import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  blankCharacterWithEmptySot,
  persistCollectedSpellTables,
  SPELL_BOOK_JOURNAL_TITLE,
  SPELL_BOOK_PAGE_COUNT,
  SPELL_BOOK_TAG,
  SPELL_KNOWN_REMAINING_TAB_ID,
  spellSlotActionId,
  spellSlotResourceId,
  spellSlotStepperScopeId,
} from '../../storage/characterState';
import { computeDerivedCharacterStats } from '../../engine/pf1eMath';
import {
  evaluateCounterDisplayValue,
  stepResourceBarValue,
} from '../../engine/actionDirectory';
import {
  ActionDirectoryModule,
  executeCounterRunStepperOnCharacter,
  executeSpellCastOnCharacter,
} from './ActionDirectoryModule';
import {
  JournalModal,
  extractLookupTablesFromArtifacts,
  resolveJournalModalTitle,
} from '../tools/JournalModal';
import type { CharacterActionItem } from '../../types/character';
import type { SrdIngestArtifacts } from '../../storage/fsAdapter';

test('Spell Cast popup, Run Stepper persistence, Spell Book pages, and lookup-table reference UI work', () => {
  const base = blankCharacterWithEmptySot();
  base.name = 'Merisiel';
  base.level = 3;
  base.spellSlots = [
    { level: 1, saveDC: 15, spellsPerDay: 3, bonusSpells: 0, spellsKnown: 3, usedSlots: 0 },
    { level: 2, saveDC: 16, spellsPerDay: 2, bonusSpells: 0, spellsKnown: 1, usedSlots: 0 },
  ];

  const casterChar = persistCollectedSpellTables(base, {
    spellsPerDay: {
      kind: 'spells-per-day',
      columns: ['spd_0', 'spd_1', 'spd_2'],
      rows: [
        { level: 1, values: { spd_0: '3', spd_1: '2', spd_2: '—' } },
        { level: 2, values: { spd_0: '4', spd_1: '3', spd_2: '—' } },
        { level: 3, values: { spd_0: '4', spd_1: '3', spd_2: '2' } },
      ],
    },
    spellsKnown: {
      kind: 'spells-known',
      columns: ['sk_0', 'sk_1', 'sk_2'],
      rows: [
        { level: 3, values: { sk_0: '5', sk_1: '3', sk_2: '1' } },
      ],
    },
  });

  assert.equal(resolveJournalModalTitle(blankCharacterWithEmptySot()).includes('Session Journal'), true);
  assert.equal(resolveJournalModalTitle(casterChar), SPELL_BOOK_JOURNAL_TITLE);
  const spellBookPages = (casterChar.journal || []).filter((j) => j.tags?.includes(SPELL_BOOK_TAG));
  assert.equal(spellBookPages.length, SPELL_BOOK_PAGE_COUNT);

  const remainingTab = (casterChar.actionDirectoryTabs || []).find(
    (t) => t.id === SPELL_KNOWN_REMAINING_TAB_ID
  );
  assert.ok(remainingTab, 'AF8 remaining spell tab must exist');
  assert.deepEqual(remainingTab.entryIds, []);

  const magicMissile: CharacterActionItem = {
    id: 'spell-mm',
    name: 'Magic Missile',
    entryType: 'spell',
    category: 'Spells',
    spellLevel: 1,
    isAvailable: true,
    actionType: 'Standard',
    description: 'Fires unerring force missiles.',
  };
  const heightenedMmAlt: CharacterActionItem = {
    id: 'spell-mm-alt2',
    name: 'Magic Missile (Heightened)',
    entryType: 'alt',
    category: 'Spells',
    parentActionId: 'spell-mm',
    altTargetType: 'spell',
    spellLevel: 2,
    actionType: 'Standard',
    description: 'Cast as 2nd-level spell.',
  };
  casterChar.characterActions = [...(casterChar.characterActions || []), magicMissile, heightenedMmAlt];

  const derived = computeDerivedCharacterStats(casterChar);
  const cast1 = executeSpellCastOnCharacter(casterChar, magicMissile, derived);
  const slot1ActionAfter = (cast1.character.characterActions || []).find(
    (a) => a.id === spellSlotActionId(1)
  );
  assert.ok(slot1ActionAfter);
  assert.equal(slot1ActionAfter.resourceCurrent, 2);
  assert.equal(
    (cast1.character.resourceTrackers || []).find((r) => r.id === spellSlotResourceId(1))?.current,
    2
  );
  assert.equal(cast1.character.spellSlots?.find((s) => s.level === 1)?.usedSlots, 1);

  const castAlt2 = executeSpellCastOnCharacter(cast1.character, heightenedMmAlt, derived);
  const slot2ActionAfter = (castAlt2.character.characterActions || []).find(
    (a) => a.id === spellSlotActionId(2)
  );
  assert.equal(slot2ActionAfter?.resourceCurrent, 1);

  const bangSlotChar = {
    ...casterChar,
    characterActions: (casterChar.characterActions || []).map((a) =>
      a.id === spellSlotActionId(1)
        ? { ...a, stepperMacro: '<<[3-!*1]', resourceCurrent: 3, resourceMax: 3, stepperStepCount: 0 }
        : a
    ),
  };
  const bangCast1 = executeSpellCastOnCharacter(bangSlotChar, magicMissile, derived);
  assert.equal(bangCast1.character.macaroniStepperStore?.[`${spellSlotStepperScopeId(1)}::bang-1`], 1);
  assert.equal(
    (bangCast1.character.characterActions || []).find((a) => a.id === spellSlotActionId(1))?.resourceCurrent,
    2
  );
  const bangCast2 = executeSpellCastOnCharacter(bangCast1.character, magicMissile, derived);
  assert.equal(bangCast2.character.macaroniStepperStore?.[`${spellSlotStepperScopeId(1)}::bang-1`], 2);
  assert.equal(
    (bangCast2.character.characterActions || []).find((a) => a.id === spellSlotActionId(1))?.resourceCurrent,
    1
  );

  const slotActionObj = bangSlotChar.characterActions!.find((a) => a.id === spellSlotActionId(1))!;
  const stepRes = stepResourceBarValue(slotActionObj, bangSlotChar, derived);
  assert.equal(stepRes.macaroniResult?.stepperSnapshots?.[0]?.bangId, `${spellSlotStepperScopeId(1)}::bang-1`);

  const counterEntry: CharacterActionItem = {
    id: 'cnt-arcana',
    name: 'Arcane Surge Counter',
    entryType: 'counter',
    category: 'Other',
    totalCountMacro: '<<[!*2]',
    description: 'Scales by 2 per step.',
  };
  const charWithCounter = {
    ...casterChar,
    characterActions: [...(casterChar.characterActions || []), counterEntry],
  };

  const renderEval0 = evaluateCounterDisplayValue(counterEntry, charWithCounter, derived);
  assert.equal(renderEval0.hasBang, true);
  assert.equal(renderEval0.currentStep, 0);
  assert.equal(renderEval0.display, '0');
  assert.equal(charWithCounter.macaroniStepperStore?.['counter-cnt-arcana::bang-1'], undefined);

  const afterStep1 = executeCounterRunStepperOnCharacter(charWithCounter, counterEntry, derived);
  assert.equal(afterStep1.character.macaroniStepperStore?.['counter-cnt-arcana::bang-1'], 1);
  assert.equal(evaluateCounterDisplayValue(counterEntry, afterStep1.character, derived).display, '2');
  assert.equal(evaluateCounterDisplayValue(counterEntry, afterStep1.character, derived).display, '2');
  assert.equal(afterStep1.character.macaroniStepperStore?.['counter-cnt-arcana::bang-1'], 1);

  const afterStep2 = executeCounterRunStepperOnCharacter(afterStep1.character, counterEntry, derived);
  assert.equal(afterStep2.character.macaroniStepperStore?.['counter-cnt-arcana::bang-1'], 2);
  assert.equal(evaluateCounterDisplayValue(counterEntry, afterStep2.character, derived).display, '4');

  const actionHtml = renderToString(
    React.createElement(ActionDirectoryModule, {
      character: afterStep1.character,
      derived,
      theme: 'blueprint',
      onUpdateCharacter: () => {},
      onRollFormula: () => {},
    })
  );
  assert.ok(actionHtml.includes('Cast'));
  assert.ok(actionHtml.includes('Run Stepper'));

  const sampleArtifacts: SrdIngestArtifacts = {
    'table.json': {
      schemaVersion: 'PF1E_SOT_INGEST_V1',
      documentId: 'doc-1',
      tables: [
        { id: 't1', caption: 'Wizard Class Table', kind: 'class-grid', headers: ['Level'], rows: [['1st']] },
        {
          id: 't2',
          caption: 'Arcane School Familiarity Lookup',
          kind: 'lookup-table',
          headers: ['School', 'Focus'],
          rows: [['Evocation', 'Force']],
        },
      ],
    },
    'links.json': { schemaVersion: 'PF1E_SOT_INGEST_V1', documentId: 'doc-1', links: [] },
    'text.md': '# Wizard',
    'index.json': { schemaVersion: 'PF1E_SOT_INGEST_V1', document: { id: 'doc-1', title: 'Wizard', sha256: 'a', sourceType: 'html' }, sections: [], toc: [], keywords: [], termIndex: {} },
  };
  const extractedLookups = extractLookupTablesFromArtifacts('Core Wizard', sampleArtifacts);
  assert.equal(extractedLookups.length, 1);

  const journalHtml = renderToString(
    React.createElement(JournalModal, {
      isOpen: true,
      onClose: () => {},
      character: casterChar,
      onUpdateCharacter: () => {},
      theme: 'parchment',
      lookupTables: extractedLookups,
    })
  );
  assert.ok(journalHtml.includes(SPELL_BOOK_JOURNAL_TITLE));
  assert.ok(journalHtml.includes('1st-level spells'));
  assert.ok(journalHtml.includes('9th-level spells'));
  assert.ok(journalHtml.includes('Arcane School Familiarity Lookup'));

  const adSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/sheet/ActionDirectoryModule.tsx'),
    'utf8'
  );
  assert.ok(adSrc.includes('aria-label="Entry format"'));
  assert.ok(adSrc.includes('Change ability type for'));
});
