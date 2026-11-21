/**
 * Macroni Overhaul 1.2 Evaluator
 * Clean, deterministic interpreter enforcing:
 * - Mandatory leading sigil (==, <<, <>, <?>, <^>, <!>, >target<op value)
 * - 5-step resolution order:
 *     1. {object} references & {dN} fresh dice rolls (never cached; dN reserved)
 *     2. Innermost [...] brackets outward (strict calculator boundary, PEMDAS)
 *     3. Outermost [...] bracket
 *     4. #calls last (legacy fallback treated as {})
 *     5. Print result / execute sigil behavior
 * - Safe recursive-descent math parser (no eval / new Function)
 * - Per-! hidden ID stepper counters (0 -> 1 on first run before multiplication)
 * - Sigil-aware <?> query options (depth <= 5, self-reopen loop stop)
 * - <^> buff modifier keyed by (name, bonusType)
 * - >target<op value field & non-mutating object merge
 */

import {
  PF1Character,
  UiMakePreset,
  BuffBonusType,
  BuffStatTarget,
  CustomBuffEffect,
} from '../../types/character';
import {
  findNestedSigilInBody,
  findReservedSymbolInBody,
  isArrayCapsuleRef,
  isReservedDiceName,
  parseSigilEnvelope,
  tokenizeMacaroni,
} from './lexer';
import {
  MacaroniBuffMakeSpec,
  MacaroniExecutionResult,
  MacaroniExternalSheet,
  MacaroniMergeResult,
  MacaroniQueryOption,
  MacaroniQueryRequest,
  MacaroniScopeAccessEvent,
  MacaroniScopePermissions,
  MacaroniSlotResult,
  MacaroniTraceStep,
  MergeOperator,
  NoodleTextSegment,
} from './types';

export interface MacaroniExecutionContext {
  character: PF1Character;
  formulaContext: Record<string, any>;
  target?: Record<string, any>;
  companion?: Record<string, any>;
  thisValue?: number;
  stepCount?: number;
  stepperStore?: Record<string, number>;
  stepperScopeId?: string;
  queryDisplayStore?: Record<string, string>;
  inlineQueryAnswers?: Record<string, string>;
  queryDepth?: number;
  visitedQueryKeys?: string[];
  visitedObjects?: string[];
  activeMacros?: string[];
  tempObjects?: Record<string, string>;
  arrayStore?: Record<string, string[]>;
  permissions?: MacaroniScopePermissions;
  externalSheets?: Record<string, MacaroniExternalSheet>;
  requesterId?: string;
  uiPresets?: UiMakePreset[];
  depth?: number;
}

export const BUFF_MATRIX_COLUMNS: BuffStatTarget[] = [
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

export const BUFF_MATRIX_ROWS: BuffBonusType[] = [
  'Untyped',
  'Enhancement',
  'Circumstance',
  'Competence',
  'Deflection',
  'Dodge',
  'Insight',
  'Item',
  'Inherent',
  'Luck',
  'Morale',
  'Pro/Sac',
  'Race',
  'NAT armor',
  'Armor',
  'Level advance',
  'Shield',
  'Size',
  'Alt size',
];

export const DEFAULT_UI_PRESETS: UiMakePreset[] = [
  {
    tag: 1,
    name: 'Default Tabletop Alert',
    layout: 'floating_card',
    font: 'serif',
    theme: 'default_amber',
    soundCue: 'bell',
  },
  {
    tag: 11,
    name: 'Dragonfire Critical',
    layout: 'floating_card',
    font: 'gothic',
    theme: 'crimson_gold',
    soundCue: 'critical',
  },
  {
    tag: 20,
    name: 'Natural 20 Fanfare',
    layout: 'banner',
    font: 'serif',
    theme: 'celestial_cyan',
    soundCue: 'fanfare',
  },
  {
    tag: 13,
    name: 'Necrotic Decay',
    layout: 'toast',
    font: 'mono',
    theme: 'necrotic_slate',
    soundCue: 'whisper',
  },
];

export function pickQuirkyMessage(kind: 'buff' | 'debuff' | 'roll' | 'locked' | 'toggled_off'): string {
  if (kind === 'buff') return 'Buff updated in Buff Box.';
  if (kind === 'debuff') return 'Debuff updated in Buff Box.';
  if (kind === 'locked') return 'Buff active.';
  if (kind === 'toggled_off') return 'Buff deactivated.';
  return 'Macro executed cleanly.';
}

export function resolveUiMakePreset(
  tagCandidate: number | undefined,
  presets: UiMakePreset[] = DEFAULT_UI_PRESETS
): UiMakePreset {
  const allPresets = presets.length > 0 ? presets : DEFAULT_UI_PRESETS;
  const defaultPreset = allPresets.find((p) => p.tag === 1) || allPresets[0] || DEFAULT_UI_PRESETS[0];
  if (tagCandidate === undefined || Number.isNaN(tagCandidate)) return defaultPreset;
  const exact = allPresets.find((p) => p.tag === tagCandidate);
  if (exact) return exact;
  const candidateStr = String(tagCandidate);
  let bestMatch: UiMakePreset | null = null;
  let bestLen = 0;
  for (const preset of allPresets) {
    const pStr = String(preset.tag);
    if (candidateStr.startsWith(pStr) && pStr.length > bestLen) {
      bestMatch = preset;
      bestLen = pStr.length;
    }
  }
  return bestMatch || defaultPreset;
}

export function resolveBuffStatTarget(rawStat: string): BuffStatTarget | null {
  const clean = String(rawStat || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const map: Record<string, BuffStatTarget> = {
    hp: 'hp',
    health: 'hp',
    hitpoints: 'hp',
    mattack: 'mattack',
    melee: 'mattack',
    meleeattack: 'mattack',
    atk: 'mattack',
    attack: 'mattack',
    rattack: 'rattack',
    ranged: 'rattack',
    rangedattack: 'rattack',
    fort: 'fort',
    fortitude: 'fort',
    ref: 'ref',
    reflex: 'ref',
    will: 'will',
    willsave: 'will',
    ac: 'ac',
    armorclass: 'ac',
    str: 'str',
    strength: 'str',
    dex: 'dex',
    dexterity: 'dex',
    con: 'con',
    constitution: 'con',
    int: 'int',
    intelligence: 'int',
    wis: 'wis',
    wisdom: 'wis',
    cha: 'cha',
    charisma: 'cha',
    strmod: 'str_mod',
    str_mod: 'str_mod',
    dexmod: 'dex_mod',
    dex_mod: 'dex_mod',
    conmod: 'con_mod',
    con_mod: 'con_mod',
    intmod: 'int_mod',
    int_mod: 'int_mod',
    wismod: 'wis_mod',
    wis_mod: 'wis_mod',
    chamod: 'cha_mod',
    cha_mod: 'cha_mod',
  };
  return map[clean] || null;
}

export function resolveBuffBonusType(rawType?: string): BuffBonusType {
  if (!rawType) return 'Untyped';
  const clean = rawType.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const map: Record<string, BuffBonusType> = {
    untyped: 'Untyped',
    enhancement: 'Enhancement',
    enhancment: 'Enhancement',
    enh: 'Enhancement',
    circumstance: 'Circumstance',
    circ: 'Circumstance',
    competence: 'Competence',
    comp: 'Competence',
    deflection: 'Deflection',
    defl: 'Deflection',
    dodge: 'Dodge',
    insight: 'Insight',
    item: 'Item',
    inherent: 'Inherent',
    luck: 'Luck',
    morale: 'Morale',
    prosac: 'Pro/Sac',
    profane: 'Pro/Sac',
    sacred: 'Pro/Sac',
    race: 'Race',
    racial: 'Race',
    natarmor: 'NAT armor',
    naturalarmor: 'NAT armor',
    natural: 'NAT armor',
    nat: 'NAT armor',
    armor: 'Armor',
    leveladvance: 'Level advance',
    level: 'Level advance',
    shield: 'Shield',
    size: 'Size',
    altsize: 'Alt size',
  };
  return map[clean] || 'Untyped';
}

export function validateObjectName(name: string): { valid: boolean; reason?: string } {
  const clean = String(name || '').trim();
  if (!clean) return { valid: false, reason: 'Object name cannot be empty.' };
  const base = clean.endsWith('&') ? clean.slice(0, -1) : clean;
  if (!base) return { valid: false, reason: 'Array capsule name cannot be just "&".' };
  if (isReservedDiceName(clean) || isReservedDiceName(base)) {
    return {
      valid: false,
      reason: `"${clean}" is reserved for dice rolls ({dN} / {XdN}). Choose a different object name.`,
    };
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(base)) {
    return {
      valid: false,
      reason: `"${clean}" must start with a letter/underscore and contain only letters, digits, or underscores (plus optional trailing & for arrays).`,
    };
  }
  return { valid: true };
}

export const ALLOWED_NOODLE_COLORS = [
  'red',
  'blue',
  'green',
  'amber',
  'gold',
  'cyan',
  'purple',
  'orange',
  'white',
  'gray',
  'slate',
] as const;

const NOODLE_COLOR_SET = new Set<string>(ALLOWED_NOODLE_COLORS);

/**
 * Parses safe Noodle formatting (+bold+, _underline_, #color#) into structured text runs.
 * Raw HTML is never emitted; unknown #color# tags remain literal plain text.
 */
export function parseNoodleFormatting(text: string): NoodleTextSegment[] {
  const input = String(text ?? '');
  if (!input) return [];

  const segments: NoodleTextSegment[] = [];
  let bold = false;
  let underline = false;
  let activeColor: string | undefined;
  let buffer = '';

  const flush = () => {
    if (buffer) {
      segments.push({ text: buffer, bold, underline, color: activeColor });
      buffer = '';
    }
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    // #color# fixed-whitelist color marker
    if (ch === '#') {
      const m = input.slice(i).match(/^#([a-zA-Z]+)#/);
      if (m) {
        const candidate = m[1].toLowerCase();
        if (NOODLE_COLOR_SET.has(candidate)) {
          flush();
          activeColor = candidate;
          i += m[0].length - 1;
          continue;
        }
      }
    }

    // +bold+ toggle when a matching closing + exists later in the string
    if (ch === '+' && (bold || input.indexOf('+', i + 1) !== -1)) {
      flush();
      bold = !bold;
      continue;
    }

    // _underline_ toggle when a matching closing _ exists later in the string
    if (ch === '_' && (underline || input.indexOf('_', i + 1) !== -1)) {
      flush();
      underline = !underline;
      continue;
    }

    buffer += ch;
  }

  flush();
  return segments;
}

// ============================================================================
// SAFE RECURSIVE-DESCENT PEMDAS ARITHMETIC PARSER
// ============================================================================

type MathLexToken =
  | { kind: 'num'; val: number }
  | { kind: 'op'; val: string }
  | { kind: 'id'; val: string }
  | { kind: 'comma' };

function tokenizeArithmetic(expr: string): { ok: true; tokens: MathLexToken[] } | { ok: false; error: string } {
  const tokens: MathLexToken[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = expr.slice(i).match(/^(?:\d+\.?\d*|\.\d+)/);
      if (!m) return { ok: false, error: `Invalid number near "${expr.slice(i, i + 8)}"` };
      const num = Number(m[0]);
      if (!Number.isFinite(num)) return { ok: false, error: `Invalid number "${m[0]}"` };
      tokens.push({ kind: 'num', val: num });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = expr.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (!m) return { ok: false, error: `Unexpected identifier near "${expr.slice(i, i + 8)}"` };
      tokens.push({ kind: 'id', val: m[0].toLowerCase() });
      i += m[0].length;
      continue;
    }
    if (ch === ',') {
      tokens.push({ kind: 'comma' });
      i++;
      continue;
    }
    if (['+', '-', '*', '/', '%', '(', ')'].includes(ch)) {
      tokens.push({ kind: 'op', val: ch });
      i++;
      continue;
    }
    return { ok: false, error: `Unexpected character "${ch}" inside calculator [...]` };
  }
  return { ok: true, tokens };
}

function parseStrictArithmetic(expr: string): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = expr.trim();
  if (!trimmed) return { ok: false, error: 'Empty calculator [] expression' };

  const lexed = tokenizeArithmetic(trimmed);
  if (!lexed.ok) return lexed;
  const tokens = lexed.tokens;
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpression(): number {
    let left = parseTerm();
    while (true) {
      const tok = peek();
      if (tok && tok.kind === 'op' && (tok.val === '+' || tok.val === '-')) {
        consume();
        const right = parseTerm();
        left = tok.val === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseUnary();
    while (true) {
      const tok = peek();
      if (tok && tok.kind === 'op' && (tok.val === '*' || tok.val === '/' || tok.val === '%')) {
        consume();
        const right = parseUnary();
        if (tok.val === '*') {
          left = left * right;
        } else if (tok.val === '/') {
          if (right === 0) throw new Error('Division by zero');
          left = left / right;
        } else {
          if (right === 0) throw new Error('Modulo by zero');
          left = left % right;
        }
      } else if (tok && tok.kind === 'op' && tok.val === '(') {
        // Allow implicit multiplication for e.g. 4(3) inside brackets
        left = left * parseUnary();
      } else {
        break;
      }
    }
    return left;
  }

  function parseUnary(): number {
    const tok = peek();
    if (tok && tok.kind === 'op' && tok.val === '+') {
      consume();
      return parseUnary();
    }
    if (tok && tok.kind === 'op' && tok.val === '-') {
      consume();
      return -parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of expression inside []');

    if (tok.kind === 'num') {
      consume();
      return tok.val;
    }

    if (tok.kind === 'op' && tok.val === '(') {
      consume();
      const val = parseExpression();
      const close = consume();
      if (!close || close.kind !== 'op' || close.val !== ')') {
        throw new Error('Missing closing parenthesis ")" inside []');
      }
      return val;
    }

    if (tok.kind === 'id') {
      consume();
      const openParen = peek();
      if (!openParen || openParen.kind !== 'op' || openParen.val !== '(') {
        throw new Error(`Unresolved symbol "${tok.val}" inside calculator []`);
      }
      consume(); // '('
      const args: number[] = [];
      if (peek() && !(peek()!.kind === 'op' && (peek() as { kind: 'op'; val: string }).val === ')')) {
        args.push(parseExpression());
        while (peek()?.kind === 'comma') {
          consume();
          args.push(parseExpression());
        }
      }
      const closeParen = consume();
      if (!closeParen || closeParen.kind !== 'op' || closeParen.val !== ')') {
        throw new Error(`Missing closing ")" for ${tok.val}(...)`);
      }
      switch (tok.val) {
        case 'floor':
          if (args.length !== 1) throw new Error('floor() expects 1 argument');
          return Math.floor(args[0]);
        case 'ceil':
          if (args.length !== 1) throw new Error('ceil() expects 1 argument');
          return Math.ceil(args[0]);
        case 'round':
          if (args.length !== 1) throw new Error('round() expects 1 argument');
          return Math.round(args[0]);
        case 'abs':
          if (args.length !== 1) throw new Error('abs() expects 1 argument');
          return Math.abs(args[0]);
        case 'sqrt':
          if (args.length !== 1) throw new Error('sqrt() expects 1 argument');
          if (args[0] < 0) throw new Error('sqrt() of negative number');
          return Math.sqrt(args[0]);
        case 'min':
          if (args.length < 1) throw new Error('min() expects at least 1 argument');
          return Math.min(...args);
        case 'max':
          if (args.length < 1) throw new Error('max() expects at least 1 argument');
          return Math.max(...args);
        default:
          throw new Error(`Unknown function "${tok.val}" inside []`);
      }
    }

    throw new Error(`Unexpected token inside calculator []`);
  }

  try {
    const rawResult = parseExpression();
    if (pos < tokens.length) {
      throw new Error(`Unexpected trailing token in calculator [${trimmed}]`);
    }
    const clean = Object.is(rawResult, -0)
      ? 0
      : Math.abs(rawResult - Math.round(rawResult)) < 1e-10
      ? Math.round(rawResult)
      : Number(rawResult.toFixed(6));
    return { ok: true, value: clean };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function evaluatePureMath(expr: string): number {
  const res = parseStrictArithmetic(expr);
  return res.ok ? res.value : 0;
}

type CalcCmpOp = '=' | '<>' | '>' | '<' | '>=' | '<=';

function findTopLevelComparison(expr: string): { op: CalcCmpOp; lhs: string; rhs: string } | null {
  let parenDepth = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(') {
      parenDepth++;
      continue;
    }
    if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (parenDepth > 0) continue;

    const two = expr.slice(i, i + 2);
    let normalized: CalcCmpOp | null = null;
    let width = 1;
    if (two === '>=' || two === '=>') {
      normalized = '>=';
      width = 2;
    } else if (two === '<=' || two === '=<') {
      normalized = '<=';
      width = 2;
    } else if (two === '<>') {
      normalized = '<>';
      width = 2;
    } else if (ch === '=' || ch === '>' || ch === '<') {
      normalized = ch as CalcCmpOp;
      width = 1;
    }
    if (normalized) {
      return {
        op: normalized,
        lhs: expr.slice(0, i).trim(),
        rhs: expr.slice(i + width).trim(),
      };
    }
  }
  return null;
}

/**
 * Evaluates a [...] calculator bracket:
 * - Resolves arithmetic first (PEMDAS).
 * - If =, >, <, >=/=>, <=/=<, or <> appears at top level inside [...], turns the bracket into a booli comparison.
 */
function evaluateCalculatorBracket(
  innerExpr: string
): { ok: true; value: number | boolean; display: string; isBool: boolean } | { ok: false; error: string } {
  const cmp = findTopLevelComparison(innerExpr);
  if (!cmp) {
    const calc = parseStrictArithmetic(innerExpr);
    if (!calc.ok) return calc;
    return { ok: true, value: calc.value, display: String(calc.value), isBool: false };
  }

  if (!cmp.lhs || !cmp.rhs) {
    return { ok: false, error: `Incomplete comparison "${cmp.op}" inside calculator [${innerExpr}].` };
  }

  const lhsCalc = parseStrictArithmetic(cmp.lhs);
  const rhsCalc = parseStrictArithmetic(cmp.rhs);
  let matched = false;

  if (lhsCalc.ok && rhsCalc.ok) {
    const a = lhsCalc.value;
    const b = rhsCalc.value;
    if (cmp.op === '=') matched = a === b;
    else if (cmp.op === '<>') matched = a !== b;
    else if (cmp.op === '>') matched = a > b;
    else if (cmp.op === '<') matched = a < b;
    else if (cmp.op === '>=') matched = a >= b;
    else if (cmp.op === '<=') matched = a <= b;
  } else {
    // Allow comparing boolean or string tokens with = or <>
    const aStr = lhsCalc.ok ? String(lhsCalc.value) : cmp.lhs.trim().toLowerCase();
    const bStr = rhsCalc.ok ? String(rhsCalc.value) : cmp.rhs.trim().toLowerCase();
    if (cmp.op === '=') matched = aStr === bStr;
    else if (cmp.op === '<>') matched = aStr !== bStr;
    else {
      return { ok: false, error: !lhsCalc.ok ? lhsCalc.error : !rhsCalc.ok ? rhsCalc.error : 'Invalid comparison' };
    }
  }

  return {
    ok: true,
    value: matched,
    display: matched ? 'true' : 'false',
    isBool: true,
  };
}

// ============================================================================
// CONTEXT & OBJECT RESOLUTION
// ============================================================================

function resolveFieldFromContext(rawKey: string, ctx: MacaroniExecutionContext): string | number | undefined {
  const lower = rawKey.trim().toLowerCase();

  // Dynamic multiclass LevelA / LevelB / LevelC ... and HDA / HDB ...
  const classLevelMatch = lower.match(/^level([a-z])$/);
  if (classLevelMatch) {
    const idx = classLevelMatch[1].charCodeAt(0) - 97;
    const cls = ctx.character?.classes?.[idx];
    if (cls && typeof cls.level === 'number') return cls.level;
    if (idx === 0 && typeof ctx.character?.level === 'number') return ctx.character.level;
    return 0;
  }
  const classHdMatch = lower.match(/^hd([a-z])$/);
  if (classHdMatch) {
    const idx = classHdMatch[1].charCodeAt(0) - 97;
    const cls = ctx.character?.classes?.[idx];
    if (cls && typeof cls.hitDie === 'number') return cls.hitDie;
  }

  if (lower in ctx.formulaContext) return ctx.formulaContext[lower];
  if (`#${lower}` in ctx.formulaContext) return ctx.formulaContext[`#${lower}`];
  if (rawKey in ctx.formulaContext) return ctx.formulaContext[rawKey];
  return undefined;
}

function findStoredObjectFormula(name: string, ctx: MacaroniExecutionContext): string | null {
  const lower = name.trim().toLowerCase();
  const custom = ctx.character?.customObjects?.find((o) => o.name.trim().toLowerCase() === lower);
  if (custom) return custom.formula;
  const xdx = ctx.character?.xdxMacros?.find((m) => m.name.trim().toLowerCase() === lower);
  if (xdx) return xdx.formula;
  return null;
}

function protectQuotes(input: string): { masked: string; literals: string[] } {
  const literals: string[] = [];
  const masked = input.replace(/"([^"]*)"|'([^']*)'/g, (_, p1, p2) => {
    const str = p1 !== undefined ? p1 : p2;
    const idx = literals.length;
    literals.push(str);
    return `__MSTR_${idx}__`;
  });
  return { masked, literals };
}

function restoreQuotes(input: string, literals: string[], keepQuotes = false): string {
  return input.replace(/__MSTR_(\d+)__/g, (_, idxStr) => {
    const text = literals[parseInt(idxStr, 10)] ?? '';
    return keepQuotes ? `"${text}"` : text;
  });
}

function checkOutsideCalculatorJuxtaposition(maskedBody: string): string | null {
  let depth = 0;
  for (let i = 0; i < maskedBody.length; i++) {
    const ch = maskedBody[i];
    if (ch === '[') {
      if (depth === 0) {
        // Look back for immediately preceding non-space character
        let j = i - 1;
        while (j >= 0 && /\s/.test(maskedBody[j])) j--;
        if (j >= 0 && /[0-9)\]]/.test(maskedBody[j])) {
          const snippet = maskedBody.slice(Math.max(0, j - 6), Math.min(maskedBody.length, i + 8)).trim();
          return `Syntax error near "${snippet}": numbers or values outside [...] cannot multiply a calculator directly. Put the calculation inside brackets (e.g. [${snippet}]).`;
        }
      }
      depth++;
    } else if (ch === ']') {
      if (depth === 0) {
        return 'Unbalanced closing bracket "]".';
      }
      depth--;
      if (depth === 0) {
        let j = i + 1;
        while (j < maskedBody.length && /\s/.test(maskedBody[j])) j++;
        if (j < maskedBody.length && /[0-9([]/.test(maskedBody[j])) {
          const snippet = maskedBody.slice(Math.max(0, i - 6), Math.min(maskedBody.length, j + 6)).trim();
          return `Syntax error near "${snippet}": values outside [...] cannot multiply a calculator directly. Wrap everything inside [...].`;
        }
      }
    }
  }
  if (depth !== 0) {
    return 'Unbalanced opening bracket "[".';
  }
  return null;
}

function findInnermostBracket(text: string): { start: number; end: number; inner: string; depth: number } | null {
  let depth = 0;
  let lastOpenIdx = -1;
  let lastOpenDepth = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '[') {
      lastOpenIdx = i;
      lastOpenDepth = depth;
      depth++;
    } else if (text[i] === ']') {
      if (lastOpenIdx !== -1) {
        return {
          start: lastOpenIdx,
          end: i,
          inner: text.slice(lastOpenIdx + 1, i),
          depth: lastOpenDepth,
        };
      }
      depth = Math.max(0, depth - 1);
    }
  }
  return null;
}

