/**
 * Classified SRD class extraction. Consumes CX2 ingest tables only:
 * no prose grids, lookup tables, or synthesized 1–20 progressions.
 */
import type { IngestTable } from '../../server/ingest/ingest';

export interface ClassColumn { id: string; header: string; sourceTableId: string; }
export interface ClassGridRow { level: number; values: Record<string, string>; }
export interface ExtractedClass {
  matched: boolean; className: string; hitDie: number; skillPointsPerLevel: number;
  proficiencies: string; classSkillsText: string; cleanedSkillsList: string[];
  columns: ClassColumn[]; rows: ClassGridRow[]; sourceTableIds: string[]; estimated: false;
  summaryMessage: string;
}

const CORE_HEADERS = new Set(['level', 'hd', 'bab', 'fort', 'ref', 'will', 'special']);
const canonicalSkills = [
  'Acrobatics', 'Appraise', 'Bluff', 'Climb', 'Craft', 'Diplomacy', 'Disable Device', 'Disguise', 'Escape Artist', 'Fly', 'Handle Animal', 'Heal', 'Intimidate',
  'Knowledge (Arcana)', 'Knowledge (Dungeoneering)', 'Knowledge (Engineering)', 'Knowledge (Geography)', 'Knowledge (History)', 'Knowledge (Local)', 'Knowledge (Nature)', 'Knowledge (Nobility)', 'Knowledge (Planes)', 'Knowledge (Religion)',
  'Linguistics', 'Perception', 'Perform', 'Profession', 'Ride', 'Sense Motive', 'Sleight of Hand', 'Spellcraft', 'Stealth', 'Survival', 'Swim', 'Use Magic Device',
];

