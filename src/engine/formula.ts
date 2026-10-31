/**
 * Pathfinder 1e Player-Friendly Formula and Object Expression Engine
 * Supports:
 * - Built-in stats: level, bab, str_mod, dex_mod, con_mod, int_mod, wis_mod, cha_mod, ac, hp_max, etc.
 * - Dice notation: 1d6, 2d8, 3d6+5
 * - Math functions: floor, round, ceil, min, max, abs
 * - String literals: " fire", " slashing", " to hit "
 * - String concatenation: mainattack + " and " + firebreath
 * - Dynamic object recall & nested references
 * - Syntax highlighting & live dice rolling
 */

import { PF1Character } from '../types/character';

export interface EvaluatedResult {
  raw: string;
  evaluated: string;
  isError: boolean;
  errorMessage?: string;
  tokens: FormulaToken[];
  rollable?: boolean;
}

export type TokenType =
  | 'dice'
  | 'number'
  | 'operator'
  | 'function'
  | 'variable'
  | 'string'
  | 'punctuation'
  | 'text'
  | 'unknown';

export interface FormulaToken {
  type: TokenType;
  value: string;
}

/**
 * Builds an evaluation context dictionary from a PF1Character
 */
export function buildFormulaContext(
  character: PF1Character,
  activeConditionsModifier: { strPenalty: number; dexPenalty: number; attackPenalty: number },
  derivedCombatStats?: any
): Record<string, any> {
  const strScore = (character.abilities.STR.base + character.abilities.STR.raceMod + (character.abilities.STR.levelAsiMod || 0) + character.abilities.STR.enhMod + character.abilities.STR.miscMod + character.abilities.STR.tempMod) - activeConditionsModifier.strPenalty;
  const dexScore = (character.abilities.DEX.base + character.abilities.DEX.raceMod + (character.abilities.DEX.levelAsiMod || 0) + character.abilities.DEX.enhMod + character.abilities.DEX.miscMod + character.abilities.DEX.tempMod) - activeConditionsModifier.dexPenalty;
  const conScore = character.abilities.CON.base + character.abilities.CON.raceMod + (character.abilities.CON.levelAsiMod || 0) + character.abilities.CON.enhMod + character.abilities.CON.miscMod + character.abilities.CON.tempMod;
  const intScore = character.abilities.INT.base + character.abilities.INT.raceMod + (character.abilities.INT.levelAsiMod || 0) + character.abilities.INT.enhMod + character.abilities.INT.miscMod + character.abilities.INT.tempMod;
  const wisScore = character.abilities.WIS.base + character.abilities.WIS.raceMod + (character.abilities.WIS.levelAsiMod || 0) + character.abilities.WIS.enhMod + character.abilities.WIS.miscMod + character.abilities.WIS.tempMod;
  const chaScore = character.abilities.CHA.base + character.abilities.CHA.raceMod + (character.abilities.CHA.levelAsiMod || 0) + character.abilities.CHA.enhMod + character.abilities.CHA.miscMod + character.abilities.CHA.tempMod;

  const str_mod = Math.floor((strScore - 10) / 2);
  const dex_mod = Math.floor((dexScore - 10) / 2);
  const con_mod = Math.floor((conScore - 10) / 2);
  const int_mod = Math.floor((intScore - 10) / 2);
  const wis_mod = Math.floor((wisScore - 10) / 2);
  const cha_mod = Math.floor((chaScore - 10) / 2);

  const context: Record<string, any> = {
    // Standard variables
    level: character.level,
    bab: character.baseAttackBonus,
    str: strScore,
    dex: dexScore,
    con: conScore,
    int: intScore,
    wis: wisScore,
    cha: chaScore,
    strength: strScore,
    dexterity: dexScore,
    constitution: conScore,
    intelligence: intScore,
    wisdom: wisScore,
    charisma: chaScore,
    str_mod,
    dex_mod,
    con_mod,
    int_mod,
    wis_mod,
    cha_mod,
    strmod: str_mod,
    dexmod: dex_mod,
    conmod: con_mod,
    intmod: int_mod,
    wismod: wis_mod,
    chamod: cha_mod,
    cl: character.casterLevel,
    casterlevel: character.casterLevel,
    hp_current: character.hpCurrent,
    hp_max: character.hpTotalMax,
    hp: character.hpCurrent,
    thp: character.hpTemp,

    // # Macro calls (as specified in user prompt 3: #hp, #str = bonus, #strength = score)
    '#hp': character.hpCurrent,
    '#maxhp': character.hpTotalMax,
    '#hpmax': character.hpTotalMax,
    '#thp': character.hpTemp,
    '#str': str_mod,
    '#strength': strScore,
    '#dex': dex_mod,
    '#dexterity': dexScore,
    '#con': con_mod,
    '#constitution': conScore,
    '#int': int_mod,
    '#intelligence': intScore,
    '#wis': wis_mod,
    '#wisdom': wisScore,
    '#cha': cha_mod,
    '#charisma': chaScore,
    '#bab': character.baseAttackBonus,
    '#level': character.level,
    '#cl': character.casterLevel,
    '#casterlevel': character.casterLevel,
    // Initiative macro calls (e.g. INIT, init, #init)
    init: derivedCombatStats?.initiativeTotal ?? (dex_mod + character.initMiscMod),
    INIT: derivedCombatStats?.initiativeTotal ?? (dex_mod + character.initMiscMod),
    initiative: derivedCombatStats?.initiativeTotal ?? (dex_mod + character.initMiscMod),
    INITIATIVE: derivedCombatStats?.initiativeTotal ?? (dex_mod + character.initMiscMod),
    '#init': derivedCombatStats?.initiativeTotal ?? (dex_mod + character.initMiscMod),
    '#initiative': derivedCombatStats?.initiativeTotal ?? (dex_mod + character.initMiscMod),
    '#ac': derivedCombatStats?.acTotal ?? 10,
    '#touch': derivedCombatStats?.touchAC ?? 10,
    '#flat': derivedCombatStats?.flatFootedAC ?? 10,
    '#flatfooted': derivedCombatStats?.flatFootedAC ?? 10,

    // Saving throws macro calls: FORT, REF, WILL (with Con, Dex, Wis bonuses)
    fort: derivedCombatStats?.fortitudeTotal ?? (con_mod + character.saves.fortitude.base),
    ref: derivedCombatStats?.reflexTotal ?? (dex_mod + character.saves.reflex.base),
    will: derivedCombatStats?.willTotal ?? (wis_mod + character.saves.will.base),
    FORT: derivedCombatStats?.fortitudeTotal ?? (con_mod + character.saves.fortitude.base),
    REF: derivedCombatStats?.reflexTotal ?? (dex_mod + character.saves.reflex.base),
    WILL: derivedCombatStats?.willTotal ?? (wis_mod + character.saves.will.base),
    '#fort': derivedCombatStats?.fortitudeTotal ?? (con_mod + character.saves.fortitude.base),
    '#ref': derivedCombatStats?.reflexTotal ?? (dex_mod + character.saves.reflex.base),
    '#will': derivedCombatStats?.willTotal ?? (wis_mod + character.saves.will.base),
    fortitude: derivedCombatStats?.fortitudeTotal ?? (con_mod + character.saves.fortitude.base),
    reflex: derivedCombatStats?.reflexTotal ?? (dex_mod + character.saves.reflex.base),
    '#fortitude': derivedCombatStats?.fortitudeTotal ?? (con_mod + character.saves.fortitude.base),
    '#reflex': derivedCombatStats?.reflexTotal ?? (dex_mod + character.saves.reflex.base),

    // Size macro call (default bonus +0 per user request)
    size: 0,
    SIZE: 0,
    '#size': 0,
    misc: 0,
    MISC: 0,

    // Combat Maneuvers & BAB (CMB+STR+SIZE+MISC macro support)
    cmb: derivedCombatStats?.cmbTotal ?? (character.baseAttackBonus + str_mod),
    CMB: derivedCombatStats?.cmbTotal ?? (character.baseAttackBonus + str_mod),
    '#cmb': derivedCombatStats?.cmbTotal ?? (character.baseAttackBonus + str_mod),
    cmd: derivedCombatStats?.cmdTotal ?? (10 + character.baseAttackBonus + str_mod),
    CMD: derivedCombatStats?.cmdTotal ?? (10 + character.baseAttackBonus + str_mod),
    '#cmd': derivedCombatStats?.cmdTotal ?? (10 + character.baseAttackBonus + str_mod),
    STR: str_mod,
    DEX: dex_mod,
    CON: con_mod,
    INT: int_mod,
    WIS: wis_mod,
    CHA: cha_mod,
    BAB: character.baseAttackBonus,
    '#mattack': derivedCombatStats?.meleeAttackBonusTotal ?? (character.baseAttackBonus + str_mod),
    '#rattack': derivedCombatStats?.rangedAttackBonusTotal ?? (character.baseAttackBonus + dex_mod),
    '#speed': character.speedBase,
  };

  // Add custom user objects into context
  if (character.customObjects) {
    for (const obj of character.customObjects) {
      if (obj.name) {
        const cleanName = obj.name.toLowerCase().trim();
        context[cleanName] = obj.formula;
        context[`#${cleanName}`] = obj.formula;
      }
    }
  }

  // Add resource trackers into context (e.g. {smite}, #smite, SMITE)
  if (character.resourceTrackers) {
    for (const res of character.resourceTrackers) {
      if (res.name) {
        const cleanName = res.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        context[cleanName] = res.current;
        context[`#${cleanName}`] = res.current;
      }
      if (res.macroKey) {
        const cleanKey = res.macroKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
        context[cleanKey] = res.current;
        context[res.macroKey] = res.current;
        context[`#${cleanKey}`] = res.current;
      }
    }
  }

  return context;
}

