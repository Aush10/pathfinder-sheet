/**
 * Bounded SOT retrieval for Complete Sheet and lookup.
 * Queries ingest index.json and packs matching text.md sections / table rows.
 * Input is untrusted content, never executed, never treated as instructions.
 */

export const SOT_CONTEXT_CHAR_BUDGET = 12_000;
export const HISTORY_MESSAGE_CAP = 8;
export const HISTORY_CHAR_BUDGET = 4_000;
export const CLIENT_EXCERPT_CHAR_CAP = 4_000;

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'not', 'you', 'your']);

type SOTWeblink = {
  title?: string;
  category?: string;
  url?: string;
  notes?: string;
  isActive?: boolean;
};

export type BoundChatMessage = { role: string; text: string };

export interface BoundedSotResult {
  text: string;
  selectedSectionIds: string[];
  truncated: boolean;
  mode: 'ingest' | 'excerpt' | 'empty' | 'mixed';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Strip tags so leftover HTML is never sent as markup or executed. */
export function untrustedPlainText(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeQuery(query: string): string[] {
  const tokens = query.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || [];
  return tokens.filter((token) => !STOP_WORDS.has(token));
}

export function activeWeblinks(sotWeblinks: unknown, limit = 15): SOTWeblink[] {
  if (!Array.isArray(sotWeblinks)) return [];
  return sotWeblinks.filter((l: SOTWeblink) => l && l.isActive && l.url).slice(0, limit);
}

export function formatWeblinks(links: SOTWeblink[], includeNotes = false): string {
  if (links.length === 0) return 'None specified.';
  return links
    .map((l) => {
      const notes = includeNotes && l.notes ? ` — ${l.notes}` : '';
      return `- ${l.title} (${l.category}): ${l.url}${notes}`;
    })
    .join('\n');
}

export function formatModifiers(modifiers: unknown): string {
  if (!modifiers || typeof modifiers !== 'object' || Object.keys(modifiers as object).length === 0) {
    return 'None specified.';
  }
  const entries = Object.entries(modifiers as Record<string, unknown>)
    .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `- ${k}: ${v}`);
  return entries.length > 0 ? entries.join('\n') : 'None specified.';
}

export function formatBlindSpots(allowedFields: unknown): string {
  if (!allowedFields || typeof allowedFields !== 'object') return '';
  return Object.entries(allowedFields as Record<string, unknown>)
    .filter(([_, allowed]) => allowed === false)
    .map(([k]) => k)
    .join(', ');
}

export function boundConversation(conversation: unknown): BoundChatMessage[] {
  if (!Array.isArray(conversation)) return [];
  const messages: BoundChatMessage[] = [];
  for (const item of conversation) {
    if (!isRecord(item)) continue;
    const text = asString(item.text).trim();
    if (!text) continue;
    const role = asString(item.role) || 'user';
    messages.push({ role, text });
  }
  let slice = messages.slice(-HISTORY_MESSAGE_CAP);
  const size = () => slice.reduce((sum, message) => sum + message.text.length, 0);
  while (slice.length > 1 && size() > HISTORY_CHAR_BUDGET) slice = slice.slice(1);
  if (slice.length === 1 && size() > HISTORY_CHAR_BUDGET) {
    slice = [{ ...slice[0], text: slice[0].text.slice(-HISTORY_CHAR_BUDGET) }];
  }
  return slice;
}

export function formatBoundConversation(messages: BoundChatMessage[]): string {
  if (messages.length === 0) {
    return 'PLAYER: Hey, I want to build a new character! What should we make?';
  }
  return messages
    .map((msg) => `${msg.role === 'user' ? 'PLAYER' : 'AI COMPANION'}: ${msg.text}`)
    .join('\n\n');
}

function ingestFrom(document: Record<string, unknown>): {
  index: Record<string, unknown>;
  textMd: string;
  tables: unknown[];
} | null {
  const ingest = isRecord(document.ingest) ? document.ingest
    : isRecord(document.ingestArtifacts) ? document.ingestArtifacts
    : document;
  const index = ingest['index.json'] ?? ingest.index;
  const textMd = ingest['text.md'] ?? ingest.textMd;
  const tableDoc = ingest['table.json'] ?? ingest.tables;
  if (!isRecord(index) || !Array.isArray(index.sections)) return null;
  const tables = isRecord(tableDoc) && Array.isArray(tableDoc.tables)
    ? tableDoc.tables
    : Array.isArray(tableDoc) ? tableDoc : [];
  return { index, textMd: asString(textMd), tables };
}

interface RankedBlock {
  id: string;
  score: number;
  order: number;
  text: string;
}

function scoreTokens(haystack: string, tokens: string[]): number {
  if (!tokens.length || !haystack) return 0;
  const lower = haystack.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (lower.includes(token)) score += 1;
  }
  return score;
}

