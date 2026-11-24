/**
 * CX2 staging implementation: deterministic and deliberately dependency-free.
 * AF2 promotes this module to server/ingest after reviewing the handoff.
 */
import { createHash } from 'node:crypto';

export const INGEST_SCHEMA_VERSION = 'PF1E_SOT_INGEST_V1';
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
export type TableKind = 'class-grid' | 'casting-subgrid' | 'extended-grid' | 'lookup-table';
export type CastingKind = 'spells-per-day' | 'spells-known';

export interface SourceDocument { name: string; content: string; path?: string; }
export interface IngestTableCell { row: number; col: number; text: string; rowspan: number; colspan: number; isHeader: boolean; }
export interface IngestTable {
  id: string; sectionId: string; caption?: string; headers: string[]; headerMap: Record<string, string>;
  /** Original cells retain span coordinates; grids repeat spanned values for deterministic lookup. */
  cells: IngestTableCell[]; headerGrid: string[][]; rows: string[][]; notes: string[];
  kind: TableKind; casting?: CastingKind; documentOrder: number;
}
export interface IngestLink { id: string; sectionId: string; text: string; href: string; external: boolean; }
export interface IngestSection { id: string; headingPath: string[]; level: number; text: string; tableIds: string[]; linkIds: string[]; keywords: string[]; }
export interface IngestOutputs {
  'table.json': { schemaVersion: string; documentId: string; tables: IngestTable[] };
  'links.json': { schemaVersion: string; documentId: string; links: IngestLink[] };
  'text.md': string;
  'index.json': { schemaVersion: string; document: { id: string; title: string; sha256: string; sourceType: string }; sections: IngestSection[]; toc: Array<{ sectionId: string; headingPath: string[]; level: number }>; keywords: string[]; termIndex: Record<string, Array<{ sectionId: string; score: number }>> };
}

const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);
const space = (value: string) => decode(value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')).replace(/\s+/g, ' ').trim();
const decode = (value: string) => value.replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const stableId = (kind: string, seed: string) => `${kind}-${hash(seed).slice(0, 16)}`;

function assertSafeJson(value: unknown): void {
  if (Array.isArray(value)) return value.forEach(assertSafeJson);
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) throw new Error(`Rejected unsafe JSON key: ${key}`);
      assertSafeJson(child);
    }
  }
}

function normalizeSource(source: SourceDocument): { html: string; title: string; sourceType: string } {
  if (Buffer.byteLength(source.content, 'utf8') > MAX_SOURCE_BYTES) throw new Error(`Source exceeds ${MAX_SOURCE_BYTES} byte limit.`);
  const trimmed = source.content.trim();
  if (!trimmed.startsWith('{')) {
    const sourceType = source.name.split('.').pop()?.toLowerCase() || 'text';
    return { html: sourceType === 'md' || sourceType === 'markdown' ? markdownToHtml(source.content) : source.content, title: titleFromName(source.name), sourceType };
  }
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(trimmed) as Record<string, unknown>; } catch { return { html: source.content, title: titleFromName(source.name), sourceType: 'text' }; }
  assertSafeJson(parsed);
  const srd = parsed.srdDocument;
  if (srd && typeof srd === 'object' && !Array.isArray(srd)) {
    const doc = srd as Record<string, unknown>;
    if (typeof doc.htmlContent !== 'string') throw new Error('Invalid SRD JSON: srdDocument.htmlContent must be a string.');
    return { html: doc.htmlContent, title: typeof doc.title === 'string' ? doc.title : titleFromName(source.name), sourceType: 'srd-json' };
  }
  const sheet = parsed._pf1e_sheet ?? parsed.character ?? parsed.data;
  if (sheet && typeof sheet === 'object' && !Array.isArray(sheet)) {
    const pretty = JSON.stringify(sheet, null, 2);
    return { html: `<h1>${titleFromName(source.name)}</h1><pre>${pretty}</pre>`, title: titleFromName(source.name), sourceType: 'sheet-json' };
  }
  throw new Error('Unknown JSON input. Expected srdDocument.htmlContent, _pf1e_sheet, character, or data.');
}

