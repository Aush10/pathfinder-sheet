/** CX3 Character Matrix engine (pure, no UI). AF7 promotes this module. */
import type {
  CareerIndex,
  CareerIndexTrack,
  ClassGridRow,
  CustomClassGrid,
  MatrixColumn,
  MatrixColumnType,
  MatrixRow,
  UserMatrixIndex,
} from '../../../../src/types/character';
import type { IngestTable } from '../CX2/ingest';
import { normalizeHeader } from '../CX2/ingest';

export const MATRIX_DEFAULT_ROWS = 20;
export const MATRIX_MAX_ROWS = 40;
export type MatrixCellState = 'green' | 'red' | 'yellow';

export interface ParsedHeaderFill {
  kind: 'constant' | 'sequence';
  value?: string;
  start?: number;
  direction?: 1 | -1;
  count?: number;
  every?: number;
}

export interface ParsedIndexToken {
  indexName: string;
  normalizedIndexName: string;
  explicitCount?: number;
  dominant: boolean;
  include?: string[];
  exclude: string[];
}

export interface MatrixDiagnostic { trackId: string; row: number; message: string; }
export interface DerivedMatrixRow { level: number; values: Record<string, string>; sourceIndexIds: string[]; }
export interface DerivedMatrix {
  columns: MatrixColumn[];
  rows: DerivedMatrixRow[];
  row0?: DerivedMatrixRow;
  cellStates: Record<string, MatrixCellState>;
  diagnostics: MatrixDiagnostic[];
}

const key = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const numericHeaders = new Set(['level', 'hd', 'bab', 'fort', 'ref', 'will']);
const abilityHeaders = new Set(['special', 'ability', 'abilities', 'class_features', 'features']);
export const normalizeMatrixHeader = (header: string) => normalizeHeader(header);

export function columnTypeForHeader(header: string): MatrixColumnType {
  const normalized = normalizeMatrixHeader(header);
  return numericHeaders.has(normalized) ? 'number' : abilityHeaders.has(normalized) ? 'ability-list' : 'text';
}

/** Collision-free stable ids fix B11 without relying on a tab count. */
export function createMatrixId(prefix: string, seed: string, existing: Iterable<string> = []): string {
  const used = new Set(existing);
  const suffix = key(seed).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
  const base = `${prefix}-${suffix}`;
  if (!used.has(base)) return base;
  let ordinal = 2;
  while (used.has(`${base}-${ordinal}`)) ordinal += 1;
  return `${base}-${ordinal}`;
}

export function makeColumns(headers: string[], existing: Iterable<string> = []): MatrixColumn[] {
  const used = new Set(existing);
  return headers.map((header, offset) => {
    const id = createMatrixId('col', normalizeMatrixHeader(header) || `column-${offset + 1}`, used);
    used.add(id);
    return { id, header, type: columnTypeForHeader(header), frozen: offset === 0 };
  });
}

/** Migrates each fixed legacy row without losing a value. */
export function migrateClassGrid(grid: CustomClassGrid): UserMatrixIndex {
  const columns: MatrixColumn[] = [
    { id: 'level', header: 'Level', type: 'number', frozen: true },
    { id: 'bab', header: 'Base Attack Bonus', type: 'number' },
    { id: 'fort', header: 'Fort', type: 'number' },
    { id: 'ref', header: 'Ref', type: 'number' },
    { id: 'will', header: 'Will', type: 'number' },
    { id: 'special', header: 'Special', type: 'ability-list' },
  ];
  return {
    id: grid.id,
    name: grid.className || grid.id,
    columns,
    rows: (grid.rows || []).map((row) => ({
      level: row.level,
      values: { level: String(row.level), bab: row.babString || String(row.bab), fort: String(row.fort), ref: String(row.ref), will: String(row.will), special: row.special || '' },
    })),
    classData: { hitDie: grid.hitDie, skillPointsPerLevel: grid.skillPointsPerLevel, proficiencies: grid.proficiencies, classSkillsText: grid.classSkillsText },
  };
}

export function migrateClassGrids(grids: Record<string, CustomClassGrid> | undefined): Record<string, UserMatrixIndex> {
  return Object.fromEntries(Object.values(grids || {}).map((grid) => [grid.id, migrateClassGrid(grid)]));
}