function tableCellBlob(table: Record<string, unknown>): string {
  const rows = Array.isArray(table.rows) ? table.rows : [];
  return rows
    .map((row) => (Array.isArray(row) ? row.map((cell) => untrustedPlainText(cell) || asString(cell)).join(' ') : ''))
    .join(' ');
}

function boundedLabel(value: string, fallback: string, maxLength: number): string {
  const label = value || fallback;
  return label.length > maxLength ? `${label.slice(0, Math.max(0, maxLength - 1))}…` : label;
}

function formatTableRows(table: Record<string, unknown>, tokens: string[]): string {
  const kind = asString(table.kind) || 'lookup-table';
  const headers = Array.isArray(table.headers) ? table.headers.map((cell) => untrustedPlainText(cell) || asString(cell)) : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const matchedRows: string[][] = [];
  const includeGrid = kind === 'class-grid' || kind === 'extended-grid' || kind === 'casting-subgrid';
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const cells = row.map((cell) => untrustedPlainText(cell) || asString(cell));
    if (includeGrid) {
      matchedRows.push(cells);
      continue;
    }
    if (tokens.length && scoreTokens(cells.join(' '), tokens) === 0) continue;
    matchedRows.push(cells);
  }
  if (kind === 'lookup-table' && matchedRows.length === 0) return '';
  const headerLine = headers.join(' | ');
  const rowLines = matchedRows.slice(0, 40).map((cells) => cells.join(' | '));
  return `[Table kind=${kind} id=${asString(table.id) || 'table'}]\n${headerLine}\n${rowLines.join('\n')}`.trim();
}

function blocksFromIngest(
  document: Record<string, unknown>,
  ingest: { index: Record<string, unknown>; textMd: string; tables: unknown[] },
  tokens: string[],
  orderBase: number,
): RankedBlock[] {
  const title = boundedLabel(asString(document.title) || asString((ingest.index.document as { title?: string } | undefined)?.title), 'Untitled', 240);
  const docId = boundedLabel(asString(document.id) || asString((ingest.index.document as { id?: string } | undefined)?.id), title, 120);
  const sections = Array.isArray(ingest.index.sections) ? ingest.index.sections : [];
  const termIndex = isRecord(ingest.index.termIndex) ? ingest.index.termIndex : {};
  const tablesById = new Map<string, Record<string, unknown>>();
  ingest.tables.forEach((table, index) => {
    if (!isRecord(table)) return;
    tablesById.set(asString(table.id) || `table-${index}`, table);
  });

  const sectionScores = new Map<string, number>();
  for (const token of tokens) {
    const hits = termIndex[token];
    if (!Array.isArray(hits)) continue;
    for (const hit of hits) {
      if (!isRecord(hit)) continue;
      const sectionId = asString(hit.sectionId);
      const score = typeof hit.score === 'number' ? hit.score : 0;
      if (!sectionId) continue;
      sectionScores.set(sectionId, (sectionScores.get(sectionId) || 0) + score + 1);
    }
  }

  const blocks: RankedBlock[] = [];
  sections.forEach((section, index) => {
    if (!isRecord(section)) return;
    const sectionId = asString(section.id) || `${docId}:section-${index}`;
    const heading = Array.isArray(section.headingPath) ? section.headingPath.map((part) => asString(part)).filter(Boolean).join(' > ') : title;
    const sectionText = untrustedPlainText(section.text) || asString(section.text);
    const keywords = Array.isArray(section.keywords) ? section.keywords.map((part) => asString(part)).join(' ') : '';
    let score = sectionScores.get(sectionId) || 0;
    score += scoreTokens(`${title} ${heading} ${sectionText} ${keywords}`, tokens);
    const tableBits: string[] = [];
    const tableIds = Array.isArray(section.tableIds) ? section.tableIds : [];
    for (const tableId of tableIds) {
      const table = tablesById.get(asString(tableId));
      if (!table) continue;
      score += scoreTokens(tableCellBlob(table), tokens);
      const rendered = formatTableRows(table, tokens);
      if (rendered) tableBits.push(rendered);
    }
    const body = [`### ${heading}`, sectionText, ...tableBits].filter(Boolean).join('\n');
    if (!body.trim()) return;
    blocks.push({
      id: sectionId,
      score: score || (tokens.length ? 0 : 0.1),
      order: orderBase + index,
      text: `[SOT DOC "${title}" | ${boundedLabel(asString(document.category), 'General Rule', 80)} | id=${docId}]\n${body}`,
    });
  });
  return blocks;
}

