import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Upload,
  FileText,
  Globe,
  BookOpen,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Layers,
  Link2,
  Table2,
  Hash,
  Plus,
  RefreshCw,
} from 'lucide-react';
import type {
  PF1Character,
  SOTCategory,
  SOTRichTextPage,
  SOTWeblinkItem,
  ThemeMode,
} from '../../types/character';
import { useCharacter } from '../../context/CharacterContext';
import {
  exportSrdDocFileToHost,
  getActiveHostSrdOwner,
  loadHostSrdDocsForCharacter,
  parseImportedSrdFile,
  removeSrdDocFromHostDeviceStorage,
  sanitizeSrdDocument,
  saveSrdDocForCharacter,
} from '../../engine/sotEngine';
import {
  loadSrdIngestArtifacts,
  persistSrdIngestArtifacts,
  srdDocFolderName,
  type SrdIngestArtifacts,
} from '../../storage/fsAdapter';

export const MAX_SOT_FILE_BYTES = 5 * 1024 * 1024;
export const WARN_SOT_FILE_BYTES = Math.floor(1.5 * 1024 * 1024);

export type SrdTableKind =
  | 'class-grid'
  | 'casting-subgrid'
  | 'extended-grid'
  | 'lookup-table';

export interface ParsedIngestTablePreview {
  id: string;
  caption?: string;
  kind: SrdTableKind;
  casting?: 'spells-per-day' | 'spells-known';
  headers: string[];
  rows: string[][];
}

export interface ParsedIngestLinkPreview {
  id: string;
  sectionId: string;
  text: string;
  href: string;
  external: boolean;
}

export interface ParsedIngestIndexPreview {
  keywords: string[];
  toc: Array<{ sectionId: string; headingPath: string[]; level: number }>;
  sectionsCount: number;
  sourceType?: string;
  sha256?: string;
}

export interface ExtractedArtifactViews {
  tables: ParsedIngestTablePreview[];
  links: ParsedIngestLinkPreview[];
  markdown: string;
  index: ParsedIngestIndexPreview;
}

export interface SrdBatchDraftItem {
  id: string;
  title: string;
  category: SOTCategory;
  rawText: string;
}

export interface SotNotice {
  id: string;
  level: 'error' | 'warning' | 'success' | 'info';
  message: string;
}

export interface SOTPanelProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: ThemeMode;
  /** Optional explicit character override (used by tests/SSR; defaults to CharacterContext). */
  character?: PF1Character;
  /** Optional explicit character updater (used by tests/SSR; defaults to CharacterContext). */
  onUpdateCharacter?: (updater: (prev: PF1Character) => PF1Character) => void;
  player?: string;
}

export const SOT_CATEGORIES: SOTCategory[] = [
  'Full Class SRD',
  'Archetype',
  'Class Ability',
  'Feat',
  'Spell',
  'General Rule',
];

export const TABLE_KIND_META: Record<
  SrdTableKind,
  { label: string; badgeClass: string; matrixEligible: boolean; hint: string }
> = {
  'class-grid': {
    label: 'class-grid',
    badgeClass: 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
    matrixEligible: true,
    hint: 'Primary 1-20 class progression table (Matrix import eligible)',
  },
  'extended-grid': {
    label: 'extended-grid',
    badgeClass: 'bg-cyan-600/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/40',
    matrixEligible: true,
    hint: 'Extended leveled progression columns (Matrix import eligible)',
  },
  'casting-subgrid': {
    label: 'casting-subgrid',
    badgeClass: 'bg-violet-600/20 text-violet-700 dark:text-violet-300 border-violet-500/40',
    matrixEligible: true,
    hint: 'Spells per day / Spells known progression subtable',
  },
  'lookup-table': {
    label: 'lookup-table',
    badgeClass: 'bg-amber-600/20 text-amber-700 dark:text-amber-300 border-amber-500/40',
    matrixEligible: false,
    hint: 'Auxiliary rules lookup table (Reference only â€” excluded from Matrix progression)',
  },
};

export function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return Buffer.byteLength(text, 'utf8');
}

export function validateSotPageDraft(
  title: string,
  rawText: string
): { ok: true; warning?: string } | { ok: false; error: string } {
  const cleanTitle = title.trim();
  const cleanText = rawText.trim();
  if (!cleanTitle) {
    return {
      ok: false,
      error: 'Page title is required before saving (blank names are not allowed).',
    };
  }
  if (!cleanText) {
    return {
      ok: false,
      error: `Source content for "${cleanTitle}" is empty. Paste text/HTML or import a file.`,
    };
  }
  const bytes = utf8ByteLength(cleanText);
  if (bytes > MAX_SOT_FILE_BYTES) {
    return {
      ok: false,
      error: `"${cleanTitle}" is ${(bytes / (1024 * 1024)).toFixed(2)} MiB, exceeding the 5 MiB SOT size limit.`,
    };
  }
  if (bytes >= WARN_SOT_FILE_BYTES) {
    return {
      ok: true,
      warning: `"${cleanTitle}" is ${(bytes / (1024 * 1024)).toFixed(2)} MiB â€” large documents may approach browser storage quota.`,
    };
  }
  return { ok: true };
}