export function parseHeaderFill(source: string): ParsedHeaderFill | { error: string } | undefined {
  const value = source.trim();
  if (!value) return undefined;
  const constant = /^=\s*(.+)$/.exec(value);
  if (constant) return { kind: 'constant', value: constant[1].trim() };
  const sequence = /^([+-])\s*(\d+)\s*(?:>\s*(\d+))?\s*(?:!\s*(\d+))?$/.exec(value);
  if (!sequence) return { error: `Invalid header fill: ${source}` };
  const count = sequence[3] ? Number(sequence[3]) : undefined;
  const every = sequence[4] ? Number(sequence[4]) : undefined;
  if ((count !== undefined && count < 1) || (every !== undefined && every < 1)) return { error: `Fill counts must be positive: ${source}` };
  return { kind: 'sequence', start: Number(sequence[2]), direction: sequence[1] === '+' ? 1 : -1, count, every };
}

/** Header fills only fill empty cells: explicit player edits always win. */
export function materializeTrack(track: CareerIndexTrack, rowCount = MATRIX_DEFAULT_ROWS): { cells: string[]; error?: string } {
  const parsed = parseHeaderFill(track.header);
  if (parsed && 'error' in parsed) return { cells: track.cells.slice(0, MATRIX_MAX_ROWS), error: parsed.error };
  const length = Math.max(rowCount, track.cells.length);
  if (length > MATRIX_MAX_ROWS) return { cells: track.cells.slice(0, MATRIX_MAX_ROWS), error: `Matrix cap is ${MATRIX_MAX_ROWS} rows.` };
  const cells = Array.from({ length }, (_, index) => track.cells[index] || '');
  if (!parsed) return { cells };
  if (parsed.kind === 'constant') return { cells: cells.map((cell) => cell || parsed.value || '') };
  const count = parsed.count ?? length;
  for (let emitted = 0, position = 0; emitted < count && position < length; emitted += 1, position += parsed.every || 1) {
    if (!cells[position]) cells[position] = String((parsed.start || 0) + (parsed.direction || 1) * emitted);
  }
  return { cells };
}

/** Parses `fighter4`, `*wizard`, `fighter=bab+special`, and `fighter-bab`. */
export function parseIndexToken(value: string): ParsedIndexToken | { error: string } {
  let source = value.trim();
  if (!source) return { error: 'Empty index token.' };
  const dominant = source.startsWith('*');
  if (dominant) source = source.slice(1).trim();
  const marker = source.search(/[+=-]/);
  const classPart = (marker < 0 ? source : source.slice(0, marker)).trim();
  const filters = marker < 0 ? '' : source.slice(marker);
  const countMatch = /^(.*?)(\d+)$/.exec(classPart);
  const indexName = (countMatch?.[1] || classPart).trim();
  if (!indexName) return { error: `Missing index name in ${value}` };
  const include: string[] = []; const exclude: string[] = [];
  if (filters) {
    const parts = [...filters.matchAll(/([+=-])([^+=-]+)/g)];
    if (!parts.length || parts.map((part) => part[0]).join('') !== filters) return { error: `Invalid column filter in ${value}` };
    for (const part of parts) {
      const headers = part[2].split('+').map(normalizeMatrixHeader).filter(Boolean);
      if (!headers.length) return { error: `Empty column filter in ${value}` };
      if (part[1] === '-') exclude.push(...headers); else include.push(...headers);
    }
  }
  return { indexName, normalizedIndexName: key(indexName), explicitCount: countMatch ? Number(countMatch[2]) : undefined, dominant, include: include.length ? [...new Set(include)] : undefined, exclude: [...new Set(exclude)] };
}

