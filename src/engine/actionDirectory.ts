import type {
  ActionDirectoryEntryType,
  ActionDirectoryTab,
  CharacterActionItem,
  CustomClassGrid,
  PF1Character,
  ResourceTracker,
} from '../types/character';
import type { DerivedCombatStats } from './pf1eMath';
import type { CalculatedCareerResult } from './multiclassCalculator';
import { buildFormulaContext, evaluateFormula } from './formula';
import { executeMacaroni } from './macaroni';
import type { MacaroniExecutionResult } from './macaroni/types';

export const DEFAULT_ABILITY_TYPES = ['Racial', 'Class Feature'] as const;

export interface ResourceColorOption {
  id: string;
  label: string;
  hex: string;
  barClass: string;
  pillClass: string;
}

export const RESOURCE_BAR_COLORS: ResourceColorOption[] = [
  {
    id: 'amber',
    label: 'Amber',
    hex: '#f59e0b',
    barClass: 'bg-amber-500',
    pillClass: 'border-amber-500/50 text-amber-400',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    hex: '#10b981',
    barClass: 'bg-emerald-500',
    pillClass: 'border-emerald-500/50 text-emerald-400',
  },
  {
    id: 'cyan',
    label: 'Cyan',
    hex: '#06b6d4',
    barClass: 'bg-cyan-500',
    pillClass: 'border-cyan-500/50 text-cyan-400',
  },
  {
    id: 'rose',
    label: 'Crimson',
    hex: '#f43f5e',
    barClass: 'bg-rose-500',
    pillClass: 'border-rose-500/50 text-rose-400',
  },
  {
    id: 'purple',
    label: 'Arcane',
    hex: '#a855f7',
    barClass: 'bg-purple-500',
    pillClass: 'border-purple-500/50 text-purple-400',
  },
  {
    id: 'indigo',
    label: 'Cobalt',
    hex: '#6366f1',
    barClass: 'bg-indigo-500',
    pillClass: 'border-indigo-500/50 text-indigo-400',
  },
  {
    id: 'orange',
    label: 'Flame',
    hex: '#f97316',
    barClass: 'bg-orange-500',
    pillClass: 'border-orange-500/50 text-orange-400',
  },
  {
    id: 'sky',
    label: 'Sky',
    hex: '#0ea5e9',
    barClass: 'bg-sky-500',
    pillClass: 'border-sky-500/50 text-sky-400',
  },
];

export interface SearchableMacroResult {
  id: string;
  name: string;
  key: string;
  formula: string;
  description: string;
  source: 'DSL Studio' | 'XDX Macro' | 'Core Macro';
  suggestedType: 'ability' | 'resource' | 'counter';
}