export function parseImportErrorMessage(fileName: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || 'Unknown import error');
  if (/full PF1E character sheet/i.test(msg)) {
    return `"${fileName}" is a full PF1E character sheet JSON, not an SOT document.`;
  }
  if (/Missing "srdDocument"/.test(msg)) {
    return `"${fileName}" is an .srd.json envelope without a valid "srdDocument" payload.`;
  }
  if (/Unrecognized JSON structure/i.test(msg)) {
    return `"${fileName}" contains raw JSON that does not match the .srd.json SOT envelope format.`;
  }
  if (/Invalid JSON syntax/i.test(msg)) {
    return `"${fileName}" has malformed JSON syntax (${msg}).`;
  }
  if (/empty/i.test(msg)) {
    return `"${fileName}" is empty and cannot be imported.`;
  }
  return `Failed to import "${fileName}": ${msg}`;
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { name?: string; message?: string; code?: number };
  return (
    anyErr.name === 'QuotaExceededError' ||
    anyErr.code === 22 ||
    anyErr.code === 1014 ||
    /quota/i.test(anyErr.message || '')
  );
}

export function buildBatchSotPages(
  drafts: SrdBatchDraftItem[],
  nowMs: number = Date.now()
): { pages: SOTRichTextPage[]; errors: string[]; warnings: string[] } {
  const pages: SOTRichTextPage[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  drafts.forEach((draft, idx) => {
    const check = validateSotPageDraft(draft.title, draft.rawText);
    if (!check.ok) {
      errors.push(check.error);
      return;
    }
    if (check.warning) {
      warnings.push(check.warning);
    }
    const cleanTitle = draft.title.trim();
    const sanitized = sanitizeSrdDocument(draft.rawText.trim());
    pages.push({
      id: `sot-page-${nowMs}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      title: cleanTitle,
      category: draft.category || 'General Rule',
      htmlContent: sanitized.sanitizedHtml,
      plainText: sanitized.sanitizedPlainText,
      isOverride: true,
      isReadOnly: true,
      tags: [draft.category || 'General Rule', cleanTitle],
      updatedAt: nowMs + idx,
      incidentalLinks: sanitized.incidentalLinks,
      securityAudit: sanitized.securityAudit,
    });
  });

  return { pages, errors, warnings };
}

export function extractArtifactViews(artifacts: SrdIngestArtifacts | null | undefined): ExtractedArtifactViews {
  if (!artifacts) {
    return {
      tables: [],
      links: [],
      markdown: '',
      index: { keywords: [], toc: [], sectionsCount: 0 },
    };
  }

  const rawTableObj = (artifacts['table.json'] || {}) as {
    tables?: Array<Record<string, unknown>>;
  };
  const rawTables = Array.isArray(rawTableObj.tables) ? rawTableObj.tables : [];
  const tables: ParsedIngestTablePreview[] = rawTables.map((t, idx) => {
    const rawKind = String(t.kind || 'lookup-table');
    const kind: SrdTableKind =
      rawKind === 'class-grid' ||
      rawKind === 'casting-subgrid' ||
      rawKind === 'extended-grid' ||
      rawKind === 'lookup-table'
        ? rawKind
        : 'lookup-table';
    const rawCasting = t.casting;
    const casting =
      rawCasting === 'spells-per-day' || rawCasting === 'spells-known'
        ? rawCasting
        : undefined;
    return {
      id: String(t.id || `table-${idx}`),
      caption: typeof t.caption === 'string' ? t.caption : undefined,
      kind,
      casting,
      headers: Array.isArray(t.headers) ? t.headers.map(String) : [],
      rows: Array.isArray(t.rows)
        ? (t.rows as unknown[]).map((row) =>
            Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []
          )
        : [],
    };
  });

  const rawLinksObj = (artifacts['links.json'] || {}) as {
    links?: Array<Record<string, unknown>>;
  };
  const rawLinks = Array.isArray(rawLinksObj.links) ? rawLinksObj.links : [];
  const links: ParsedIngestLinkPreview[] = rawLinks.map((lnk, idx) => ({
    id: String(lnk.id || `link-${idx}`),
    sectionId: String(lnk.sectionId || ''),
    text: String(lnk.text || lnk.href || ''),
    href: String(lnk.href || ''),
    external: Boolean(lnk.external),
  }));

  const rawIndexObj = (artifacts['index.json'] || {}) as {
    keywords?: unknown[];
    toc?: Array<Record<string, unknown>>;
    sections?: unknown[];
    document?: { sourceType?: string; sha256?: string };
  };

  const index: ParsedIngestIndexPreview = {
    keywords: Array.isArray(rawIndexObj.keywords)
      ? rawIndexObj.keywords.map(String)
      : [],
    toc: Array.isArray(rawIndexObj.toc)
      ? rawIndexObj.toc.map((item, idx) => ({
          sectionId: String(item.sectionId || `sec-${idx}`),
          headingPath: Array.isArray(item.headingPath)
            ? item.headingPath.map(String)
            : [],
          level: typeof item.level === 'number' ? item.level : 1,
        }))
      : [],
    sectionsCount: Array.isArray(rawIndexObj.sections)
      ? rawIndexObj.sections.length
      : 0,
    sourceType: rawIndexObj.document?.sourceType,
    sha256: rawIndexObj.document?.sha256,
  };

  return {
    tables,
    links,
    markdown: typeof artifacts['text.md'] === 'string' ? artifacts['text.md'] : '',
    index,
  };
}

export async function runServerIngest(source: {
  name: string;
  content: string;
  path?: string;
}): Promise<{
  ok: true;
  documentId: string;
  title: string;
  artifacts: SrdIngestArtifacts;
} | {
  ok: false;
  error: string;
  status?: number;
}> {
  if (typeof fetch !== 'function') {
    return { ok: false, error: 'Fetch API unavailable for /api/sot/ingest.' };
  }
  try {
    const res = await fetch('/api/sot/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source),
    });
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {
        ok: false,
        status: res.status,
        error: `Ingest server returned non-JSON HTTP ${res.status}. Ensure the PF1E ingest API server is running.`,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: String(parsed.error || `Ingest failed with HTTP ${res.status}.`),
      };
    }
    if (!parsed.artifacts || typeof parsed.artifacts !== 'object') {
      return { ok: false, error: 'Ingest response is missing the 4 artifact outputs.' };
    }
    return {
      ok: true,
      documentId: String(parsed.documentId || ''),
      title: String(parsed.title || source.name),
      artifacts: parsed.artifacts as SrdIngestArtifacts,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Ingest request unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function getThemeSurfaceClasses(theme: ThemeMode = 'parchment'): {
  backdrop: string;
  panel: string;
  header: string;
  subPanel: string;
  input: string;
  mutedText: string;
} {
  if (theme === 'blueprint') {
    return {
      backdrop: 'bg-slate-950/75',
      panel: 'bg-slate-900 text-slate-100 border-cyan-500/40',
      header: 'bg-slate-950/90 border-slate-700 text-cyan-200',
      subPanel: 'bg-slate-950/70 border-slate-800',
      input: 'bg-slate-950 border-slate-700 text-slate-100',
      mutedText: 'text-slate-400',
    };
  }
  if (theme === 'mythweavers') {
    return {
      backdrop: 'bg-black/75',
      panel: 'bg-zinc-900 text-zinc-100 border-zinc-600/60',
      header: 'bg-zinc-950 border-zinc-700 text-zinc-100',
      subPanel: 'bg-zinc-950/70 border-zinc-800',
      input: 'bg-zinc-950 border-zinc-700 text-zinc-100',
      mutedText: 'text-zinc-400',
    };
  }
  if (theme === 'print') {
    return {
      backdrop: 'bg-slate-900/60',
      panel: 'bg-white text-slate-900 border-slate-300',
      header: 'bg-slate-100 border-slate-300 text-slate-900',
      subPanel: 'bg-slate-50 border-slate-200',
      input: 'bg-white border-slate-300 text-slate-900',
      mutedText: 'text-slate-600',
    };
  }
  return {
    backdrop: 'bg-stone-950/70',
    panel: 'bg-[#fdf8eb] text-stone-900 border-amber-800/40',
    header: 'bg-[#f4e8cd] border-amber-800/30 text-stone-900',
    subPanel: 'bg-[#f9f1de] border-amber-800/25',
    input: 'bg-white border-amber-800/30 text-stone-900',
    mutedText: 'text-stone-600',
  };
}

interface SOTPanelCoreProps extends SOTPanelProps {
  character: PF1Character;
  onUpdateCharacter: (updater: (prev: PF1Character) => PF1Character) => void;
}

const SOTPanelCore: React.FC<SOTPanelCoreProps> = ({
  isOpen,
  onClose,
  theme = 'parchment',
  character,
  onUpdateCharacter,
  player,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rightTab, setRightTab] = useState<'add' | 'inspect'>('add');
  const [artifactTab, setArtifactTab] = useState<'table' | 'links' | 'text' | 'index'>('table');
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  // Draft / batch paste state
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState<SOTCategory>('Full Class SRD');
  const [draftText, setDraftText] = useState('');
  const [batchQueue, setBatchQueue] = useState<SrdBatchDraftItem[]>([]);

  // Weblink add + optional single-page fetch
  const [weblinkTitle, setWeblinkTitle] = useState('');
  const [weblinkUrl, setWeblinkUrl] = useState('');
  const [fetchUrl, setFetchUrl] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  // Dismissable notices (B8 replacement â€” never relies on <details> or window.alert)
  const [notices, setNotices] = useState<SotNotice[]>([]);

  // Cached 4-output artifacts keyed by SOT doc id
  const [artifactCache, setArtifactCache] = useState<Record<string, SrdIngestArtifacts>>({});
  const [artifactStatusMsg, setArtifactStatusMsg] = useState<string>('');

  const ownerCharacterId =
    getActiveHostSrdOwner() || character.name?.trim() || 'session-default';
  const charPages = character.sotCatalogue?.overridePages || [];
  const charWeblinks = character.sotCatalogue?.weblinks || [];

  const mergedDocs = useMemo(() => {
    const hostDocs =
      typeof window !== 'undefined' ? loadHostSrdDocsForCharacter(ownerCharacterId) : [];
    const byId = new Map<string, SOTRichTextPage>();
    for (const d of hostDocs) {
      if (d?.id) byId.set(d.id, d);
    }
    for (const d of charPages) {
      if (d?.id) byId.set(d.id, d);
    }
    return Array.from(byId.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [charPages, ownerCharacterId]);

  const selectedDoc = useMemo(
    () => mergedDocs.find((d) => d.id === selectedDocId) || mergedDocs[0] || null,
    [mergedDocs, selectedDocId]
  );

  const selectedArtifacts = selectedDoc ? artifactCache[selectedDoc.id] : undefined;
  const selectedViews = useMemo(
    () => extractArtifactViews(selectedArtifacts),
    [selectedArtifacts]
  );

  const pushNotice = useCallback((level: SotNotice['level'], message: string) => {
    const id = `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setNotices((prev) => [{ id, level, message }, ...prev].slice(0, 6));
  }, []);

  const dismissNotice = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedDocId && mergedDocs[0]) {
      setSelectedDocId(mergedDocs[0].id);
    }
  }, [isOpen, mergedDocs, selectedDocId]);

  // Load persisted 4-output artifacts whenever selectedDoc changes and isn't cached yet
  useEffect(() => {
    if (!isOpen || !selectedDoc) return;
    if (artifactCache[selectedDoc.id]) {
      setArtifactStatusMsg('Loaded deterministic 4-output ingest artifacts.');
      return;
    }
    let cancelled = false;
    const docFolder = srdDocFolderName(selectedDoc.title, selectedDoc.id);
    setArtifactStatusMsg(`Checking stored artifacts for "${selectedDoc.title}"...`);
    void loadSrdIngestArtifacts({
      player,
      characterName: character.name,
      characterId: ownerCharacterId,
      docFolder,
    }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setArtifactCache((prev) => ({ ...prev, [selectedDoc.id]: res.artifacts }));
        setArtifactStatusMsg(`Loaded 4 artifacts from ${res.stored} (${res.relativePath}).`);
      } else {
        setArtifactStatusMsg(
          'No stored 4-output artifacts yet. Click "Re-run Ingest" to extract table.json, links.json, text.md, and index.json.'
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedDoc, artifactCache, player, character.name, ownerCharacterId]);

  const persistPageAndArtifacts = useCallback(
    async (page: SOTRichTextPage, rawSourceForIngest: string): Promise<string[]> => {
      const notes: string[] = [];

      // 1. Save per-character host copy safely (catching quota errors)
      try {
        if (typeof window !== 'undefined') {
          saveSrdDocForCharacter(ownerCharacterId, page);
        }
      } catch (err) {
        if (isQuotaExceededError(err)) {
          notes.push(
            `Storage quota warning while saving "${page.title}" to browser localStorage.`
          );
        } else {
          notes.push(
            `Host local cache notice for "${page.title}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // 2. Run deterministic /api/sot/ingest and persist the 4 output files via AF2
      const ingestName = `${page.title.replace(/\.[^.]+$/, '')}.html`;
      const ingestOutcome = await runServerIngest({
        name: ingestName,
        content: rawSourceForIngest,
      });

      if (!ingestOutcome.ok) {
        notes.push(`"${page.title}" saved read-only; ingest skipped/error: ${ingestOutcome.error}`);
        return notes;
      }

      setArtifactCache((prev) => ({ ...prev, [page.id]: ingestOutcome.artifacts }));
      const docFolder = srdDocFolderName(page.title, page.id);
      const persistRes = await persistSrdIngestArtifacts({
        player,
        characterName: character.name,
        characterId: ownerCharacterId,
        docFolder,
        artifacts: ingestOutcome.artifacts,
      });
      if (!persistRes.ok) {
        notes.push(
          `"${page.title}" ingested, but 4-output persistence reported: ${persistRes.error.message}`
        );
      }
      return notes;
    },
    [ownerCharacterId, player, character.name]
  );

  const commitPagesToCharacter = useCallback(
    (newPages: SOTRichTextPage[]) => {
      onUpdateCharacter((prev) => {
        const existing = prev.sotCatalogue?.overridePages || [];
        const existingIds = new Set(existing.map((p) => p.id));
        const deduped = [...existing];
        for (const p of newPages) {
          if (!existingIds.has(p.id)) {
            deduped.push(p);
          }
        }
        return {
          ...prev,
          sotCatalogue: {
            weblinks: prev.sotCatalogue?.weblinks || [],
            macaroniSuggestions: prev.sotCatalogue?.macaroniSuggestions || [],
            overridePages: deduped,
          },
        };
      });
    },
    [onUpdateCharacter]
  );

  const handleQueueDraft = () => {
    const check = validateSotPageDraft(draftTitle, draftText);
    if (!check.ok) {
      pushNotice('error', check.error);
      return;
    }
    if (check.warning) {
      pushNotice('warning', check.warning);
    }
    setBatchQueue((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: draftTitle.trim(),
        category: draftCategory,
        rawText: draftText,
      },
    ]);
    setDraftTitle('');
    setDraftText('');
    pushNotice('info', `Queued "${draftTitle.trim()}" for batch SOT save.`);
  };

  const handleBatchSave = async () => {
    const itemsToSave: SrdBatchDraftItem[] = [...batchQueue];
    if (draftTitle.trim() || draftText.trim()) {
      itemsToSave.push({
        id: `draft-current-${Date.now()}`,
        title: draftTitle,
        category: draftCategory,
        rawText: draftText,
      });
    }
    if (itemsToSave.length === 0) {
      pushNotice('error', 'Add at least one SOT page title and text before saving.');
      return;
    }

    const built = buildBatchSotPages(itemsToSave);
    built.errors.forEach((e) => pushNotice('error', e));
    built.warnings.forEach((w) => pushNotice('warning', w));
    if (built.pages.length === 0) return;

    setIsBusy(true);
    try {
      commitPagesToCharacter(built.pages);
      const rawMap = new Map(
        built.pages.map((p, idx) => [p.id, itemsToSave[idx]?.rawText || p.plainText])
      );
      for (const page of built.pages) {
        const pageNotes = await persistPageAndArtifacts(page, rawMap.get(page.id) || page.plainText);
        pageNotes.forEach((n) => pushNotice('warning', n));
      }
      setSelectedDocId(built.pages[0].id);
      setRightTab('inspect');
      setBatchQueue([]);
      if (draftTitle.trim() && draftText.trim()) {
        setDraftTitle('');
        setDraftText('');
      }
      pushNotice(
        'success',
        `Saved ${built.pages.length} SOT ${built.pages.length === 1 ? 'document' : 'documents'} (${built.pages.map((p) => p.title).join(', ')}).`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleMultiFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsBusy(true);
    const importedPages: SOTRichTextPage[] = [];
    const rawByDocId = new Map<string, string>();
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_SOT_FILE_BYTES) {
          pushNotice(
            'error',
            `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)} MiB, exceeding the 5 MiB limit.`
          );
          continue;
        }
        if (file.size >= WARN_SOT_FILE_BYTES) {
          pushNotice(
            'warning',
            `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)} MiB (approaching browser storage limit).`
          );
        }
        const rawContent = await file.text();
        const isJsonFile = file.name.toLowerCase().endsWith('.json');
        if (isJsonFile || file.name.toLowerCase().endsWith('.srd.json')) {
          try {
            const parsedDoc = parseImportedSrdFile(file.name, rawContent);
            importedPages.push(parsedDoc);
            rawByDocId.set(parsedDoc.id, parsedDoc.htmlContent || parsedDoc.plainText);
          } catch (err) {
            pushNotice('error', parseImportErrorMessage(file.name, err));
          }
        } else {
          const baseTitle = file.name.replace(/\.[^.]+$/, '').trim();
          const check = validateSotPageDraft(baseTitle, rawContent);
          if (!check.ok) {
            pushNotice('error', `${file.name}: ${check.error}`);
            continue;
          }
          const sanitized = sanitizeSrdDocument(rawContent);
          const page: SOTRichTextPage = {
            id: `sot-file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: baseTitle,
            category: draftCategory,
            htmlContent: sanitized.sanitizedHtml,
            plainText: sanitized.sanitizedPlainText,
            isOverride: true,
            isReadOnly: true,
            tags: [draftCategory, baseTitle],
            updatedAt: Date.now(),
            incidentalLinks: sanitized.incidentalLinks,
            securityAudit: sanitized.securityAudit,
          };
          importedPages.push(page);
          rawByDocId.set(page.id, rawContent);
        }
      }

      if (importedPages.length > 0) {
        commitPagesToCharacter(importedPages);
        for (const page of importedPages) {
          const notes = await persistPageAndArtifacts(
            page,
            rawByDocId.get(page.id) || page.plainText
          );
          notes.forEach((n) => pushNotice('warning', n));
        }
        setSelectedDocId(importedPages[0].id);
        setRightTab('inspect');
        pushNotice(
          'success',
          `Imported ${importedPages.length} SOT ${importedPages.length === 1 ? 'file' : 'files'}.`
        );
      }
    } finally {
      setIsBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRerunIngest = async (doc: SOTRichTextPage) => {
    setIsBusy(true);
    try {
      const notes = await persistPageAndArtifacts(doc, doc.htmlContent || doc.plainText);
      if (notes.length > 0) {
        notes.forEach((n) => pushNotice('warning', n));
      } else {
        pushNotice('success', `Re-ingested "${doc.title}" into 4 artifacts.`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveDoc = (doc: SOTRichTextPage) => {
    if (typeof window !== 'undefined') {
      removeSrdDocFromHostDeviceStorage(doc.id);
    }
    onUpdateCharacter((prev) => ({
      ...prev,
      sotCatalogue: {
        weblinks: prev.sotCatalogue?.weblinks || [],
        macaroniSuggestions: prev.sotCatalogue?.macaroniSuggestions || [],
        overridePages: (prev.sotCatalogue?.overridePages || []).filter((p) => p.id !== doc.id),
      },
    }));
    if (selectedDocId === doc.id) {
      setSelectedDocId('');
    }
    pushNotice('info', `Removed SOT document "${doc.title}".`);
  };

  const handleAddWeblink = (titleValue: string, urlValue: string) => {
    const title = titleValue.trim();
    const url = urlValue.trim();
    if (!title || !url) {
      pushNotice('error', 'Weblink title and URL are required.');
      return;
    }
    const item: SOTWeblinkItem = {
      id: `weblink-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title,
      url,
      category: 'General Rule',
      isActive: true,
      createdAt: Date.now(),
    };
    onUpdateCharacter((prev) => ({
      ...prev,
      sotCatalogue: {
        weblinks: [...(prev.sotCatalogue?.weblinks || []), item],
        overridePages: prev.sotCatalogue?.overridePages || [],
        macaroniSuggestions: prev.sotCatalogue?.macaroniSuggestions || [],
      },
    }));
    setWeblinkTitle('');
    setWeblinkUrl('');
    pushNotice('success', `Saved weblink "${title}".`);
  };

  const handleFetchSinglePage = async () => {
    const cleanUrl = fetchUrl.trim();
    if (!cleanUrl) {
      pushNotice('error', 'Enter a single URL to fetch read-only.');
      return;
    }
    setIsBusy(true);
    try {
      const res = await fetch('/api/sot/fetch-readonly-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
      });
      const data = (await res.json()) as { title?: string; content?: string; error?: string };
      if (!res.ok) {
        pushNotice('error', data.error || `Single-page fetch returned HTTP ${res.status}.`);
        return;
      }
      setDraftTitle((prev) => prev.trim() || String(data.title || cleanUrl));
      setDraftText(String(data.content || ''));
      setRightTab('add');
      pushNotice('success', `Fetched single-page snapshot from "${cleanUrl}". Review and save to SOT.`);
    } catch (err) {
      pushNotice(
        'error',
        `Single-page fetch failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsBusy(false);
    }
  };

  if (!isOpen) return null;
  const surface = getThemeSurfaceClasses(theme);
  const currentBytes = utf8ByteLength(draftText);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${surface.backdrop} backdrop-blur-xs`}
      role="dialog"
      aria-modal="true"
      aria-label="Source of Truth Document Library"
    >
      <div
        className={`w-full max-w-6xl max-h-[90vh] flex flex-col rounded-xl border-2 shadow-2xl overflow-hidden ${surface.panel}`}
      >
        {/* Header */}
        <div className={`px-5 py-3.5 border-b flex items-center justify-between gap-4 ${surface.header}`}>
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="w-5 h-5 shrink-0 text-cyan-500" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base tracking-tight">
                  Source of Truth (SOT) Library
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
                  {character.name || 'Character'} â€¢ {mergedDocs.length} Docs
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Standalone â€¢ Non-AI
                </span>
              </div>
              <p className={`text-xs truncate ${surface.mutedText}`}>
                Batch import rulebook pages &amp; inspect deterministic 4-output ingest (table.json, links.json, text.md, index.json)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close SOT Library"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dismissable Notices Banner (replaces alerts & auto-closing details) */}
        {notices.length > 0 && (
          <div className="px-5 py-2 border-b border-black/10 dark:border-white/10 space-y-1.5 max-h-36 overflow-y-auto pf1-theme-scrollbar">
            {notices.map((n) => (
              <div
                key={n.id}
                className={`flex items-start justify-between gap-2 px-3 py-1.5 rounded text-xs border ${
                  n.level === 'error'
                    ? 'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-300'
                    : n.level === 'warning'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
                    : n.level === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                    : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-800 dark:text-cyan-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  {n.level === 'error' || n.level === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{n.message}</span>
                </div>
                <button
                  onClick={() => dismissNotice(n.id)}
                  className="text-[11px] font-mono underline shrink-0 hover:opacity-80"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main 2-column body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left column: Saved SOT documents & Weblinks */}
          <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-black/10 dark:border-white/10 flex flex-col min-h-0 overflow-y-auto pf1-theme-scrollbar p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-500" />
                Loaded SOT Documents ({mergedDocs.length})
              </h3>
              <button
                onClick={() => setRightTab('add')}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Batch
              </button>
            </div>

            {mergedDocs.length === 0 ? (
              <div className={`p-3 rounded-lg border text-xs ${surface.subPanel} ${surface.mutedText}`}>
                No SOT documents loaded for this character yet. Paste rule text or import HTML, MD, TXT, or .srd.json files on the right.
              </div>
            ) : (
              <div className="space-y-2">
                {mergedDocs.map((doc) => {
                  const isSelected = selectedDoc?.id === doc.id;
                  const hasArtifacts = Boolean(artifactCache[doc.id]);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => {
                        setSelectedDocId(doc.id);
                        setRightTab('inspect');
                      }}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : `${surface.subPanel} hover:border-cyan-500/50`
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-xs truncate">{doc.title}</div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10">
                              {doc.category}
                            </span>
                            {hasArtifacts && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                                4 Outputs
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void exportSrdDocFileToHost(doc);
                            }}
                            title="Export .srd.json"
                            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveDoc(doc);
                            }}
                            title="Remove SOT document"
                            className="p-1 rounded hover:bg-red-500/20 text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Weblinks Section */}
            <div className={`p-3 rounded-lg border space-y-2 ${surface.subPanel}`}>
              <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-500" />
                Weblinks &amp; Single-Page Snapshot ({charWeblinks.length})
              </div>
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={weblinkTitle}
                  onChange={(e) => setWeblinkTitle(e.target.value)}
                  placeholder="Reference label"
                  className={`w-full px-2 py-1 text-xs rounded border ${surface.input}`}
                />
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={weblinkUrl}
                    onChange={(e) => setWeblinkUrl(e.target.value)}
                    placeholder="https://aonprd.com/..."
                    className={`flex-1 min-w-0 px-2 py-1 text-xs rounded border ${surface.input}`}
                  />
                  <button
                    onClick={() => handleAddWeblink(weblinkTitle, weblinkUrl)}
                    className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shrink-0"
                  >
                    Save
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5 pt-1 border-t border-black/10 dark:border-white/10">
                <input
                  type="url"
                  value={fetchUrl}
                  onChange={(e) => setFetchUrl(e.target.value)}
                  placeholder="Single URL snapshot..."
                  className={`flex-1 min-w-0 px-2 py-1 text-xs rounded border ${surface.input}`}
                />
                <button
                  onClick={handleFetchSinglePage}
                  disabled={isBusy}
                  className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-mono shrink-0"
                >
                  Fetch 1 Page
                </button>
              </div>
              {charWeblinks.length > 0 && (
                <ul className="space-y-1 max-h-36 overflow-y-auto pf1-theme-scrollbar pt-1">
                  {charWeblinks.map((w) => (
                    <li
                      key={w.id}
                      className="flex items-center justify-between gap-2 text-xs py-0.5"
                    >
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-cyan-600 dark:text-cyan-300 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        {w.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* Right column: Batch Upload / Paste OR 4-Output Viewer */}
          <section className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden">
            <div className="px-4 py-2 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRightTab('add')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    rightTab === 'add'
                      ? 'bg-cyan-600 text-white'
                      : 'hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  Batch Import &amp; Paste
                </button>
                <button
                  onClick={() => setRightTab('inspect')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    rightTab === 'inspect'
                      ? 'bg-cyan-600 text-white'
                      : 'hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  4-Output Viewer {selectedDoc ? `(${selectedDoc.title})` : ''}
                </button>
              </div>
              {selectedDoc && rightTab === 'inspect' && (
                <button
                  onClick={() => void handleRerunIngest(selectedDoc)}
                  disabled={isBusy}
                  className="px-2.5 py-1 rounded text-xs font-mono bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Re-run Ingest
                </button>
              )}
            </div>

            {rightTab === 'add' ? (
              <div className="flex-1 min-h-0 overflow-y-auto pf1-theme-scrollbar p-4 space-y-4">
                {/* Multi-file upload box */}
                <div className={`p-3 rounded-lg border border-dashed flex items-center justify-between gap-3 flex-wrap ${surface.subPanel}`}>
                  <div className="text-xs">
                    <div className="font-semibold flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-cyan-500" />
                      Import Multiple SOT Files (5 MiB max per file)
                    </div>
                    <p className={`text-[11px] ${surface.mutedText}`}>
                      Supports .html, .htm, .md, .txt, and validated .srd.json envelopes (rejects raw/sheet JSON).
                    </p>
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".srd.json,.json,.html,.htm,.txt,.md,.markdown"
                      onChange={(e) => void handleMultiFileUpload(e.target.files)}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isBusy}
                      className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold"
                    >
                      Choose Files...
                    </button>
                  </div>
                </div>

                {/* Paste / Batch Queue Editor */}
                <div className={`p-4 rounded-lg border space-y-3 ${surface.subPanel}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      Paste One or Multiple SOT Pages
                    </h4>
                    <span className={`text-[11px] font-mono ${surface.mutedText}`}>
                      Draft size: {(currentBytes / 1024).toFixed(1)} KiB / 5120 KiB
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`text-[11px] font-mono block mb-1 ${surface.mutedText}`}>
                        Page Title (Required)
                      </label>
                      <input
                        type="text"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        placeholder="e.g. Fighter Class Progression"
                        className={`w-full px-2.5 py-1.5 rounded border text-xs ${surface.input}`}
                      />
                    </div>
                    <div>
                      <label className={`text-[11px] font-mono block mb-1 ${surface.mutedText}`}>
                        Category
                      </label>
                      <select
                        value={draftCategory}
                        onChange={(e) => setDraftCategory(e.target.value as SOTCategory)}
                        className={`w-full px-2.5 py-1.5 rounded border text-xs ${surface.input}`}
                      >
                        {SOT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={`text-[11px] font-mono block mb-1 ${surface.mutedText}`}>
                      Rulebook HTML / Markdown / Plain Text
                    </label>
                    <textarea
                      rows={7}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      placeholder="Paste HTML tables, Markdown, or SRD text here..."
                      className={`w-full p-2.5 rounded border text-xs font-mono ${surface.input}`}
                    />
                  </div>

                  {batchQueue.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-black/10 dark:border-white/10">
                      <div className="text-[11px] font-mono font-bold">
                        Batch Queue ({batchQueue.length} ready)
                      </div>
                      {batchQueue.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-1 rounded bg-black/5 dark:bg-white/5 text-xs"
                        >
                          <span className="truncate font-medium">
                            {item.title} ({item.category})
                          </span>
                          <button
                            onClick={() =>
                              setBatchQueue((prev) => prev.filter((q) => q.id !== item.id))
                            }
                            className="text-red-500 text-[11px] font-mono hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                    <button
                      onClick={handleQueueDraft}
                      disabled={isBusy}
                      className="px-3 py-1.5 rounded border border-cyan-500/50 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/10 text-xs font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Queue Page for Batch
                    </button>
                    <button
                      onClick={() => void handleBatchSave()}
                      disabled={isBusy}
                      className="px-3.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {batchQueue.length > 0
                        ? `Save Batch (${batchQueue.length + (draftTitle.trim() && draftText.trim() ? 1 : 0)}) & Ingest`
                        : 'Save Page & Ingest'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {!selectedDoc ? (
                  <div className={`p-6 text-xs ${surface.mutedText}`}>
                    Select a document from the left column or add a new SOT document first.
                  </div>
                ) : (
                  <>
                    {/* 4-Output Sub-Tab Bar */}
                    <div className="px-4 py-2 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => setArtifactTab('table')}
                          className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 ${
                            artifactTab === 'table'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-black/5 dark:bg-white/5'
                          }`}
                        >
                          <Table2 className="w-3.5 h-3.5" />
                          table.json ({selectedViews.tables.length})
                        </button>
                        <button
                          onClick={() => setArtifactTab('links')}
                          className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 ${
                            artifactTab === 'links'
                              ? 'bg-cyan-600 text-white'
                              : 'bg-black/5 dark:bg-white/5'
                          }`}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          links.json ({selectedViews.links.length})
                        </button>
                        <button
                          onClick={() => setArtifactTab('text')}
                          className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 ${
                            artifactTab === 'text'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-black/5 dark:bg-white/5'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          text.md
                        </button>
                        <button
                          onClick={() => setArtifactTab('index')}
                          className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 ${
                            artifactTab === 'index'
                              ? 'bg-amber-600 text-white'
                              : 'bg-black/5 dark:bg-white/5'
                          }`}
                        >
                          <Hash className="w-3.5 h-3.5" />
                          index.json ({selectedViews.index.keywords.length})
                        </button>
                      </div>
                      <span className={`text-[11px] font-mono truncate max-w-sm ${surface.mutedText}`}>
                        {artifactStatusMsg}
                      </span>
                    </div>

                    {/* 4-Output Content */}
                    <div className="flex-1 min-h-0 overflow-y-auto pf1-theme-scrollbar p-4 space-y-3">
                      {artifactTab === 'table' && (
                        selectedViews.tables.length === 0 ? (
                          <div className={`p-4 rounded border text-xs ${surface.subPanel} ${surface.mutedText}`}>
                            No extracted HTML tables in table.json for this document.
                          </div>
                        ) : (
                          selectedViews.tables.map((tbl) => {
                            const meta = TABLE_KIND_META[tbl.kind];
                            return (
                              <div
                                key={tbl.id}
                                className={`p-3 rounded-lg border space-y-2 ${surface.subPanel}`}
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-xs">
                                      {tbl.caption || tbl.id}
                                    </span>
                                    <span
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${meta.badgeClass}`}
                                    >
                                      {meta.label}
                                    </span>
                                    {tbl.casting && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                                        {tbl.casting}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-[10px] font-mono ${surface.mutedText}`}>
                                    {tbl.rows.length} rows Ã— {tbl.headers.length} cols
                                  </span>
                                </div>
                                <div className={`text-[11px] ${surface.mutedText}`}>{meta.hint}</div>
                                <div className="overflow-x-auto pf1-theme-scrollbar">
                                  <table className="min-w-full text-[11px] border-collapse">
                                    {tbl.headers.length > 0 && (
                                      <thead>
                                        <tr className="border-b border-black/15 dark:border-white/15 text-left">
                                          {tbl.headers.map((h, hIdx) => (
                                            <th key={hIdx} className="px-2 py-1 font-mono font-bold whitespace-nowrap">
                                              {h}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                    )}
                                    <tbody>
                                      {tbl.rows.slice(0, 25).map((row, rIdx) => (
                                        <tr
                                          key={rIdx}
                                          className="border-b border-black/5 dark:border-white/5"
                                        >
                                          {row.map((cell, cIdx) => (
                                            <td key={cIdx} className="px-2 py-1 align-top">
                                              {cell}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {tbl.rows.length > 25 && (
                                    <div className={`text-[10px] font-mono pt-1 ${surface.mutedText}`}>
                                      Showing first 25 of {tbl.rows.length} rows.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )
                      )}

                      {artifactTab === 'links' && (
                        selectedViews.links.length === 0 ? (
                          <div className={`p-4 rounded border text-xs ${surface.subPanel} ${surface.mutedText}`}>
                            No extracted links in links.json.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {selectedViews.links.map((lnk) => (
                              <div
                                key={lnk.id}
                                className={`p-2 rounded border flex items-center justify-between gap-2 text-xs ${surface.subPanel}`}
                              >
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">{lnk.text || lnk.href}</div>
                                  <div className={`text-[11px] font-mono truncate ${surface.mutedText}`}>
                                    {lnk.href} {lnk.external ? 'â€¢ external' : 'â€¢ relative'}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleAddWeblink(lnk.text || lnk.href, lnk.href)}
                                  className="px-2 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-700 dark:text-cyan-300 text-[11px] font-mono shrink-0"
                                >
                                  + Save Weblink
                                </button>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                      {artifactTab === 'text' && (
                        <pre className={`p-3 rounded-lg border text-xs whitespace-pre-wrap font-mono ${surface.subPanel}`}>
                          {selectedViews.markdown || selectedDoc.plainText || '(Empty document text)'}
                        </pre>
                      )}

                      {artifactTab === 'index' && (
                        <div className="space-y-3">
                          <div className={`p-3 rounded-lg border space-y-2 ${surface.subPanel}`}>
                            <div className="text-xs font-bold uppercase tracking-wider">
                              Keywords ({selectedViews.index.keywords.length})
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedViews.index.keywords.length > 0 ? (
                                selectedViews.index.keywords.map((kw) => (
                                  <span
                                    key={kw}
                                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                                  >
                                    {kw}
                                  </span>
                                ))
                              ) : (
                                <span className={`text-xs ${surface.mutedText}`}>
                                  No keywords indexed yet.
                                </span>
                              )}
                            </div>
                          </div>

                          <div className={`p-3 rounded-lg border space-y-1.5 ${surface.subPanel}`}>
                            <div className="text-xs font-bold uppercase tracking-wider">
                              Table of Contents ({selectedViews.index.toc.length} sections)
                            </div>
                            {selectedViews.index.toc.map((entry) => (
                              <div
                                key={entry.sectionId}
                                style={{ paddingLeft: `${Math.max(0, entry.level - 1) * 12}px` }}
                                className="text-xs py-0.5 font-mono"
                              >
                                â€¢ {entry.headingPath.join(' â€º ')}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

const ConnectedSOTPanel: React.FC<SOTPanelProps> = (props) => {
  const { character, updateCharacter } = useCharacter();
  return <SOTPanelCore {...props} character={character} onUpdateCharacter={updateCharacter} />;
};

export const SOTPanel: React.FC<SOTPanelProps> = (props) => {
  if (!props.isOpen) return null;
  if (props.character && props.onUpdateCharacter) {
    return (
      <SOTPanelCore
        {...props}
        character={props.character}
        onUpdateCharacter={props.onUpdateCharacter}
      />
    );
  }
  return <ConnectedSOTPanel {...props} />;
};
