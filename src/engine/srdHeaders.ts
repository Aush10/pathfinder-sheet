/** Client-safe header normalizer. Keep in sync with server/ingest/ingest.ts `normalizeHeader`. */
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
