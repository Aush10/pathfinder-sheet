import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { blankCharacterWithEmptySot } from '../../../storage/characterState';
import { applyMatrixProgressionToCharacter } from '../../../engine/characterIntegration';
import {
  clearIndex,
  createMatrixId,
  deriveMatrix,
  indexFromClassifiedTables,
  parseHeaderFill,
  parseIndexToken,
  replaceIndexValues,
  addRow0,
  autofillIndexColumn,
  appendIndex,
  assignMatrixValue,
  autoAssignIndex,
  bindMatrixValue,
  abilityTypeFromTag,
} from '../../../engine/matrix/matrixEngine';
import type { IngestTable } from './SotClassifiedPicker';
import {
  CharacterMatrixPanel,
  createNewUserIndexInCharacter,
  getCellStateClasses,
} from './CharacterMatrixPanel';
import { buildAutoAssignLookup } from './EditIndexModal';
import { splitIngestTablesByEligibility } from './SotClassifiedPicker';
import {
  classifyIngestTablesForArchitect,
  nextCollisionFreeClassId,
} from '../ClassArchitectModal';
import type { SrdIngestArtifacts } from '../../../storage/fsAdapter';

test('CharacterMatrixPanel, EditIndexModal, SotClassifiedPicker, and ClassArchitect integration work end-to-end', () => {
  const mockGrids: Record<string, any> = {
    class2: { id: 'class2', className: 'Wizard' },
  };
  assert.equal(nextCollisionFreeClassId(mockGrids).id, 'class1');
  const mockGridsBoth: Record<string, any> = {
    class1: { id: 'class1', className: 'Fighter' },
    class2: { id: 'class2', className: 'Wizard' },
  };
  assert.equal(nextCollisionFreeClassId(mockGridsBoth).id, 'class3');

  const baseChar = blankCharacterWithEmptySot();
  const { createdIndex, nextCharacter } = createNewUserIndexInCharacter(baseChar, 'Fighter');
  assert.ok(nextCharacter.matrixIndexes?.[createdIndex.id]);
  assert.equal(nextCharacter.careerIndex?.tracks.length, 1);
  assert.equal(nextCharacter.careerIndex?.tracks[0].header, '=Fighter');

  const fighterTable: IngestTable = {
    id: 't-fighter',
    sectionId: 'sec-f',
    caption: 'Table: Fighter',
    headers: ['Level', 'Base Attack Bonus', 'Fort', 'Ref', 'Will', 'Special'],
    headerMap: {},
    cells: [],
    headerGrid: [],
    rows: [
      ['1st', '+1', '+2', '+0', '+0', 'Bonus feat <feat>'],
      ['2nd', '+2', '+3', '+0', '+0', 'Bravery +1'],
      ['3rd', '+3', '+3', '+1', '+1', 'Armor training 1'],
      ['4th', '+4', '+4', '+1', '+1', 'Bonus feat <feat>'],
    ],
    notes: [],
    kind: 'class-grid',
    documentOrder: 0,
  };
  const lookupOnlyArtifact: SrdIngestArtifacts = {
    'table.json': {
      schemaVersion: 'PF1E_SOT_INGEST_V1',
      documentId: 'doc-l',
      tables: [
        { id: 't-lookup', caption: 'Weapon Price Chart', kind: 'lookup-table', headers: ['Item', 'Cost'], rows: [['Sword', '15 gp']] },
      ],
    },
    'links.json': { schemaVersion: 'PF1E_SOT_INGEST_V1', documentId: 'doc-l', links: [] },
    'text.md': '',
    'index.json': { schemaVersion: 'PF1E_SOT_INGEST_V1', document: { id: 'doc-l', title: 'Weapons', sha256: 'x', sourceType: 'html' }, sections: [], toc: [], keywords: [], termIndex: {} },
  };

  assert.equal(classifyIngestTablesForArchitect(lookupOnlyArtifact).lookupOnly, true);

  const mixedSplit = splitIngestTablesByEligibility({
    'table.json': {
      tables: [
        fighterTable,
        { id: 't-l2', sectionId: 's', headers: ['A'], headerMap: {}, cells: [], headerGrid: [], rows: [['1']], notes: [], kind: 'lookup-table', documentOrder: 1 },
      ],
    },
    'links.json': {},
    'text.md': '',
    'index.json': {},
  });
  assert.equal(mixedSplit.eligibleTables.length, 1);
  assert.equal(mixedSplit.lookupTables.length, 1);

  const fighterIdx = indexFromClassifiedTables(
    createMatrixId('idx', 'Fighter', []),
    'Fighter',
    [fighterTable]
  );
  assert.ok(!('error' in fighterIdx));

  assert.ok(!('error' in (parseHeaderFill('=wizard') || {})));
  assert.ok('error' in (parseHeaderFill('bad!header') || {}));
  assert.ok('error' in parseIndexToken('not-valid-%%%'));
  assert.ok(getCellStateClasses('green').includes('emerald'));
  assert.ok(getCellStateClasses('red').includes('rose'));
  assert.ok(getCellStateClasses('yellow').includes('amber'));

  if (!('error' in fighterIdx)) {
    const edited0 = addRow0(fighterIdx);
    assert.ok(edited0.row0);
    const replaced = replaceIndexValues(edited0, 'Bravery +1', 'Bravery +2');
    assert.ok(JSON.stringify(replaced.rows).includes('Bravery +2'));
    const assigned = assignMatrixValue(replaced, 'Bravery +2', 'sec-bravery', 'Fear resistance');
    assert.equal(assigned.assignments?.length, 1);
    const auto = autoAssignIndex(
      assigned,
      buildAutoAssignLookup([
        { sectionId: 'sec-armor', headingPath: ['Armor Training'], text: 'Reduces armor penalty.', keywords: ['armor training 1'] },
      ])
    );
    assert.ok(auto.assignments && auto.assignments.length >= 1);
    const bound = bindMatrixValue(auto, 'Bravery +2', 'take-highest', 'bravery');
    assert.equal(bound.bindings?.[0]?.mode, 'take-highest');
    const filled = autofillIndexColumn(bound, bound.columns[1].id, '+1');
    assert.ok(filled.rows.length >= 4);
    const appended = appendIndex(filled, 'idx-parent');
    assert.equal(appended.appendToIndexId, 'idx-parent');
    const cleared = clearIndex(appended);
    assert.deepEqual(cleared.rows[0].values, {});

    assert.equal(abilityTypeFromTag('Power Attack <feat>').type, 'feat');
    assert.equal(abilityTypeFromTag('Smite Evil <act>').type, 'action');
    assert.equal(abilityTypeFromTag('Lay on Hands <rec>').type, 'resource');
    assert.equal(abilityTypeFromTag('Cure Light Wounds <spell>').type, 'spell');

    const charForApply = {
      ...baseChar,
      matrixIndexes: { [fighterIdx.id]: fighterIdx },
      careerIndex: {
        tracks: [
          {
            id: 'trk-a',
            header: '',
            cells: ['fighter1', 'fighter2', 'fighter3', 'fighter4'],
          },
        ],
      },
    };
    const derived = deriveMatrix(charForApply.matrixIndexes!, charForApply.careerIndex, 20);
    assert.equal(derived.rows.length, 20);
    const afterApply = applyMatrixProgressionToCharacter(charForApply, derived);
    assert.equal(afterApply.level, 4);
  }

  const matrixHtml = renderToString(
    React.createElement(CharacterMatrixPanel, {
      character: nextCharacter,
      onUpdateCharacter: () => {},
    })
  );
  assert.ok(matrixHtml.includes('Character Matrix'));
  assert.ok(matrixHtml.includes('Career Index'));
  assert.ok(matrixHtml.includes('Apply Matrix to Sheet'));

  const modalSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/tools/ClassArchitectModal.tsx'),
    'utf8'
  );
  assert.ok(modalSrc.includes("import { CharacterMatrixPanel } from './matrix/CharacterMatrixPanel'"));
  assert.ok(!modalSrc.includes('Staged for AF7 Promotion'));
});
