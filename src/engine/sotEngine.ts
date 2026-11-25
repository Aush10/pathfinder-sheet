/**
 * Source of Truth (SOT) Security, Read-Only Quarantine, Host-Device SRD Storage,
 * Full-Page Class Extractor & Mathematical Macaroni Suggestion Engine
 */

import {
  SOTRichTextPage,
  SOTWeblinkItem,
  SOTIncidentalLink,
  SOTSecurityAudit,
  SOTMacaroniSuggestion,
  SOTCategory,
  ClassGridRow,
  MacaroniCategory,
} from '../types/character';
import type { IngestOutputs, IngestTable } from '../../server/ingest/ingest';
import type { SrdIngestArtifacts } from '../storage/fsAdapter';
import {
  extractClassFromClassifiedTables,
  type ClassColumn,
  type ExtractedClass,
} from './classExtraction';

/** Legacy unscoped keys. AF2 migrates these once; AF1 no longer reads them as authority. */
export const LEGACY_GLOBAL_HOST_SRD_INDEX_KEY = 'pf1e_host_srd_index_v1';
export const LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX = 'pf1e_host_srd_doc_';
const HOST_SRD_DOC_PREFIX = LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX;
const HOST_SRD_OWNER_SESSION_KEY = 'pf1e_host_srd_active_owner_v1';

export const EMPTY_SOT_CATALOGUE = {
  weblinks: [] as SOTWeblinkItem[],
  overridePages: [] as SOTRichTextPage[],
  macaroniSuggestions: [] as SOTMacaroniSuggestion[],
};

let activeHostSrdOwner: string | null = null;

function emitHostSrdError(message: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pf1e:storage-error', { detail: { error: message } }));
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function ownerKeyPart(characterId: string): string {
  return characterId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

function indexKeyFor(characterId: string): string {
  return `pf1e_host_srd_index_${ownerKeyPart(characterId)}_v1`;
}

function docKeyFor(characterId: string, docId: string): string {
  return `${HOST_SRD_DOC_PREFIX}${ownerKeyPart(characterId)}_${docId}`;
}

export function setActiveHostSrdOwner(characterId: string | null): void {
  activeHostSrdOwner = characterId && characterId.trim() ? characterId.trim() : null;
  if (!hasLocalStorage()) return;
  try {
    if (activeHostSrdOwner) localStorage.setItem(HOST_SRD_OWNER_SESSION_KEY, activeHostSrdOwner);
    else localStorage.removeItem(HOST_SRD_OWNER_SESSION_KEY);
  } catch (error) {
    const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
    emitHostSrdError(
      quota
        ? 'Browser session storage is full. The AIgamesheet folder is still the durable copy. Free origin storage and try again.'
        : 'Could not remember the active character for host SRD storage.',
    );
  }
}

export function getActiveHostSrdOwner(): string | null {
  if (activeHostSrdOwner) return activeHostSrdOwner;
  if (!hasLocalStorage()) return null;
  try {
    const stored = localStorage.getItem(HOST_SRD_OWNER_SESSION_KEY);
    activeHostSrdOwner = stored && stored.trim() ? stored.trim() : null;
    return activeHostSrdOwner;
  } catch {
    return null;
  }
}

function parseHostSrdDoc(raw: string | null): SOTRichTextPage | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SOTRichTextPage;
    if (parsed && parsed.id && parsed.title) return { ...parsed, isReadOnly: true };
  } catch {
    return null;
  }
  return null;
}