function asNumber(value: string): number | undefined {
  const match = /^\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(value);
  return match ? Number(match[1]) : undefined;
}
function findIndex(indexes: Record<string, UserMatrixIndex>, value: string): UserMatrixIndex | undefined {
  const wanted = key(value);
  return Object.values(indexes).find((index) => key(index.id) === wanted || key(index.name) === wanted);
}
function getAppends(index: UserMatrixIndex, indexes: Record<string, UserMatrixIndex>, visited = new Set<string>()): UserMatrixIndex[] {
  if (visited.has(index.id)) return [];
  visited.add(index.id);
  return [index, ...Object.values(indexes).filter((candidate) => candidate.appendToIndexId === index.id).flatMap((candidate) => getAppends(candidate, indexes, visited))];
}
function allowed(column: MatrixColumn, token: ParsedIndexToken): boolean {
  const header = normalizeMatrixHeader(column.header);
  return !token.exclude.includes(header) && (!token.include || token.include.includes(header));
}
function merge(existing: string | undefined, incoming: string, type: MatrixColumnType, secondTrack: boolean): string {
  if (!existing) return incoming;
  if (!incoming) return existing;
  if (type === 'number') {
    if (!secondTrack) return existing; // within a comma cell, first / *-dominant wins
    const current = asNumber(existing); const next = asNumber(incoming);
    return current === undefined || next === undefined ? existing : String(Math.max(current, next));
  }
  return existing.split(', ').includes(incoming) ? existing : `${existing}, ${incoming}`;
}

function applyToken(
  values: Record<string, string>, token: ParsedIndexToken, indexes: Record<string, UserMatrixIndex>, counts: Map<string, number>, sources: string[], secondTrack: boolean,
): boolean {
  const root = findIndex(indexes, token.indexName);
  if (!root) return false;
  const countKey = key(root.id);
  const level = token.explicitCount ?? (counts.get(countKey) || 0) + 1;
  counts.set(countKey, level); // Decision 2: fighter4 then fighter is level 5.
  let found = false;
  for (const index of getAppends(root, indexes)) {
    const row = index.rows.find((candidate) => candidate.level === level);
    if (!row) continue;
    found = true; sources.push(index.id);
    for (const column of index.columns.filter((candidate) => allowed(candidate, token))) {
      const incoming = row.values[column.id] || '';
      const matrixId = normalizeMatrixHeader(column.header) || column.id;
      if (incoming) values[matrixId] = merge(values[matrixId], incoming, column.type, secondTrack);
    }
  }
  return found;
}

function collectColumns(indexes: Record<string, UserMatrixIndex>): MatrixColumn[] {
  const seen = new Set<string>(); const columns: MatrixColumn[] = [];
  for (const index of Object.values(indexes)) for (const column of index.columns) {
    const id = normalizeMatrixHeader(column.header) || column.id;
    if (!seen.has(id)) { seen.add(id); columns.push({ ...column, id }); }
  }
  return columns;
}

/** Pure Matrix derivation. Lookup tables can never enter because this accepts
 * only saved user indexes, which are constructed by indexFromClassifiedTables. */
export function deriveMatrix(indexes: Record<string, UserMatrixIndex>, career: CareerIndex | undefined, requestedRows?: number): DerivedMatrix {
  const tracks = career?.tracks || [];
  const requested = Math.max(requestedRows || MATRIX_DEFAULT_ROWS, ...tracks.map((track) => track.cells.length), MATRIX_DEFAULT_ROWS);
  const materialized = tracks.map((track) => ({ track, ...materializeTrack(track, requested) }));
  const diagnostics: MatrixDiagnostic[] = [];
  materialized.forEach(({ track, error }) => { if (error) diagnostics.push({ trackId: track.id, row: 0, message: error }); });
  const states: Record<string, MatrixCellState> = {};
  // Each Career Index track is a separate progression. A second gestalt track
  // at character level 1 must read its own class level 1, not level 2 because
  // the same class name occurred in the first track.
  const countsByTrack = new Map<string, Map<string, number>>();
  const rows: DerivedMatrixRow[] = [];
  for (let rowOffset = 0; rowOffset < Math.min(requested, MATRIX_MAX_ROWS); rowOffset += 1) {
    const values: Record<string, string> = {}; const sourceIndexIds: string[] = [];
    materialized.forEach(({ track, cells }, trackOffset) => {
      const source = cells[rowOffset]?.trim() || '';
      if (!source) return;
      const parsed = source.split(',').map((part) => parseIndexToken(part));
      const failure = parsed.find((part) => 'error' in part);
      if (failure && 'error' in failure) {
        states[`${track.id}:${rowOffset}`] = 'yellow'; diagnostics.push({ trackId: track.id, row: rowOffset + 1, message: failure.error }); return;
      }
      const tokens = (parsed as ParsedIndexToken[]).sort((left, right) => Number(right.dominant) - Number(left.dominant));
      const counts = countsByTrack.get(track.id) || new Map<string, number>();
      countsByTrack.set(track.id, counts);
      const found = tokens.map((token) => applyToken(values, token, indexes, counts, sourceIndexIds, trackOffset > 0));
      states[`${track.id}:${rowOffset}`] = found.every(Boolean) ? 'green' : 'red';
    });
    rows.push({ level: rowOffset + 1, values, sourceIndexIds: [...new Set(sourceIndexIds)] });
  }
  const row0Values: Record<string, string> = {}; const row0Sources: string[] = [];
  Object.values(indexes).forEach((index) => {
    if (!index.row0) return;
    row0Sources.push(index.id);
    index.columns.forEach((column) => {
      const incoming = index.row0?.values[column.id] || ''; const matrixId = normalizeMatrixHeader(column.header) || column.id;
      if (incoming) row0Values[matrixId] = merge(row0Values[matrixId], incoming, column.type, false);
    });
  });
  return { columns: collectColumns(indexes), rows, ...(row0Sources.length ? { row0: { level: 0, values: row0Values, sourceIndexIds: row0Sources } } : {}), cellStates: states, diagnostics };
}