function titleFromName(name: string): string { return name.replace(/\.(srd\.json|json|html?|md|txt)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported document'; }
function htmlEscape(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);
    if (heading) { output.push(`<h${heading[1].length}>${htmlEscape(heading[2])}</h${heading[1].length}>`); continue; }
    if (lines[i].includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] || '')) {
      const cells = (value: string) => value.replace(/^\s*\||\|\s*$/g, '').split('|').map((cell) => htmlEscape(cell.trim()));
      const headers = cells(lines[i]); i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) { rows.push(cells(lines[i])); i++; }
      i--;
      output.push(`<table><tr>${headers.map((cell) => `<th>${cell}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</table>`); continue;
    }
    const linked = htmlEscape(lines[i]).replace(/\[([^\]]+)]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    output.push(linked ? `<p>${linked}</p>` : '');
  }
  return output.join('\n');
}
function attr(tag: string, name: string): string | undefined { return new RegExp(`\\b${name}\\s*=\\s*["']?([^\\s"'>]+)`, 'i').exec(tag)?.[1]; }
function expandRows(rows: Array<Array<{ value: string; colspan: number; rowspan: number; isHeader: boolean }>>): { grid: string[][]; cells: IngestTableCell[] } {
  const grid: string[][] = [];
  const originalCells: IngestTableCell[] = [];
  const pending = new Map<string, { value: string; remaining: number }>();
  rows.forEach((cells, rowIndex) => {
    const row: string[] = [];
    let column = 0;
    const putPending = () => {
      const carry = pending.get(`${rowIndex}:${column}`);
      if (!carry) return false;
      row[column] = carry.value;
      if (carry.remaining > 1) pending.set(`${rowIndex + 1}:${column}`, { value: carry.value, remaining: carry.remaining - 1 });
      pending.delete(`${rowIndex}:${column}`); column++; return true;
    };
    for (const cell of cells) {
      while (putPending()) { /* fill prior rowspan */ }
      originalCells.push({ row: rowIndex, col: column, text: cell.value, rowspan: cell.rowspan, colspan: cell.colspan, isHeader: cell.isHeader });
      for (let i = 0; i < cell.colspan; i++) {
        row[column + i] = cell.value;
        if (cell.rowspan > 1) pending.set(`${rowIndex + 1}:${column + i}`, { value: cell.value, remaining: cell.rowspan - 1 });
      }
      column += cell.colspan;
    }
    while (putPending()) { /* trailing rowspan */ }
    grid.push(row);
  });
  return { grid, cells: originalCells };
}

function extractTables(html: string, documentId: string): Array<{ token: string; table: IngestTable }> {
  let sequence = 0;
  return [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => {
    const token = match[0];
    const rawRows = [...token.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...row[1].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map((cell) => ({
        value: space(cell[3]), colspan: Math.max(1, Number(attr(cell[2], 'colspan')) || 1), rowspan: Math.max(1, Number(attr(cell[2], 'rowspan')) || 1), isHeader: cell[1].toLowerCase() === 'th',
      }))
    ).filter((row) => row.length);
    const expanded = expandRows(rawRows);
    const grid = expanded.grid;
    const caption = space(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(token)?.[1] || '');
    const { headers, rows, casting } = tableShape(grid);
    const headerMap = Object.fromEntries(headers.map((header) => [header, normalizeHeader(header)]));
    const id = stableId('table', `${documentId}:${sequence}:${caption}:${headers.join('|')}`);
    const headerCount = casting ? 2 : Math.max(1, rawRows.findIndex((row) => row.some((cell) => !cell.isHeader)));
    return { token, table: { id, sectionId: '', caption: caption || undefined, headers, headerMap, cells: expanded.cells, headerGrid: grid.slice(0, headerCount), rows, notes: [], kind: 'lookup-table', documentOrder: sequence++, ...(casting ? { casting } : {}) } };
  });
}

function tableShape(grid: string[][]): { headers: string[]; rows: string[][]; casting?: CastingKind } {
  if (!grid.length) return { headers: [], rows: [] };
  const first = grid[0].map(space);
  const second = grid[1]?.map(space) || [];
  const joined = first.join(' ').toLowerCase();
  const bottomAreLevels = second.length >= 2 && second.filter((cell) => /^(?:[0-9]|10)$/.test(cell)).length >= Math.min(2, second.length - 1);
  const casting: CastingKind | undefined = /spells?\s+per\s+day/.test(joined) ? 'spells-per-day' : /spells?\s+known/.test(joined) ? 'spells-known' : undefined;
  if (casting && bottomAreLevels) {
    const prefix = casting === 'spells-per-day' ? 'spd_' : 'sk_';
    const headers = second.map((cell, index) => /^(?:[0-9]|10)$/.test(cell) ? `${prefix}${cell}` : cell || first[index] || `column_${index + 1}`);
    return { headers, rows: grid.slice(2), casting };
  }
  return { headers: first, rows: grid.slice(1), casting };
}

export function normalizeHeader(header: string): string {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (normalized === 'base attack bonus' || normalized === 'bab') return 'bab';
  if (normalized === 'fort' || normalized === 'fort save' || normalized === 'fortitude' || normalized === 'fortitude save') return 'fort';
  if (normalized === 'ref' || normalized === 'ref save' || normalized === 'reflex' || normalized === 'reflex save') return 'ref';
  if (normalized === 'will' || normalized === 'will save') return 'will';
  if (normalized === 'level') return 'level';
  if (normalized === 'hd' || normalized === 'hit dice') return 'hd';
  if (normalized === 'special') return 'special';
  return normalized.replace(/\s+/g, '_');
}

export function classifyTables(tables: IngestTable[]): IngestTable[] {
  let classGridSeen = false;
  return tables.map((table) => {
    const keys = new Set(Object.values(table.headerMap));
    const hasLevel = keys.has('level') || (keys.has('hd') && table.rows.some((row) => /^\d+(?:st|nd|rd|th)?$/i.test(row[table.headers.findIndex((h) => table.headerMap[h] === 'hd')] || '')));
    const isClassShape = hasLevel && ['bab', 'fort', 'ref', 'will', 'special'].every((key) => keys.has(key));
    const fullSpellColumns = table.headers.filter((header) => /^(?:spd|sk)_\d+$/.test(table.headerMap[header])).length >= 2;
    let kind: TableKind = 'lookup-table';
    if (isClassShape && !classGridSeen) { kind = 'class-grid'; classGridSeen = true; }
    else if (table.casting && hasLevel && fullSpellColumns) kind = 'extended-grid';
    else if (table.casting || fullSpellColumns) kind = 'casting-subgrid';
    else if (hasLevel) kind = 'extended-grid';
    return { ...table, kind };
  });
}

function keywordList(value: string): string[] {
  const counts = new Map<string, number>();
  for (const word of value.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || []) {
    if (!new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'not']).has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts].sort(([a, ac], [b, bc]) => bc - ac || a.localeCompare(b)).slice(0, 24).map(([word]) => word);
}

function extractLinks(html: string, documentId: string, sectionId: string): IngestLink[] {
  let index = 0;
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => {
    const href = decode(attr(match[1], 'href') || ''); const text = space(match[2]) || href;
    return { id: stableId('link', `${documentId}:${sectionId}:${index++}:${href}:${text}`), sectionId, text, href, external: /^(?:https?:)?\/\//i.test(href) };
  }).filter((link) => Boolean(link.href));
}

function htmlToText(html: string): string {
  return decode(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|nav|footer|form|noscript)\b[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|li|h[1-6]|tr|pre)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').replace(/[ \t]+/g, ' ').trim());
}

function bm25Index(sections: IngestSection[]): Record<string, Array<{ sectionId: string; score: number }>> {
  const terms = new Map<string, Map<string, number>>();
  for (const section of sections) {
    const tokens = `${section.headingPath.join(' ')} ${section.text}`.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || [];
    const length = Math.max(tokens.length, 1);
    const counts = new Map<string, number>();
    tokens.forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));
    counts.forEach((count, token) => { if (!terms.has(token)) terms.set(token, new Map()); terms.get(token)!.set(section.id, count / length); });
  }
  const result: Record<string, Array<{ sectionId: string; score: number }>> = {};
  for (const [term, perSection] of [...terms].sort(([a], [b]) => a.localeCompare(b))) {
    const idf = Math.log(1 + sections.length / Math.max(perSection.size, 1));
    result[term] = [...perSection].sort(([a], [b]) => a.localeCompare(b)).map(([sectionId, tf]) => ({ sectionId, score: Number((tf * idf).toFixed(6)) }));
  }
  return result;
}