function readIdIndex(indexKey: string): string[] {
  if (!hasLocalStorage()) return [];
  const existingIndexRaw = localStorage.getItem(indexKey);
  if (!existingIndexRaw) return [];
  try {
    const ids = JSON.parse(existingIndexRaw);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

// ============================================================================
// 1. SOT SECURITY SANITIZER & READ-ONLY QUARANTINE
// ============================================================================

const WEBHOOK_PATTERNS = [
  /https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/[^\s"'<>]+/gi,
  /https?:\/\/hooks\.slack\.com\/services\/[^\s"'<>]+/gi,
  /https?:\/\/[^\s"'<>]*webhook[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]*(?:pipedream\.net|ngrok\.io|ngrok-free\.app|requestbin|beeceptor)[^\s"'<>]*/gi,
];

const DANGEROUS_CODE_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^>]*>/gi,
  /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
  /\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /data\s*:\s*text\/html/gi,
];

const CODE_SNIPPET_PATTERNS = [
  /```[\s\S]*?```/g,
  /<pre\b[^<]*(?:(?!<\/pre>)<[^<]*)*<\/pre>/gi,
  /<code\b[^<]*(?:(?!<\/code>)<[^<]*)*<\/code>/gi,
  /\b(?:fetch|XMLHttpRequest|eval|Function|setTimeout|setInterval|navigator\.sendBeacon)\s*\(/g,
];

export interface SanitizedSrdResult {
  sanitizedHtml: string;
  sanitizedPlainText: string;
  incidentalLinks: SOTIncidentalLink[];
  securityAudit: SOTSecurityAudit;
}

/**
 * Sanitizes raw HTML / pasted browser page text into a strictly READ-ONLY SRD document.
 * - Neutralizes all scripts, iframes, event handlers, webhooks, and executable code snippets.
 * - Extracts embedded links into `incidentalLinks` (inert in the document; user can promote to SOT Links).
 */
export function sanitizeSrdDocument(
  rawHtmlOrText: string,
  fallbackPlainText?: string
): SanitizedSrdResult {
  let workingHtml = rawHtmlOrText || fallbackPlainText || '';
  let strippedScriptsCount = 0;
  let strippedWebhooksCount = 0;
  let strippedCodeSnipsCount = 0;

  const incidentalLinksMap = new Map<string, SOTIncidentalLink>();

  // 1. Detect and strip webhooks first
  WEBHOOK_PATTERNS.forEach((regex) => {
    const matches = workingHtml.match(regex);
    if (matches) {
      strippedWebhooksCount += matches.length;
      matches.forEach((m) => {
        incidentalLinksMap.set(m, {
          url: m,
          label: 'Blocked Webhook / Callback URL',
          isWebhookOrSuspicious: true,
        });
      });
      workingHtml = workingHtml.replace(regex, '[WEBHOOK STRIPPED BY SOT READ-ONLY GUARD]');
    }
  });

  // 2. Detect and strip dangerous scripts / iframes / event handlers
  DANGEROUS_CODE_PATTERNS.forEach((regex) => {
    const matches = workingHtml.match(regex);
    if (matches) {
      strippedScriptsCount += matches.length;
      workingHtml = workingHtml.replace(regex, '');
    }
  });

  // 3. Detect and neutralize code snippets
  CODE_SNIPPET_PATTERNS.forEach((regex) => {
    const matches = workingHtml.match(regex);
    if (matches) {
      strippedCodeSnipsCount += matches.length;
      workingHtml = workingHtml.replace(regex, (match) => {
        const inner = match
          .replace(/^```[a-z]*\n?/i, '')
          .replace(/```$/, '')
          .replace(/<\/?(?:pre|code)[^>]*>/gi, '')
          .replace(/[<>]/g, '');
        return `[Read-Only Code Note: ${inner.slice(0, 120)}]`;
      });
    }
  });

  // 4. Extract <a href="...">Label</a> links and convert them to inert read-only spans
  workingHtml = workingHtml.replace(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
    (_full, href1, href2, href3, innerHtml) => {
      const rawUrl = (href1 || href2 || href3 || '').trim();
      const cleanLabel = innerHtml.replace(/<[^>]+>/g, '').trim() || rawUrl;

      if (/^https?:\/\//i.test(rawUrl)) {
        const isSuspicious = /webhook|discord\.com\/api|slack\.com|javascript:/i.test(rawUrl);
        if (!incidentalLinksMap.has(rawUrl)) {
          incidentalLinksMap.set(rawUrl, {
            url: rawUrl,
            label: cleanLabel.slice(0, 80),
            isWebhookOrSuspicious: isSuspicious,
          });
        }
      }
      return `<span class="underline decoration-dotted opacity-85" title="Incidental SRD link (Read-Only): ${rawUrl}">${cleanLabel}</span>`;
    }
  );

  // 5. Also scan plain text for raw https:// URLs
  const rawUrlMatches = workingHtml.match(/https?:\/\/[^\s"'<>)\]]+/gi) || [];
  rawUrlMatches.forEach((url) => {
    const cleanUrl = url.replace(/[.,;:]+$/, '');
    if (!incidentalLinksMap.has(cleanUrl)) {
      const isSuspicious = /webhook|discord\.com\/api|slack\.com/i.test(cleanUrl);
      incidentalLinksMap.set(cleanUrl, {
        url: cleanUrl,
        label: cleanUrl.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 60),
        isWebhookOrSuspicious: isSuspicious,
      });
    }
  });

  // 6. Produce clean plainText
  const rawPlain = (fallbackPlainText || workingHtml)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>|<\/th>/gi, '\t')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  const incidentalLinks = Array.from(incidentalLinksMap.values());

  const securityAudit: SOTSecurityAudit = {
    isReadOnly: true,
    strippedScriptsCount,
    strippedWebhooksCount,
    strippedCodeSnipsCount,
    incidentalLinksCount: incidentalLinks.length,
    sanitizedAt: Date.now(),
  };

  return {
    sanitizedHtml: workingHtml,
    sanitizedPlainText: rawPlain,
    incidentalLinks,
    securityAudit,
  };
}

// ============================================================================
// 2. HOST-DEVICE SEPARATE STORAGE FOR MULTIPLE SRD DOCS
// ============================================================================

export function saveSrdDocForCharacter(characterId: string, doc: SOTRichTextPage): string {
  if (!characterId.trim()) return '';
  if (!hasLocalStorage()) return '';
  try {
    const hostKey = docKeyFor(characterId, doc.id);
    const docWithKey: SOTRichTextPage = {
      ...doc,
      isReadOnly: true,
      hostSavedKey: hostKey,
    };
    localStorage.setItem(hostKey, JSON.stringify(docWithKey));
    const existingIds = readIdIndex(indexKeyFor(characterId));
    if (!existingIds.includes(doc.id)) {
      existingIds.unshift(doc.id);
      localStorage.setItem(indexKeyFor(characterId), JSON.stringify(existingIds));
    }
    return hostKey;
  } catch (error) {
    const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
    emitHostSrdError(
      quota
        ? 'Browser session storage is full. SRD text was not cached in origin storage. Use the connected AIgamesheet folder as the durable copy.'
        : 'Could not save this SRD to host storage.',
    );
    return '';
  }
}

/** Per-character host-SRD loader for AG3 and Add Class. Never mixes another character's docs. */
export function loadHostSrdDocsForCharacter(characterId: string): SOTRichTextPage[] {
  if (!characterId.trim() || !hasLocalStorage()) return [];
  try {
    const docs: SOTRichTextPage[] = [];
    for (const id of readIdIndex(indexKeyFor(characterId))) {
      const parsed = parseHostSrdDoc(localStorage.getItem(docKeyFor(characterId, id)));
      if (parsed) docs.push(parsed);
    }
    return docs;
  } catch {
    return [];
  }
}

export function loadHostSrdDocForCharacter(characterId: string, docId: string): SOTRichTextPage | null {
  if (!characterId.trim() || !docId.trim() || !hasLocalStorage()) return null;
  try {
    return parseHostSrdDoc(localStorage.getItem(docKeyFor(characterId, docId)));
  } catch {
    return null;
  }
}

export function saveSrdDocToHostDeviceStorage(doc: SOTRichTextPage): string {
  const owner = getActiveHostSrdOwner();
  if (!owner) {
    emitHostSrdError('No active character is selected for host SRD storage. Save or load a sheet first.');
    return '';
  }
  return saveSrdDocForCharacter(owner, doc);
}

export function loadAllHostDeviceSrdDocs(): SOTRichTextPage[] {
  const owner = getActiveHostSrdOwner();
  if (!owner) return [];
  return loadHostSrdDocsForCharacter(owner);
}

export function removeSrdDocFromHostDeviceStorage(id: string): void {
  const owner = getActiveHostSrdOwner();
  if (!owner || !hasLocalStorage()) return;
  try {
    localStorage.removeItem(docKeyFor(owner, id));
    localStorage.setItem(
      indexKeyFor(owner),
      JSON.stringify(readIdIndex(indexKeyFor(owner)).filter((item) => item !== id)),
    );
  } catch {
    emitHostSrdError('Could not remove this SRD from host storage.');
  }
}

export function referenceSrdPagesForStorage<T extends { sotCatalogue?: { weblinks: SOTWeblinkItem[]; overridePages: SOTRichTextPage[]; macaroniSuggestions?: SOTMacaroniSuggestion[] } }>(
  character: T,
  characterId: string,
): T {
  const pages = character.sotCatalogue?.overridePages;
  if (!pages?.length || !hasLocalStorage()) return character;
  const nextPages = pages.map((page) => {
    const hasBody = Boolean(page.htmlContent || page.plainText);
    if (!hasBody) return page;
    const hostKey = saveSrdDocForCharacter(characterId, page);
    if (!hostKey) return page;
    return { ...page, htmlContent: '', plainText: '', hostSavedKey: hostKey };
  });
  return {
    ...character,
    sotCatalogue: {
      weblinks: character.sotCatalogue?.weblinks ?? [],
      overridePages: nextPages,
      macaroniSuggestions: character.sotCatalogue?.macaroniSuggestions ?? [],
    },
  };
}

export function rehydrateSrdPagesFromHost<T extends { sotCatalogue?: { weblinks: SOTWeblinkItem[]; overridePages: SOTRichTextPage[]; macaroniSuggestions?: SOTMacaroniSuggestion[] } }>(
  character: T,
  characterId: string,
): T {
  const pages = character.sotCatalogue?.overridePages;
  if (!pages?.length || !characterId) return character;
  const hosted = new Map(loadHostSrdDocsForCharacter(characterId).map((doc) => [doc.id, doc]));
  const nextPages = pages.map((page) => {
    const full = hosted.get(page.id);
    if (!full) return page;
    return {
      ...page,
      htmlContent: full.htmlContent || page.htmlContent,
      plainText: full.plainText || page.plainText,
      hostSavedKey: full.hostSavedKey || page.hostSavedKey,
    };
  });
  return {
    ...character,
    sotCatalogue: {
      weblinks: character.sotCatalogue?.weblinks ?? [],
      overridePages: nextPages,
      macaroniSuggestions: character.sotCatalogue?.macaroniSuggestions ?? [],
    },
  };
}

function downloadSrdDocBlob(fileName: string, contents: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportSrdDocFileToHost(doc: SOTRichTextPage): Promise<'folder' | 'download'> {
  const safeSlug = doc.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'srd_document';
  const fileName = `${safeSlug}.srd.json`;
  const contents = JSON.stringify({
    format: 'PF1E_SOT_READONLY_SRD_V1',
    exportedAt: new Date().toISOString(),
    srdDocument: {
      ...doc,
      isReadOnly: true,
    },
  }, null, 2);
  try {
    const { writeOrDownloadExport } = await import('../utils/sheetExporters');
    return await writeOrDownloadExport(fileName, contents, 'application/json;charset=utf-8');
  } catch {
    downloadSrdDocBlob(fileName, contents);
    return 'download';
  }
}

export function parseImportedSrdFile(fileName: string, rawContent: string): SOTRichTextPage {
  // Check if it's a JSON SRD file first
  try {
    const parsed = JSON.parse(rawContent);
    const docCandidate = parsed.srdDocument || parsed;
    if (docCandidate && docCandidate.title && (docCandidate.plainText || docCandidate.htmlContent)) {
      const sanitized = sanitizeSrdDocument(
        docCandidate.htmlContent || docCandidate.plainText,
        docCandidate.plainText
      );
      return {
        id: docCandidate.id || `srd-host-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: docCandidate.title,
        category: (docCandidate.category as SOTCategory) || 'Full Class SRD',
        htmlContent: sanitized.sanitizedHtml,
        plainText: sanitized.sanitizedPlainText,
        isOverride: docCandidate.isOverride ?? true,
        isReadOnly: true,
        tags: Array.isArray(docCandidate.tags) ? docCandidate.tags : ['Imported SRD'],
        updatedAt: Date.now(),
        incidentalLinks: sanitized.incidentalLinks,
        securityAudit: sanitized.securityAudit,
      };
    }
  } catch {
    // Not JSON; treat as raw HTML / Markdown / Text browser page dump
  }

  const cleanTitle = fileName
    .replace(/\.(srd\.json|json|html|htm|txt|md)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const sanitized = sanitizeSrdDocument(rawContent);
  const isLikelyClassPage =
    /hit die|skill ranks per level|class skills|weapon and armor proficiency|table:\s*\w+/i.test(
      sanitized.sanitizedPlainText
    );

  return {
    id: `srd-host-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: cleanTitle || 'Imported SRD Document',
    category: isLikelyClassPage ? 'Full Class SRD' : 'General Rule',
    htmlContent: `<div class="whitespace-pre-wrap">${sanitized.sanitizedPlainText}</div>`,
    plainText: sanitized.sanitizedPlainText,
    isOverride: true,
    isReadOnly: true,
    tags: isLikelyClassPage ? ['Full Class SRD', 'Host File'] : ['Host File'],
    updatedAt: Date.now(),
    incidentalLinks: sanitized.incidentalLinks,
    securityAudit: sanitized.securityAudit,
  };
}

// ============================================================================
// 3. MATHEMATICAL BREAKDOWN -> MACARONI SUGGESTIONS EXTRACTOR
// ============================================================================

/**
 * Scans an SRD document's plain text for abilities that describe a mathematical
 * breakdown of their calculation and synthesizes Macaroni DSL suggestions for DSL Studio.
 */
export function extractMacaroniSuggestionsFromSrd(
  docId: string | undefined,
  docTitle: string,
  plainText: string
): SOTMacaroniSuggestion[] {
  const suggestions: SOTMacaroniSuggestion[] = [];
  const sentences = plainText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15);

  const seenFormulas = new Set<string>();

  const pushSuggestion = (
    abilityName: string,
    mathBreakdownText: string,
    suggestedFormula: string,
    category: MacaroniCategory,
    explanation: string
  ) => {
    const key = `${abilityName.toLowerCase()}::${suggestedFormula}`;
    if (seenFormulas.has(key)) return;
    seenFormulas.add(key);

    suggestions.push({
      id: `mac-sugg-${Date.now()}-${suggestions.length + 1}`,
      sourceDocId: docId,
      sourceDocTitle: docTitle,
      abilityName,
      mathBreakdownText: mathBreakdownText.slice(0, 240),
      suggestedFormula,
      category,
      explanation,
      createdAt: Date.now(),
    });
  };

  for (const line of sentences) {
    const lower = line.toLowerCase();

    // Try to infer ability name from leading "Ability Name (Ex/Su/Sp):" or title
    const headerMatch = line.match(/^([A-Z][A-Za-z0-9\s'-]{2,32}?)(?:\s*\((?:Ex|Su|Sp)\))?\s*[:—-]\s*(.+)/);
    const abilityTitle = headerMatch ? headerMatch[1].trim() : docTitle;

    // Pattern 1: XdY per caster level / class level (with optional maximum)
    const perLevelDiceMatch = lower.match(
      /(\d+d\d+)\s+(?:points?\s+of\s+)?([a-z]+\s+)?damage\s+per\s+(?:caster\s+|class\s+)?level(?:\s*\(maximum\s+(\d+)d\d+\))?/i
    );
    if (perLevelDiceMatch) {
      const dieSize = perLevelDiceMatch[1].split('d')[1] || '6';
      const dmgType = (perLevelDiceMatch[2] || '').trim() || 'damage';
      const maxDice = perLevelDiceMatch[3] ? parseInt(perLevelDiceMatch[3], 10) : 10;
      pushSuggestion(
        abilityTitle,
        line,
        `[min(${maxDice}, #CL)d${dieSize}] "${dmgType}"`,
        'action',
        `Scales 1d${dieSize} per caster level (#CL), capped at ${maxDice}d${dieSize}.`
      );
    }

    // Pattern 2: XdY for every two levels / per 2 levels (Sneak Attack, Lay on Hands, Channel, Bombs)
    const everyTwoLevelsDice = lower.match(
      /(\d+d\d+)\s+(?:points?\s+of\s+)?(?:([a-z]+)\s+)?(?:damage|healing|hit points).*?(?:every\s+two|per\s+two|per\s+2)\s+(?:[a-z]+\s+)?levels?/i
    );
    if (everyTwoLevelsDice) {
      const dieStr = everyTwoLevelsDice[1];
      const dieSides = dieStr.split('d')[1] || '6';
      const label = (everyTwoLevelsDice[2] || 'scaling').trim();
      pushSuggestion(
        abilityTitle,
        line,
        `[ceil(#LEVEL / 2)d${dieSides}] "${abilityTitle} (${label})"`,
        'action',
        `Rolls 1d${dieSides} for every 2 character/class levels using ceil(#LEVEL / 2).`
      );
    }

    // Pattern 3: Save DC = 10 + 1/2 level + Ability modifier
    const dcMatch = lower.match(
      /dc\s+(?:is\s+)?(?:equal\s+to\s+)?10\s*\+\s*(?:1\/2|half)\s+.*?\blevel\b.*?\+\s*.*?\b(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\b/i
    );
    if (dcMatch) {
      const abil = dcMatch[1].toUpperCase().slice(0, 3);
      pushSuggestion(
        `${abilityTitle} Save DC`,
        line,
        `"${abilityTitle} DC" [10 + floor(#LEVEL / 2) + #${abil}]`,
        'logic',
        `Calculates standard Pathfinder 1e scaling Save DC: 10 + 1/2 level + #${abil}.`
      );
    }

    // Pattern 4: Daily Uses / Resource Pool = X + Ability Modifier or 1/2 level + Ability Modifier
    const poolHalfLvlMatch = lower.match(
      /(?:times\s+per\s+day|rounds\s+per\s+day|points\s+equal\s+to)\s+(?:equal\s+to\s+)?(?:1\/2|half)\s+.*?\blevel\b.*?\+\s*.*?\b(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\b/i
    );
    if (poolHalfLvlMatch) {
      const abil = poolHalfLvlMatch[1].toUpperCase().slice(0, 3);
      pushSuggestion(
        `${abilityTitle} Daily Pool`,
        line,
        `[max(1, floor(#LEVEL / 2) + #${abil})] "${abilityTitle} Uses/Day"`,
        'logic',
        `Calculates daily resource pool cap: 1/2 level + #${abil} modifier.`
      );
    }

    const poolFlatAbilMatch = lower.match(
      /(?:times\s+per\s+day|rounds\s+per\s+day)\s+equal\s+to\s+(\d+)\s*\+\s*.*?\b(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\b/i
    );
    if (poolFlatAbilMatch) {
      const baseNum = parseInt(poolFlatAbilMatch[1], 10);
      const abil = poolFlatAbilMatch[2].toUpperCase().slice(0, 3);
      pushSuggestion(
        `${abilityTitle} Daily Pool`,
        line,
        `[${baseNum} + #${abil}] "${abilityTitle} Uses/Day"`,
        'logic',
        `Calculates daily uses/rounds: ${baseNum} + #${abil} modifier.`
      );
    }

    // Pattern 5: Scaling Bonus (+1 at Xth level, increasing by +1 for every N levels)
    const scalingBonusMatch = lower.match(
      /\+(\d+)\s+(?:(morale|competence|dodge|deflection|insight|luck|sacred|profane|enhancement|natural\s+armor)\s+)?bonus\s+on\s+([a-z\s]+?)\s*(?:rolls|checks|ac|armor class|saves)?.*?(?:every\s+(?:four|4|three|3|five|5|six|6)\s+levels)/i
    );
    if (scalingBonusMatch) {
      const baseBonus = parseInt(scalingBonusMatch[1], 10) || 1;
      const bonusTypeRaw = (scalingBonusMatch[2] || 'Untyped').trim();
      const stepDiv = lower.includes('three') || lower.includes(' 3 ')
        ? 3
        : lower.includes('five') || lower.includes(' 5 ')
        ? 5
        : lower.includes('six') || lower.includes(' 6 ')
        ? 6
        : 4;
      pushSuggestion(
        `${abilityTitle} Scaling Bonus`,
        line,
        `[${baseBonus} + floor(#LEVEL / ${stepDiv})] "${abilityTitle} (${bonusTypeRaw})"`,
        'logic',
        `Starts at +${baseBonus} and increases by +1 every ${stepDiv} levels.`
      );
    }

    // Pattern 6: Trade -1 attack per 4 BAB for +2 damage (Power Attack / Deadly Aim style)
    if (
      (lower.includes('penalty') && lower.includes('attack rolls') && lower.includes('bonus') && lower.includes('damage')) ||
      (lower.includes('base attack bonus reaches +4') && lower.includes('every 4'))
    ) {
      pushSuggestion(
        abilityTitle,
        line,
        `[1d20 + #BAB + #STR - (1 + floor(#BAB / 4))] "${abilityTitle} Hit" & [1d8 + #STR + ((1 + floor(#BAB / 4)) * 2)] "${abilityTitle} Damage"`,
        'action',
        `Scales attack penalty -(1 + floor(#BAB / 4)) and damage bonus +((1 + floor(#BAB / 4)) * 2).`
      );
    }

    // Pattern 7: Explicit Typed Buff to AC / Attack / Saves (e.g., "+1 dodge bonus to AC", "+4 armor bonus to AC")
    const typedAcMatch = lower.match(
      /\+(\d+)\s+(dodge|armor|shield|deflection|natural\s+armor|enhancement|insight|sacred|luck|morale)\s+bonus\s+to\s+(?:your\s+|its\s+)?(?:ac|armor\s+class)/i
    );
    if (typedAcMatch) {
      const amt = parseInt(typedAcMatch[1], 10);
      const bTypeRaw = typedAcMatch[2].toLowerCase();
      const cleanType =
        bTypeRaw.includes('natural')
          ? 'NAT armor'
          : bTypeRaw.charAt(0).toUpperCase() + bTypeRaw.slice(1);
      const cleanId = abilityTitle.replace(/[^A-Za-z0-9]/g, '') || 'SrdBuff';
      pushSuggestion(
        `${abilityTitle} (Buff Box)`,
        line,
        `${cleanId}:|<^AC.${cleanType}+${amt}>|$`,
        'action',
        `Applies +${amt} ${cleanType} bonus to AC in the Buff Box and locks with $.`
      );
    }
  }

  return suggestions;
}

// ============================================================================
// 4. FULL-PAGE CLASS SRD PARSER FOR "ADD CLASS" STUDIO
// ============================================================================

export interface ExtractedSrdClassData {
  matched: boolean;
  className: string;
  hitDie: number;
  skillPointsPerLevel: number;
  proficiencies: string;
  classSkillsText: string;
  cleanedSkillsList: string[];
  rawGridText: string;
  rows: ClassGridRow[];
  columns: ClassColumn[];
  matrixRows: Array<{ level: number; values: Record<string, string> }>;
  sourceDocTitle: string;
  macaroniSuggestions: SOTMacaroniSuggestion[];
  summaryMessage: string;
}

function signedInt(value: string): number {
  const match = /([+-]?\d+)/.exec(value.replace(/,/g, ''));
  return match ? Number(match[1]) : 0;
}

function extractedColumnValue(extracted: ExtractedClass, row: ExtractedClass['rows'][number], normalized: string): string {
  const column = extracted.columns.find((item) => item.id === normalized || item.id.startsWith(`${normalized}_`));
  return column ? row.values[column.id] || '' : '';
}

function toLegacyClassGridRows(extracted: ExtractedClass): ClassGridRow[] {
  return extracted.rows.map((row) => {
    const babRaw = extractedColumnValue(extracted, row, 'bab');
    const bab = signedInt(babRaw);
    return {
      level: row.level,
      bab,
      babString: babRaw.trim() || `+${bab}`,
      fort: signedInt(extractedColumnValue(extracted, row, 'fort')),
      ref: signedInt(extractedColumnValue(extracted, row, 'ref')),
      will: signedInt(extractedColumnValue(extracted, row, 'will')),
      special: extractedColumnValue(extracted, row, 'special') || '—',
    };
  });
}

export async function ingestClassifiedTablesFromSrdDoc(doc: SOTRichTextPage): Promise<{
  tables: IngestTable[];
  documentId?: string;
  text: string;
}> {
  const fallbackText = doc.plainText || doc.htmlContent.replace(/<[^>]+>/g, ' ');
  const fallback = { tables: [] as IngestTable[], text: fallbackText };
  const content = doc.htmlContent || doc.plainText || '';
  if (!content.trim() || typeof fetch !== 'function') return fallback;
  try {
    const response = await fetch('/api/sot/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: doc.title || 'srd-document', content }),
    });
    const payload = await response.json() as {
      documentId?: unknown;
      artifacts?: { 'table.json'?: { tables?: IngestTable[] }; 'text.md'?: unknown };
    };
    if (!response.ok) return fallback;
    const tables = payload.artifacts?.['table.json']?.tables ?? [];
    const text = typeof payload.artifacts?.['text.md'] === 'string' ? payload.artifacts['text.md'] : fallbackText;
    const documentId = typeof payload.documentId === 'string' ? payload.documentId : undefined;
    return { tables, documentId, text };
  } catch {
    return fallback;
  }
}

/**
 * Extracts a class from CX2-classified tables only.
 * Missing tables or a missing class-grid returns unmatched rows; it never
 * synthesizes a 1–20 prose grid or falls back to lookup tables.
 */
export function extractClassFromSrdDoc(
  doc: SOTRichTextPage,
  targetClassNameHint?: string,
  tables: IngestTable[] = [],
  plainTextOverride?: string,
): ExtractedSrdClassData {
  const text = plainTextOverride || doc.plainText || doc.htmlContent.replace(/<[^>]+>/g, ' ');
  const extracted = extractClassFromClassifiedTables({
    title: doc.title,
    plainText: text,
    tables,
    classNameHint: targetClassNameHint,
  });
  const rows = toLegacyClassGridRows(extracted);
  const rawGridText = rows
    .map((r) => `${r.level}\t${r.babString || `+${r.bab}`}\t+${r.fort}\t+${r.ref}\t+${r.will}\t${r.special}`)
    .join('\n');
  const macaroniSuggestions = extractMacaroniSuggestionsFromSrd(doc.id, doc.title, text);
  return {
    matched: extracted.matched,
    className: extracted.className,
    hitDie: extracted.hitDie,
    skillPointsPerLevel: extracted.skillPointsPerLevel,
    proficiencies: extracted.proficiencies,
    classSkillsText: extracted.classSkillsText,
    cleanedSkillsList: extracted.cleanedSkillsList,
    rawGridText,
    rows,
    columns: extracted.columns,
    matrixRows: extracted.rows.map((row) => ({ level: row.level, values: { ...row.values } })),
    sourceDocTitle: doc.title,
    macaroniSuggestions,
    summaryMessage: extracted.matched
      ? `${extracted.summaryMessage} ${macaroniSuggestions.length} Macaroni math suggestion(s) sent to DSL Studio.`
      : extracted.summaryMessage,
  };
}

export async function extractClassFromSrdDocWithIngest(
  doc: SOTRichTextPage,
  targetClassNameHint?: string,
  savedArtifacts?: SrdIngestArtifacts,
): Promise<ExtractedSrdClassData & { tables: IngestTable[]; documentId?: string }> {
  const savedTable = savedArtifacts?.['table.json'] as Partial<IngestOutputs['table.json']> | undefined;
  const savedIndex = savedArtifacts?.['index.json'] as Partial<IngestOutputs['index.json']> | undefined;
  const savedTables = savedTable?.tables;
  const tableDocumentId = typeof savedTable?.documentId === 'string' ? savedTable.documentId : undefined;
  const indexDocumentId = typeof savedIndex?.document?.id === 'string' ? savedIndex.document.id : undefined;
  const matchesIndex = !tableDocumentId || !indexDocumentId || tableDocumentId === indexDocumentId;
  const hasSavedTables = Array.isArray(savedTables) && savedTables.length > 0 && savedTables.every(
    (table) => table && typeof table.id === 'string'
      && ['class-grid', 'extended-grid', 'casting-subgrid', 'lookup-table'].includes(table.kind)
      && Array.isArray(table.headers) && table.headers.every((header) => typeof header === 'string')
      && table.headerMap && typeof table.headerMap === 'object' && !Array.isArray(table.headerMap)
      && Object.values(table.headerMap).every((value) => typeof value === 'string')
      && Array.isArray(table.rows) && table.rows.every(
        (row) => Array.isArray(row) && row.every((value) => typeof value === 'string'),
      ),
  );
  const ingested = savedArtifacts && matchesIndex && hasSavedTables
    ? {
        tables: savedTables,
        documentId: tableDocumentId || indexDocumentId,
        text: savedArtifacts['text.md'],
      }
    : await ingestClassifiedTablesFromSrdDoc(doc);
  const extracted = extractClassFromSrdDoc(doc, targetClassNameHint, ingested.tables, ingested.text);
  return { ...extracted, tables: ingested.tables, documentId: ingested.documentId };
}