/**
 * Tokenizes a formula string for syntax highlighting and safe parsing
 */
export function tokenizeFormula(expression: string): FormulaToken[] {
  const tokens: FormulaToken[] = [];
  let i = 0;
  const len = expression.length;

  while (i < len) {
    const ch = expression[i];

    // Skip whitespace but record it if needed
    if (/\s/.test(ch)) {
      let ws = '';
      while (i < len && /\s/.test(expression[i])) {
        ws += expression[i];
        i++;
      }
      tokens.push({ type: 'text', value: ws });
      continue;
    }

    // String literals "..." or '...'
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = quote;
      i++;
      while (i < len && expression[i] !== quote) {
        str += expression[i];
        i++;
      }
      if (i < len) {
        str += expression[i]; // closing quote
        i++;
      }
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Dice notation: e.g. 2d6, 1d20, d8
    const diceMatch = expression.slice(i).match(/^(\d*d\d+)/i);
    if (diceMatch) {
      tokens.push({ type: 'dice', value: diceMatch[1] });
      i += diceMatch[1].length;
      continue;
    }

    // Numbers (integers or floats)
    const numMatch = expression.slice(i).match(/^(\d+(?:\.\d+)?)/);
    if (numMatch) {
      tokens.push({ type: 'number', value: numMatch[1] });
      i += numMatch[1].length;
      continue;
    }

    // Operators
    if (['+', '-', '*', '/', '%', '^'].includes(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    // Punctuation: parentheses, colons, commas
    if (['(', ')', ',', ':'].includes(ch)) {
      tokens.push({ type: 'punctuation', value: ch });
      i++;
      continue;
    }

    // Identifiers (functions or variable names, including #macro syntax)
    const idMatch = expression.slice(i).match(/^(#?[a-zA-Z_][a-zA-Z0-9_]*)/);
    if (idMatch) {
      const id = idMatch[1];
      const lower = id.toLowerCase();
      if (['floor', 'round', 'ceil', 'min', 'max', 'abs', 'sqrt'].includes(lower)) {
        tokens.push({ type: 'function', value: id });
      } else {
        tokens.push({ type: 'variable', value: id });
      }
      i += id.length;
      continue;
    }

    // Fallback unknown character
    tokens.push({ type: 'unknown', value: ch });
    i++;
  }

  return tokens;
}

/**
 * Resolves and evaluates an expression safely.
 * Allows math simplification while preserving dice formulas or combining text strings.
 */
export function evaluateFormula(
  expression: string,
  context: Record<string, any>,
  depth: number = 0
): EvaluatedResult {
  if (depth > 6) {
    return {
      raw: expression,
      evaluated: 'Error: circular reference',
      isError: true,
      errorMessage: 'Circular reference detected',
      tokens: tokenizeFormula(expression),
    };
  }

  if (!expression || !expression.trim()) {
    return {
      raw: expression,
      evaluated: '',
      isError: false,
      tokens: [],
    };
  }

  const trimmed = expression.trim();

  // If the user entered "name: formula", strip the label for calculation
  let formulaBody = trimmed;
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex > 0 && !trimmed.slice(0, colonIndex).includes('"') && !trimmed.slice(0, colonIndex).includes(' ')) {
    formulaBody = trimmed.slice(colonIndex + 1).trim();
  }

  const tokens = tokenizeFormula(formulaBody);

  try {
    // Check if the expression contains dice expressions or strings
    // We replace variables and known objects first
    let processed = '';

    for (let idx = 0; idx < tokens.length; idx++) {
      const token = tokens[idx];

      if (token.type === 'variable') {
        const varName = token.value.toLowerCase();
        if (varName in context) {
          const val = context[varName];
          if (typeof val === 'number') {
            processed += val.toString();
          } else if (typeof val === 'string') {
            // It could be another formula object!
            // Evaluate nested formula
            const nested = evaluateFormula(val, context, depth + 1);
            if (nested.isError) {
              return nested;
            }
            // If nested evaluation is simple or contains dice/strings, wrap if needed
            processed += ` ${nested.evaluated} `;
          } else {
            processed += String(val);
          }
        } else {
          // Unknown variable: leave as is or return error
          processed += token.value;
        }
      } else if (token.type === 'string') {
        // Unquote the string literal
        const unquoted = token.value.slice(1, -1);
        processed += ` "${unquoted}" `;
      } else {
        processed += token.value;
      }
    }

    // Now evaluate strings and math
    const result = evaluateMixedExpression(processed.trim());

    return {
      raw: expression,
      evaluated: result,
      isError: false,
      tokens,
      rollable: /d\d+/i.test(result),
    };
  } catch (err: any) {
    return {
      raw: expression,
      evaluated: formulaBody,
      isError: true,
      errorMessage: err?.message || 'Formula evaluation error',
      tokens,
    };
  }
}

/**
 * Evaluates mixed arithmetic, string concatenation, and dice preservation
 */
function evaluateMixedExpression(input: string): string {
  // Check if input is a pure string or concatenation of strings & dice
  // E.g.: 2d6 + 10 + " fire"
  // E.g.: "Axe +4 to hit 1d8+4 slashing" + " and " + "2d6+10 fire"

  // If there are string literals, we can segment by '+'
  // and evaluate numeric/dice parts while keeping strings
  const stringLiterals: string[] = [];
  const placeholderReplaced = input.replace(/"([^"]*)"|'([^']*)'/g, (_match, p1, p2) => {
    const str = p1 !== undefined ? p1 : p2;
    const index = stringLiterals.length;
    stringLiterals.push(str);
    return `__STR_${index}__`;
  });

  // Split by top-level '+' if it links strings or dice
  // Let's first simplify standard math like (5 * round(5/2) + 1) -> (5 * 3 + 1) -> 16
  // Or (5 * floor(5/2)) -> (5 * 2) -> 10
  const mathSimplified = simplifyMathExpressions(placeholderReplaced);

  // Restore string literals
  let finalOutput = mathSimplified.replace(/__STR_(\d+)__/g, (_match, index) => {
    return stringLiterals[Number(index)] ?? '';
  });

  // Clean up duplicate plus signs around strings: e.g. "2d6+10 + fire" -> "2d6+10 fire" or "2d6+10 and fire"
  finalOutput = cleanConcatenations(finalOutput);

  return finalOutput.trim();
}