function excerptWindows(excerpt: string, windowSize = 1500): string[] {
  const paragraphs = excerpt.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const source = paragraphs.length ? paragraphs : [excerpt];
  const windows: string[] = [];
  for (const chunk of source) {
    if (chunk.length <= windowSize) {
      windows.push(chunk);
      continue;
    }
    let remaining = chunk;
    while (remaining.length > windowSize) {
      let cut = remaining.lastIndexOf(' ', windowSize);
      if (cut < windowSize / 2) cut = windowSize;
      windows.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) windows.push(remaining);
  }
  return windows;
}

function blocksFromExcerpt(document: Record<string, unknown>, tokens: string[], orderBase: number): RankedBlock[] {
  const title = boundedLabel(asString(document.title), 'Untitled', 240);
  const docId = boundedLabel(asString(document.id), title, 120);
  const excerpt = untrustedPlainText(document.excerpt)
    || untrustedPlainText(document.plainText)
    || untrustedPlainText(document.htmlContent);
  if (!excerpt) return [];
  return excerptWindows(excerpt).map((chunk, index) => {
    const score = scoreTokens(`${title} ${chunk}`, tokens);
    return {
      id: `${docId}:excerpt-${index}`,
      score: score || (tokens.length ? 0 : 0.1),
      order: orderBase + index,
      text: `[SOT DOC "${title}" | ${boundedLabel(asString(document.category), 'General Rule', 80)} | id=${docId}]\n${chunk}`,
    };
  });
}

function catalogueLine(document: Record<string, unknown>, index: number): string {
  const title = boundedLabel(asString(document.title), `Document ${index + 1}`, 240);
  const category = boundedLabel(asString(document.category), 'General Rule', 80);
  const id = boundedLabel(asString(document.id), '', 120);
  return `- "${title}" [${category}]${id ? ` id=${id}` : ''}`;
}

function hasTruncatedDocumentMetadata(document: Record<string, unknown>): boolean {
  return asString(document.title).length > 240
    || asString(document.category).length > 80
    || asString(document.id).length > 120;
}

function boundedCatalogue(documents: Record<string, unknown>[], budget: number): { text: string; truncated: boolean } {
  const header = 'Loaded SOT documents (catalogue only; an omitted excerpt does not mean the rule is absent from a loaded document):';
  if (budget <= 0) return { text: '', truncated: documents.length > 0 };
  if (header.length >= budget) return { text: header.slice(0, budget), truncated: true };

  const parts = [header];
  let used = header.length;
  let truncated = false;
  for (let index = 0; index < documents.length; index += 1) {
    const line = catalogueLine(documents[index], index);
    const addition = `\n${line}`;
    if (used + addition.length > budget) {
      truncated = true;
      break;
    }
    parts.push(line);
    used += addition.length;
  }
  return { text: parts.join('\n'), truncated };
}

function boundedText(text: string, budget: number): { text: string; truncated: boolean } {
  if (budget <= 0) return { text: '', truncated: text.length > 0 };
  return text.length > budget
    ? { text: text.slice(0, budget), truncated: true }
    : { text, truncated: false };
}

function packBlocks(blocks: RankedBlock[], budget: number): { text: string; selectedSectionIds: string[]; truncated: boolean } {
  const ranked = [...blocks]
    .filter((block) => block.score > 0)
    .sort((left, right) => right.score - left.score || left.order - right.order);
  const topScore = ranked[0]?.score ?? 0;
  const minScore = Math.max(1, topScore * 0.5);
  const selected: string[] = [];
  const parts: string[] = [];
  let used = 0;
  let truncated = false;
  for (const block of ranked) {
    if (block.score < minScore) continue;
    const addition = (parts.length ? '\n\n' : '') + block.text;
    if (used + addition.length > budget) {
      truncated = true;
      continue;
    }
    parts.push(block.text);
    selected.push(block.id);
    used += addition.length;
  }
  return { text: parts.join('\n\n'), selectedSectionIds: selected, truncated };
}

