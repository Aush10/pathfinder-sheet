export const TAP_TEST_STEPS = [
  { id: 'identity', label: 'Name, race, and alignment', category: 'coreIdentity', values: ['name', 'race', 'alignment'], fields: [] },
  { id: 'class', label: 'Class and starting level', category: 'coreIdentity', values: ['className', 'level', 'hitDie', 'archetype'], fields: ['className', 'level', 'hitDie', 'archetype', 'classMode'] },
  { id: 'abilities', label: 'Ability scores', category: 'abilities', values: [], fields: ['scores', 'random', 'budget'] },
  { id: 'hp', label: 'Hit points', category: 'hp', values: ['hpCurrent', 'hpTotalMax', 'hpTemp'], fields: [] },
  { id: 'skills', label: 'One skill', category: 'skills', values: [], fields: ['skill', 'isClassSkill', 'ranks', 'miscMod'] },
  { id: 'feats', label: 'One feat', category: 'feats', values: [], fields: ['add'] },
  { id: 'attacks', label: 'One weapon', category: 'attacksAndWeapons', values: [], fields: ['add'] },
  { id: 'armor', label: 'One armor item', category: 'armorAndGear', values: [], fields: ['add'] },
  { id: 'inventory', label: 'One inventory item', category: 'inventory', values: [], fields: ['add'] },
  { id: 'biography', label: 'A short description and personality', category: 'bioAndProfile', values: ['description', 'personality'], fields: [] },
] as const;

export interface TapTestTurn {
  step: number;
  budget: number;
}

export function isTapTestCommand(text: string): boolean {
  return text.trim().toLowerCase() === 'tap test';
}

export function getTapTestStep(index: number) {
  return Number.isInteger(index) && index >= 0 ? TAP_TEST_STEPS[index] : undefined;
}

export function buildTapTestTurnInstruction(step: number, budget: number): string {
  const current = getTapTestStep(step);
  if (!current || !Number.isInteger(budget) || budget < 0 || budget > 100) return '';
  return `TAP TEST — STEP ${step + 1} OF ${TAP_TEST_STEPS.length}: ${current.label}
The player explicitly requested a random character through the "tap test" command.
Simulate receiving just this small piece of character information now, then applying it.
Choose one coherent random character and keep prior name, race, class, and choices consistent.
Only populate this step: category "${current.category}". Return at most one sheetUpdates object.
Allowed top-level write fields: ${current.fields.join(', ') || 'none'}.
Allowed scalar keys inside values: ${current.values.join(', ') || 'none'}.
Each add must be a single row object, never a list. Do not clear or reset existing collections.
Use a starting level of 1 for the class step. Choose a class supported by loaded SOT documents.
The ability-score step uses a random ${budget}-point buy (the current test budget); emit random: true and budget: ${budget}. Do not roll or change abilities on any other step.
Invent names and flavor freely, but source all mechanics from loaded SOT. If a needed source is missing, return missingSotRequest and pause rather than fabricate a rule.
Keep existing field permissions. Return fieldUpdates: [] and explain only the small change made this turn.
Do not fill future steps or outline a whole completed character in this response.`;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Enforce the same small write boundary even if the model returns a full sheet. */
export function filterTapTestUpdates(updates: unknown, step: number): unknown[] {
  const current = getTapTestStep(step);
  if (!current || !Array.isArray(updates)) return [];
  for (const update of updates) {
    if (!record(update) || update.category !== current.category) continue;
    const filtered: Record<string, unknown> = { category: current.category };
    for (const field of current.fields) {
      if (field === 'add') {
        if (record(update.add)) filtered.add = update.add;
      } else if (update[field] !== undefined) {
        filtered[field] = update[field];
      }
    }
    if (record(update.values)) {
      const values: Record<string, unknown> = {};
      for (const key of current.values) {
        if (update.values[key] !== undefined) values[key] = update.values[key];
      }
      if (Object.keys(values).length) filtered.values = values;
    }
    if (Object.keys(filtered).length > 1) return [filtered];
  }
  return [];
}