/** The only SRD-to-index entrance. It accepts the classified core grid plus
 * extensions/casting subgrids and expressly excludes lookup tables. */
export function indexFromClassifiedTables(id: string, name: string, tables: IngestTable[]): UserMatrixIndex | { error: string } {
  const primary = tables.find((table) => table.kind === 'class-grid');
  if (!primary) return { error: 'No classified class grid is available.' };
  const accepted = [primary, ...tables.filter((table) => table !== primary && (table.kind === 'extended-grid' || table.kind === 'casting-subgrid'))];
  const used = new Set<string>(); const columns: MatrixColumn[] = [];
  const levelHeader = (table: IngestTable) => table.headers.find((header) => ['level', 'hd'].includes(table.headerMap[header] || ''));
  for (const table of accepted) for (const header of table.headers) {
    if (table !== primary && header === levelHeader(table)) continue;
    const idForColumn = createMatrixId('col', normalizeMatrixHeader(header) || header, used); used.add(idForColumn);
    columns.push({ id: idForColumn, header, type: columnTypeForHeader(header) });
  }
  const rowsByLevel = new Map<number, MatrixRow>();
  for (const table of accepted) {
    const level = levelHeader(table); const levelPosition = level ? table.headers.indexOf(level) : -1;
    table.rows.forEach((cells, offset) => {
      const number = Number((levelPosition >= 0 ? cells[levelPosition] : String(offset + 1)).replace(/\D.*$/, ''));
      if (!Number.isInteger(number) || number < 1 || number > MATRIX_MAX_ROWS) return;
      const row = rowsByLevel.get(number) || { level: number, values: {} };
      table.headers.forEach((header, position) => {
        if (table !== primary && header === level) return;
        const column = columns.find((candidate) => candidate.header === header && !(candidate.id in row.values));
        if (column) row.values[column.id] = cells[position] || '';
      });
      rowsByLevel.set(number, row);
    });
  }
  return { id, name, columns, rows: [...rowsByLevel.values()].sort((left, right) => left.level - right.level), sourceTableIds: accepted.map((table) => table.id) };
}