interface InternalEvalOutcome {
  ok: boolean;
  output: string;
  errorMessage?: string;
  diceRolls: Array<{ die: string; sides: number; rolled: number }>;
  stepperSnapshots: Array<{ bangId: string; step: number }>;
  scopeEvents?: MacaroniScopeAccessEvent[];
  privateOutput?: boolean;
  traceSteps: MacaroniTraceStep[];
  pendingQuery?: MacaroniQueryRequest;
}

const WRITABLE_MERGE_FIELDS = new Set<string>([
  'hp',
  'hp_current',
  'thp',
  'temp_hp',
  'gp',
  'gold',
  'str',
  'strength',
  'dex',
  'dexterity',
  'con',
  'constitution',
  'int',
  'intelligence',
  'wis',
  'wisdom',
  'cha',
  'charisma',
]);

function splitArrayRawItems(raw: string): string[] {
  let clean = raw.trim();
  const env = parseSigilEnvelope(clean);
  if (env.valid) clean = env.body.trim();
  if (clean.startsWith('(') && clean.endsWith(')')) {
    let depth = 0;
    let wrapsWhole = true;
    for (let i = 0; i < clean.length; i++) {
      if (clean[i] === '(') depth++;
      else if (clean[i] === ')') {
        depth--;
        if (depth === 0 && i < clean.length - 1) {
          wrapsWhole = false;
          break;
        }
      }
    }
    if (wrapsWhole) clean = clean.slice(1, -1).trim();
  }
  if (!clean) return [];

  // Choose delimiter & first, then |, then , outside quotes and brackets
  const trySplit = (delim: string): string[] => {
    const out: string[] = [];
    let inQ = false;
    let qChar = '';
    let bDepth = 0;
    let pDepth = 0;
    let cDepth = 0;
    let start = 0;
    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if ((ch === '"' || ch === "'") && (i === 0 || clean[i - 1] !== '\\')) {
        if (!inQ) {
          inQ = true;
          qChar = ch;
        } else if (ch === qChar) {
          inQ = false;
        }
        continue;
      }
      if (inQ) continue;
      if (ch === '[') bDepth++;
      else if (ch === ']') bDepth = Math.max(0, bDepth - 1);
      else if (ch === '(') pDepth++;
      else if (ch === ')') pDepth = Math.max(0, pDepth - 1);
      else if (ch === '{') cDepth++;
      else if (ch === '}') cDepth = Math.max(0, cDepth - 1);
      else if (bDepth === 0 && pDepth === 0 && cDepth === 0 && ch === delim) {
        out.push(clean.slice(start, i).trim());
        start = i + 1;
      }
    }
    out.push(clean.slice(start).trim());
    return out.filter(Boolean);
  };

  for (const d of ['&', '|', ',']) {
    const candidate = trySplit(d);
    if (candidate.length > 1 || (d === '&' && clean.includes('&'))) {
      return candidate;
    }
  }
  return [clean];
}

