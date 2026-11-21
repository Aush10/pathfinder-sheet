/**
 * Macroni Overhaul 1.2 Lexer
 * - Every macro must begin with a valid sigil (==, <<, <>, <?>, <^>, <!>, >target<op).
 * - Closed pairs (<>, {}) can hold sub-markers (<?>, <^>, <!>); open pairs (==, <<) cannot.
 * - [[ and {{ are NOT sigils.
 * - Sigils cannot be chained or nested inside the body.
 * - d followed by digits (d6, d20, ...) is reserved for fresh dice rolls.
 */

import {
  MacaroniSigilEnvelope,
  MacaroniToken,
  MacaroniTokenType,
  MergeOperator,
} from './types';

export function isReservedDiceName(name: string): boolean {
  return /^\d*d\d+$/i.test(String(name || '').trim());
}

export function isArrayCapsuleRef(name: string): { base: string; index?: number } | null {
  const m = String(name || '').trim().match(/^([A-Za-z_][A-Za-z0-9_]*)&(\d*)$/);
  if (!m) return null;
  return {
    base: m[1],
    index: m[2] ? parseInt(m[2], 10) : undefined,
  };
}

/**
 * Parses the mandatory leading sigil from a Macroni 1.2 expression.
 * The sigil is read separately from the formula that follows it.
 */
export function parseSigilEnvelope(expression: string): MacaroniSigilEnvelope {
  const trimmed = String(expression || '').trim();
  if (!trimmed) {
    return { valid: false, body: '', errorMessage: 'Macro is empty.' };
  }

  if (trimmed.startsWith('>>')) {
    return {
      valid: false,
      body: trimmed,
      errorMessage: 'Reserved symbol ">>": dead for now (planned for future remote activation).',
    };
  }
  if (trimmed.startsWith('$')) {
    return {
      valid: false,
      body: trimmed,
      errorMessage: 'Reserved symbol "$": dead for now.',
    };
  }
  if (trimmed.startsWith('#')) {
    return {
      valid: false,
      body: trimmed,
      errorMessage:
        'Reserved symbol "#": dead as a leading sigil in macros (start with ==, <<, <>, <?>, <^>, <!>, or >target<op; legacy #calls only work inside a macro body).',
    };
  }
  if (trimmed.startsWith('^')) {
    return {
      valid: false,
      body: trimmed,
      errorMessage: 'Reserved usage of "^": ^ is live only inside the <^> modifier sigil.',
    };
  }

  if (trimmed.startsWith('[[') || trimmed.startsWith('{{')) {
    return {
      valid: false,
      body: trimmed,
      errorMessage:
        "'[[' and '{{' are nested expressions, not sigils. Start every macro with ==, <<, <>, <?>, <^>, <!>, or >target<op.",
    };
  }

  if (trimmed.startsWith('==')) {
    return { valid: true, sigil: '==', kind: 'neutral', body: trimmed.slice(2).trim() };
  }
  if (trimmed.startsWith('<<')) {
    return { valid: true, sigil: '<<', kind: 'pull', body: trimmed.slice(2).trim() };
  }
  if (trimmed.startsWith('<?>')) {
    return { valid: true, sigil: '<?>', kind: 'query', body: trimmed.slice(3).trim() };
  }
  if (trimmed.startsWith('<^>')) {
    return { valid: true, sigil: '<^>', kind: 'modifier', body: trimmed.slice(3).trim() };
  }
  if (trimmed.startsWith('<!>')) {
    return { valid: true, sigil: '<!>', kind: 'stepper', body: trimmed.slice(3).trim() };
  }
  if (trimmed.startsWith('<>')) {
    return { valid: true, sigil: '<>', kind: 'make', body: trimmed.slice(2).trim() };
  }

  // Merge sigil: >target<op value  OR  >{object}<op value  OR  >{fire&}<op value  OR  >{listener:name}<=value
  if (trimmed.startsWith('>')) {
    const mergeMatch = trimmed.match(
      /^>\s*(\{[^{}]+\}|[A-Za-z_][A-Za-z0-9_]*(?:&\d*)?)\s*<\s*([+\-*/=])\s*(.*)$/s
    );
    if (!mergeMatch) {
      return {
        valid: false,
        body: trimmed,
        errorMessage:
          'Malformed merge sigil. Expected >target<op value where op is +, -, *, /, or = (for example >strength<+{strdmg} or >{firebreath}<+{morefire}).',
      };
    }

    const rawTarget = mergeMatch[1].trim();
    const isObj = rawTarget.startsWith('{') && rawTarget.endsWith('}');
    const targetName = isObj ? rawTarget.slice(1, -1).trim() : rawTarget;
    if (!targetName) {
      return {
        valid: false,
        body: trimmed,
        errorMessage: 'Merge target inside >{}< cannot be empty.',
      };
    }
    const op = mergeMatch[2] as MergeOperator;
    const valueExpr = mergeMatch[3].trim();

    if (!valueExpr) {
      return {
        valid: false,
        body: trimmed,
        errorMessage: `Merge sigil >${rawTarget}<${op} requires a value expression on the right side.`,
      };
    }

    return {
      valid: true,
      sigil: 'merge',
      kind: 'merge',
      body: valueExpr,
      mergeTarget: targetName,
      mergeIsObject: isObj,
      mergeOperator: op,
      mergeValueExpr: valueExpr,
    };
  }

  return {
    valid: false,
    body: trimmed,
    errorMessage:
      'Missing or invalid leading sigil. Every macro must start with ==, <<, <>, <?>, <^>, <!>, or >target<op.',
  };
}

