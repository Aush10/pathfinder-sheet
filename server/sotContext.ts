type SOTOverridePage = {
  title?: string;
  category?: string;
  plainText?: string;
  htmlContent?: string;
};

type SOTWeblink = {
  title?: string;
  category?: string;
  url?: string;
  notes?: string;
  isActive?: boolean;
};

export function activeWeblinks(sotWeblinks: unknown, limit = 15): SOTWeblink[] {
  if (!Array.isArray(sotWeblinks)) return [];
  return sotWeblinks.filter((l: SOTWeblink) => l && l.isActive && l.url).slice(0, limit);
}

export function formatOverridePages(sotOverridePages: unknown): string {
  if (!Array.isArray(sotOverridePages) || sotOverridePages.length === 0) {
    return 'None saved.';
  }
  return sotOverridePages
    .map(
      (p: SOTOverridePage, idx: number) =>
        `[SOT OVERRIDE DOC #${idx + 1} - TITLE: "${p.title}" | CATEGORY: ${p.category}]\n${
          p.plainText || p.htmlContent || ''
        }`,
    )
    .join('\n\n');
}

export function formatCompleteSheetOverridePages(sotOverridePages: unknown): string {
  if (!Array.isArray(sotOverridePages) || sotOverridePages.length === 0) {
    return 'None saved in SOT Catalogue.';
  }
  return sotOverridePages
    .map(
      (p: SOTOverridePage, idx: number) =>
        `[SOT OVERRIDE DOC #${idx + 1} - "${p.title}" | CATEGORY: ${p.category}]\n${
          p.plainText || p.htmlContent || ''
        }`,
    )
    .join('\n\n');
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