function parseArrayItemsSafe(
  rawFormula: string,
  arrayLabel: string,
  ctx: MacaroniExecutionContext,
  state: {
    diceRolls: Array<{ die: string; sides: number; rolled: number }>;
    stepperSnapshots: Array<{ bangId: string; step: number }>;
    scopeEvents: MacaroniScopeAccessEvent[];
    visitedObjects: string[];
    scopeId: string;
  }
): { ok: true; items: string[] } | { ok: false; error: string } {
  const rawParts = splitArrayRawItems(rawFormula);
  if (rawParts.length > 5) {
    return {
      ok: false,
      error: `Array limit exceeded in "{${arrayLabel}}": maximum 5 items per array (got ${rawParts.length}).`,
    };
  }
  for (const part of rawParts) {
    if (/\{[^{}]*&[^{}]*\}/.test(part)) {
      return {
        ok: false,
        error: `Arrays of arrays are disabled (nested array found inside "{${arrayLabel}}").`,
      };
    }
  }
  const items: string[] = [];
  for (let i = 0; i < rawParts.length; i++) {
    const res = resolveBodyV12(rawParts[i], {
      ...ctx,
      depth: (ctx.depth || 0) + 1,
      visitedObjects: [...state.visitedObjects, arrayLabel.toLowerCase()],
      stepperScopeId: `${state.scopeId}->${arrayLabel}[${i + 1}]`,
    });
    if (!res.ok) {
      return { ok: false, error: res.errorMessage || `Error evaluating array item #${i + 1} in "{${arrayLabel}}".` };
    }
    state.diceRolls.push(...res.diceRolls);
    state.stepperSnapshots.push(...res.stepperSnapshots);
    if (res.scopeEvents) state.scopeEvents.push(...res.scopeEvents);
    items.push(res.output);
  }
  return { ok: true, items };
}

function resolveRefName(
  rawRef: string,
  insideCalc: boolean,
  fromPullSigil: boolean,
  ctx: MacaroniExecutionContext,
  state: {
    diceRolls: Array<{ die: string; sides: number; rolled: number }>;
    stepperSnapshots: Array<{ bangId: string; step: number }>;
    scopeEvents: MacaroniScopeAccessEvent[];
    privateOutput?: boolean;
    literals?: string[];
    traceSteps: MacaroniTraceStep[];
    visitedObjects: string[];
    scopeId: string;
    pendingQuery?: MacaroniQueryRequest;
  }
): { ok: true; text: string } | { ok: false; error: string } {
  const maskInertText = (val: string): string => {
    const clean = String(val ?? '').trim();
    if (/^[+-]?\d+(?:\.\d+)?$/.test(clean) || !state.literals) return clean;
    const idx = state.literals.length;
    state.literals.push(clean);
    return `__MSTR_${idx}__`;
  };
  const cleanName = rawRef.trim();

  // 1. Reserved {dN} / {XdN} fresh die roll (1 die minimum; never cached)
  const diceMatch = cleanName.match(/^(\d*)d(\d+)$/i);
  if (diceMatch) {
    const count = diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
    const sides = parseInt(diceMatch[2], 10);
    if (!Number.isFinite(count) || count < 1) {
      return { ok: false, error: `Invalid die capsule "{${cleanName}}": 1 die is the minimum.` };
    }
    if (!Number.isFinite(sides) || sides < 1) {
      return { ok: false, error: `Invalid die capsule "{${cleanName}}": sides must be >= 1.` };
    }
    let total = 0;
    for (let r = 0; r < count; r++) {
      const rolled = Math.floor(Math.random() * sides) + 1;
      total += rolled;
      state.diceRolls.push({ die: `d${sides}`, sides, rolled });
    }
    return { ok: true, text: String(total) };
  }

  const lower = cleanName.toLowerCase();

  // 1b. Cross-sheet private read {sheet:<SheetKey>.<Field>} (inert data only, permission-checked)
  const sheetReadMatch = cleanName.match(/^sheet:([A-Za-z0-9_-]+)\.([A-Za-z0-9_]+)$/i);
  if (sheetReadMatch) {
    const sheetKey = sheetReadMatch[1].trim().toLowerCase();
    const fieldKey = sheetReadMatch[2].trim().toLowerCase();
    const requester = (ctx.requesterId || ctx.character?.name || 'owner').trim().toLowerCase();
    const sheets = ctx.externalSheets || {};
    const targetSheet = Object.values(sheets).find(
      (s) => s.id.toLowerCase() === sheetKey || s.name.toLowerCase() === sheetKey
    );
    if (!targetSheet) {
      return { ok: false, error: `External sheet "${sheetReadMatch[1]}" not found in scope.` };
    }
    const perms = targetSheet.permissions || {};
    const revoked = (perms.revokedSenders || []).map((x) => x.toLowerCase());
    if (revoked.includes(requester)) {
      state.scopeEvents.push({
        kind: 'permission_denied',
        targetSheet: targetSheet.name,
        targetField: fieldKey,
        note: `Access revoked for requester "${requester}" on sheet "${targetSheet.name}".`,
      });
      return { ok: false, error: `Permission denied: access revoked for "${requester}" on sheet "${targetSheet.name}".` };
    }
    const allowlist = (perms.readAllowlist || []).map((x) => x.toLowerCase());
    if (!allowlist.includes('*') && !allowlist.includes(requester)) {
      state.scopeEvents.push({
        kind: 'permission_denied',
        targetSheet: targetSheet.name,
        targetField: fieldKey,
        note: `Requester "${requester}" lacks read permission on sheet "${targetSheet.name}".`,
      });
      return {
        ok: false,
        error: `Permission denied: "${requester}" cannot read "${fieldKey}" from sheet "${targetSheet.name}".`,
      };
    }

    const extCtx = targetSheet.formulaContext || {};
    let readVal: unknown = extCtx[fieldKey];
    if (readVal === undefined && fieldKey in (targetSheet.character || {})) {
      readVal = (targetSheet.character as unknown as Record<string, unknown>)[fieldKey];
    }
    if (readVal === undefined) {
      return { ok: false, error: `Stat "${sheetReadMatch[2]}" not readable on sheet "${targetSheet.name}".` };
    }
    // Strictly inert scalar text/number — never executed as a macro
    const inertText = typeof readVal === 'object' ? JSON.stringify(readVal) : String(readVal);
    state.privateOutput = true;
    state.scopeEvents.push({
      kind: 'private_read',
      targetSheet: targetSheet.name,
      targetField: fieldKey,
      value: inertText,
      isPrivate: true,
      note: `Private read (${requester} <- ${targetSheet.name}.${fieldKey} = ${inertText})`,
    });
    return { ok: true, text: maskInertText(inertText) };
  }

  // 1c. Opt-in listening point read {listener:<name>} (inert data only)
  const listenerMatch = cleanName.match(/^listener:([A-Za-z_][A-Za-z0-9_]*)$/i);
  if (listenerMatch) {
    const lName = listenerMatch[1].trim().toLowerCase();
    const entry = ctx.permissions?.listeners?.[lName];
    if (!entry) {
      return { ok: false, error: `Listening point "{listener:${listenerMatch[1]}}" does not exist on this sheet.` };
    }
    if (entry.revoked) {
      return { ok: false, error: `Listening point "${listenerMatch[1]}" access is revoked.` };
    }
    const inertVal = Array.isArray(entry.lastValue) ? entry.lastValue.join(', ') : String(entry.lastValue ?? '');
    return { ok: true, text: maskInertText(inertVal) };
  }

  // 1d. Scoped temporary capsule from preceding (pasta) steps
  if (ctx.tempObjects && lower in ctx.tempObjects) {
    return { ok: true, text: ctx.tempObjects[lower] };
  }

  // 1e. Array capsule {fire&} or 1-based lookup {fire&2} (limit 5, out-of-range -> 0)
  const arrRef = isArrayCapsuleRef(cleanName);
  if (arrRef) {
    const baseLower = arrRef.base.toLowerCase();
    let items: string[] | undefined = ctx.arrayStore?.[baseLower];
    if (!items) {
      const arrFormula =
        findStoredObjectFormula(`${arrRef.base}&`, ctx) ??
        findStoredObjectFormula(arrRef.base, ctx);
      if (arrFormula !== null) {
        if (state.visitedObjects.includes(`${baseLower}&`) || (ctx.depth || 0) > 8) {
          return { ok: false, error: `Loop stopped: array "{${arrRef.base}&}" is already running.` };
        }
        const parsed = parseArrayItemsSafe(arrFormula, `${arrRef.base}&`, ctx, state);
        if (!parsed.ok) return { ok: false, error: parsed.error };
        items = parsed.items;
        if (!ctx.arrayStore) ctx.arrayStore = {};
        ctx.arrayStore[baseLower] = items;
      }
    }
    if (!items) {
      return { ok: false, error: `Unknown array capsule "{${cleanName}}".` };
    }
    if (arrRef.index === undefined) {
      return { ok: true, text: items.join(', ') };
    }
    if (arrRef.index < 1 || arrRef.index > items.length) {
      state.traceSteps.push({
        stage: `Array Lookup {${cleanName}}`,
        before: cleanName,
        after: '0',
        note: `Index ${arrRef.index} out of range (1..${items.length}); returned 0 safely.`,
      });
      return { ok: true, text: '0' };
    }
    return { ok: true, text: items[arrRef.index - 1] };
  }

  // 2. Stored custom object / macro
  const storedFormula = findStoredObjectFormula(cleanName, ctx);
  if (storedFormula !== null) {
    if (state.visitedObjects.includes(lower) || ctx.activeMacros?.includes(lower) || (ctx.depth || 0) > 8) {
      return { ok: false, error: `Cycle stopped: macro "{${cleanName}}" is already running.` };
    }

    const env = parseSigilEnvelope(storedFormula);
    if (!env.valid || !env.kind) {
      return {
        ok: false,
        error: `Object "{${cleanName}}" does not begin with a valid sigil: ${env.errorMessage}`,
      };
    }

    // Query object call rules:
    //   Called with << -> show currently displayed value
    //   Called with {} -> ask inline and use chosen answer in formula
    if (env.kind === 'query') {
      if (fromPullSigil) {
        const currentDisp = ctx.queryDisplayStore?.[lower];
        return { ok: true, text: currentDisp !== undefined ? currentDisp : '' };
      }

      if (ctx.inlineQueryAnswers && lower in ctx.inlineQueryAnswers) {
        return { ok: true, text: ctx.inlineQueryAnswers[lower] };
      }

      // Build inline query request so the runtime prompts the user
      const parsedQuery = buildQueryRequest(env.body, ctx, {
        depth: ctx.queryDepth || 1,
        visitedQueryKeys: [...(ctx.visitedQueryKeys || []), lower],
        inlineTargetName: lower,
      });
      if ('error' in parsedQuery) {
        return { ok: false, error: parsedQuery.error };
      }
      state.pendingQuery = parsedQuery.request;
      return { ok: false, error: `__PENDING_INLINE_QUERY__:${lower}` };
    }

    let resolvedText = '';
    const nextActive = [...(ctx.activeMacros || []), lower];
    if (env.kind === 'neutral') {
      const neutralRes = resolveBodyV12(env.body, {
        ...ctx,
        depth: (ctx.depth || 0) + 1,
        visitedObjects: [...state.visitedObjects, lower],
        activeMacros: nextActive,
        stepperScopeId: `${state.scopeId}->${lower}`,
      });
      if (!neutralRes.ok) {
        if (neutralRes.pendingQuery) state.pendingQuery = neutralRes.pendingQuery;
        return { ok: false, error: neutralRes.errorMessage || `Error evaluating "{${cleanName}}"` };
      }
      if (neutralRes.diceRolls) state.diceRolls.push(...neutralRes.diceRolls);
      if (neutralRes.stepperSnapshots) state.stepperSnapshots.push(...neutralRes.stepperSnapshots);
      if (neutralRes.scopeEvents) state.scopeEvents.push(...neutralRes.scopeEvents);
      if (neutralRes.privateOutput) state.privateOutput = true;
      resolvedText = neutralRes.output;
    } else {
      const childRes = executeMacaroni(storedFormula, {
        ...ctx,
        depth: (ctx.depth || 0) + 1,
        visitedObjects: [...state.visitedObjects, lower],
        activeMacros: nextActive,
        stepperScopeId: `${state.scopeId}->${lower}`,
      });

      if (childRes.isError) {
        if (childRes.queryEvent) state.pendingQuery = childRes.queryEvent;
        return { ok: false, error: childRes.errorMessage || `Error evaluating "{${cleanName}}"` };
      }
      if (childRes.diceRolls) state.diceRolls.push(...childRes.diceRolls);
      if (childRes.stepperSnapshots) state.stepperSnapshots.push(...childRes.stepperSnapshots);
      if (childRes.scopeEvents) state.scopeEvents.push(...childRes.scopeEvents);
      if (childRes.privateOutput) state.privateOutput = true;
      resolvedText = childRes.fullOutput;
    }

    // If inside [...] and unbracketed arithmetic came back (e.g. ==5+5), parenthesize safely
    if (insideCalc && /[+\-*/%]/.test(resolvedText) && !/^[+-]?\d+(\.\d+)?$/.test(resolvedText)) {
      resolvedText = `(${resolvedText})`;
    }
    return { ok: true, text: resolvedText };
  }

  // 3. Sheet field / formulaContext lookup (inert data only, never executed as macro)
  const fieldVal = resolveFieldFromContext(cleanName, ctx);
  if (fieldVal !== undefined) {
    return { ok: true, text: String(fieldVal).trim() };
  }

  return { ok: false, error: `Unknown object or field "{${cleanName}}".` };
}

