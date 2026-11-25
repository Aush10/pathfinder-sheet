import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  SOTPanel,
  MAX_SOT_FILE_BYTES,
  validateSotPageDraft,
  buildBatchSotPages,
  parseImportErrorMessage,
  isQuotaExceededError,
  extractArtifactViews,
} from './SOTPanel';
import { blankCharacterWithEmptySot } from '../../../../src/storage/characterState';
import type { SrdIngestArtifacts } from '../../../../src/storage/fsAdapter';

// 1. Validation & batch building tests
assert.equal(validateSotPageDraft('', 'hello').ok, false, 'Blank title must be rejected');
assert.equal(validateSotPageDraft('Fighter', '   ').ok, false, 'Blank content must be rejected');

const overLimitText = 'x'.repeat(MAX_SOT_FILE_BYTES + 16);
const overLimitResult = validateSotPageDraft('Huge Doc', overLimitText);
assert.equal(overLimitResult.ok, false, 'Documents > 5 MiB must fail validation');

const batch = buildBatchSotPages([
  { id: '1', title: 'Wizard Progression', category: 'Full Class SRD', rawText: '<table><tr><th>Level</th></tr><tr><td>1st</td></tr></table>' },
  { id: '2', title: 'Arcane School', category: 'Class Ability', rawText: '<p>Select one Arcane School.</p>' },
  { id: '3', title: '   ', category: 'General Rule', rawText: 'Missing title should reject' },
]);
assert.equal(batch.pages.length, 2, 'Two valid batch pages created');
assert.equal(batch.errors.length, 1, 'One invalid batch page error reported');
assert.ok(batch.pages.every((p) => p.isReadOnly && p.isOverride), 'All SOT pages are read-only overrides');

// 2. Import error messaging tests
assert.ok(
  parseImportErrorMessage('bad.json', new Error('This is a full PF1E character sheet export')).includes('character sheet JSON')
);
assert.ok(
  parseImportErrorMessage('raw.json', new Error('Unrecognized JSON structure')).includes('raw JSON')
);
assert.ok(
  parseImportErrorMessage('env.srd.json', new Error('Missing "srdDocument"')).includes('srdDocument')
);
assert.equal(isQuotaExceededError({ name: 'QuotaExceededError' }), true);

// 3. Deterministic 4-output artifact extraction
const sampleArtifacts: SrdIngestArtifacts = {
  'table.json': {
    schemaVersion: 'PF1E_SOT_INGEST_V1',
    documentId: 'doc-1',
    tables: [
      {
        id: 'tbl-1',
        caption: 'Table: Wizard',
        kind: 'class-grid',
        headers: ['Level', 'Base Attack Bonus', 'Special'],
        rows: [['1st', '+0', 'Arcane Bond, Scribe Scroll']],
      },
      {
        id: 'tbl-2',
        caption: 'Spells per Day',
        kind: 'casting-subgrid',
        casting: 'spells-per-day',
        headers: ['Level', '1st', '2nd'],
        rows: [['1st', '1', '—']],
      },
      {
        id: 'tbl-3',
        caption: 'Familiar Bonuses',
        kind: 'lookup-table',
        headers: ['Familiar', 'Benefit'],
        rows: [['Bat', '+3 Fly']],
      },
    ],
  },
  'links.json': {
    schemaVersion: 'PF1E_SOT_INGEST_V1',
    documentId: 'doc-1',
    links: [{ id: 'lnk-1', sectionId: 'sec-1', text: 'Arcane Bond', href: '/rules/bond', external: false }],
  },
  'text.md': '# Wizard\n\nPrimary arcane spellcaster.',
  'index.json': {
    schemaVersion: 'PF1E_SOT_INGEST_V1',
    document: { id: 'doc-1', title: 'Wizard', sha256: 'abc123', sourceType: 'html' },
    sections: [{ id: 'sec-1', headingPath: ['Wizard'], level: 1, text: 'Primary arcane spellcaster.' }],
    toc: [{ sectionId: 'sec-1', headingPath: ['Wizard'], level: 1 }],
    keywords: ['wizard', 'arcane', 'spellcaster'],
    termIndex: {},
  },
};

const views = extractArtifactViews(sampleArtifacts);
assert.equal(views.tables.length, 3);
assert.equal(views.tables[0].kind, 'class-grid');
assert.equal(views.tables[1].casting, 'spells-per-day');
assert.equal(views.tables[2].kind, 'lookup-table');
assert.equal(views.links.length, 1);
assert.ok(views.markdown.includes('# Wizard'));
assert.deepEqual(views.index.keywords, ['wizard', 'arcane', 'spellcaster']);

// 4. SSR render of SOTPanel without AI dependencies
const char = blankCharacterWithEmptySot();
char.name = 'Ezren';
char.sotCatalogue = {
  weblinks: [{ id: 'w1', title: 'PFSRD Wizard', url: 'https://example.com/wizard', category: 'Full Class SRD', isActive: true, createdAt: 1 }],
  overridePages: batch.pages,
  macaroniSuggestions: [],
};
const html = renderToString(
  React.createElement(SOTPanel, {
    isOpen: true,
    onClose: () => {},
    theme: 'blueprint',
    character: char,
    onUpdateCharacter: () => {},
  })
);
assert.ok(html.includes('Source of Truth (SOT) Library'));
assert.ok(html.includes('Wizard Progression'));
assert.ok(html.includes('PFSRD Wizard'));
assert.ok(html.includes('Batch Import'));

// 5. Verify B5 Slayer chips & Stygian placeholder removed from CompleteSheetChatWindow
const chatSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/components/tools/CompleteSheetChatWindow.tsx'),
  'utf8'
);
assert.ok(!chatSrc.includes('Build Slayer from SOT'), 'B5 Slayer chip must be removed');
assert.ok(!chatSrc.includes('Test Missing SOT (Stygian)'), 'B5 Stygian chip must be removed');
assert.ok(!chatSrc.includes('Dual-Wield Feats'), 'B5 Slayer dual-wield chip must be removed');
assert.ok(chatSrc.includes('Queue Page'), 'I5 Batch Queue Page button must exist');

console.log('AG1 SOTPanel & chat verification passed.');