const CORE_SEARCHABLE_MACROS: SearchableMacroResult[] = [
  { id: 'core-hp', name: 'Hit Points (#HP)', key: 'HP', formula: '<<#HP', description: 'Current Hit Points', source: 'Core Macro', suggestedType: 'counter' },
  { id: 'core-hdmath', name: 'Hit Die Math (#HDmath)', key: 'HDMATH', formula: '<<[[#HDmath+#CON]+#hdbonus+#bhp]', description: 'Calculated Max HD HP breakdown', source: 'Core Macro', suggestedType: 'counter' },
  { id: 'core-init', name: 'Initiative Roll (#INIT)', key: 'INIT', formula: '[1d20+#INIT]', description: 'Roll Initiative check', source: 'Core Macro', suggestedType: 'ability' },
  { id: 'core-mattack', name: 'Melee Attack (#MATTACK)', key: 'MATTACK', formula: '[1d20+#MATTACK]', description: 'Standard melee attack roll', source: 'Core Macro', suggestedType: 'ability' },
  { id: 'core-rattack', name: 'Ranged Attack (#RATTACK)', key: 'RATTACK', formula: '[1d20+#RATTACK]', description: 'Standard ranged attack roll', source: 'Core Macro', suggestedType: 'ability' },
  { id: 'core-fort', name: 'Fortitude Save (#FORT)', key: 'FORT', formula: '[1d20+#FORT]', description: 'Fortitude saving throw', source: 'Core Macro', suggestedType: 'ability' },
  { id: 'core-ref', name: 'Reflex Save (#REF)', key: 'REF', formula: '[1d20+#REF]', description: 'Reflex saving throw', source: 'Core Macro', suggestedType: 'ability' },
  { id: 'core-will', name: 'Will Save (#WILL)', key: 'WILL', formula: '[1d20+#WILL]', description: 'Will saving throw', source: 'Core Macro', suggestedType: 'ability' },
  { id: 'core-cmb', name: 'Combat Maneuver (#CMB)', key: 'CMB', formula: '[1d20+#CMB]', description: 'Combat Maneuver Bonus check', source: 'Core Macro', suggestedType: 'ability' },
  { id: 'core-cmd', name: 'Command Defense (#CMD)', key: 'CMD', formula: '<<#CMD', description: 'Combat Maneuver Defense score', source: 'Core Macro', suggestedType: 'counter' },
  { id: 'core-bab', name: 'Base Attack Bonus (#BAB)', key: 'BAB', formula: '<<#BAB', description: 'Current Base Attack Bonus', source: 'Core Macro', suggestedType: 'counter' },
  { id: 'core-level', name: 'Character Level (#LEVEL)', key: 'LEVEL', formula: '<<#LEVEL', description: 'Current character level', source: 'Core Macro', suggestedType: 'counter' },
];

export function resolveResourceColor(color?: string): ResourceColorOption {
  if (!color) return RESOURCE_BAR_COLORS[0];
  const byId = RESOURCE_BAR_COLORS.find((c) => c.id === color.toLowerCase());
  if (byId) return byId;
  const byHex = RESOURCE_BAR_COLORS.find((c) => c.hex.toLowerCase() === color.toLowerCase());
  if (byHex) return byHex;
  return {
    id: color,
    label: color,
    hex: color.startsWith('#') ? color : '#f59e0b',
    barClass: '',
    pillClass: 'border-amber-500/50 text-amber-300',
  };
}

/**
 * Infers the entry format for backwards compatibility with older saved characters.
 */
export function resolveActionEntryType(item: Partial<CharacterActionItem>): ActionDirectoryEntryType {
  if (
    item.entryType === 'resource' ||
    item.entryType === 'ability' ||
    item.entryType === 'spell' ||
    item.entryType === 'counter' ||
    item.entryType === 'alt'
  ) {
    return item.entryType;
  }
  if (item.parentActionId) return 'alt';
  if (item.totalCountMacro !== undefined && item.totalCountMacro !== '') return 'counter';
  if (item.category === 'Spells' || typeof item.spellLevel === 'number') return 'spell';
  if (
    item.hasResourcePool ||
    item.category === 'Class Resource' ||
    item.category === 'Resource Pool' ||
    Boolean(item.stepperMacro)
  ) {
    return 'resource';
  }
  return 'ability';
}

export function isAltEligibleEntry(item: Partial<CharacterActionItem>): boolean {
  const type = resolveActionEntryType(item);
  return type === 'ability' || type === 'spell';
}

export function getAltsForEntry(
  entries: CharacterActionItem[],
  parentId: string
): CharacterActionItem[] {
  return entries.filter(
    (entry) => resolveActionEntryType(entry) === 'alt' && entry.parentActionId === parentId
  );
}

/**
 * Unifies `characterActions` and legacy standalone `resourceTrackers` into one list
 * without losing newly added format fields or creating duplicate entries.
 */