export function ingestSource(source: SourceDocument): IngestOutputs {
  const normalized = normalizeSource(source);
  const documentId = stableId('doc', `${source.path || source.name}:${normalized.html}`);
  const tablesWithTokens = extractTables(normalized.html, documentId);
  const headingRegex = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const boundaries = [...normalized.html.matchAll(headingRegex)];
  const sections: IngestSection[] = [];
  const links: IngestLink[] = [];
  // The preamble often carries Class Skills, HD, and proficiency fields, so it is a real section.
  const sectionsHtml = boundaries.length ? [
    { level: 1, heading: normalized.title, html: normalized.html.slice(0, boundaries[0]!.index), order: -1 },
    ...boundaries.map((heading, index) => ({
      level: Number(heading[1]), heading: space(heading[2]) || 'Untitled', html: normalized.html.slice(heading.index! + heading[0].length, boundaries[index + 1]?.index ?? normalized.html.length), order: index,
    })),
  ] : [{ level: 1, heading: normalized.title, html: normalized.html, order: 0 }];
  const headingPath: string[] = [];
  for (const item of sectionsHtml) {
    headingPath.length = item.level - 1; headingPath[item.level - 1] = item.heading;
    const sectionId = stableId('section', `${documentId}:${item.order}:${headingPath.join('/')}`);
    const matches = tablesWithTokens.filter(({ token }) => item.html.includes(token));
    let text = htmlToText(item.html);
    for (const { token, table } of matches) text = text.replace(htmlToText(token), `[Table: ${table.caption || table.headers.join(', ') || 'Untitled'}; table_id=${table.id}]`);
    const sectionLinks = extractLinks(item.html, documentId, sectionId); links.push(...sectionLinks);
    sections.push({ id: sectionId, headingPath: [...headingPath], level: item.level, text, tableIds: matches.map(({ table }) => table.id), linkIds: sectionLinks.map((link) => link.id), keywords: keywordList(`${headingPath.join(' ')} ${text}`) });
    for (const match of matches) match.table.sectionId = sectionId;
  }
  const tables = classifyTables(tablesWithTokens.map(({ table }) => ({ ...table, sectionId: table.sectionId || sections[0]?.id || stableId('section', documentId), kind: 'lookup-table' })));
  const text = sections.map((section) => `${'#'.repeat(Math.min(section.level, 6))} ${section.headingPath.at(-1)}\n\n${section.text}`.trim()).join('\n\n');
  return {
    'table.json': { schemaVersion: INGEST_SCHEMA_VERSION, documentId, tables },
    'links.json': { schemaVersion: INGEST_SCHEMA_VERSION, documentId, links },
    'text.md': text,
    'index.json': { schemaVersion: INGEST_SCHEMA_VERSION, document: { id: documentId, title: normalized.title, sha256: hash(normalized.html), sourceType: normalized.sourceType }, sections, toc: sections.map(({ id, headingPath, level }) => ({ sectionId: id, headingPath, level })), keywords: keywordList(`${normalized.title} ${text}`), termIndex: bm25Index(sections) },
  };
}

/** JSON schemas are intentionally data, so AF2 can expose/validate them without importing a schema library. */
export const OUTPUT_SCHEMAS = {
  table: { type: 'object', required: ['schemaVersion', 'documentId', 'tables'], properties: { tables: { type: 'array' } } },
  links: { type: 'object', required: ['schemaVersion', 'documentId', 'links'], properties: { links: { type: 'array' } } },
  text: { type: 'string' },
  index: { type: 'object', required: ['schemaVersion', 'document', 'sections', 'toc', 'keywords', 'termIndex'] },
} as const;