/**
 * Rejects reserved symbols (>>, $, stray ^, non-call #) anywhere in the macro body outside quotes.
 */
export function findReservedSymbolInBody(body: string): string | null {
  let inQuote = false;
  let quoteChar = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"' || ch === "'") {
      if (!inQuote) {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === quoteChar && body[i - 1] !== '\\') {
        inQuote = false;
      }
      continue;
    }
    if (inQuote) continue;

    const rest = body.slice(i);
    if (rest.startsWith('>>')) {
      return 'Reserved symbol ">>": dead for now (planned for future remote activation).';
    }
    if (ch === '$') {
      return 'Reserved symbol "$": dead for now.';
    }
    if (ch === '^') {
      return 'Reserved usage of "^": ^ is live only inside the leading <^> modifier sigil (not inside a macro body).';
    }
    if (ch === '#') {
      const legacyCall = rest.match(/^#(?:[A-Za-z_][A-Za-z0-9_]*(?:\.[0-9]+)?|\([^)]+\))/);
      if (legacyCall) {
        i += legacyCall[0].length - 1;
        continue;
      }
      return 'Reserved symbol "#": dead in macros for now (only legacy #calls like #STR or #LEVEL are still accepted).';
    }
  }
  return null;
}

/**
 * Checks whether any sigil appears chained or nested inside a macro body outside quotes
 * and outside calculator brackets [...]. Inside [...], <> <= =< >= => = < > are calculator comparisons.
 */
export function findNestedSigilInBody(body: string): string | null {
  let inQuote = false;
  let quoteChar = '';
  let bracketDepth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"' || ch === "'") {
      if (!inQuote) {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === quoteChar && body[i - 1] !== '\\') {
        inQuote = false;
      }
      continue;
    }
    if (inQuote) continue;

    if (ch === '[') {
      bracketDepth++;
      continue;
    }
    if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    // Inside [...] brackets, comparison operators (<>, <=, =<, >=, =>) are strictly math/booli operators
    if (bracketDepth > 0) continue;

    const rest = body.slice(i);
    if (rest.startsWith('==')) return '==';
    if (rest.startsWith('<<')) return '<<';
    if (rest.startsWith('<?>')) return '<?>';
    if (rest.startsWith('<^>')) return '<^>';
    if (rest.startsWith('<!>')) return '<!>';
    if (rest.startsWith('<>') && body[i - 1] !== '?') return '<>';
    if (/^>\s*(?:\{[^{}]+\}|[A-Za-z_][A-Za-z0-9_]*(?:&\d*)?)\s*<\s*[+\-*/=]/.test(rest)) {
      return '>target<op';
    }
  }
  return null;
}

/**
 * Tokenizes a Macroni 1.2 macro into sigil + body tokens for trace inspection & syntax coloring.
 */