function isBooliTruthy(val: string): boolean {
  const s = String(val ?? '').trim().toLowerCase();
  if (!s || s === 'false' || s === '0' || s === 'no' || s === 'null' || s === 'undefined') {
    return false;
  }
  const n = Number(s);
  if (Number.isFinite(n)) return n !== 0;
  return true;
}

function splitOutsideDelims(input: string, delim: string): string[] {
  const out: string[] = [];
  let inQ = false;
  let qChar = '';
  let bDepth = 0;
  let pDepth = 0;
  let cDepth = 0;
  let aDepth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' || ch === "'") {
      if (!inQ) {
        inQ = true;
        qChar = ch;
      } else if (ch === qChar && input[i - 1] !== '\\') {
        inQ = false;
      }
      continue;
    }
    if (inQ) continue;
    if (ch === '[') bDepth++;
    else if (ch === ']') bDepth = Math.max(0, bDepth - 1);
    else if (ch === '(') pDepth++;
    else if (ch === ')') pDepth = Math.max(0, pDepth - 1);
    else if (ch === '{') cDepth++;
    else if (ch === '}') cDepth = Math.max(0, cDepth - 1);
    else if (ch === '<' && bDepth === 0) aDepth++;
    else if (ch === '>' && bDepth === 0) aDepth = Math.max(0, aDepth - 1);
    else if (
      bDepth === 0 &&
      pDepth === 0 &&
      cDepth === 0 &&
      aDepth === 0 &&
      input.slice(i, i + delim.length) === delim
    ) {
      out.push(input.slice(start, i));
      start = i + delim.length;
      i += delim.length - 1;
    }
  }
  out.push(input.slice(start));
  return out;
}

function findFirstTopLevelChar(input: string, target: string): number {
  let inQ = false;
  let qChar = '';
  let bDepth = 0;
  let pDepth = 0;
  let cDepth = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' || ch === "'") {
      if (!inQ) {
        inQ = true;
        qChar = ch;
      } else if (ch === qChar && input[i - 1] !== '\\') {
        inQ = false;
      }
      continue;
    }
    if (inQ) continue;
    if (ch === '[') bDepth++;
    else if (ch === ']') bDepth = Math.max(0, bDepth - 1);
    else if (ch === '(') pDepth++;
    else if (ch === ')') pDepth = Math.max(0, pDepth - 1);
    else if (ch === '{') cDepth++;
    else if (ch === '}') cDepth = Math.max(0, cDepth - 1);
    else if (bDepth === 0 && pDepth === 0 && cDepth === 0 && ch === target) {
      return i;
    }
  }
  return -1;
}

function hasTopLevelPastaMarkers(masked: string): boolean {
  let bDepth = 0;
  let cDepth = 0;
  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (ch === '[') {
      bDepth++;
      continue;
    }
    if (ch === ']') {
      bDepth = Math.max(0, bDepth - 1);
      continue;
    }
    if (ch === '{') {
      cDepth++;
      continue;
    }
    if (ch === '}') {
      cDepth = Math.max(0, cDepth - 1);
      continue;
    }
    if (bDepth === 0 && cDepth === 0) {
      if ('()<>/\\?=+'.includes(ch)) return true;
    }
  }
  return false;
}

function compareBooliValues(leftRaw: string, op: string, rightRaw: string): boolean {
  const aTrim = leftRaw.trim();
  const bTrim = rightRaw.trim();
  const aNum = Number(aTrim);
  const bNum = Number(bTrim);
  const bothNum = aTrim !== '' && bTrim !== '' && Number.isFinite(aNum) && Number.isFinite(bNum);

  if (op === '=' || op === '==') return bothNum ? aNum === bNum : aTrim === bTrim;
  if (op === '<>' || op === '!=') return bothNum ? aNum !== bNum : aTrim !== bTrim;
  if (!bothNum) {
    if (op === '>') return aTrim > bTrim;
    if (op === '<') return aTrim < bTrim;
    if (op === '>=' || op === '=>') return aTrim >= bTrim;
    if (op === '<=' || op === '=<') return aTrim <= bTrim;
    return false;
  }
  if (op === '>') return aNum > bNum;
  if (op === '<') return aNum < bNum;
  if (op === '>=' || op === '=>') return aNum >= bNum;
  if (op === '<=' || op === '=<') return aNum <= bNum;
  return false;
}

function tokenizePastaSteps(rawBody: string): { ok: true; chunks: Array<{ kind: 'paren' | 'angle' | 'plain'; text: string }> } | { ok: false; error: string } {
  const chunks: Array<{ kind: 'paren' | 'angle' | 'plain'; text: string }> = [];
  let i = 0;
  const n = rawBody.length;
  let plainStart = 0;
  let bDepth = 0;
  let cDepth = 0;
  let inQ = false;
  let qChar = '';

  const flushPlain = (endIdx: number) => {
    const seg = rawBody.slice(plainStart, endIdx).trim();
    if (seg) chunks.push({ kind: 'plain', text: seg });
  };

  while (i < n) {
    const ch = rawBody[i];
    if (ch === '"' || ch === "'") {
      if (!inQ) {
        inQ = true;
        qChar = ch;
      } else if (ch === qChar && rawBody[i - 1] !== '\\') {
        inQ = false;
      }
      i++;
      continue;
    }
    if (inQ) {
      i++;
      continue;
    }
    if (ch === '[') {
      bDepth++;
      i++;
      continue;
    }
    if (ch === ']') {
      bDepth = Math.max(0, bDepth - 1);
      i++;
      continue;
    }
    if (ch === '{') {
      cDepth++;
      i++;
      continue;
    }
    if (ch === '}') {
      cDepth = Math.max(0, cDepth - 1);
      i++;
      continue;
    }

    if (bDepth === 0 && cDepth === 0 && (ch === '(' || ch === '<')) {
      flushPlain(i);
      const openChar = ch;
      const closeChar = ch === '(' ? ')' : '>';
      let depth = 1;
      let j = i + 1;
      let innerQ = false;
      let innerQC = '';
      let innerB = 0;
      while (j < n && depth > 0) {
        const jc = rawBody[j];
        if (jc === '"' || jc === "'") {
          if (!innerQ) {
            innerQ = true;
            innerQC = jc;
          } else if (jc === innerQC && rawBody[j - 1] !== '\\') {
            innerQ = false;
          }
        } else if (!innerQ) {
          if (jc === '[') innerB++;
          else if (jc === ']') innerB = Math.max(0, innerB - 1);
          else if (innerB === 0) {
            if (jc === openChar) depth++;
            else if (jc === closeChar) depth--;
          }
        }
        j++;
      }
      if (depth !== 0) {
        return {
          ok: false,
          error:
            openChar === '<'
              ? 'Unclosed booli "<...>" (missing closing ">").'
              : 'Unclosed "(pasta)" group (missing closing ")").',
        };
      }
      chunks.push({
        kind: openChar === '(' ? 'paren' : 'angle',
        text: rawBody.slice(i + 1, j - 1).trim(),
      });
      i = j;
      plainStart = j;
      continue;
    }
    i++;
  }
  flushPlain(n);
  return { ok: true, chunks };
}

function resolveSinglePastaChunk(
  chunkText: string,
  isAngleBooli: boolean,
  ctx: MacaroniExecutionContext,
  opts: { scopeId?: string; isPullTopLevel?: boolean },
  acc: {
    diceRolls: Array<{ die: string; sides: number; rolled: number }>;
    stepperSnapshots: Array<{ bangId: string; step: number }>;
    scopeEvents: MacaroniScopeAccessEvent[];
    traceSteps: MacaroniTraceStep[];
    privateOutput?: boolean;
  }
): { ok: true; output: string } | { ok: false; errorMessage: string; pendingQuery?: MacaroniQueryRequest } {
  const trimmed = chunkText.trim();
  if (!trimmed) return { ok: true, output: '' };

  // 1. Naming assignment inside pasta: ("thetest"=[2+2]) or (thetest=[2+2]) or ("fire&"=[3]&[5])
  if (!isAngleBooli) {
    const assignMatch = trimmed.match(
      /^(?:"([A-Za-z_][A-Za-z0-9_]*&?)"|'([A-Za-z_][A-Za-z0-9_]*&?)'|([A-Za-z_][A-Za-z0-9_]*&?))\s*=(?![=<>])\s*(.+)$/s
    );
    if (assignMatch) {
      const rawName = (assignMatch[1] || assignMatch[2] || assignMatch[3] || '').trim();
      const rhsExpr = assignMatch[4].trim();
      const nameCheck = validateObjectName(rawName);
      if (!nameCheck.valid) {
        return { ok: false, errorMessage: nameCheck.reason || `Invalid variable name "${rawName}".` };
      }
      if (rawName.endsWith('&')) {
        const parsedArr = parseArrayItemsSafe(rhsExpr, rawName, ctx, {
          diceRolls: acc.diceRolls,
          stepperSnapshots: acc.stepperSnapshots,
          scopeEvents: acc.scopeEvents,
          visitedObjects: [...(ctx.visitedObjects || [])],
          scopeId: opts.scopeId || ctx.stepperScopeId || 'root',
        });
        if (!parsedArr.ok) return { ok: false, errorMessage: parsedArr.error };
        if (!ctx.arrayStore) ctx.arrayStore = {};
        ctx.arrayStore[rawName.slice(0, -1).toLowerCase()] = parsedArr.items;
        acc.traceSteps.push({
          stage: `Pasta Array (${rawName})`,
          before: trimmed,
          after: parsedArr.items.join(', '),
        });
        return { ok: true, output: '' };
      }

      const rhsRes = resolveBodyV12(rhsExpr, ctx, opts);
      if (!rhsRes.ok) {
        return { ok: false, errorMessage: rhsRes.errorMessage || 'Error in assignment', pendingQuery: rhsRes.pendingQuery };
      }
      acc.diceRolls.push(...rhsRes.diceRolls);
      acc.stepperSnapshots.push(...rhsRes.stepperSnapshots);
      if (rhsRes.scopeEvents) acc.scopeEvents.push(...rhsRes.scopeEvents);
      if (rhsRes.privateOutput) acc.privateOutput = true;

      if (!ctx.tempObjects) ctx.tempObjects = {};
      ctx.tempObjects[rawName.toLowerCase()] = rhsRes.output;
      acc.traceSteps.push({
        stage: `Pasta Assign (${rawName} =)`,
        before: trimmed,
        after: rhsRes.output,
      });
      return { ok: true, output: '' };
    }
  }

  // 2. Booli conditional (? or inside <booli>) with / (THEN) and optional \ (ELSE)
  const qIdx = findFirstTopLevelChar(trimmed, '?');
  const slashIdx = findFirstTopLevelChar(trimmed, '/');
  if (isAngleBooli || qIdx !== -1) {
    let condPart = trimmed;
    let thenPart = '';
    let elsePart = '';
    let hasBranches = false;

    if (slashIdx !== -1 && (qIdx === -1 || slashIdx > qIdx)) {
      hasBranches = true;
      condPart = trimmed.slice(0, slashIdx).trim();
      const tail = trimmed.slice(slashIdx + 1);
      const backIdx = findFirstTopLevelChar(tail, '\\');
      if (backIdx !== -1) {
        thenPart = tail.slice(0, backIdx).trim();
        elsePart = tail.slice(backIdx + 1).trim();
      } else {
        thenPart = tail.trim();
      }
    }

    let conditionMet = false;
    const condQ = findFirstTopLevelChar(condPart, '?');
    if (condQ !== -1) {
      const lhsRaw = condPart.slice(0, condQ).trim();
      const rhsAfterQ = condPart.slice(condQ + 1).trim();
      const lhsRes = resolveBodyV12(lhsRaw, ctx, opts);
      if (!lhsRes.ok) {
        return { ok: false, errorMessage: lhsRes.errorMessage || 'Booli LHS error', pendingQuery: lhsRes.pendingQuery };
      }
      acc.diceRolls.push(...lhsRes.diceRolls);
      acc.stepperSnapshots.push(...lhsRes.stepperSnapshots);
      if (lhsRes.scopeEvents) acc.scopeEvents.push(...lhsRes.scopeEvents);
      if (lhsRes.privateOutput) acc.privateOutput = true;

      if (!rhsAfterQ) {
        conditionMet = isBooliTruthy(lhsRes.output);
      } else {
        const cmpMatch = rhsAfterQ.match(/^(>=|=>|<=|=<|<>|!=|=|>|<)\s*(.+)$/s);
        const cmpOp = cmpMatch ? cmpMatch[1] : '=';
        const rhsExpr = cmpMatch ? cmpMatch[2].trim() : rhsAfterQ;
        const rhsRes = resolveBodyV12(rhsExpr, ctx, opts);
        if (!rhsRes.ok) {
          return { ok: false, errorMessage: rhsRes.errorMessage || 'Booli RHS error', pendingQuery: rhsRes.pendingQuery };
        }
        acc.diceRolls.push(...rhsRes.diceRolls);
        acc.stepperSnapshots.push(...rhsRes.stepperSnapshots);
        if (rhsRes.scopeEvents) acc.scopeEvents.push(...rhsRes.scopeEvents);
        if (rhsRes.privateOutput) acc.privateOutput = true;
        conditionMet = compareBooliValues(lhsRes.output, cmpOp, rhsRes.output);
      }
    } else {
      const condRes = resolveBodyV12(condPart, ctx, opts);
      if (!condRes.ok) {
        return { ok: false, errorMessage: condRes.errorMessage || 'Booli condition error', pendingQuery: condRes.pendingQuery };
      }
      acc.diceRolls.push(...condRes.diceRolls);
      acc.stepperSnapshots.push(...condRes.stepperSnapshots);
      if (condRes.scopeEvents) acc.scopeEvents.push(...condRes.scopeEvents);
      if (condRes.privateOutput) acc.privateOutput = true;
      conditionMet = isBooliTruthy(condRes.output);
    }

    if (!hasBranches) {
      const boolStr = conditionMet ? 'true' : 'false';
      acc.traceSteps.push({ stage: 'Booli Check', before: trimmed, after: boolStr });
      return { ok: true, output: boolStr };
    }

    const chosenBranch = conditionMet ? thenPart : elsePart;
    acc.traceSteps.push({
      stage: `Booli (${conditionMet ? 'THEN /' : 'ELSE \\'})`,
      before: trimmed,
      after: chosenBranch || '(empty)',
    });
    if (!chosenBranch) return { ok: true, output: '' };
    const branchRes = resolveBodyV12(chosenBranch, ctx, opts);
    if (!branchRes.ok) {
      return {
        ok: false,
        errorMessage: branchRes.errorMessage || 'Error in booli branch',
        pendingQuery: branchRes.pendingQuery,
      };
    }
    acc.diceRolls.push(...branchRes.diceRolls);
    acc.stepperSnapshots.push(...branchRes.stepperSnapshots);
    if (branchRes.scopeEvents) acc.scopeEvents.push(...branchRes.scopeEvents);
    if (branchRes.privateOutput) acc.privateOutput = true;
    acc.traceSteps.push(...branchRes.traceSteps);
    return { ok: true, output: branchRes.output };
  }

  // 3. Reject bare / outside calculators [...] and outside booli
  if (slashIdx !== -1) {
    return {
      ok: false,
      errorMessage: 'Error: "/" can only divide inside calculator brackets [...], or mark THEN inside a booli (? cond / then \\ else).',
    };
  }

  // 4. Side-by-side '+' concatenation outside [...]
  const plusParts = splitOutsideDelims(trimmed, '+');
  if (plusParts.length > 1) {
    let joined = '';
    for (const part of plusParts) {
      const pTrim = part.trim();
      if (!pTrim) continue;
      const quotedOnly = pTrim.match(/^"([^"]*)"$|^'([^']*)'$/);
      if (quotedOnly) {
        joined += quotedOnly[1] !== undefined ? quotedOnly[1] : (quotedOnly[2] ?? '');
        continue;
      }
      const pieceRes = resolveBodyV12(pTrim, ctx, opts);
      if (!pieceRes.ok) {
        return { ok: false, errorMessage: pieceRes.errorMessage || 'Error in + concatenation', pendingQuery: pieceRes.pendingQuery };
      }
      acc.diceRolls.push(...pieceRes.diceRolls);
      acc.stepperSnapshots.push(...pieceRes.stepperSnapshots);
      if (pieceRes.scopeEvents) acc.scopeEvents.push(...pieceRes.scopeEvents);
      if (pieceRes.privateOutput) acc.privateOutput = true;
      joined += pieceRes.output;
    }
    return { ok: true, output: joined };
  }

  // 5. Standard scalar evaluation
  const scalar = resolveScalarBody(trimmed, ctx, opts);
  if (!scalar.ok) {
    return { ok: false, errorMessage: scalar.errorMessage || 'Scalar error', pendingQuery: scalar.pendingQuery };
  }
  acc.diceRolls.push(...scalar.diceRolls);
  acc.stepperSnapshots.push(...scalar.stepperSnapshots);
  if (scalar.scopeEvents) acc.scopeEvents.push(...scalar.scopeEvents);
  if (scalar.privateOutput) acc.privateOutput = true;
  acc.traceSteps.push(...scalar.traceSteps);
  return { ok: true, output: scalar.output };
}