export function normalizeDirectoryEntries(
  actions?: CharacterActionItem[],
  trackers?: ResourceTracker[]
): CharacterActionItem[] {
  const baseActions = [...(actions || [])];
  const resourceList = trackers || [];

  const merged = baseActions.map((act) => {
    const entryType = resolveActionEntryType(act);
    if (entryType !== 'resource') {
      return {
        ...act,
        entryType,
      };
    }

    const matchedTracker = resourceList.find(
      (r) =>
        (act.linkedResourceId && r.id === act.linkedResourceId) ||
        (act.macroKey && r.macroKey && act.macroKey.toUpperCase() === r.macroKey.toUpperCase()) ||
        r.name.toLowerCase().replace(/[^a-z0-9]/g, '') ===
          act.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    );

    if (matchedTracker) {
      return {
        ...act,
        entryType: 'resource' as const,
        hasResourcePool: true,
        resourceCurrent: matchedTracker.current,
        resourceMax: matchedTracker.max,
        macroKey: act.macroKey || matchedTracker.macroKey,
        linkedResourceId: matchedTracker.id,
      };
    }

    return {
      ...act,
      entryType: 'resource' as const,
      hasResourcePool: true,
    };
  });

  resourceList.forEach((r) => {
    const alreadyInActions = merged.some(
      (act) =>
        act.linkedResourceId === r.id ||
        act.id === r.id ||
        (act.macroKey && r.macroKey && act.macroKey.toUpperCase() === r.macroKey.toUpperCase()) ||
        r.name.toLowerCase().replace(/[^a-z0-9]/g, '') ===
          act.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    if (!alreadyInActions) {
      const isSpellTracker = r.category === 'Spell Slot';
      merged.push({
        id: r.id,
        name: r.name,
        entryType: 'resource',
        category: isSpellTracker
          ? 'Spells'
          : r.category === 'Resource Pool'
          ? 'Resource Pool'
          : 'Class Resource',
        actionType: 'Passive / Pool',
        macroKey: r.macroKey || r.name.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
        icon: isSpellTracker ? 'book' : 'zap',
        description: r.notes || `Class resource / daily pool (${r.current}/${r.max} uses remaining).`,
        shortSummary: r.notes || `${r.category || 'Class Resource'} pool (${r.current}/${r.max})`,
        hasResourcePool: true,
        resourceCurrent: r.current,
        resourceMax: r.max,
        linkedResourceId: r.id,
        color: 'amber',
      });
    }
  });

  return merged;
}

/**
 * Evaluates a macro expression (DC, counter total, resource cap) safely against character state.
 */
export function evaluateDirectoryMacroValue(
  expr: string | undefined,
  character: PF1Character,
  derived?: DerivedCombatStats,
  stepCount?: number,
  options?: {
    stepperStore?: Record<string, number>;
    stepperScopeId?: string;
  }
): { display: string; numeric: number | null; rollable: boolean } {
  const raw = (expr || '').trim();
  if (!raw) return { display: '', numeric: null, rollable: false };

  // Strip optional leading << display flag so <<5+5 or <<#LEVEL evaluates cleanly
  const normalizedExpr = raw.startsWith('<<') ? raw.slice(2).trim() : raw;
  if (!normalizedExpr) return { display: '', numeric: null, rollable: false };

  const context = buildFormulaContext(
    character,
    { strPenalty: 0, dexPenalty: 0, attackPenalty: 0 },
    derived
  );

  // If plain numeric literal
  if (/^[+-]?\d+(\.\d+)?$/.test(normalizedExpr)) {
    const n = Number(normalizedExpr);
    return { display: String(n), numeric: n, rollable: false };
  }

  // Try Macaroni if expression uses Macaroni 1.2 sigils/operators (!, |, <^, <>, <?>, <!>, >target<)
  const hasV12Sigil = /^(?:<<|==|<>|<\?>|<\^>|<!>|>[a-zA-Z0-9_{}]+\s*<[+\-*/=])/.test(raw);
  if (hasV12Sigil || /[!|<>^]/.test(normalizedExpr)) {
    const macaroniExpr = hasV12Sigil ? raw : `<<${normalizedExpr}`;
    const mac = executeMacaroni(macaroniExpr, {
      character,
      formulaContext: context,
      stepCount,
      stepperStore: options?.stepperStore,
      stepperScopeId: options?.stepperScopeId,
    });
    if (!mac.isError) {
      const out = mac.fullOutput.trim();
      const numMatch = out.match(/^-?\d+(\.\d+)?$/);
      return {
        display: mac.isNoOp ? '' : (out || normalizedExpr),
        numeric: numMatch ? Number(numMatch[0]) : null,
        rollable: mac.rollable,
      };
    }
  }

  const evalRes = evaluateFormula(normalizedExpr, context);
  const out = (evalRes.evaluated || '').trim();
  if (!evalRes.isError && out !== '') {
    const numMatch = out.match(/^-?\d+(\.\d+)?$/);
    return {
      display: out,
      numeric: numMatch ? Number(numMatch[0]) : null,
      rollable: Boolean(evalRes.rollable),
    };
  }

  return { display: raw, numeric: null, rollable: /d\d+/i.test(raw) };
}

/**
 * Evaluates a Counter entry for read-only display without mutating `!` stepper state.
 * Counters that include `!` reflect their persisted `macaroniStepperStore` step (defaulting to 0 pre-click).
 */
export function evaluateCounterDisplayValue(
  entry: CharacterActionItem,
  character: PF1Character,
  derived?: DerivedCombatStats
): { display: string; numeric: number | null; rollable: boolean; currentStep: number; hasBang: boolean } {
  const raw = (entry.totalCountMacro || '').trim();
  if (!raw.includes('!')) {
    const base = evaluateDirectoryMacroValue(raw, character, derived);
    return { ...base, currentStep: 0, hasBang: false };
  }

  const scopeId = `counter-${entry.id}`;
  const persisted = character.macaroniStepperStore || {};
  const scopePrefix = `${scopeId}::`;
  let maxStep = 0;
  const peekStore: Record<string, number> = {};
  for (const [key, val] of Object.entries(persisted)) {
    if (key.startsWith(scopePrefix) && typeof val === 'number' && Number.isFinite(val)) {
      maxStep = Math.max(maxStep, val);
      peekStore[key] = Math.max(0, Math.floor(val) - 1);
    }
  }

  if (maxStep <= 0) {
    return {
      display: '0',
      numeric: 0,
      rollable: false,
      currentStep: 0,
      hasBang: true,
    };
  }

  const evalAtCurrent = evaluateDirectoryMacroValue(raw, character, derived, maxStep, {
    stepperStore: peekStore,
    stepperScopeId: scopeId,
  });
  return {
    ...evalAtCurrent,
    currentStep: maxStep,
    hasBang: true,
  };
}

/**
 * Executes a Counter entry's `!` stepper macro against a cloned stepperStore and returns
 * the full MacaroniExecutionResult so callers can project persisted snapshots via `projectMacaroniResult`.
 */
export function stepCounterBangAction(
  entry: CharacterActionItem,
  character: PF1Character,
  derived?: DerivedCombatStats
): {
  display: string;
  numeric: number | null;
  currentStep: number;
  macaroniResult: MacaroniExecutionResult;
  feedback: string;
} {
  const raw = (entry.totalCountMacro || '0').trim() || '0';
  const hasV12Sigil = /^(?:<<|==|<>|<\?>|<\^>|<!>|>[a-zA-Z0-9_{}]+\s*<[+\-*/=])/.test(raw);
  const macaroniExpr = hasV12Sigil ? raw : `<<${raw}`;
  const scopeId = `counter-${entry.id}`;
  const storeCopy: Record<string, number> = { ...(character.macaroniStepperStore || {}) };
  const prevStep = storeCopy[`${scopeId}::bang-1`] || 0;
  const context = buildFormulaContext(
    character,
    { strPenalty: 0, dexPenalty: 0, attackPenalty: 0 },
    derived
  );
  context.step = prevStep + 1;

  const mac = executeMacaroni(macaroniExpr, {
    character,
    formulaContext: context,
    stepCount: prevStep + 1,
    stepperStore: storeCopy,
    stepperScopeId: scopeId,
  });

  const currentStep = mac.stepperSnapshots?.[0]?.step ?? prevStep + 1;
  const out = mac.fullOutput.trim();
  const numMatch = out.match(/^-?\d+(\.\d+)?$/);
  return {
    display: mac.isError ? 'Err' : out || String(currentStep),
    numeric: numMatch ? Number(numMatch[0]) : null,
    currentStep,
    macaroniResult: mac,
    feedback: mac.isError
      ? `${entry.name}: ${mac.errorMessage || 'Stepper error'}`
      : `${entry.name} (step #${currentStep}): ${out || String(currentStep)}`,
  };
}

/**
 * Runs a Resource Bar's stepper macro to compute its next current value and step count.
 */
export function stepResourceBarValue(
  entry: CharacterActionItem,
  character: PF1Character,
  derived?: DerivedCombatStats,
  options?: {
    stepperScopeId?: string;
    stepperStore?: Record<string, number>;
  }
): {
  nextCurrent: number;
  nextMax: number;
  nextStepCount: number;
  feedback: string;
  macaroniResult?: MacaroniExecutionResult;
} {
  const maxVal = Math.max(
    1,
    (() => {
      if (entry.macroFormula) {
        const evalMax = evaluateDirectoryMacroValue(entry.macroFormula, character, derived);
        if (evalMax.numeric !== null && evalMax.numeric >= 1) {
          return Math.round(evalMax.numeric);
        }
      }
      return entry.resourceMax ?? 1;
    })()
  );

  const curVal = Math.max(0, Math.min(maxVal, entry.resourceCurrent ?? maxVal));
  const defaultSpellDigits =
    entry.id.startsWith('spell-slot-action-') || entry.id.startsWith('spell-slot-level-')
      ? entry.id.replace(/\D+/g, '')
      : '';
  const scopeId =
    options?.stepperScopeId ||
    (defaultSpellDigits ? `spell-slot-${defaultSpellDigits}` : `resource-${entry.id}`);
  const bang1Key = `${scopeId}::bang-1`;
  const storeCopy: Record<string, number> = {
    ...(character.macaroniStepperStore || {}),
    ...(options?.stepperStore || {}),
  };
  if (storeCopy[bang1Key] === undefined && typeof entry.stepperStepCount === 'number' && entry.stepperStepCount > 0) {
    storeCopy[bang1Key] = entry.stepperStepCount;
  }

  const prevStepCount = storeCopy[bang1Key] ?? entry.stepperStepCount ?? 0;
  const nextStepCount = prevStepCount + 1;
  const rawStepper = (entry.stepperMacro || '').trim();

  // Default stepper when none is specified: spend 1 use
  if (!rawStepper) {
    const nextCurrent = Math.max(0, curVal - 1);
    return {
      nextCurrent,
      nextMax: maxVal,
      nextStepCount,
      feedback: `${entry.name}: ${curVal} -> ${nextCurrent}/${maxVal}`,
    };
  }

  // Simple signed delta such as "-1", "+1", "-2"
  const deltaOnlyMatch = rawStepper.match(/^([+-]\s*\d+)$/);
  if (deltaOnlyMatch) {
    const delta = parseInt(deltaOnlyMatch[1].replace(/\s+/g, ''), 10) || -1;
    const nextCurrent = Math.max(0, Math.min(maxVal, curVal + delta));
    return {
      nextCurrent,
      nextMax: maxVal,
      nextStepCount,
      feedback: `${entry.name} (${rawStepper}): ${nextCurrent}/${maxVal}`,
    };
  }

  // Evaluate via Macaroni with stateful stepperStore & stepperScopeId first
  const cleanStepper = rawStepper.startsWith('<<') ? rawStepper.slice(2).trim() : rawStepper;
  const context = buildFormulaContext(
    character,
    { strPenalty: 0, dexPenalty: 0, attackPenalty: 0 },
    derived
  );
  context.current = curVal;
  context.cur = curVal;
  context.max = maxVal;
  context.this = curVal;
  context.step = nextStepCount;

  const stepperExpr = /^(?:<<|==|<>|<\?>|<\^>|<!>|>[a-zA-Z0-9_{}]+\s*<[+\-*/=])/.test(rawStepper)
    ? rawStepper
    : `<<${cleanStepper}`;
  const mac = executeMacaroni(stepperExpr, {
    character,
    formulaContext: context,
    thisValue: curVal,
    stepCount: nextStepCount,
    stepperStore: storeCopy,
    stepperScopeId: scopeId,
  });

  const numFromMac = mac.fullOutput.match(/-?\d+/);
  if (!mac.isError && numFromMac) {
    const resolvedStep =
      mac.stepperSnapshots?.[mac.stepperSnapshots.length - 1]?.step ?? nextStepCount;
    const nextCurrent = Math.max(0, Math.min(maxVal, parseInt(numFromMac[0], 10)));
    return {
      nextCurrent,
      nextMax: maxVal,
      nextStepCount: resolvedStep,
      feedback: `${entry.name}${rawStepper.includes('!') ? ` (step #${resolvedStep})` : ''}: ${nextCurrent}/${maxVal}`,
      macaroniResult: mac,
    };
  }

  // Shorthand ! fallback (e.g. legacy "10-1!" notation), still tracking bang step snapshot
  const bangStepMatch = cleanStepper.match(/(\d+)\s*([+-])\s*(?:!\s*\*?\s*(\d*)|(\d+)\s*!)/);
  if (bangStepMatch) {
    const base = parseInt(bangStepMatch[1], 10);
    const op = bangStepMatch[2];
    const mult = parseInt(bangStepMatch[3] || bangStepMatch[4] || '1', 10) || 1;
    const computed = op === '-' ? base - mult * nextStepCount : base + mult * nextStepCount;
    const nextCurrent = Math.max(0, Math.min(maxVal, computed));
    return {
      nextCurrent,
      nextMax: maxVal,
      nextStepCount,
      feedback: `${entry.name} (step #${nextStepCount}): ${nextCurrent}/${maxVal}`,
      macaroniResult: {
        raw: stepperExpr,
        fullOutput: String(nextCurrent),
        slots: [],
        isError: false,
        tokens: [],
        rollable: false,
        stepperSnapshots: [{ bangId: bang1Key, step: nextStepCount }],
      },
    };
  }

  const evalRes = evaluateFormula(cleanStepper, context);
  const numFromEval = evalRes.evaluated.match(/-?\d+/);
  if (!evalRes.isError && numFromEval) {
    const nextCurrent = Math.max(0, Math.min(maxVal, parseInt(numFromEval[0], 10)));
    return {
      nextCurrent,
      nextMax: maxVal,
      nextStepCount,
      feedback: `${entry.name}: ${nextCurrent}/${maxVal}`,
    };
  }

  // Safe fallback: decrement by 1
  const nextCurrent = Math.max(0, curVal - 1);
  return {
    nextCurrent,
    nextMax: maxVal,
    nextStepCount,
    feedback: `${entry.name}: ${nextCurrent}/${maxVal}`,
  };
}

/**
 * Filters directory entries for display:
 * - Alts are hidden from default results, but appear when searching.
 * - Optional custom tab restricts non-search view to tab's assigned entry IDs.
 */
export function filterDirectoryEntries(
  entries: CharacterActionItem[],
  options: {
    search?: string;
    activeTab?: ActionDirectoryTab | null;
  }
): CharacterActionItem[] {
  const q = (options.search || '').trim().toLowerCase();
  const entryById = new Map(entries.map((e) => [e.id, e]));

  if (!q) {
    const visibleBase = entries.filter((e) => resolveActionEntryType(e) !== 'alt');
    if (options.activeTab) {
      const idSet = new Set(options.activeTab.entryIds);
      return visibleBase.filter((e) => idSet.has(e.id));
    }
    return visibleBase;
  }

  return entries.filter((entry) => {
    const type = resolveActionEntryType(entry);
    const parent =
      type === 'alt' && entry.parentActionId ? entryById.get(entry.parentActionId) : undefined;
    const haystack = [
      entry.name,
      entry.description,
      entry.macroKey,
      entry.macroFormula,
      entry.totalCountMacro,
      entry.stepperMacro,
      entry.abilityType,
      entry.saveDC,
      entry.actionType,
      entry.sourceClassName,
      parent?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesQuery = haystack.includes(q);
    if (!matchesQuery) return false;

    if (options.activeTab) {
      const idSet = new Set(options.activeTab.entryIds);
      if (type === 'alt' && entry.parentActionId) {
        return idSet.has(entry.id) || idSet.has(entry.parentActionId);
      }
      return idSet.has(entry.id);
    }

    return true;
  });
}

/**
 * Searches saved DSL custom objects, XDX macros, and core sheet macro keys.
 */
export function searchCharacterMacros(
  character: PF1Character,
  query: string
): SearchableMacroResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchableMacroResult[] = [];
  const seenKeys = new Set<string>();

  for (const obj of character.customObjects || []) {
    const key = obj.name.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
    const hay = `${obj.name} ${obj.formula} ${obj.description}`.toLowerCase();
    if (hay.includes(q)) {
      seenKeys.add(key);
      results.push({
        id: `dsl-${obj.id}`,
        name: obj.name,
        key,
        formula: obj.formula,
        description: obj.description || 'Custom DSL macro',
        source: 'DSL Studio',
        suggestedType: obj.category === 'step' ? 'resource' : 'ability',
      });
    }
  }

  for (const xdx of character.xdxMacros || []) {
    const key = xdx.name.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
    const hay = `${xdx.name} ${xdx.formula} ${xdx.description || ''}`.toLowerCase();
    if (hay.includes(q) && !seenKeys.has(key)) {
      seenKeys.add(key);
      results.push({
        id: `xdx-${xdx.id}`,
        name: xdx.name,
        key,
        formula: xdx.formula,
        description: xdx.description || 'XDX saved macro',
        source: 'XDX Macro',
        suggestedType: 'ability',
      });
    }
  }

  for (const core of CORE_SEARCHABLE_MACROS) {
    const hay = `${core.name} ${core.key} ${core.formula} ${core.description}`.toLowerCase();
    if (hay.includes(q) && !seenKeys.has(core.key)) {
      results.push(core);
    }
  }

  return results;
}

export function buildActionFromMacroResult(macro: SearchableMacroResult): CharacterActionItem {
  const id = `act-mac-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cleanKey = macro.key || macro.name.toUpperCase().replace(/[^A-Z0-9_]+/g, '_');

  if (macro.suggestedType === 'counter') {
    return {
      id,
      name: macro.name,
      entryType: 'counter',
      category: 'Other',
      icon: 'zap',
      macroKey: cleanKey,
      totalCountMacro: macro.formula,
      description: macro.description,
      shortSummary: `Counter: ${macro.formula}`,
    };
  }

  if (macro.suggestedType === 'resource') {
    return {
      id,
      name: macro.name,
      entryType: 'resource',
      category: 'Resource Pool',
      actionType: 'Passive / Pool',
      icon: 'zap',
      color: 'cyan',
      macroKey: cleanKey,
      macroFormula: '10',
      stepperMacro: macro.formula,
      hasResourcePool: true,
      resourceCurrent: 10,
      resourceMax: 10,
      description: macro.description,
      shortSummary: `Resource (${macro.source})`,
    };
  }

  return {
    id,
    name: macro.name,
    entryType: 'ability',
    category: 'Class Ability',
    abilityType: 'Class Feature',
    actionType: 'Standard',
    icon: 'sparkles',
    macroKey: cleanKey,
    macroFormula: macro.formula,
    description: macro.description,
    shortSummary: `${macro.source}: ${macro.formula}`,
  };
}

/**
 * Returns all directory spells flagged `isAvailable === true` for the Journal spell link list.
 */
export function getAvailableDirectorySpells(character: PF1Character): CharacterActionItem[] {
  const normalized = normalizeDirectoryEntries(
    character.characterActions,
    character.resourceTrackers
  );
  return normalized.filter(
    (entry) => resolveActionEntryType(entry) === 'spell' && entry.isAvailable === true
  );
}

/**
 * Connects class progression abilities from `calculateCareerProgression` into the
 * Action & Resource Directory without duplicating existing abilities or overwriting edits.
 */
export function syncCareerAbilitiesToDirectory(
  existingActions: CharacterActionItem[],
  careerResult: CalculatedCareerResult,
  customGrids?: Record<string, CustomClassGrid>
): CharacterActionItem[] {
  const nextActions = [...(existingActions || [])];
  const gridByName = new Map<string, CustomClassGrid>();
  Object.values(customGrids || {}).forEach((g) => {
    if (g.className) gridByName.set(g.className.trim().toLowerCase(), g);
  });

  const existingKeys = new Set<string>();
  const existingSourceNamePairs = new Set<string>();
  const existingNames = new Set<string>();

  for (const act of nextActions) {
    if (act.sourceFeatureKey) existingKeys.add(act.sourceFeatureKey.toLowerCase());
    if (act.name) {
      const cleanName = act.name.trim().toLowerCase();
      existingNames.add(cleanName);
      if (act.sourceClassName) {
        existingSourceNamePairs.add(`${act.sourceClassName.trim().toLowerCase()}::${cleanName}`);
      }
    }
  }

  let seq = 0;
  for (const lvlEntry of careerResult.levelBreakdown || []) {
    for (const rawFeature of lvlEntry.features || []) {
      const trimmed = rawFeature.trim();
      if (!trimmed || trimmed === '—' || trimmed === '-') continue;

      let sourceClassName = lvlEntry.className;
      let featureName = trimmed;
      let sourceLevel = lvlEntry.classLevel || lvlEntry.level;

      // Format 1: "[ArchName] Feature"
      const archMatch = trimmed.match(/^\[([^\]]+)\]\s*(.+)$/);
      // Format 2: "ClassName N: Feature"
      const classColonMatch = trimmed.match(/^(.+?)\s+(\d+):\s*(.+)$/);

      if (archMatch) {
        sourceClassName = archMatch[1].trim();
        featureName = archMatch[2].replace(/\s*\(replaces\s+[^)]+\)\s*$/i, '').trim();
      } else if (classColonMatch) {
        sourceClassName = classColonMatch[1].trim();
        sourceLevel = parseInt(classColonMatch[2], 10) || sourceLevel;
        featureName = classColonMatch[3].trim();
      }

      if (!featureName || featureName === '—') continue;

      const matchedGrid = gridByName.get(sourceClassName.toLowerCase());
      const sourceClassId = matchedGrid?.id;
      const normalizedFeature = featureName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const normalizedClass = sourceClassName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const sourceFeatureKey = `${normalizedClass}::${normalizedFeature}`;
      const pairKey = `${sourceClassName.toLowerCase()}::${featureName.toLowerCase()}`;

      // Deduplicate: do not re-add if already tracked from this source or with the same name
      if (
        existingKeys.has(sourceFeatureKey) ||
        existingSourceNamePairs.has(pairKey) ||
        existingNames.has(featureName.toLowerCase())
      ) {
        continue;
      }

      existingKeys.add(sourceFeatureKey);
      existingSourceNamePairs.add(pairKey);
      existingNames.add(featureName.toLowerCase());

      const macroKey = featureName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 24);

      seq += 1;
      nextActions.push({
        id: `act-cls-${normalizedClass}-${lvlEntry.level}-${seq}`,
        name: featureName,
        entryType: 'ability',
        category: 'Class Ability',
        abilityType: 'Class Feature',
        actionType: 'Standard',
        icon: 'sparkles',
        macroKey: macroKey || `CLASS_FEAT_${seq}`,
        description: `Class feature granted by ${sourceClassName} (Level ${sourceLevel}).`,
        shortSummary: `${sourceClassName} (Lvl ${sourceLevel})`,
        sourceClassId,
        sourceClassName,
        sourceFeatureKey,
        sourceLevel,
      });
    }
  }

  return nextActions;
}
