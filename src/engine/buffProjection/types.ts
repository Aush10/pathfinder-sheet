/**
 * Buff Projection Types
 * =====================
 *
 * A projection is the rules-resolved view of the Buff Box: every bonus and
 * penalty the player has switched on, reduced to the number that actually
 * reaches the sheet after Pathfinder 1e stacking rules are applied.
 *
 * The projection is data-only so sheet modules, the formula context, and the
 * printable export all read the same resolved numbers.
 */

import type { BuffBonusType, BuffStatTarget } from '../../types/character';

/** Canonical column order of the 19x19 Buff Box matrix. */
export const BUFF_STAT_TARGET_ORDER: BuffStatTarget[] = [
  'hp',
  'mattack',
  'rattack',
  'fort',
  'ref',
  'will',
  'ac',
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha',
  'str_mod',
  'dex_mod',
  'con_mod',
  'int_mod',
  'wis_mod',
  'cha_mod',
];

export type BuffSourceKind = 'matrix' | 'custom';

export interface BuffContribution {
  /** Stable key: `matrix:Morale:ac` or the custom buff id. */
  key: string;
  /** Player-facing label for the effect that supplied this number. */
  source: string;
  sourceKind: BuffSourceKind;
  stat: BuffStatTarget;
  bonusType: BuffBonusType;
  /** The raw number the player entered. Negative values are penalties. */
  value: number;
  isPenalty: boolean;
  /** False when Pathfinder stacking rules suppress this contribution. */
  stacks: boolean;
  /** The number actually added to the stat total. */
  applied: number;
  /** Why this contribution was suppressed, when it was. */
  suppressedBy?: string;
}

export interface BuffStatProjection {
  stat: BuffStatTarget;
  total: number;
  contributions: BuffContribution[];
  suppressedCount: number;
  /** True when the total differs from a naive sum, i.e. stacking changed it. */
  hasStackingConflict: boolean;
}

export interface BuffProjection {
  /** Resolved per-stat totals, ready for the combat math. */
  totals: Record<BuffStatTarget, number>;
  /** Per-stat detail including the contributions that were suppressed. */
  byStat: Record<BuffStatTarget, BuffStatProjection>;
  /** Every contribution considered, applied or not. */
  contributions: BuffContribution[];
  /** The contributions that stacking rules withheld. */
  suppressed: BuffContribution[];
  /** Sum of every contribution before stacking, used for "vs naive" UI. */
  naiveTotals: Record<BuffStatTarget, number>;
}