/**
 * Resolves a body strictly following Macroni 1.2 + Pasta Layer rules:
 * - If (pasta) sequential steps, <booli> branches, assignments, or side-by-side + exist outside [...], executes left-to-right.
 * - Otherwise resolves scalar body: {objects}/{dice}/{arrays} -> inner [...] -> outer [...] -> #calls -> output.
 */
function resolveBodyV12(
  rawBody: string,
  ctx: MacaroniExecutionContext,
  opts: { scopeId?: string; isPullTopLevel?: boolean } = {}
): InternalEvalOutcome {
  const { masked } = protectQuotes(rawBody);
  if (!hasTopLevelPastaMarkers(masked)) {
    return resolveScalarBody(rawBody, ctx, opts);
  }

  // Reject unclosed outside [...] juxtaposition before pasta tokenization too
  const juxErr = checkOutsideCalculatorJuxtaposition(masked);
  if (juxErr) {
    return { ok: false, output: juxErr, errorMessage: juxErr, diceRolls: [], stepperSnapshots: [], traceSteps: [] };
  }

  const chunked = tokenizePastaSteps(rawBody);
  if (!chunked.ok) {
    return {
      ok: false,
      output: chunked.error,
      errorMessage: chunked.error,
      diceRolls: [],
      stepperSnapshots: [],
      traceSteps: [],
    };
  }

  // Single plain chunk falls directly through resolveSinglePastaChunk -> resolveScalarBody if plain
  const seqCtx: MacaroniExecutionContext = {
    ...ctx,
    tempObjects: ctx.tempObjects || {},
    arrayStore: ctx.arrayStore || {},
  };
  const acc = {
    diceRolls: [] as Array<{ die: string; sides: number; rolled: number }>,
    stepperSnapshots: [] as Array<{ bangId: string; step: number }>,
    scopeEvents: [] as MacaroniScopeAccessEvent[],
    traceSteps: [] as MacaroniTraceStep[],
    privateOutput: false,
  };

  const outputs: string[] = [];
  for (let idx = 0; idx < chunked.chunks.length; idx++) {
    const ch = chunked.chunks[idx];
    const stepScope = `${opts.scopeId || ctx.stepperScopeId || 'root'}::step-${idx + 1}`;
    const stepRes = resolveSinglePastaChunk(
      ch.text,
      ch.kind === 'angle',
      seqCtx,
      { ...opts, scopeId: stepScope },
      acc
    );
    if (!stepRes.ok) {
      return {
        ok: false,
        output: stepRes.errorMessage,
        errorMessage: stepRes.errorMessage,
        diceRolls: acc.diceRolls,
        stepperSnapshots: acc.stepperSnapshots,
        scopeEvents: acc.scopeEvents,
        privateOutput: acc.privateOutput,
        traceSteps: acc.traceSteps,
        pendingQuery: stepRes.pendingQuery,
      };
    }
    if (stepRes.output !== '') {
      outputs.push(stepRes.output);
    }
  }

  return {
    ok: true,
    output: outputs.join(' ').trim(),
    diceRolls: acc.diceRolls,
    stepperSnapshots: acc.stepperSnapshots,
    scopeEvents: acc.scopeEvents.length ? acc.scopeEvents : undefined,
    privateOutput: acc.privateOutput || undefined,
    traceSteps: acc.traceSteps,
  };
}

function resolveScalarBody(
  rawBody: string,
  ctx: MacaroniExecutionContext,
  opts: { scopeId?: string; isPullTopLevel?: boolean } = {}
): InternalEvalOutcome {
  const scopeId = opts.scopeId || ctx.stepperScopeId || 'root';
  const diceRolls: Array<{ die: string; sides: number; rolled: number }> = [];
  const stepperSnapshots: Array<{ bangId: string; step: number }> = [];
  const scopeEvents: MacaroniScopeAccessEvent[] = [];
  const traceSteps: MacaroniTraceStep[] = [];
  const visitedObjects = [...(ctx.visitedObjects || [])];

  const { masked, literals } = protectQuotes(rawBody);
  const juxErr = checkOutsideCalculatorJuxtaposition(masked);
  if (juxErr) {
    return {
      ok: false,
      output: juxErr,
      errorMessage: juxErr,
      diceRolls,
      stepperSnapshots,
      traceSteps,
    };
  }

  let current = masked;

  // Step 0: Increment & resolve each ! stepper as its own numeric object (0 -> 1 before multiplication)
  if (current.includes('!')) {
    if (ctx.permissions?.allowStepper === false) {
      const err = 'Permission denied: stepper (!) execution is disabled by sheet permissions.';
      return { ok: false, output: err, errorMessage: err, diceRolls, stepperSnapshots, traceSteps };
    }
    const beforeBang = current;
    let bangIdx = 0;
    current = current.replace(/!/g, () => {
      bangIdx += 1;
      const bangId = `${scopeId}::bang-${bangIdx}`;
      let nextStep: number;
      if (ctx.stepperStore) {
        nextStep = (ctx.stepperStore[bangId] ?? 0) + 1;
        ctx.stepperStore[bangId] = nextStep;
      } else if (ctx.stepCount !== undefined) {
        nextStep = ctx.stepCount <= 0 ? 1 : ctx.stepCount;
      } else {
        nextStep = 1;
      }
      stepperSnapshots.push({ bangId, step: nextStep });
      return String(nextStep);
    });
    traceSteps.push({
      stage: '0. Stepper (!) Objects',
      before: restoreQuotes(beforeBang, literals, true),
      after: restoreQuotes(current, literals, true),
      note: stepperSnapshots.map((s) => `${s.bangId}=${s.step}`).join(', '),
    });
  }

  const refState = {
    diceRolls,
    stepperSnapshots,
    scopeEvents,
    privateOutput: false,
    literals,
    traceSteps,
    visitedObjects,
    scopeId,
    pendingQuery: undefined as MacaroniQueryRequest | undefined,
  };

  // Step 1: Resolve {object}, {dN}/{XdN}, {fire&}/{fire&2}, {sheet:...}, {listener:...}
  if (current.includes('{')) {
    const beforeRefs = current;
    let guard = 0;
    while (/\{([^{}]+)\}/.test(current) && guard < 32) {
      guard += 1;
      let errFound: string | null = null;
      current = current.replace(/\{([^{}]+)\}/g, (_m, name, offset) => {
        if (errFound) return _m;
        // Check whether this {name} sits inside [...]
        let depthAtOffset = 0;
        for (let k = 0; k < offset; k++) {
          if (current[k] === '[') depthAtOffset++;
          else if (current[k] === ']') depthAtOffset = Math.max(0, depthAtOffset - 1);
        }
        const resolved = resolveRefName(
          name,
          depthAtOffset > 0,
          Boolean(opts.isPullTopLevel && depthAtOffset === 0),
          ctx,
          refState
        );
        if (!resolved.ok) {
          errFound = resolved.error;
          return _m;
        }
        if (resolved.text.includes('__PENDING_INLINE_QUERY__')) {
          return _m;
        }
        return resolved.text;
      });
      if (errFound) {
        const cleanMsg = String(errFound).replace(/^__PENDING_INLINE_QUERY__:/, 'Inline query required: ');
        return {
          ok: false,
          output: cleanMsg,
          errorMessage: cleanMsg,
          diceRolls,
          stepperSnapshots,
          scopeEvents: scopeEvents.length ? scopeEvents : undefined,
          privateOutput: refState.privateOutput || undefined,
          traceSteps,
          pendingQuery: refState.pendingQuery,
        };
      }
    }
    traceSteps.push({
      stage: '1. Objects {} & Dice {dN}',
      before: restoreQuotes(beforeRefs, literals, true),
      after: restoreQuotes(current, literals, true),
      note: diceRolls.length ? diceRolls.map((d) => `${d.die}→${d.rolled}`).join(', ') : undefined,
    });
  }

  // Step 2 & 3: Evaluate brackets [...], innermost first, outward, then outermost bracket
  let bracketPass = 0;
  let innermost = findInnermostBracket(current);
  while (innermost) {
    bracketPass += 1;
    let innerExpr = innermost.inner;

    // If legacy #calls exist inside brackets, resolve them behind the scenes as {}
    if (innerExpr.includes('#')) {
      let hashErr: string | null = null;
      innerExpr = innerExpr.replace(/#\(([^)]+)\)|#([A-Za-z_][A-Za-z0-9_]*)/g, (_m, b, s) => {
        if (hashErr) return _m;
        const resolved = resolveRefName(b || s, true, false, ctx, refState);
        if (!resolved.ok) {
          hashErr = resolved.error;
          return _m;
        }
        return resolved.text;
      });
      if (hashErr) {
        return {
          ok: false,
          output: hashErr,
          errorMessage: hashErr,
          diceRolls,
          stepperSnapshots,
          scopeEvents: scopeEvents.length ? scopeEvents : undefined,
          traceSteps,
        };
      }
    }

    // Also allow compact NdM inside [...] (e.g. 1d20), enforcing minimum 1 die
    let diceErr: string | null = null;
    innerExpr = innerExpr.replace(/\b(\d*)d(\d+)\b/gi, (m, cStr, sStr) => {
      if (diceErr) return m;
      const count = cStr ? parseInt(cStr, 10) : 1;
      const sides = parseInt(sStr, 10);
      if (count < 1) {
        diceErr = `Invalid die "${m}": 1 die is the minimum.`;
        return m;
      }
      if (sides < 1) {
        diceErr = `Invalid die "${m}": sides must be >= 1.`;
        return m;
      }
      let sum = 0;
      for (let r = 0; r < count; r++) {
        const rolled = Math.floor(Math.random() * sides) + 1;
        sum += rolled;
        diceRolls.push({ die: `d${sides}`, sides, rolled });
      }
      return String(sum);
    });
    if (diceErr) {
      return { ok: false, output: diceErr, errorMessage: diceErr, diceRolls, stepperSnapshots, traceSteps };
    }

    const calc = evaluateCalculatorBracket(innerExpr);
    if (!calc.ok) {
      return {
        ok: false,
        output: calc.error,
        errorMessage: calc.error,
        diceRolls,
        stepperSnapshots,
        traceSteps,
      };
    }

    let replacement = calc.display;
    if (!calc.isBool && innermost.depth >= 1) {
      // Implicit multiplication ONLY inside an enclosing [...] (e.g. [4[3]] -> [4*3])
      const prevChar = current[innermost.start - 1];
      const nextChar = current[innermost.end + 1];
      if (prevChar && /[0-9)]/.test(prevChar)) {
        replacement = `*${replacement}`;
      }
      if (nextChar && /[0-9(]/.test(nextChar)) {
        replacement = `${replacement}*`;
      }
    }

    const beforeBracket = current;
    current = current.slice(0, innermost.start) + replacement + current.slice(innermost.end + 1);
    const hasMore = Boolean(findInnermostBracket(current));
    traceSteps.push({
      stage: hasMore
        ? `2. Inner Bracket #${bracketPass}`
        : bracketPass === 1
        ? '3. Calculator Bracket []'
        : '3. Outermost Bracket []',
      before: restoreQuotes(beforeBracket, literals, true),
      after: restoreQuotes(current, literals, true),
      note: `[${innermost.inner}] = ${calc.display}`,
    });

    innermost = findInnermostBracket(current);
  }

  // Step 4: #calls last (kept for legacy macros and treated as {} behind the scenes)
  if (current.includes('#')) {
    const beforeHash = current;
    let hashErr: string | null = null;
    current = current.replace(/#\(([^)]+)\)|#([A-Za-z_][A-Za-z0-9_]*)/g, (_m, b, s) => {
      if (hashErr) return _m;
      const resolved = resolveRefName(b || s, false, false, ctx, refState);
      if (!resolved.ok) {
        hashErr = resolved.error;
        return _m;
      }
      return resolved.text;
    });
    if (hashErr) {
      return {
        ok: false,
        output: hashErr,
        errorMessage: hashErr,
        diceRolls,
        stepperSnapshots,
        traceSteps,
      };
    }
    traceSteps.push({
      stage: '4. Legacy #Calls',
      before: restoreQuotes(beforeHash, literals, true),
      after: restoreQuotes(current, literals, true),
    });
  }

  // Bare '/' outside [...] in scalar context is disallowed
  if (current.includes('/')) {
    const err = 'Error: "/" can only divide inside calculator brackets [...], or mark THEN inside a booli.';
    return { ok: false, output: err, errorMessage: err, diceRolls, stepperSnapshots, traceSteps };
  }

  // Step 5: Print result (restore string literals unquoted; preserve author's explicit spaces when inside a plain string literal)
  const rawRestored = restoreQuotes(current, literals, false).replace(/\s{2,}/g, ' ');
  const finalOutput = /^__MSTR_\d+__$/.test(current.trim()) ? rawRestored : rawRestored.trim();

  traceSteps.push({
    stage: '5. Final Output',
    before: restoreQuotes(current, literals, true),
    after: finalOutput,
  });

  return {
    ok: true,
    output: finalOutput,
    diceRolls,
    stepperSnapshots,
    scopeEvents: scopeEvents.length ? scopeEvents : undefined,
    privateOutput: refState.privateOutput || undefined,
    traceSteps,
  };
}

