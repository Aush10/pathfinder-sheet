/**
 * CX7 staging adapter: turn CX2's classified spell tables into fixed,
 * queryable PF1 progression records.  This module is pure and performs no IO.
 */
import type {
  PF1Character,
  SpellProgressionKind,
  SpellProgressionRow,
  SpellProgressionTable,
  SpellProgressionTables,
} from '../../../../src/types/character';
import type { IngestTable } from '../../../../server/ingest/ingest';

const MAX_LEVEL = 20;
const prefixFor = (kind: SpellProgressionKind) => kind === 'spells-per-day' ? 'spd_' : 'sk_';

function levelColumn(table: IngestTable): number {
  const level = table.headers.findIndex((header) => table.headerMap[header] === 'level');
  if (level >= 0) return level;
  // HD is only a synonym when it is actually a progression count, never d6/d8 text.
  const hd = table.headers.findIndex((header) => table.headerMap[header] === 'hd');
  return hd >= 0 && table.rows.some((row) => /^\d+(?:st|nd|rd|th)?$/i.test((row[hd] || '').trim())) ? hd : -1;
}

function parseLevel(value: string): number | undefined {
  const match = /^(\d+)(?:st|nd|rd|th)?$/i.exec(value.trim());
  if (!match) return undefined;
  const level = Number(match[1]);
  return level >= 1 && level <= MAX_LEVEL ? level : undefined;
}

function emptyRows(columns: string[]): SpellProgressionRow[] {
  return Array.from({ length: MAX_LEVEL }, (_, index) => ({
    level: index + 1,
    values: Object.fromEntries(columns.map((column) => [column, ''])),
  }));
}

/** Returns null unless this is a CX2-classified, structured spell table. */
export function buildSpellProgressionTable(table: IngestTable, sourceDocumentId?: string): SpellProgressionTable | null {
  if (!table.casting || (table.kind !== 'casting-subgrid' && table.kind !== 'extended-grid')) return null;
  const prefix = prefixFor(table.casting);
  const columns = table.headers.filter((header) => (table.headerMap[header] || header).startsWith(prefix));
  const levelIndex = levelColumn(table);
  if (!columns.length || levelIndex < 0) return null;

  const rows = emptyRows(columns);
  for (const sourceRow of table.rows) {
    const level = parseLevel(sourceRow[levelIndex] || '');
    if (!level) continue;
    const target = rows[level - 1];
    for (const column of columns) {
      const sourceIndex = table.headers.indexOf(column);
      target.values[column] = sourceRow[sourceIndex] ?? '';
    }
  }
  return { kind: table.casting, sourceTableId: table.id, ...(sourceDocumentId ? { sourceDocumentId } : {}), columns, rows };
}

/**
 * Selects the first classified table of each kind, preferring a full extended
 * grid over a standalone casting subgrid.  Document order breaks remaining ties.
 */
export function collectSpellProgressionTables(tables: IngestTable[], sourceDocumentId?: string): Partial<SpellProgressionTables> {
  const ordered = [...tables].sort((a, b) => {
    const aRank = a.kind === 'extended-grid' ? 0 : 1;
    const bRank = b.kind === 'extended-grid' ? 0 : 1;
    return aRank - bRank || a.documentOrder - b.documentOrder;
  });
  const result: Partial<SpellProgressionTables> = {};
  for (const table of ordered) {
    const parsed = buildSpellProgressionTable(table, sourceDocumentId);
    if (!parsed) continue;
    if (parsed.kind === 'spells-per-day' && !result.spellsPerDay) result.spellsPerDay = parsed;
    if (parsed.kind === 'spells-known' && !result.spellsKnown) result.spellsKnown = parsed;
  }
  return result;
}

export function getSpellProgressionTable(
  character: Pick<PF1Character, 'spellTables'>,
  kind: SpellProgressionKind,
): SpellProgressionTable | undefined {
  return kind === 'spells-per-day' ? character.spellTables?.spellsPerDay : character.spellTables?.spellsKnown;
}

export function getSpellProgressionRow(
  character: Pick<PF1Character, 'spellTables'>,
  kind: SpellProgressionKind,
  level: number,
): SpellProgressionRow | undefined {
  return getSpellProgressionTable(character, kind)?.rows.find((row) => row.level === level);
}

/** Immutable attach hook for CX3/AF8; it deliberately does not persist data. */
export function attachSpellProgressionTable<T extends Pick<PF1Character, 'spellTables'>>(
  character: T,
  table: SpellProgressionTable,
): T {
  const current = character.spellTables || {};
  const spellTables: Partial<SpellProgressionTables> = table.kind === 'spells-per-day'
    ? { ...current, spellsPerDay: table }
    : { ...current, spellsKnown: table };
  return { ...character, spellTables };
}

/** A small matrix-shaped view CX3 can merge without re-parsing source tables. */
export function toSpellProgressionMatrix(table: SpellProgressionTable): { columns: string[]; rows: SpellProgressionRow[] } {
  return { columns: ['level', ...table.columns], rows: table.rows.map((row) => ({ level: row.level, values: { ...row.values } })) };
}
