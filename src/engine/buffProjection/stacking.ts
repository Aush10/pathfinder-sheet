/**
 * Pathfinder 1e Bonus Stacking Resolver
 * =====================================
 *
 * Core rule (CRB "Bonus Types"): two bonuses of the same type do not stack —
 * the higher one applies. Bonuses of different types always stack. Untyped
 * bonuses stack with everything, dodge bonuses stack with each other, and
 * penalties always stack regardless of type.
 *
 * This module turns the flat Buff Box matrix plus the active custom buff list
 * into one projection that the combat math can consume without re-deciding
 * any of that.
 */

import type {
  BuffBonusType,
  BuffBoxData,
  BuffStatTarget,
  CustomBuffEffect,
} from '../../types/character';
import {
  BUFF_STAT_TARGET_ORDER,
  type BuffContribution,
  type BuffProjection,
  type BuffStatProjection,
} from './types';

/**
 * Types that are exempt from the "same type does not stack" rule.
 * Untyped bonuses explicitly stack; dodge bonuses stack with one another.
 */
const STACKING_EXEMPT_BONUS_TYPES: readonly BuffBonusType[] = ['Untyped', 'Dodge'];

export function bonusTypeStacks(bonusType: BuffBonusType): boolean {
  return STACKING_EXEMPT_BONUS_TYPES.includes(bonusType);
}

function emptyStatRecord(): Record<BuffStatTarget, number> {
  const record = {} as Record<BuffStatTarget, number>;
  for (const stat of BUFF_STAT_TARGET_ORDER) record[stat] = 0;
  return record;
}

function collectMatrixContributions(buffBox?: BuffBoxData): BuffContribution[] {
  if (!buffBox) return [];
  const contributions: BuffContribution[] = [];

  for (const bonusType of Object.keys(buffBox) as BuffBonusType[]) {
    const row = buffBox[bonusType];
    if (!row) continue;

    for (const stat of BUFF_STAT_TARGET_ORDER) {
      const value = Number(row[stat]) || 0;
      if (value === 0) continue;

      contributions.push({
        key: `matrix:${bonusType}:${stat}`,
        source: `${bonusType} bonus`,
        sourceKind: 'matrix',
        stat,
        bonusType,
        value,
        isPenalty: value < 0,
        stacks: true,
        applied: 0,
      });
    }
  }

  return contributions;
}

function collectCustomContributions(customBuffs?: CustomBuffEffect[]): BuffContribution[] {
  if (!customBuffs || !Array.isArray(customBuffs)) return [];
  const contributions: BuffContribution[] = [];

  for (const buff of customBuffs) {
    if (!buff.isActive || !buff.values) continue;

    for (const stat of BUFF_STAT_TARGET_ORDER) {
      const value = Number(buff.values[stat]) || 0;
      if (value === 0) continue;

      contributions.push({
        key: `${buff.id}:${stat}`,
        source: buff.name,
        sourceKind: 'custom',
        stat,
        bonusType: buff.bonusType,
        value,
        isPenalty: value < 0,
        stacks: true,
        applied: 0,
      });
    }
  }

  return contributions;
}

/**
 * Resolves which bonus of each type actually applies for one stat.
 *
 * Penalties stack unconditionally. Bonuses stack when their type is exempt,
 * otherwise only the largest of each type survives and the rest are marked
 * as suppressed so the UI can explain the difference.
 */
function resolveStatContributions(
  stat: BuffStatTarget,
  contributions: BuffContribution[]
): BuffStatProjection {
  const penalties = contributions.filter((c) => c.isPenalty);
  const bonuses = contributions.filter((c) => !c.isPenalty);

  for (const penalty of penalties) {
    penalty.stacks = true;
    penalty.applied = penalty.value;
  }

  const survivorsByType = new Map<BuffBonusType, BuffContribution>();

  for (const bonus of bonuses) {
    if (bonusTypeStacks(bonus.bonusType)) {
      bonus.stacks = true;
      bonus.applied = bonus.value;
      continue;
    }

    const incumbent = survivorsByType.get(bonus.bonusType);
    if (!incumbent) {
      survivorsByType.set(bonus.bonusType, bonus);
      bonus.stacks = true;
      bonus.applied = bonus.value;
      continue;
    }

    // Same non-stacking type: keep the larger bonus, suppress the smaller.
    const winner = incumbent.value >= bonus.value ? incumbent : bonus;
    const loser = winner === incumbent ? bonus : incumbent;

    winner.stacks = true;
    winner.applied = winner.value;

    loser.stacks = false;
    loser.applied = 0;
    loser.suppressedBy = `${winner.bonusType} bonus from ${winner.source} (${winner.value >= 0 ? '+' : ''}${winner.value})`;

    survivorsByType.set(bonus.bonusType, winner);
  }

  const total = contributions.reduce((sum, c) => sum + c.applied, 0);
  const naive = contributions.reduce((sum, c) => sum + c.value, 0);
  const suppressedCount = contributions.filter((c) => !c.stacks).length;

  return {
    stat,
    total,
    contributions: contributions.sort((a, b) => b.value - a.value),
    suppressedCount,
    hasStackingConflict: total !== naive,
  };
}

/**
 * Builds the full buff projection: per-stat totals plus the audit trail of
 * which contribution applied and which was withheld by stacking rules.
 */
export function resolveBuffProjection(
  buffBox?: BuffBoxData,
  customBuffs?: CustomBuffEffect[]
): BuffProjection {
  const allContributions = [
    ...collectMatrixContributions(buffBox),
    ...collectCustomContributions(customBuffs),
  ];

  const totals = emptyStatRecord();
  const naiveTotals = emptyStatRecord();
  const byStat = {} as Record<BuffStatTarget, BuffStatProjection>;

  for (const stat of BUFF_STAT_TARGET_ORDER) {
    const statContributions = allContributions.filter((c) => c.stat === stat);
    const projection = resolveStatContributions(stat, statContributions);

    byStat[stat] = projection;
    totals[stat] = projection.total;
    naiveTotals[stat] = statContributions.reduce((sum, c) => sum + c.value, 0);
  }

  return {
    totals,
    byStat,
    contributions: allContributions,
    suppressed: allContributions.filter((c) => !c.stacks),
    naiveTotals,
  };
}

/**
 * Convenience wrapper returning only the resolved totals. This is the shape
 * the combat math needs and mirrors the legacy `computeBuffBoxTotals` result.
 */
export function computeStackedBuffTotals(
  buffBox?: BuffBoxData,
  customBuffs?: CustomBuffEffect[]
): Record<BuffStatTarget, number> {
  return resolveBuffProjection(buffBox, customBuffs).totals;
}

/**
 * Human-readable summary of a single stat's sources, e.g.
 * "AC 24 from Armor +5, Dodge +1, Heroism +2 (Bardic Inspiration +2 suppressed)".
 */
export function describeStatProjection(projection: BuffStatProjection): string {
  if (projection.contributions.length === 0) return 'No active modifiers';

  const applied = projection.contributions
    .filter((c) => c.stacks)
    .map((c) => `${c.source} ${c.value >= 0 ? '+' : ''}${c.value}`);

  const withheld = projection.contributions
    .filter((c) => !c.stacks)
    .map((c) => `${c.source} ${c.value >= 0 ? '+' : ''}${c.value}`);

  const appliedText = applied.length > 0 ? applied.join(', ') : 'nothing';
  const withheldText =
    withheld.length > 0 ? ` (suppressed: ${withheld.join(', ')})` : '';

  return `${appliedText}${withheldText}`;
}