/**
 * Evaluates pure mathematical sub-expressions:
 * Supports floor, round, ceil, min, max, basic arithmetic, and keeps dice
 */
function simplifyMathExpressions(expr: string): string {
  let text = expr;

  // Replace functions: floor(x), round(x), ceil(x)
  text = text.replace(/(floor|round|ceil|abs)\s*\(([^()]+)\)/gi, (_m, fn, inner) => {
    try {
      const val = evalMathSafe(inner);
      if (fn.toLowerCase() === 'floor') return String(Math.floor(val));
      if (fn.toLowerCase() === 'round') return String(Math.round(val));
      if (fn.toLowerCase() === 'ceil') return String(Math.ceil(val));
      if (fn.toLowerCase() === 'abs') return String(Math.abs(val));
      return String(val);
    } catch {
      return _m;
    }
  });

  // Check if there is dice notation in this fragment
  // If there's e.g. "2d6 + (10)", we evaluate the math "(10)" to 10
  // Match parenthesized pure math: ( ... )
  text = text.replace(/\(([^()a-zA-Z_]+)\)/g, (_m, inner) => {
    try {
      const val = evalMathSafe(inner);
      return String(val);
    } catch {
      return _m;
    }
  });

  // If there's an arithmetic segment like "+ 5 * 2"
  // Let's try simplifying isolated math segments:
  // E.g.: "2d6 + 5 * 2" -> "2d6 + 10"
  const diceMatch = text.match(/(\d*d\d+)/i);
  if (diceMatch) {
    const dice = diceMatch[1];
    // Split into parts around dice
    const parts = text.split(dice);
    if (parts.length === 2) {
      const before = parts[0].trim();
      const after = parts[1].trim();

      let simplifiedAfter = after;
      if (after.startsWith('+') || after.startsWith('-')) {
        const sign = after[0];
        const rest = after.slice(1).trim();
        // Look for next string placeholder or text
        const strIdx = rest.indexOf('__STR_');
        let mathPart = rest;
        let suffix = '';
        if (strIdx !== -1) {
          mathPart = rest.slice(0, strIdx).replace(/\+\s*$/, '').trim();
          suffix = rest.slice(strIdx);
        }

        if (mathPart && /^[\d\s+\-*/.%()]+$/.test(mathPart)) {
          try {
            const calculated = evalMathSafe(mathPart);
            simplifiedAfter = `${sign} ${calculated} ${suffix}`;
          } catch {
            // Keep unchanged
          }
        }
      }

      return `${before}${dice}${simplifiedAfter}`.replace(/\s+/g, ' ');
    }
  }

  // If there are no dice and no string placeholders, evaluate as pure math
  if (!text.includes('__STR_') && /^[\d\s+\-*/.%()]+$/.test(text.trim())) {
    try {
      const result = evalMathSafe(text);
      return String(result);
    } catch {
      return text;
    }
  }

  return text;
}

