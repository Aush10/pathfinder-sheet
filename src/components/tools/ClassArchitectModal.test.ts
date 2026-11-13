import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseClassProgressionGrid,
  generateProgressionSkeleton,
} from './ClassArchitectModal';

test('parseClassProgressionGrid parses tab-delimited SRD table', () => {
  const sample = `1\t+1\t+2\t+0\t+0\tAura, blessings, orisons\n2\t+2\t+3\t+0\t+0\tFervor 1d6`;
  const parsed = parseClassProgressionGrid(sample);

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].level, 1);
  assert.equal(parsed[0].babString, '+1');
  assert.equal(parsed[0].fort, 2);
  assert.equal(parsed[0].ref, 0);
  assert.equal(parsed[0].will, 0);
  assert.equal(parsed[0].special, 'Aura, blessings, orisons');

  assert.equal(parsed[1].level, 2);
  assert.equal(parsed[1].babString, '+2');
  assert.equal(parsed[1].fort, 3);
  assert.equal(parsed[1].special, 'Fervor 1d6');
});

test('parseClassProgressionGrid ignores header rows and handles pipe-delimited tables', () => {
  const sample = `Level | BAB | Fort | Ref | Will | Special\n1 | +0 | +2 | +0 | +2 | Spells, domain`;
  const parsed = parseClassProgressionGrid(sample);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].level, 1);
  assert.equal(parsed[0].babString, '+0');
  assert.equal(parsed[0].fort, 2);
  assert.equal(parsed[0].will, 2);
  assert.equal(parsed[0].special, 'Spells, domain');
});

test('generateProgressionSkeleton generates valid 1-20 progression', () => {
  const skeleton = generateProgressionSkeleton('full', true, false, false);
  assert.equal(skeleton.length, 20);

  // Full BAB level 1 = +1, level 6 = +6/+1, level 20 = +20/+15/+10/+5
  assert.equal(skeleton[0].babString, '+1');
  assert.equal(skeleton[5].babString, '+6/+1');
  assert.equal(skeleton[19].babString, '+20/+15/+10/+5');

  // Good Fort level 1 = +2, level 20 = +12
  assert.equal(skeleton[0].fort, 2);
  assert.equal(skeleton[19].fort, 12);

  // Poor Ref level 1 = +0, level 20 = +6
  assert.equal(skeleton[0].ref, 0);
  assert.equal(skeleton[19].ref, 6);
});