// Edit Index operations. Each is immutable so UI autosave can safely debounce them.
export function clearIndex(index: UserMatrixIndex): UserMatrixIndex { return { ...index, rows: index.rows.map((row) => ({ ...row, values: {} })), row0: index.row0 ? { ...index.row0, values: {} } : undefined }; }
export function replaceIndexValues(index: UserMatrixIndex, from: string, to = ''): UserMatrixIndex {
  const replace = (row: MatrixRow): MatrixRow => ({ ...row, values: Object.fromEntries(Object.entries(row.values).map(([column, value]) => [column, value === from ? to : value])) });
  return { ...index, rows: index.rows.map(replace), row0: index.row0 ? replace(index.row0) : undefined };
}
export function addRow0(index: UserMatrixIndex): UserMatrixIndex { return index.row0 ? index : { ...index, row0: { level: 0, values: {} } }; }
export function updateIndexColumns(index: UserMatrixIndex, columns: MatrixColumn[]): UserMatrixIndex {
  const permitted = new Set(columns.map((column) => column.id));
  const trim = (row: MatrixRow): MatrixRow => ({ ...row, values: Object.fromEntries(Object.entries(row.values).filter(([column]) => permitted.has(column))) });
  return { ...index, columns: columns.map((column, position) => ({ ...column, frozen: position === 0 ? true : column.frozen })), rows: index.rows.map(trim), row0: index.row0 ? trim(index.row0) : undefined };
}
export function insertIndexRow(index: UserMatrixIndex, level: number): UserMatrixIndex {
  if (!Number.isInteger(level) || level < 1 || level > MATRIX_MAX_ROWS || index.rows.some((row) => row.level === level)) return index;
  return { ...index, rows: [...index.rows, { level, values: {} }].sort((left, right) => left.level - right.level) };
}
export function autofillIndexColumn(index: UserMatrixIndex, columnId: string, instruction: string): UserMatrixIndex {
  if (!index.columns.some((column) => column.id === columnId)) return index;
  const materialized = materializeTrack({ id: columnId, header: instruction, cells: index.rows.map((row) => row.values[columnId] || '') }, Math.max(MATRIX_DEFAULT_ROWS, index.rows.length));
  if (materialized.error) return index;
  return { ...index, rows: index.rows.map((row, offset) => ({ ...row, values: { ...row.values, ...(materialized.cells[offset] && !row.values[columnId] ? { [columnId]: materialized.cells[offset] } : {}) } })) };
}
export function appendIndex(index: UserMatrixIndex, parentId?: string): UserMatrixIndex { return { ...index, appendToIndexId: parentId }; }
export function assignMatrixValue(index: UserMatrixIndex, value: string, sectionId: string, text?: string): UserMatrixIndex {
  return { ...index, assignments: [...(index.assignments || []).filter((assignment) => assignment.value !== value), { value, sectionId, text }] };
}
export function autoAssignIndex(index: UserMatrixIndex, lookup: (value: string) => { sectionId: string; text?: string } | undefined): UserMatrixIndex {
  let updated = index;
  const existing = new Set((index.assignments || []).map((assignment) => assignment.value));
  for (const row of index.rows) for (const value of Object.values(row.values)) {
    if (!value || asNumber(value) !== undefined || existing.has(value)) continue;
    const match = lookup(value); if (match) updated = assignMatrixValue(updated, value, match.sectionId, match.text);
  }
  return updated;
}
export function bindMatrixValue(index: UserMatrixIndex, value: string, mode: 'take-highest' | 'count-total', keyValue = value): UserMatrixIndex {
  return { ...index, bindings: [...(index.bindings || []).filter((binding) => binding.value !== value), { value, mode, key: keyValue }] };
}
export function abilityTypeFromTag(value: string): { value: string; type: 'action' | 'resource' | 'spell' | 'feat' } {
  const match = /\s*<(act|rec|spell|feat)>\s*$/i.exec(value);
  const tag = match?.[1]?.toLowerCase();
  return { value: value.replace(/\s*<(?:act|rec|spell|feat)>\s*$/i, '').trim(), type: tag === 'rec' ? 'resource' : tag === 'spell' ? 'spell' : tag === 'feat' ? 'feat' : 'action' };
}

export function matrixRowToClassGridRow(row: DerivedMatrixRow, columns: MatrixColumn[]): ClassGridRow {
  const read = (header: string) => columns.find((column) => normalizeMatrixHeader(column.header) === header);
  const value = (header: string) => { const column = read(header); return column ? row.values[column.id] || '' : ''; };
  return { level: row.level, bab: asNumber(value('bab')) || 0, babString: value('bab') || undefined, fort: asNumber(value('fort')) || 0, ref: asNumber(value('ref')) || 0, will: asNumber(value('will')) || 0, special: value('special') };
}