export function selectBoundedSotContext(args: {
  documents: unknown;
  query?: string;
  conversation?: BoundChatMessage[];
  budget?: number;
}): BoundedSotResult {
  const budget = args.budget ?? SOT_CONTEXT_CHAR_BUDGET;
  const documents = Array.isArray(args.documents) ? args.documents.filter(isRecord) : [];
  if (documents.length === 0) {
    return { text: 'None saved.', selectedSectionIds: [], truncated: false, mode: 'empty' };
  }

  const userMessages = (args.conversation || []).filter((message) => message.role === 'user').slice(-4).map((message) => message.text);
  const tokens = tokenizeQuery([args.query || '', ...userMessages].join(' '));

  if (tokens.length === 0) {
    const mode: BoundedSotResult['mode'] = documents.some((document) => ingestFrom(document)) ? 'ingest' : 'excerpt';
    const noQueryNotice = 'No query terms yet. Catalogue lists loaded documents; excerpts will appear when the player asks about them.';
    const catalogue = boundedCatalogue(documents, Math.max(0, budget - noQueryNotice.length - 2));
    const result = boundedText(`${catalogue.text}\n\n${noQueryNotice}`, budget);
    return {
      text: result.text,
      selectedSectionIds: [],
      truncated: catalogue.truncated || documents.some(hasTruncatedDocumentMetadata) || result.truncated,
      mode,
    };
  }

  const blocks: RankedBlock[] = [];
  let sawIngest = false;
  let sawExcerpt = false;
  documents.forEach((document, index) => {
    const ingest = ingestFrom(document);
    if (ingest) {
      sawIngest = true;
      blocks.push(...blocksFromIngest(document, ingest, tokens, index * 1000));
      return;
    }
    sawExcerpt = true;
    blocks.push(...blocksFromExcerpt(document, tokens, index * 1000));
  });

  const noMatchNotice = 'No excerpt matched this query. Loaded documents still exist; do not invent rules for them.';
  // Keep query evidence useful even when document titles are unusually long.
  const catalogue = boundedCatalogue(documents, Math.max(0, Math.min(3_000, budget - noMatchNotice.length - 2)));
  const packed = packBlocks(blocks, Math.max(0, budget - catalogue.text.length - 2));
  const evidence = packed.text
    ? `${catalogue.text}\n\n${packed.text}`
    : `${catalogue.text}\n\n${noMatchNotice}`;
  const result = boundedText(evidence, budget);
  const mode: BoundedSotResult['mode'] = sawIngest && sawExcerpt ? 'mixed' : sawIngest ? 'ingest' : 'excerpt';
  return {
    text: result.text,
    selectedSectionIds: packed.selectedSectionIds,
    truncated: catalogue.truncated || documents.some(hasTruncatedDocumentMetadata) || packed.truncated || result.truncated,
    mode,
  };
}

export function formatOverridePages(sotOverridePages: unknown, query = '', conversation: BoundChatMessage[] = []): string {
  const result = selectBoundedSotContext({ documents: sotOverridePages, query, conversation });
  return result.text === 'None saved.' ? 'None saved.' : result.text;
}

export function formatCompleteSheetOverridePages(
  sotOverridePages: unknown,
  query = '',
  conversation: BoundChatMessage[] = [],
): string {
  const result = selectBoundedSotContext({ documents: sotOverridePages, query, conversation });
  return result.text === 'None saved.' ? 'None saved in SOT Catalogue.' : result.text;
}

export function asUntrustedContent(label: string, body: string): string {
  return `<<<BEGIN ${label} CONTENT>>>\n${body}\n<<<END ${label} CONTENT>>>`;
}

/** Strip API keys and bearer tokens before any tap-test / debug log. */
export function redactSecretsForLog(value: string): string {
  return value
    .replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
}

export function retrievalQueryFromConversation(conversation: BoundChatMessage[], explicitQuery = ''): string {
  const latestUser = [...conversation].reverse().find((message) => message.role === 'user');
  return [explicitQuery, latestUser?.text || ''].filter(Boolean).join(' ').trim();
}