// ============================================================================
// QUERY (<?>) PARSING & SIGIL-DEPENDENT EXECUTION
// ============================================================================

function splitOutsideQuotesByPipe(body: string): string[] {
  const parts: string[] = [];
  let inQuote = false;
  let quoteChar = '';
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if ((ch === '"' || ch === "'") && (i === 0 || body[i - 1] !== '\\')) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === quoteChar) {
        inQuote = false;
      }
    } else if (!inQuote && ch === '|') {
      parts.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(body.slice(start).trim());
  return parts.filter((s) => s.length > 0);
}

function buildQueryRequest(
  body: string,
  ctx: MacaroniExecutionContext,
  meta: { depth: number; visitedQueryKeys: string[]; inlineTargetName?: string }
): { request: MacaroniQueryRequest } | { error: string } {
  if (meta.depth > 5) {
    return { error: 'Stopped: query depth exceeded maximum of 5 levels.' };
  }

  const segments = splitOutsideQuotesByPipe(body);
  if (segments.length === 0) {
    return { error: 'Query <?> requires a prompt and at least one option.' };
  }

  let prompt = 'Choose an option';
  let optSegments = segments;
  const firstQuote = segments[0].match(/^"([^"]*)"$/);
  if (firstQuote) {
    prompt = firstQuote[1];
    optSegments = segments.slice(1);
  }

  if (optSegments.length === 0) {
    return { error: 'Query <?> requires at least one clickable option after "|".' };
  }

  const options: MacaroniQueryOption[] = optSegments.map((seg) => {
    const labeledMatch = seg.match(/^"([^"]*)"\s*=\s*\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
    const bareObjMatch = seg.match(/^\{([A-Za-z_][A-Za-z0-9_]*)\}$/);

    const objName = labeledMatch?.[2] || bareObjMatch?.[1];
    if (objName) {
      const label = labeledMatch ? labeledMatch[1] : objName;
      const formula = findStoredObjectFormula(objName, ctx);
      let targetSigil: MacaroniQueryOption['targetSigil'] = 'none';
      if (formula) {
        const env = parseSigilEnvelope(formula);
        targetSigil = env.valid && env.kind ? env.kind : 'none';
      }
      return {
        label,
        value: objName,
        objectName: objName,
        targetSigil,
        targetFormula: formula || undefined,
      };
    }

    return {
      label: seg.replace(/^"|"$/g, ''),
      value: seg,
      targetSigil: 'none',
    };
  });

  return {
    request: {
      id: `query-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      prompt,
      options,
      depth: meta.depth,
      visitedQueryKeys: meta.visitedQueryKeys,
      inlineCallSite: meta.inlineTargetName
        ? { targetQueryName: meta.inlineTargetName, parentExpression: '' }
        : undefined,
      onSelect: () => {},
    },
  };
}

export interface QueryClickOutcome {
  action: 'replace_window' | 'show_in_place' | 'noop' | 'stopped';
  message: string;
  result?: MacaroniExecutionResult;
  nextQueryEvent?: MacaroniQueryRequest;
}

/**
 * Handles clicking an option inside a <?> Query dialog according to Macroni 1.2 rules:
 * - Target sigil is Make (<>, <?>, <^>, <!>): replaces query window
 * - Target sigil is Pull (<<): shows result where query started; keeps query open
 * - Target sigil is Neutral (==) or none: nothing happens
 * - Query depth capped at 5; reopening an already-active query stops with message
 */
export function resolveQueryOptionAction(
  option: MacaroniQueryOption,
  ctx: MacaroniExecutionContext,
  currentQuery: MacaroniQueryRequest
): QueryClickOutcome {
  if (!option.objectName || !option.targetFormula) {
    return { action: 'noop', message: 'Option has no target macro (no effect).' };
  }

  const objKey = option.objectName.toLowerCase();
  const env = parseSigilEnvelope(option.targetFormula);
  if (!env.valid || !env.kind || env.kind === 'neutral') {
    return { action: 'noop', message: 'Neutral (==) or un-sigiled object: nothing happens.' };
  }

  const visited = currentQuery.visitedQueryKeys || [];
  const nextDepth = (currentQuery.depth || 1) + 1;

  if (env.kind === 'query') {
    if (visited.includes(objKey)) {
      return {
        action: 'stopped',
        message: `Stopped: query "${option.objectName}" tried to reopen itself.`,
      };
    }
    if (nextDepth > 5) {
      return {
        action: 'stopped',
        message: 'Stopped: query depth limit (5 levels) exceeded.',
      };
    }
  }

  const evalRes = executeMacaroni(option.targetFormula, {
    ...ctx,
    queryDepth: nextDepth,
    visitedQueryKeys: [...visited, objKey],
  });

  if (evalRes.isError) {
    return {
      action: 'stopped',
      message: evalRes.errorMessage || 'Query option failed.',
      result: evalRes,
    };
  }

  if (env.kind === 'pull') {
    return {
      action: 'show_in_place',
      message: evalRes.fullOutput,
      result: evalRes,
    };
  }

  if (env.kind === 'make' || env.kind === 'query' || env.kind === 'modifier' || env.kind === 'stepper') {
    return {
      action: 'replace_window',
      message: evalRes.fullOutput,
      result: evalRes,
      nextQueryEvent: evalRes.queryEvent,
    };
  }

  return { action: 'noop', message: 'Nothing happens.' };
}

// ============================================================================
// MODIFIER (<^>) PARSING & BUFF BOX UPSERT BY (NAME, BONUSTYPE)
// ============================================================================

export function parseMacaroniBuffMake(
  innerContent: string,
  macroName: string | undefined,
  isLockedOnce: boolean,
  ctx: MacaroniExecutionContext
): MacaroniBuffMakeSpec | null {
  const trimmed = innerContent.trim();
  if (!trimmed) return null;

  // Format A (Macroni 1.2 structured inline): Name | Target | BonusType | ValueExpr
  const pipeParts = trimmed.split('|').map((s) => s.trim()).filter(Boolean);
  if (pipeParts.length >= 4) {
    const buffName = pipeParts[0].replace(/^"|"$/g, '');
    const stat = resolveBuffStatTarget(pipeParts[1]);
    const bonusType = resolveBuffBonusType(pipeParts[2]);
    const valBody = pipeParts.slice(3).join('|');
    const resolvedVal = resolveBodyV12(valBody, ctx, { scopeId: `buff:${buffName}` });
    if (!stat || !resolvedVal.ok) return null;
    const numVal = Number(resolvedVal.output);
    if (!Number.isFinite(numVal)) return null;
    const col = BUFF_MATRIX_COLUMNS.indexOf(stat) + 1;
    const row = BUFF_MATRIX_ROWS.indexOf(bonusType) + 1;
    return {
      raw: `<^> ${trimmed}`,
      name: buffName,
      isDirectMatrix: false,
      isLockedOnce,
      category: numVal < 0 ? 'debuff' : 'activatable',
      bonusType,
      values: { [stat]: numVal },
      matrixEntries: [{ col, row, stat, bonusType, value: numVal }],
      summaryText: `${buffName} (${bonusType}) ➜ ${stat.toUpperCase()} ${numVal >= 0 ? `+${numVal}` : numVal}`,
    };
  }

  return null;
}

export function applyModifierPromptSelection(
  character: PF1Character,
  selection: {
    name: string;
    target: BuffStatTarget;
    bonusType: BuffBonusType;
    value: number;
  }
): { updatedCharacter: PF1Character; summaryText: string } {
  const spec: MacaroniBuffMakeSpec = {
    raw: `<^> ${selection.name} | ${selection.target} | ${selection.bonusType} | ${selection.value}`,
    name: selection.name.trim() || 'Custom Buff',
    isDirectMatrix: false,
    isLockedOnce: false,
    category: selection.value < 0 ? 'debuff' : 'activatable',
    bonusType: selection.bonusType,
    values: { [selection.target]: selection.value },
    matrixEntries: [
      {
        col: BUFF_MATRIX_COLUMNS.indexOf(selection.target) + 1,
        row: BUFF_MATRIX_ROWS.indexOf(selection.bonusType) + 1,
        stat: selection.target,
        bonusType: selection.bonusType,
        value: selection.value,
      },
    ],
    summaryText: `${selection.name} (${selection.bonusType}) ➜ ${selection.target.toUpperCase()} ${selection.value >= 0 ? `+${selection.value}` : selection.value}`,
  };

  const applied = applyMacaroniToCharacter(character, {
    raw: spec.raw,
    fullOutput: spec.summaryText,
    slots: [],
    isError: false,
    tokens: [],
    rollable: false,
    buffMakeEvents: [spec],
  });

  return {
    updatedCharacter: applied.updatedCharacter,
    summaryText: applied.statusMessage,
  };
}

export function applyMacaroniToCharacter(
  character: PF1Character,
  result: MacaroniExecutionResult
): {
  updatedCharacter: PF1Character;
  statusMessage: string;
  quirkyMessage: string;
  didMutate: boolean;
} {
  let nextChar = { ...character };
  const statusNotes: string[] = [];
  let quirkyKind: 'buff' | 'debuff' | 'roll' | 'locked' | 'toggled_off' = 'roll';
  let didMutate = false;

  // 1. Buff Modifier (<^>): identified by (name, bonusType). Updates existing instead of duplicating or toggling off.
  if (result.buffMakeEvents && result.buffMakeEvents.length > 0) {
    for (const buffSpec of result.buffMakeEvents) {
      didMutate = true;
      const buffName = (buffSpec.name || 'Custom Buff').trim();
      const currentBuffs = [...(nextChar.customBuffs || [])];
      const existingIdx = currentBuffs.findIndex(
        (b) =>
          b.name.trim().toLowerCase() === buffName.toLowerCase() &&
          b.bonusType === buffSpec.bonusType
      );

      if (existingIdx >= 0) {
        currentBuffs[existingIdx] = {
          ...currentBuffs[existingIdx],
          isActive: true,
          category: buffSpec.category,
          bonusType: buffSpec.bonusType,
          values: buffSpec.values,
          notes: `Updated via Macroni <^>: ${buffSpec.raw}`,
        };
        nextChar = { ...nextChar, customBuffs: currentBuffs };
        statusNotes.push(`Updated Buff: ${buffSpec.summaryText}`);
      } else {
        const newBuff: CustomBuffEffect = {
          id: `mac-buff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: buffName,
          category: buffSpec.category,
          bonusType: buffSpec.bonusType,
          isActive: true,
          values: buffSpec.values,
          notes: `Created via Macroni <^>: ${buffSpec.raw}`,
        };
        nextChar = { ...nextChar, customBuffs: [newBuff, ...currentBuffs] };
        statusNotes.push(`Added Buff: ${buffSpec.summaryText}`);
      }
      quirkyKind = buffSpec.category === 'debuff' ? 'debuff' : 'buff';
    }
  }

  // 2. Apply field stateMutations from >target<op value
  if (result.stateMutations && result.stateMutations.length > 0) {
    for (const mut of result.stateMutations) {
      const f = mut.field.toLowerCase();
      if (f === 'hp' || f === 'hp_current') {
        didMutate = true;
        const nextHp =
          mut.absoluteValue !== undefined
            ? mut.absoluteValue
            : Math.min(nextChar.hpTotalMax, nextChar.hpCurrent + mut.delta);
        nextChar = { ...nextChar, hpCurrent: nextHp };
        statusNotes.push(mut.description);
      } else if (f === 'thp' || f === 'temp_hp') {
        didMutate = true;
        const nextThp =
          mut.absoluteValue !== undefined
            ? Math.max(0, mut.absoluteValue)
            : Math.max(0, (nextChar.hpTemp || 0) + mut.delta);
        nextChar = { ...nextChar, hpTemp: nextThp };
        statusNotes.push(mut.description);
      } else if (f === 'gp' || f === 'gold') {
        didMutate = true;
        const nextGp =
          mut.absoluteValue !== undefined
            ? Math.max(0, mut.absoluteValue)
            : Math.max(0, (nextChar.currency?.gp || 0) + mut.delta);
        nextChar = { ...nextChar, currency: { ...nextChar.currency, gp: nextGp } };
        statusNotes.push(mut.description);
      } else if (['str', 'strength', 'dex', 'dexterity', 'con', 'constitution', 'int', 'intelligence', 'wis', 'wisdom', 'cha', 'charisma'].includes(f)) {
        const abKey = f.slice(0, 3).toUpperCase() as keyof PF1Character['abilities'];
        const abObj = nextChar.abilities?.[abKey];
        if (abObj) {
          didMutate = true;
          const nextAbilities = { ...nextChar.abilities };
          nextAbilities[abKey] = {
            ...abObj,
            miscMod: (abObj.miscMod || 0) + mut.delta,
          };
          nextChar = { ...nextChar, abilities: nextAbilities };
          statusNotes.push(mut.description);
        }
      }
    }
  }

  return {
    updatedCharacter: nextChar,
    statusMessage: statusNotes.length > 0 ? statusNotes.join(' • ') : result.fullOutput || 'Macro executed',
    quirkyMessage: pickQuirkyMessage(quirkyKind),
    didMutate,
  };
}