export function tokenizeMacaroni(expression: string): MacaroniToken[] {
  const tokens: MacaroniToken[] = [];
  const raw = String(expression || '');
  const leadingWs = raw.match(/^\s*/)?.[0].length || 0;
  let i = leadingWs;

  const env = parseSigilEnvelope(raw);
  if (env.valid && env.sigil) {
    const sigilMap: Record<NonNullable<MacaroniSigilEnvelope['sigil']>, MacaroniTokenType> = {
      '==': 'sigil_neutral',
      '<<': 'sigil_pull',
      '<>': 'sigil_make',
      '<?>': 'sigil_query',
      '<^>': 'sigil_modifier',
      '<!>': 'sigil_stepper',
      merge: 'sigil_merge',
    };

    if (env.sigil === 'merge') {
      const m = raw.slice(i).match(
        /^>\s*(\{[^{}]+\}|[A-Za-z_][A-Za-z0-9_]*(?:&\d*)?)\s*<\s*([+\-*/=])\s*/
      );
      const rawSigil = m ? m[0] : '>';
      tokens.push({
        type: 'sigil_merge',
        value: `${env.mergeIsObject ? `{${env.mergeTarget}}` : env.mergeTarget}<${env.mergeOperator}`,
        raw: rawSigil.trimEnd(),
        start: i,
        end: i + rawSigil.length,
      });
      i += rawSigil.length;
    } else {
      tokens.push({
        type: sigilMap[env.sigil],
        value: env.sigil,
        raw: env.sigil,
        start: i,
        end: i + env.sigil.length,
      });
      i += env.sigil.length;
    }
  } else if (raw.trim()) {
    // Emit an error token for invalid start while still tokenizing body for debugging
    const preview = raw.slice(i).match(/^(?:\[\[|\{\{|[^\s[\]{}()]+|\S)/)?.[0] || raw.trim();
    tokens.push({
      type: 'error_token',
      value: env.errorMessage || 'Missing sigil',
      raw: preview,
      start: i,
      end: i + preview.length,
    });
    i += preview.length;
  }

  let bangCounter = 0;
  let bracketDepth = 0;
  const len = raw.length;

  while (i < len) {
    const ch = raw[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Comments // ...
    if (ch === '/' && raw[i + 1] === '/') {
      const lineEnd = raw.indexOf('\n', i);
      i = lineEnd === -1 ? len : lineEnd + 1;
      continue;
    }

    // String literals "..." or '...'
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      let str = '';
      i++;
      while (i < len && raw[i] !== quote) {
        if (raw[i] === '\\' && i + 1 < len) {
          str += raw[i + 1];
          i += 2;
        } else {
          str += raw[i];
          i++;
        }
      }
      if (i < len) i++;
      tokens.push({
        type: 'text_literal',
        value: str,
        raw: raw.slice(start, i),
        start,
        end: i,
      });
      continue;
    }

    // Reserved symbols in body (>>, $, stray ^)
    const rest = raw.slice(i);
    if (rest.startsWith('>>')) {
      tokens.push({
        type: 'reserved_symbol',
        value: 'Reserved symbol ">>"',
        raw: '>>',
        start: i,
        end: i + 2,
      });
      i += 2;
      continue;
    }
    if (ch === '$') {
      tokens.push({
        type: 'reserved_symbol',
        value: 'Reserved symbol "$"',
        raw: '$',
        start: i,
        end: i + 1,
      });
      i++;
      continue;
    }
    if (ch === '^') {
      tokens.push({
        type: 'reserved_symbol',
        value: 'Reserved "^" (only valid in <^>)',
        raw: '^',
        start: i,
        end: i + 1,
      });
      i++;
      continue;
    }

    // Nested/chained sigil detection in body (only outside [...] calculator brackets and not ?<>)
    const chainedMatch =
      bracketDepth === 0 && !(rest.startsWith('<>') && raw[i - 1] === '?')
        ? rest.match(/^(==|<<|<\?>|<\^>|<!>|<>)/)
        : null;
    if (chainedMatch) {
      tokens.push({
        type: 'error_token',
        value: `Chained/nested sigil "${chainedMatch[1]}" is not allowed`,
        raw: chainedMatch[1],
        start: i,
        end: i + chainedMatch[1].length,
      });
      i += chainedMatch[1].length;
      continue;
    }

    // Calculator comparison operators inside [...] (or booli comparisons ?=/?>/?<)
    if (bracketDepth > 0) {
      const cmpMatch = rest.match(/^(>=|=>|<=|=<|<>|[=<>])/);
      if (cmpMatch) {
        tokens.push({
          type: 'operator',
          value: cmpMatch[1],
          raw: cmpMatch[1],
          start: i,
          end: i + cmpMatch[1].length,
        });
        i += cmpMatch[1].length;
        continue;
      }
    }

    // {dN} / {XdN}, {fire&} / {fire&2}, {sheet:...}, {listener:...}, or {object_name}
    if (ch === '{') {
      const start = i;
      const closeIdx = raw.indexOf('}', i + 1);
      if (closeIdx !== -1) {
        const inner = raw.slice(i + 1, closeIdx).trim();
        const rawTok = raw.slice(start, closeIdx + 1);
        let type: MacaroniTokenType = 'object_ref';
        if (isReservedDiceName(inner)) {
          type = 'dice_object';
        } else if (/^(?:sheet|listener):/i.test(inner)) {
          type = 'scope_ref';
        } else if (isArrayCapsuleRef(inner)) {
          type = 'array_ref';
        }
        tokens.push({ type, value: inner, raw: rawTok, start, end: closeIdx + 1 });
        i = closeIdx + 1;
        continue;
      }
      tokens.push({
        type: 'error_token',
        value: 'Unclosed {',
        raw: '{',
        start,
        end: start + 1,
      });
      i++;
      continue;
    }

    // Calculator brackets [ and ]
    if (ch === '[') {
      bracketDepth++;
      tokens.push({ type: 'calc_open', value: '[', raw: '[', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      tokens.push({ type: 'calc_close', value: ']', raw: ']', start: i, end: i + 1 });
      i++;
      continue;
    }

    // Stepper ! (each gets its own hidden index/ID)
    if (ch === '!') {
      bangCounter += 1;
      tokens.push({
        type: 'stepper_bang',
        value: '!',
        raw: '!',
        start: i,
        end: i + 1,
        bangId: `bang-${bangCounter}`,
      });
      i++;
      continue;
    }

    // Legacy #calls (resolved last behind the scenes as {})
    const hashBracketMatch = rest.match(/^#\(([^)]+)\)/);
    if (hashBracketMatch) {
      tokens.push({
        type: 'legacy_hash_call',
        value: hashBracketMatch[1].trim(),
        raw: hashBracketMatch[0],
        start: i,
        end: i + hashBracketMatch[0].length,
      });
      i += hashBracketMatch[0].length;
      continue;
    }
    const hashMatch = rest.match(/^#([A-Za-z_][A-Za-z0-9_]*(?:\.[0-9]+)?)/);
    if (hashMatch) {
      tokens.push({
        type: 'legacy_hash_call',
        value: hashMatch[1],
        raw: hashMatch[0],
        start: i,
        end: i + hashMatch[0].length,
      });
      i += hashMatch[0].length;
      continue;
    }
    if (ch === '#') {
      tokens.push({
        type: 'reserved_symbol',
        value: 'Reserved symbol "#"',
        raw: '#',
        start: i,
        end: i + 1,
      });
      i++;
      continue;
    }

    // Pipe |
    if (ch === '|') {
      const val = raw[i + 1] === '|' ? '||' : '|';
      tokens.push({ type: 'pipe_branch', value: val, raw: val, start: i, end: i + val.length });
      i += val.length;
      continue;
    }

    // Equals =
    if (ch === '=') {
      tokens.push({ type: 'equals_op', value: '=', raw: '=', start: i, end: i + 1 });
      i++;
      continue;
    }

    // Numbers
    const numMatch = rest.match(/^(\d+(?:\.\d+)?)/);
    if (numMatch) {
      tokens.push({
        type: 'number',
        value: numMatch[1],
        raw: numMatch[1],
        start: i,
        end: i + numMatch[1].length,
      });
      i += numMatch[1].length;
      continue;
    }

    // Operators & math parens
    if (['+', '-', '*', '/', '%', '(', ')', ','].includes(ch)) {
      tokens.push({ type: 'operator', value: ch, raw: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    // Words (math functions or inert text)
    const wordMatch = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (wordMatch) {
      const w = wordMatch[1];
      const lower = w.toLowerCase();
      if (['floor', 'ceil', 'round', 'abs', 'sqrt', 'min', 'max'].includes(lower)) {
        tokens.push({ type: 'operator', value: lower, raw: w, start: i, end: i + w.length });
      } else {
        tokens.push({ type: 'inert_text', value: w, raw: w, start: i, end: i + w.length });
      }
      i += w.length;
      continue;
    }

    tokens.push({ type: 'inert_text', value: ch, raw: ch, start: i, end: i + 1 });
    i++;
  }

  return tokens;
}
