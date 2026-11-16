import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals, makeLine, unitPrice } from './bag';
import { defaultConfig, normalizeConfig } from './config';
import { PRODUCT_BY_ID } from './products';

const line = (id: string, qty = 1) => makeLine(id, defaultConfig(PRODUCT_BY_ID[id]), qty)!;

test('identical configurations merge, different ones do not', () => {
  const a = line('armchair');
  const b = line('armchair');
  assert.equal(a.key, b.key);
  const p = PRODUCT_BY_ID.armchair;
  const c = makeLine('armchair', normalizeConfig(p, { ...a.cfg, w: 880 }))!;
  assert.notEqual(a.key, c.key);
  assert.equal(makeLine('nope', a.cfg), null);
});

test('delivery thresholds by zone', () => {
  const chair = line('armchair'); // $3,450
  const pp = computeTotals([chair], 'phnomPenh', '');
  assert.equal(pp.deliveryFee, 120);
  assert.equal(pp.total, 3570);
  assert.equal(pp.toFree, 4500 - 3450);

  const two = computeTotals([line('armchair', 2)], 'phnomPenh', '');
  assert.equal(two.deliveryFee, 0);
  assert.equal(two.toFree, null);

  const intl = computeTotals([chair], 'international', '');
  assert.equal(intl.deliveryFee, 850);
  assert.equal(intl.total, 4300);
});

test('SOLIS10 takes 10% off before delivery is decided', () => {
  const lines = [line('armchair'), line('sofa')]; // 3450 + 6850
  const t = computeTotals(lines, 'provinces', 'solis10');
  assert.equal(t.promoApplied, true);
  assert.equal(t.subtotal, 10300);
  assert.equal(t.discount, 1030);
  assert.equal(t.deliveryFee, 0);
  assert.equal(t.total, 9270);
  assert.equal(computeTotals(lines, 'provinces', 'nope').promoApplied, false);
});

test('empty bag costs nothing', () => {
  const t = computeTotals([], 'phnomPenh', 'SOLIS10');
  assert.equal(t.total, 0);
  assert.equal(t.deliveryFee, 0);
  assert.equal(unitPrice(line('sideTable')), PRODUCT_BY_ID.sideTable.basePrice);
});
