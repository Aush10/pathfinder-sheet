import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAutoChange,
  getCoinsTotalGp,
  reconcileCurrency,
} from './currencyUtils';

test('calculateAutoChange splits 111.11 gp into 11 pp, 1 gp, 1 sp, 1 cp', () => {
  assert.deepEqual(calculateAutoChange(111.11), {
    pp: 11,
    gp: 1,
    sp: 1,
    cp: 1,
  });
});

test('calculateAutoChange avoids floating-point drift on 10019.61 gp and zero', () => {
  assert.deepEqual(calculateAutoChange(10019.61), {
    pp: 1001,
    gp: 9,
    sp: 6,
    cp: 1,
  });
  assert.deepEqual(calculateAutoChange(0), {
    pp: 0,
    gp: 0,
    sp: 0,
    cp: 0,
  });
});

test('reconcileCurrency compares coin total against currentGp + bankGp', () => {
  const coins = { pp: 11, gp: 1, sp: 1, cp: 1 };
  assert.equal(getCoinsTotalGp(coins), 111.11);

  const balanced = reconcileCurrency(coins, { currentGp: 100, bankGp: 11.11 }, true);
  assert.equal(balanced.isBalanced, true);
  assert.equal(balanced.targetGp, 111.11);

  const mismatch = reconcileCurrency({ pp: 10, gp: 0, sp: 0, cp: 0 }, { currentGp: 100, bankGp: 11.11 }, true);
  assert.equal(mismatch.isBalanced, false);
  assert.equal(mismatch.coinsGp, 100);
  assert.equal(mismatch.targetGp, 111.11);

  const carriedOnlyBalanced = reconcileCurrency(
    { pp: 10, gp: 0, sp: 0, cp: 0 },
    { currentGp: 100, bankGp: 11.11 },
    false
  );
  assert.equal(carriedOnlyBalanced.isBalanced, true);
});