function plain(raw: string): string { return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function firstLine(value: string): string { return value.replace(/(?:[\r\n\t]|\s*\[Table:).*$/, '').trim(); }
function normalizeSkill(value: string): string {
  const cleaned = value.replace(/^.*?\bclass skills are\s+/i, '').replace(/^\s*(?:and|or)\s+/i, '').replace(/[.;:]+$/, '').trim();
  const knowledge = /^knowledge\s*\(([^)]+)\)/i.exec(cleaned);
  if (knowledge) return `Knowledge (${knowledge[1].trim().replace(/\b\w/g, (c) => c.toUpperCase())})`;
  return cleaned.replace(/\s*\((?:str|dex|con|int|wis|cha)\)\s*$/i, '').trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** B14: only read the explicitly delimited Class Skills field; do not scan the whole SRD. */
export function parseClassSkills(text: string): { text: string; skills: string[] } {
  const match = /(?:^|\n)\s*Class Skills\s*:\s*([\s\S]*?)(?=\n\s*(?:Skill Ranks?(?: Per Level)?|Hit Die|Weapon and Armor Proficienc(?:y|ies)|Table\s*:|[A-Z][^\n:]{1,70}:)|$)/im.exec(text);
  if (!match) return { text: '', skills: [] };
  const field = plain(match[1]);
  const candidates = field.replace(/,?\s+and\s+/gi, ', ').split(/[,;]/).map(normalizeSkill).filter(Boolean);
  const allowed = new Map(canonicalSkills.map((skill) => [skill.toLowerCase(), skill]));
  const skills = [...new Set(candidates.map((candidate) => allowed.get(candidate.toLowerCase()) || candidate).filter((candidate) => allowed.has(candidate.toLowerCase())))];
  return { text: skills.join(', '), skills };
}

/** B3: the section ends at the next labelled field/heading and is capped; no document-wide fallback. */
export function parseProficiencies(text: string, cap = 1000): string {
  const match = /(?:^|\n)\s*Weapon and Armor Proficienc(?:y|ies)\s*:\s*([\s\S]*?)(?=\n\s*(?:[A-Z][^\n:]{1,70}:|Table\s*:|#{1,6}\s)|$)/im.exec(text);
  return match ? plain(match[1]).slice(0, cap).trim() : '';
}

function numericLevel(value: string): number | undefined {
  const matched = /^\s*(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(value);
  const level = matched ? Number(matched[1]) : NaN;
  return level >= 1 && level <= 40 ? level : undefined;
}
function tableColumn(table: IngestTable, normalized: string): number { return table.headers.findIndex((header) => table.headerMap[header] === normalized); }
function tableValue(row: string[], table: IngestTable, normalized: string): string { const index = tableColumn(table, normalized); return index >= 0 ? row[index] || '' : ''; }
function columnId(table: IngestTable, header: string, used: Set<string>): string {
  const base = table.headerMap[header] || header.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'column';
  let id = base; let suffix = 2;
  while (used.has(id)) id = `${base}_${suffix++}`;
  used.add(id); return id;
}

/** B12 + B13 and the classified-table guard. */
export function extractClassFromClassifiedTables(input: { title: string; plainText: string; tables: IngestTable[]; classNameHint?: string }): ExtractedClass {
  const text = input.plainText;
  const primary = input.tables.find((table) => table.kind === 'class-grid');
  const skills = parseClassSkills(text);
  const hitDie = Number(/(?:^|\n)\s*Hit Die\s*:\s*d(6|8|10|12)\b/im.exec(text)?.[1] || 8);
  const skillPointsPerLevel = Number(/(?:^|\n)\s*Skill Ranks?(?: Per Level)?\s*:\s*([0-9]+)\s*\+\s*Int\b/im.exec(text)?.[1] || 0);
  const className = firstLine(/Table\s*:\s*([^\r\n\t]+)/i.exec(text)?.[1] || input.classNameHint || input.title) || 'SRD Class';
  const proficiencies = parseProficiencies(text);
  if (!primary) return { matched: false, className, hitDie, skillPointsPerLevel, proficiencies, classSkillsText: skills.text, cleanedSkillsList: skills.skills, columns: [], rows: [], sourceTableIds: [], estimated: false, summaryMessage: `Could not populate ${className}: the ingested SRD has no classified class grid.` };

  const accepted = [primary, ...input.tables.filter((table) => table !== primary && (table.kind === 'extended-grid' || table.kind === 'casting-subgrid'))];
  const used = new Set<string>();
  const columns: ClassColumn[] = [];
  const columnSource = new Map<string, { table: IngestTable; header: string }>();
  for (const table of accepted) {
    for (const header of table.headers) {
      const normalized = table.headerMap[header];
      if (table !== primary && (normalized === 'level' || normalized === 'hd')) continue;
      const id = columnId(table, header, used);
      columns.push({ id, header, sourceTableId: table.id }); columnSource.set(id, { table, header });
    }
  }
  const primaryLevelKey = primary.headers.find((header) => ['level', 'hd'].includes(primary.headerMap[header]))!;
  const output = new Map<number, ClassGridRow>();
  for (const row of primary.rows) {
    const level = numericLevel(row[primary.headers.indexOf(primaryLevelKey)] || '');
    if (!level) continue;
    const values: Record<string, string> = {};
    for (const column of columns.filter((item) => item.sourceTableId === primary.id)) values[column.id] = row[primary.headers.indexOf(columnSource.get(column.id)!.header)] || '';
    output.set(level, { level, values });
  }
  for (const table of accepted.slice(1)) {
    const levelHeader = table.headers.find((header) => ['level', 'hd'].includes(table.headerMap[header]));
    table.rows.forEach((row, index) => {
      const level = numericLevel(levelHeader ? row[table.headers.indexOf(levelHeader)] || '' : '') ?? index + 1;
      const target = output.get(level); if (!target) return;
      for (const column of columns.filter((item) => item.sourceTableId === table.id)) target.values[column.id] = row[table.headers.indexOf(columnSource.get(column.id)!.header)] || '';
    });
  }
  const rows = [...output.values()].sort((a, b) => a.level - b.level);
  return { matched: rows.length > 0, className, hitDie, skillPointsPerLevel, proficiencies, classSkillsText: skills.text, cleanedSkillsList: skills.skills, columns, rows, sourceTableIds: accepted.map((table) => table.id), estimated: false, summaryMessage: `Populated ${className} from ${primary.id} and ${accepted.length - 1} classified extension table(s).` };
}