/**
 * Safe numeric math evaluator without arbitrary JS execution
 */
function evalMathSafe(mathStr: string): number {
  const sanitized = mathStr.replace(/[^0-9+\-*/().\s]/g, '');
  if (!sanitized.trim()) return 0;
  // Use Function with strict isolation
  // eslint-disable-next-line no-new-func
  const fn = new Function(`"use strict"; return (${sanitized});`);
  const val = fn();
  return typeof val === 'number' && !Number.isNaN(val) ? val : 0;
}

/**
 * Cleans up awkward concatenation artifacts like "2d6+10 + fire" -> "2d6+10 fire"
 */
function cleanConcatenations(str: string): string {
  return str
    .replace(/\s*\+\s*"/g, ' "')
    .replace(/"\s*\+\s*/g, '" ')
    .replace(/\s*\+\s*([a-zA-Z])/g, ' $1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Rolls dice based on a formula like "2d6+10" or "1d20+14"
 */
export interface DiceRollOutcome {
  formula: string;
  total: number;
  rolls: Array<{ dice: string; values: number[]; sum: number }>;
  modifier: number;
  textOutput: string;
  isNat20?: boolean;
  isNat1?: boolean;
}

export function executeDiceRoll(formula: string): DiceRollOutcome {
  let total = 0;
  const rolls: Array<{ dice: string; values: number[]; sum: number }> = [];
  let modifier = 0;
  let isNat20 = false;
  let isNat1 = false;

  // Find all dice in the formula
  const diceRegex = /([+-]?\s*\d*)d(\d+)/gi;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  // Extract dice
  while ((match = diceRegex.exec(formula)) !== null) {
    const fullMatch = match[0];
    const sign = fullMatch.trim().startsWith('-') ? -1 : 1;
    const countStr = match[1].replace(/[+-]/g, '').trim();
    const count = countStr ? parseInt(countStr, 10) : 1;
    const sides = parseInt(match[2], 10);

    const values: number[] = [];
    let sum = 0;

    for (let c = 0; c < count; c++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      values.push(roll);
      sum += roll;

      if (sides === 20 && count === 1) {
        if (roll === 20) isNat20 = true;
        if (roll === 1) isNat1 = true;
      }
    }

    rolls.push({
      dice: `${count}d${sides}`,
      values,
      sum: sum * sign,
    });

    total += sum * sign;
    lastIndex = diceRegex.lastIndex;
  }

  // Remove the dice segments to see if there is a flat modifier
  const withoutDice = formula.replace(/[+-]?\s*\d*d\d+/gi, '').replace(/[^0-9+\-.\s]/g, '');
  if (withoutDice.trim()) {
    try {
      modifier = evalMathSafe(withoutDice);
      total += modifier;
    } catch {
      // modifier stays 0
    }
  }

  const breakdown = rolls
    .map((r) => `${r.dice} [${r.values.join(', ')}]`)
    .join(' + ');

  const textOutput = `${breakdown}${modifier !== 0 ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`) : ''} = ${total}`;

  return {
    formula,
    total,
    rolls,
    modifier,
    textOutput,
    isNat20,
    isNat1,
  };
}
