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
import { parseSrdSkillsAndProficiencies } from './aiService';

const HOST_SRD_INDEX_KEY = 'pf1e_host_srd_index_v1';
const HOST_SRD_DOC_PREFIX = 'pf1e_host_srd_doc_';

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

export function saveSrdDocToHostDeviceStorage(doc: SOTRichTextPage): string {
  try {
    const hostKey = `${HOST_SRD_DOC_PREFIX}${doc.id}`;
    const docWithKey: SOTRichTextPage = {
      ...doc,
      isReadOnly: true,
      hostSavedKey: hostKey,
    };
    localStorage.setItem(hostKey, JSON.stringify(docWithKey));

    const existingIndexRaw = localStorage.getItem(HOST_SRD_INDEX_KEY);
    const existingIds: string[] = existingIndexRaw ? JSON.parse(existingIndexRaw) : [];
    if (!existingIds.includes(doc.id)) {
      existingIds.unshift(doc.id);
      localStorage.setItem(HOST_SRD_INDEX_KEY, JSON.stringify(existingIds));
    }
    return hostKey;
  } catch (err) {
    console.warn('Could not save SRD doc to host storage:', err);
    return '';
  }
}

export function loadAllHostDeviceSrdDocs(): SOTRichTextPage[] {
  try {
    const existingIndexRaw = localStorage.getItem(HOST_SRD_INDEX_KEY);
    if (!existingIndexRaw) return [];
    const ids: string[] = JSON.parse(existingIndexRaw);
    const docs: SOTRichTextPage[] = [];
    for (const id of ids) {
      const raw = localStorage.getItem(`${HOST_SRD_DOC_PREFIX}${id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as SOTRichTextPage;
        if (parsed && parsed.id && parsed.title) {
          docs.push({ ...parsed, isReadOnly: true });
        }
      }
    }
    return docs;
  } catch {
    return [];
  }
}

export function removeSrdDocFromHostDeviceStorage(id: string): void {
  try {
    localStorage.removeItem(`${HOST_SRD_DOC_PREFIX}${id}`);
    const existingIndexRaw = localStorage.getItem(HOST_SRD_INDEX_KEY);
    if (existingIndexRaw) {
      const ids: string[] = JSON.parse(existingIndexRaw);
      localStorage.setItem(
        HOST_SRD_INDEX_KEY,
        JSON.stringify(ids.filter((item) => item !== id))
      );
    }
  } catch {
    // ignore storage errors
  }
}

export function exportSrdDocFileToHost(doc: SOTRichTextPage): void {
  const safeSlug = doc.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'srd_document';
  const payload = {
    format: 'PF1E_SOT_READONLY_SRD_V1',
    exportedAt: new Date().toISOString(),
    srdDocument: {
      ...doc,
      isReadOnly: true,
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeSlug}.srd.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  sourceDocTitle: string;
  macaroniSuggestions: SOTMacaroniSuggestion[];
  summaryMessage: string;
}

/**
 * Parses a full class SRD page (copied from a browser page into SOT) and extracts:
 * - Class Name, Hit Die (d6/d8/d10/d12), Skill Ranks per Level
 * - Weapon & Armor Proficiencies
 * - Canonical PF1e Class Skills
 * - 1–20 Class Progression Grid (Level | BAB | Fort | Ref | Will | Special)
 * - Mathematical Macaroni Suggestions for class abilities
 */
export function extractClassFromSrdDoc(
  doc: SOTRichTextPage,
  targetClassNameHint?: string
): ExtractedSrdClassData {
  const text = doc.plainText || doc.htmlContent.replace(/<[^>]+>/g, ' ');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1. Identify Class Name
  let inferredClassName =
    targetClassNameHint?.trim() ||
    doc.title
      .replace(/^(?:srd|pathfinder|pf1e|d20pfsrd|aon|class|full class srd)\s*[:—-]?\s*/i, '')
      .trim();

  const tableClassMatch = text.match(/Table\s*:\s*([A-Z][A-Za-z\s'-]{2,25})/i);
  if (tableClassMatch && (!targetClassNameHint || targetClassNameHint === 'New Class')) {
    inferredClassName = tableClassMatch[1].trim();
  }

  // 2. Parse Skills, Proficiencies, Hit Die, and Skill Ranks via existing SRD recognizer
  const srdParsed = parseSrdSkillsAndProficiencies(text);

  const hitDie = srdParsed.detectedHitDie || 8;
  const skillPointsPerLevel = srdParsed.detectedSkillRanksPerLevel || 4;

  // Extract Weapon and Armor Proficiency paragraph specifically if present
  let proficiencies = srdParsed.cleanedProficiencies;
  const profSectionMatch = text.match(
    /Weapon and Armor Proficiency\s*[:—-]?\s*([\s\S]{20,600}?)(?=\n[A-Z][A-Za-z\s]{2,30}:|\nTable:|$)/i
  );
  if (profSectionMatch) {
    proficiencies = profSectionMatch[1].replace(/\s+/g, ' ').trim();
  }

  // 3. Extract 1–20 Progression Table Rows if pasted in the SRD
  const rows: ClassGridRow[] = [];
  for (const line of lines) {
    const rowMatch = line.match(
      /^(\d{1,2})(?:st|nd|rd|th)?\s+([+-]?\d+(?:\/[+-]?\d+)*)\s+([+-]?\d+)\s+([+-]?\d+)\s+([+-]?\d+)\s+(.+)$/
    );
    if (rowMatch) {
      const level = parseInt(rowMatch[1], 10);
      if (level >= 1 && level <= 20 && !rows.some((r) => r.level === level)) {
        const babStr = rowMatch[2].startsWith('+') ? rowMatch[2] : `+${rowMatch[2]}`;
        const primaryBab = parseInt(rowMatch[2].match(/\d+/)?.[0] || String(level), 10);
        const fort = parseInt(rowMatch[3], 10) || 0;
        const ref = parseInt(rowMatch[4], 10) || 0;
        const will = parseInt(rowMatch[5], 10) || 0;
        // Strip trailing spell-per-day columns (e.g. "1 2 — — —") if present
        const specialClean = rowMatch[6]
          .replace(/(?:\s+(?:\d+|—|-)){2,10}\s*$/, '')
          .trim() || '—';

        rows.push({
          level,
          bab: primaryBab,
          babString: babStr,
          fort,
          ref,
          will,
          special: specialClean,
        });
      }
    }
  }

  // 4. If the pasted SRD had prose ("At 1st level...", "At 2nd level...") instead of a clean tab-delimited table,
  // synthesize the 1-20 progression grid from prose level markers + Hit Die BAB/Save chassis!
  if (rows.length < 5) {
    const levelFeaturesMap: Record<number, string[]> = {};
    const levelProseRegex =
      /(?:At|Beginning at|Starting at)\s+(\d{1,2})(?:st|nd|rd|th)\s+level,\s+([^.\n]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = levelProseRegex.exec(text)) !== null) {
      const lvl = parseInt(m[1], 10);
      if (lvl >= 1 && lvl <= 20) {
        const shortFeat = m[2]
          .replace(/^(?:a|an|the)\s+[a-z]+\s+(?:gains|can|learns|receives)\s+/i, '')
          .slice(0, 60)
          .trim();
        if (!levelFeaturesMap[lvl]) levelFeaturesMap[lvl] = [];
        if (shortFeat && !levelFeaturesMap[lvl].includes(shortFeat)) {
          levelFeaturesMap[lvl].push(shortFeat);
        }
      }
    }

    // Determine BAB rate from Hit Die (d10/d12 -> Full, d8 -> 3/4, d6 -> 1/2)
    const babRate = hitDie >= 10 ? 1 : hitDie === 8 ? 0.75 : 0.5;
    const goodFort = hitDie >= 10 || /fortitude|alchemist|cleric|druid|inquisitor|magus|monk|warpriest/i.test(text);
    const goodRef = /reflex|rogue|bard|ranger|slayer|investigator|alchemist|swashbuckler|gunslinger|monk/i.test(text);
    const goodWill = hitDie === 6 || /will|cleric|druid|bard|inquisitor|investigator|magus|paladin|warpriest|monk/i.test(text);

    rows.length = 0;
    for (let lvl = 1; lvl <= 20; lvl++) {
      const bab = Math.floor(lvl * babRate);
      const iteratives: number[] = [bab];
      let nextIt = bab - 5;
      while (nextIt > 0) {
        iteratives.push(nextIt);
        nextIt -= 5;
      }
      const babString = iteratives.map((b) => `+${b}`).join('/');
      const fort = goodFort ? 2 + Math.floor(lvl / 2) : Math.floor(lvl / 3);
      const ref = goodRef ? 2 + Math.floor(lvl / 2) : Math.floor(lvl / 3);
      const will = goodWill ? 2 + Math.floor(lvl / 2) : Math.floor(lvl / 3);
      const special =
        levelFeaturesMap[lvl] && levelFeaturesMap[lvl].length > 0
          ? levelFeaturesMap[lvl].join(', ')
          : '—';

      rows.push({
        level: lvl,
        bab,
        babString,
        fort,
        ref,
        will,
        special,
      });
    }
  }

  rows.sort((a, b) => a.level - b.level);
  const rawGridText = rows
    .map((r) => `${r.level}\t${r.babString || `+${r.bab}`}\t+${r.fort}\t+${r.ref}\t+${r.will}\t${r.special}`)
    .join('\n');

  const macaroniSuggestions = extractMacaroniSuggestionsFromSrd(doc.id, doc.title, text);

  return {
    matched: rows.length > 0 || srdParsed.cleanedSkillsList.length > 0,
    className: inferredClassName || 'SRD Class',
    hitDie,
    skillPointsPerLevel,
    proficiencies: proficiencies || 'Simple weapons, light armor.',
    classSkillsText: srdParsed.cleanedSkillsText,
    cleanedSkillsList: srdParsed.cleanedSkillsList,
    rawGridText,
    rows,
    sourceDocTitle: doc.title,
    macaroniSuggestions,
    summaryMessage: `Populated "${inferredClassName}" from SOT SRD "${doc.title}" (d${hitDie} HD, ${skillPointsPerLevel}+INT SP, ${srdParsed.cleanedSkillsList.length} class skills, ${rows.length} progression levels, and ${macaroniSuggestions.length} Macaroni math suggestions sent to DSL Studio).`,
  };
}