export function evaluateMathOnlyCall(formula: string, ctx: MacaroniExecutionContext): string {
  const env = parseSigilEnvelope(formula);
  const body = env.valid ? env.body : formula;
  const res = resolveBodyV12(body, ctx);
  return res.ok ? res.output : '0';
}

// ============================================================================
// MAIN EXECUTION ENTRY POINT
// ============================================================================

export function executeMacaroni(
  expression: string,
  ctx: MacaroniExecutionContext
): MacaroniExecutionResult {
  const depth = ctx.depth || 0;
  const tokens = tokenizeMacaroni(expression);

  if (depth > 8) {
    return {
      raw: expression,
      fullOutput: 'Error: circular reference detected',
      slots: [],
      isError: true,
      errorMessage: 'Circular reference limit (depth 8) exceeded.',
      tokens,
      rollable: false,
    };
  }

  if (!expression || !expression.trim()) {
    return {
      raw: expression,
      fullOutput: '',
      slots: [],
      isError: false,
      tokens: [],
      rollable: false,
    };
  }

  const envelope = parseSigilEnvelope(expression);
  if (!envelope.valid || !envelope.sigil || !envelope.kind) {
    return {
      raw: expression,
      fullOutput: envelope.errorMessage || 'Invalid macro sigil',
      slots: [],
      isError: true,
      errorMessage: envelope.errorMessage || 'Invalid macro sigil',
      tokens,
      rollable: false,
    };
  }

  // Reject reserved symbols (>>, $, stray ^, non-call #) immediately
  const reservedErr = findReservedSymbolInBody(envelope.body);
  if (reservedErr) {
    return {
      raw: expression,
      fullOutput: reservedErr,
      slots: [],
      isError: true,
      errorMessage: reservedErr,
      tokens,
      rollable: false,
      sigil: envelope.sigil,
      sigilKind: envelope.kind,
    };
  }

  // Enforce no chained or nested sigils inside body
  const nestedSigil = findNestedSigilInBody(envelope.body);
  if (nestedSigil) {
    const err = `Sigils cannot be chained or nested inside a macro body (found "${nestedSigil}").`;
    return {
      raw: expression,
      fullOutput: err,
      slots: [],
      isError: true,
      errorMessage: err,
      tokens,
      rollable: false,
      sigil: envelope.sigil,
      sigilKind: envelope.kind,
    };
  }

  // Side-effect sigil permission checks (6c)
  if (envelope.kind === 'stepper' && ctx.permissions?.allowStepper === false) {
    const err = 'Permission denied: <!> stepper is disabled by sheet permissions.';
    return {
      raw: expression,
      fullOutput: err,
      slots: [],
      isError: true,
      errorMessage: err,
      tokens,
      rollable: false,
      sigil: envelope.sigil,
      sigilKind: envelope.kind,
    };
  }
  if (envelope.kind === 'modifier' && ctx.permissions?.allowModifier === false) {
    const err = 'Permission denied: <^> modifier is disabled by sheet permissions.';
    return {
      raw: expression,
      fullOutput: err,
      slots: [],
      isError: true,
      errorMessage: err,
      tokens,
      rollable: false,
      sigil: envelope.sigil,
      sigilKind: envelope.kind,
    };
  }

  // 1. Neutral (==): stored object that does nothing when run on its own
  if (envelope.kind === 'neutral') {
    return {
      raw: expression,
      fullOutput: '',
      slots: [],
      isError: false,
      tokens,
      rollable: false,
      sigil: '==',
      sigilKind: 'neutral',
      isNoOp: true,
      traceSteps: [
        {
          stage: 'Sigil: == (Neutral)',
          before: expression,
          after: '(no-op)',
          note: 'Neutral stored object: does nothing when run directly; callable via {name}.',
        },
      ],
      quirkyMessage: 'Neutral object (==) — callable by other macros.',
    };
  }

  // 2. Query (<?>): dialogue with clickable options
  if (envelope.kind === 'query') {
    const qRes = buildQueryRequest(envelope.body, ctx, {
      depth: ctx.queryDepth || 1,
      visitedQueryKeys: ctx.visitedQueryKeys || [],
    });
    if ('error' in qRes) {
      return {
        raw: expression,
        fullOutput: qRes.error,
        slots: [],
        isError: true,
        errorMessage: qRes.error,
        tokens,
        rollable: false,
        sigil: '<?>',
        sigilKind: 'query',
      };
    }
    return {
      raw: expression,
      fullOutput: `Query: "${qRes.request.prompt}" (${qRes.request.options.length} option(s))`,
      slots: [{ slot: 1, raw: envelope.body, evaluated: qRes.request.prompt, isNumericOnly: false }],
      isError: false,
      tokens,
      rollable: false,
      sigil: '<?>',
      sigilKind: 'query',
      queryEvent: qRes.request,
      traceSteps: [
        {
          stage: 'Sigil: <?> (Query)',
          before: expression,
          after: qRes.request.prompt,
          note: qRes.request.options.map((o) => `${o.label} [${o.targetSigil || 'none'}]`).join(', '),
        },
      ],
    };
  }

  // 3. Merge (>target<op value): field mutation OR non-mutating object composition
  if (envelope.kind === 'merge') {
    const targetName = envelope.mergeTarget || '';
    const op = envelope.mergeOperator || '+';
    const valueExpr = envelope.mergeValueExpr || '';

    if (envelope.mergeIsObject) {
      const targetLower = targetName.toLowerCase();

      // Opt-in listener push: >{listener:SheetName.inbox}<=val OR >{listener:inbox}<=val
      const listenerTargetMatch = targetName.match(/^listener:(?:([A-Za-z0-9_-]+)\.)?([A-Za-z_][A-Za-z0-9_]*)$/i);
      if (listenerTargetMatch) {
        const sheetKey = listenerTargetMatch[1]?.toLowerCase();
        const lName = listenerTargetMatch[2].toLowerCase();
        const requester = (ctx.requesterId || ctx.character?.name || 'owner').toLowerCase();

        const targetSheet = sheetKey
          ? Object.values(ctx.externalSheets || {}).find(
              (s) => s.id.toLowerCase() === sheetKey || s.name.toLowerCase() === sheetKey
            )
          : undefined;
        if (sheetKey && !targetSheet) {
          const err = `Target sheet "${listenerTargetMatch[1]}" not found for listener push.`;
          return { raw: expression, fullOutput: err, slots: [], isError: true, errorMessage: err, tokens, rollable: false, sigil: 'merge', sigilKind: 'merge' };
        }

        const targetPerms = targetSheet ? targetSheet.permissions : ctx.permissions;
        const targetLabel = targetSheet ? targetSheet.name : (ctx.character?.name || 'Current Sheet');
        const listenerEntry = targetPerms?.listeners?.[lName];
        if (!listenerEntry) {
          const err = `No opt-in listening point "${lName}" on sheet "${targetLabel}". Push does nothing.`;
          return {
            raw: expression,
            fullOutput: err,
            slots: [],
            isError: true,
            errorMessage: err,
            tokens,
            rollable: false,
            sigil: 'merge',
            sigilKind: 'merge',
            scopeEvents: [{ kind: 'permission_denied', targetSheet: targetLabel, listenerName: lName, note: err }],
          };
        }
        if (
          listenerEntry.revoked ||
          (targetPerms?.revokedSenders || []).some((x) => x.toLowerCase() === requester) ||
          (listenerEntry.allowedSenders &&
            !listenerEntry.allowedSenders.some((x) => x.toLowerCase() === '*' || x.toLowerCase() === requester))
        ) {
          const err = `Permission denied: "${requester}" cannot push to listener "${lName}" on "${targetLabel}".`;
          return {
            raw: expression,
            fullOutput: err,
            slots: [],
            isError: true,
            errorMessage: err,
            tokens,
            rollable: false,
            sigil: 'merge',
            sigilKind: 'merge',
            scopeEvents: [{ kind: 'permission_denied', targetSheet: targetLabel, listenerName: lName, note: err }],
          };
        }

        // Evaluate RHS strictly on sender sheet; deliver inert data (never executed as macro)
        const payloadOutcome = resolveBodyV12(valueExpr, ctx, { scopeId: `push:${lName}` });
        if (!payloadOutcome.ok) {
          return {
            raw: expression,
            fullOutput: payloadOutcome.errorMessage || 'Error evaluating listener payload',
            slots: [],
            isError: true,
            errorMessage: payloadOutcome.errorMessage,
            tokens,
            rollable: false,
            sigil: 'merge',
            sigilKind: 'merge',
            queryEvent: payloadOutcome.pendingQuery,
          };
        }
        const inertPayload = payloadOutcome.output;
        listenerEntry.lastValue = inertPayload;
        listenerEntry.updatedAt = Date.now();
        const pushNote = `Pushed inert data to ${targetLabel}.listener:${lName} = ${inertPayload}`;
        return {
          raw: expression,
          fullOutput: inertPayload,
          slots: [{ slot: 1, raw: valueExpr, evaluated: inertPayload, isNumericOnly: /^[+-]?\d+(\.\d+)?$/.test(inertPayload) }],
          isError: false,
          tokens,
          rollable: payloadOutcome.diceRolls.length > 0,
          sigil: 'merge',
          sigilKind: 'merge',
          appliedPushes: [pushNote],
          scopeEvents: [
            {
              kind: 'listener_push',
              targetSheet: targetLabel,
              listenerName: lName,
              value: inertPayload,
              note: pushNote,
            },
          ],
          diceRolls: payloadOutcome.diceRolls.length ? payloadOutcome.diceRolls : undefined,
          traceSteps: payloadOutcome.traceSteps,
        };
      }

      // Loop guard for recursive object merges (Section 5)
      const mergeActiveKey = `merge:${targetLower}`;
      if (ctx.activeMacros?.includes(mergeActiveKey) || ctx.visitedObjects?.includes(targetLower)) {
        const err = `Loop stopped: macro "{${targetName}}" is already running.`;
        return { raw: expression, fullOutput: err, slots: [], isError: true, errorMessage: err, tokens, rollable: false, sigil: 'merge', sigilKind: 'merge' };
      }

      // Object merge: >{firebreath}<+{morefire} runs target as if op + valueExpr appended
      const targetFormula = findStoredObjectFormula(targetName, ctx);
      if (!targetFormula) {
        const err = `Merge target object "{${targetName}}" was not found.`;
        return {
          raw: expression,
          fullOutput: err,
          slots: [],
          isError: true,
          errorMessage: err,
          tokens,
          rollable: false,
          sigil: 'merge',
          sigilKind: 'merge',
        };
      }
      const targetEnv = parseSigilEnvelope(targetFormula);
      if (!targetEnv.valid || !targetEnv.sigil) {
        const err = `Merge target "{${targetName}}" has an invalid sigil.`;
        return {
          raw: expression,
          fullOutput: err,
          slots: [],
          isError: true,
          errorMessage: err,
          tokens,
          rollable: false,
          sigil: 'merge',
          sigilKind: 'merge',
        };
      }

      // Array capsule merge push >{fire&}<+val (respecting 5-item cap)
      if (targetLower.endsWith('&')) {
        const arrRes = parseArrayItemsSafe(
          targetFormula,
          targetName,
          ctx,
          { diceRolls: [], stepperSnapshots: [], scopeEvents: [], visitedObjects: [...(ctx.visitedObjects || [])], scopeId: `merge-arr:${targetLower}` }
        );
        if (!arrRes.ok) {
          return { raw: expression, fullOutput: arrRes.error, slots: [], isError: true, errorMessage: arrRes.error, tokens, rollable: false, sigil: 'merge', sigilKind: 'merge' };
        }
        const rhsOutcome = resolveBodyV12(valueExpr, ctx, { scopeId: `merge-arr-val:${targetLower}` });
        if (!rhsOutcome.ok) {
          return { raw: expression, fullOutput: rhsOutcome.errorMessage || 'Array merge error', slots: [], isError: true, errorMessage: rhsOutcome.errorMessage, tokens, rollable: false, sigil: 'merge', sigilKind: 'merge' };
        }
        const nextArr = op === '=' ? [rhsOutcome.output] : [...arrRes.items, rhsOutcome.output];
        if (nextArr.length > 5) {
          const err = `Array limit exceeded in ">{${targetName}}<": limit of 5 items per array (cannot define item #${nextArr.length}).`;
          return { raw: expression, fullOutput: err, slots: [], isError: true, errorMessage: err, tokens, rollable: false, sigil: 'merge', sigilKind: 'merge' };
        }
        const joined = nextArr.join(', ');
        return {
          raw: expression,
          fullOutput: joined,
          slots: [{ slot: 1, raw: valueExpr, evaluated: joined, isNumericOnly: false }],
          isError: false,
          tokens,
          rollable: false,
          sigil: 'merge',
          sigilKind: 'merge',
          mergeResult: { kind: 'object', target: targetName, operator: op, valueExpr, evaluatedOperand: rhsOutcome.output, newValue: joined },
        };
      }

      const composedSigil =
        targetEnv.sigil === '==' || targetEnv.sigil === 'merge' ? '<<' : targetEnv.sigil;
      const effectiveExpr =
        op === '='
          ? `${composedSigil}[${valueExpr}]`
          : `${composedSigil}[{${targetName}}${op}${valueExpr}]`;

      const composedRes = executeMacaroni(effectiveExpr, {
        ...ctx,
        depth: depth + 1,
        activeMacros: [...(ctx.activeMacros || []), mergeActiveKey],
      });
      const mergeResult: MacaroniMergeResult = {
        kind: 'object',
        target: targetName,
        operator: op,
        valueExpr,
        evaluatedOperand: composedRes.fullOutput,
        newValue: composedRes.fullOutput,
        effectiveExpression: effectiveExpr,
      };
      return {
        ...composedRes,
        raw: expression,
        tokens,
        sigil: 'merge',
        sigilKind: 'merge',
        mergeResult,
        traceSteps: [
          {
            stage: `Merge Object >{${targetName}}<${op}`,
            before: expression,
            after: effectiveExpr,
            note: 'Runs composed expression without changing stored target object.',
          },
          ...(composedRes.traceSteps || []),
        ],
      };
    }

    // Sheet field write permission & strict whitelist checks (Section 6a + 6c)
    if (ctx.permissions?.allowWrite === false) {
      const err = 'Permission denied: merge writes are disabled by sheet permissions.';
      return { raw: expression, fullOutput: err, slots: [], isError: true, errorMessage: err, tokens, rollable: false, sigil: 'merge', sigilKind: 'merge' };
    }
    if (!WRITABLE_MERGE_FIELDS.has(targetName.toLowerCase())) {
      const err = `Unknown or non-writable merge target "${targetName}". Field names are whitelisted (hp, thp, gp, str/strength, dex/dexterity, con/constitution, int/intelligence, wis/wisdom, cha/charisma).`;
      return {
        raw: expression,
        fullOutput: err,
        slots: [],
        isError: true,
        errorMessage: err,
        tokens,
        rollable: false,
        sigil: 'merge',
        sigilKind: 'merge',
      };
    }

    // Field merge: >strength<+{strdmg}
    const valOutcome = resolveBodyV12(valueExpr, ctx, { scopeId: `merge:${targetName}` });
    if (!valOutcome.ok) {
      return {
        raw: expression,
        fullOutput: valOutcome.errorMessage || 'Error evaluating merge value',
        slots: [],
        isError: true,
        errorMessage: valOutcome.errorMessage,
        tokens,
        rollable: false,
        sigil: 'merge',
        sigilKind: 'merge',
        queryEvent: valOutcome.pendingQuery,
      };
    }

    const rhsNum = Number(valOutcome.output);
    if (!Number.isFinite(rhsNum)) {
      const err = `Merge into field "${targetName}" requires a numeric value, got "${valOutcome.output}".`;
      return {
        raw: expression,
        fullOutput: err,
        slots: [],
        isError: true,
        errorMessage: err,
        tokens,
        rollable: false,
        sigil: 'merge',
        sigilKind: 'merge',
      };
    }

    const rawCurrent = resolveFieldFromContext(targetName, ctx);
    const lhsNum = Number(rawCurrent ?? 0) || 0;
    let nextNum = lhsNum;
    if (op === '+') nextNum = lhsNum + rhsNum;
    else if (op === '-') nextNum = lhsNum - rhsNum;
    else if (op === '*') nextNum = lhsNum * rhsNum;
    else if (op === '/') {
      if (rhsNum === 0) {
        return {
          raw: expression,
          fullOutput: 'Error: division by zero in merge',
          slots: [],
          isError: true,
          errorMessage: 'Division by zero in merge',
          tokens,
          rollable: false,
          sigil: 'merge',
          sigilKind: 'merge',
        };
      }
      nextNum = Number((lhsNum / rhsNum).toFixed(4));
    } else if (op === '=') {
      nextNum = rhsNum;
    }

    const delta = nextNum - lhsNum;
    const desc = `${targetName}: ${lhsNum} ${op} ${rhsNum} ➜ ${nextNum}`;
    const mergeResult: MacaroniMergeResult = {
      kind: 'field',
      target: targetName,
      operator: op,
      valueExpr,
      evaluatedOperand: valOutcome.output,
      previousValue: lhsNum,
      newValue: nextNum,
    };

    return {
      raw: expression,
      fullOutput: String(nextNum),
      slots: [{ slot: 1, raw: valueExpr, evaluated: String(nextNum), isNumericOnly: true }],
      isError: false,
      tokens,
      rollable: valOutcome.diceRolls.length > 0,
      sigil: 'merge',
      sigilKind: 'merge',
      mergeResult,
      appliedPushes: [desc],
      stateMutations: [
        {
          field: targetName,
          delta,
          absoluteValue: op === '=' ? nextNum : undefined,
          description: desc,
        },
      ],
      diceRolls: valOutcome.diceRolls.length ? valOutcome.diceRolls : undefined,
      traceSteps: valOutcome.traceSteps,
    };
  }

  // 4. Modifier (<^>): structured inline spec OR interactive prompt for target, name, bonusType
  if (envelope.kind === 'modifier') {
    const inlineBuff = parseMacaroniBuffMake(envelope.body, undefined, false, ctx);
    if (inlineBuff) {
      return {
        raw: expression,
        fullOutput: inlineBuff.summaryText,
        slots: [{ slot: 1, raw: envelope.body, evaluated: inlineBuff.summaryText, isNumericOnly: false }],
        isError: false,
        tokens,
        rollable: false,
        sigil: '<^>',
        sigilKind: 'modifier',
        buffMakeEvents: [inlineBuff],
        quirkyMessage: pickQuirkyMessage(inlineBuff.category === 'debuff' ? 'debuff' : 'buff'),
      };
    }

    const valOutcome = envelope.body
      ? resolveBodyV12(envelope.body, ctx, { scopeId: 'modifier' })
      : {
          ok: true,
          output: '0',
          diceRolls: [],
          stepperSnapshots: [],
          traceSteps: [],
        };

    if (!valOutcome.ok) {
      return {
        raw: expression,
        fullOutput: valOutcome.errorMessage || 'Error evaluating modifier value',
        slots: [],
        isError: true,
        errorMessage: valOutcome.errorMessage,
        tokens,
        rollable: false,
        sigil: '<^>',
        sigilKind: 'modifier',
        queryEvent: valOutcome.pendingQuery,
      };
    }

    const numVal = Number(valOutcome.output);
    const safeNum = Number.isFinite(numVal) ? numVal : 0;
    return {
      raw: expression,
      fullOutput: `Modifier ready: ${safeNum >= 0 ? `+${safeNum}` : safeNum} (choose target, name, and bonus type)`,
      slots: [{ slot: 1, raw: envelope.body, evaluated: String(safeNum), isNumericOnly: true }],
      isError: false,
      tokens,
      rollable: valOutcome.diceRolls.length > 0,
      sigil: '<^>',
      sigilKind: 'modifier',
      modifierPrompt: {
        evaluatedValue: valOutcome.output || '0',
        numericValue: safeNum,
      },
      diceRolls: valOutcome.diceRolls.length ? valOutcome.diceRolls : undefined,
      traceSteps: valOutcome.traceSteps,
    };
  }

  // 5. Pull (<<), Make (<>), and Stepper (<!>) evaluate the body via the 5-step resolution order
  const resolved = resolveBodyV12(envelope.body, ctx, {
    scopeId: ctx.stepperScopeId || `${envelope.kind}:${expression}`,
    isPullTopLevel: envelope.kind === 'pull',
  });

  if (!resolved.ok) {
    if (resolved.pendingQuery) {
      if (resolved.pendingQuery.inlineCallSite && !resolved.pendingQuery.inlineCallSite.parentExpression) {
        resolved.pendingQuery.inlineCallSite.parentExpression = expression;
      }
      return {
        raw: expression,
        fullOutput: resolved.pendingQuery.prompt || 'Query opened',
        slots: [],
        isError: false,
        tokens,
        rollable: false,
        sigil: envelope.sigil,
        sigilKind: envelope.kind,
        queryEvent: resolved.pendingQuery,
        traceSteps: resolved.traceSteps,
      };
    }
    return {
      raw: expression,
      fullOutput: resolved.errorMessage || 'Macro error',
      slots: [],
      isError: true,
      errorMessage: resolved.errorMessage,
      tokens,
      rollable: false,
      sigil: envelope.sigil,
      sigilKind: envelope.kind,
      traceSteps: resolved.traceSteps,
    };
  }

  const slot: MacaroniSlotResult = {
    slot: 1,
    raw: envelope.body,
    evaluated: resolved.output,
    isNumericOnly: /^[+-]?\d+(\.\d+)?$/.test(resolved.output),
  };

  const baseResult: MacaroniExecutionResult = {
    raw: expression,
    fullOutput: resolved.output,
    slots: [slot],
    isError: false,
    tokens,
    rollable: resolved.diceRolls.length > 0,
    sigil: envelope.sigil,
    sigilKind: envelope.kind,
    privateOutput: resolved.privateOutput,
    diceRolls: resolved.diceRolls.length ? resolved.diceRolls : undefined,
    stepperSnapshots: resolved.stepperSnapshots.length ? resolved.stepperSnapshots : undefined,
    scopeEvents: resolved.scopeEvents,
    traceSteps: resolved.traceSteps,
    quirkyMessage: pickQuirkyMessage('roll'),
  };

  if (envelope.kind === 'make') {
    baseResult.makePopup = {
      title: 'Make',
      result: resolved.output,
      rawBody: envelope.body,
    };
    baseResult.alertEvents = [
      {
        tag: 1,
        message: resolved.output,
        preset: resolveUiMakePreset(1, ctx.uiPresets),
      },
    ];
  } else if (envelope.kind === 'stepper') {
    const latestStep = resolved.stepperSnapshots[resolved.stepperSnapshots.length - 1]?.step ?? (ctx.stepCount || 1);
    baseResult.stepperWindow = {
      formula: expression,
      currentStep: latestStep,
      result: resolved.output,
      bangIds: resolved.stepperSnapshots.map((s) => s.bangId),
    };
  }

  return baseResult;
}
