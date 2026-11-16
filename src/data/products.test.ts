import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, PRODUCT_BY_ID, CATEGORIES } from './products';
import { MATERIALS } from './materials';
import {
  allowedRange,
  applyPreset,
  configKey,
  defaultConfig,
  insightsFor,
  leadTime,
  normalizeConfig,
  parseConfig,
  priceBreakdown,
  serializeConfig,
  visibleChoices,
  weightKg,
} from './config';
import { formatLength, formatMoney } from '../i18n/translations';

test('catalog has 19 distinct pieces across four categories, all bilingual', () => {
  assert.equal(PRODUCTS.length, 19);
  assert.equal(new Set(PRODUCTS.map((p) => p.id)).size, 19);
  assert.equal(new Set(PRODUCTS.map((p) => p.sku)).size, 19);
  const cats = new Set(CATEGORIES.map((c) => c.id));
  for (const p of PRODUCTS) {
    assert.ok(cats.has(p.category), `${p.id} category`);
    for (const t of [p.name, p.tagline, p.warranty, p.origin, p.care, p.construction]) {
      assert.ok(t.km.trim().length > 0 && t.en.trim().length > 0, `${p.id} copy`);
    }
    assert.ok(p.presets.length >= 2, `${p.id} presets`);
    assert.ok(p.basePrice > 0);
  }
});

test('every product default, preset and material reference is valid', () => {
  for (const p of PRODUCTS) {
    for (const s of p.slots) {
      assert.ok(s.materials.includes(s.default), `${p.id}.${s.id} default in list`);
      for (const m of s.materials) assert.ok(MATERIALS[m], `${p.id}.${s.id} material ${m}`);
    }
    const def = defaultConfig(p);
    assert.ok(def.w >= p.dims.w.min && def.w <= p.dims.w.max, `${p.id} default w`);
    assert.ok(def.h >= p.dims.h.min && def.h <= p.dims.h.max, `${p.id} default h`);
    for (const pr of p.presets) {
      const c = applyPreset(p, def, pr);
      assert.equal(c.w, pr.w, `${p.id}/${pr.id} width survives validation`);
      assert.equal(c.d, pr.d, `${p.id}/${pr.id} depth survives validation`);
      assert.equal(c.h, pr.h, `${p.id}/${pr.id} height survives validation`);
    }
  }
});

test('the default build always costs exactly the base price', () => {
  for (const p of PRODUCTS) {
    const b = priceBreakdown(p, defaultConfig(p));
    assert.equal(b.total, p.basePrice, p.id);
    assert.equal(b.lines.length, 0, `${p.id} has no surcharges at default`);
  }
});

test('price grows with size and shows up as a size adjustment', () => {
  const sofa = PRODUCT_BY_ID.sofa;
  const base = defaultConfig(sofa);
  const wider = normalizeConfig(sofa, { ...base, w: 3000 });
  const narrower = normalizeConfig(sofa, { ...base, w: 1800 });
  assert.ok(priceBreakdown(sofa, wider).total > sofa.basePrice);
  assert.ok(priceBreakdown(sofa, narrower).total < sofa.basePrice);
  assert.equal(priceBreakdown(sofa, wider).size, priceBreakdown(sofa, wider).total - sofa.basePrice);
});

test('materials and options price relative to the default', () => {
  const chair = PRODUCT_BY_ID.armchair;
  const base = defaultConfig(chair);
  const silk = { ...base, slots: { ...base.slots, surface: 'emerald-silk' } };
  const b = priceBreakdown(chair, silk);
  assert.ok(b.lines.some((l) => l.key === 'slot:surface' && l.amount > 0));

  const noArms = { ...base, opts: { ...base.opts, arms: 'none' } };
  assert.ok(priceBreakdown(chair, noArms).total < chair.basePrice, 'removing arms saves money');

  const stool = PRODUCT_BY_ID.nightstand;
  const sBase = defaultConfig(stool);
  const more = { ...sBase, opts: { ...sBase.opts, drawers: 3 } };
  assert.equal(priceBreakdown(stool, more).total, stool.basePrice + 70);
});

test('round tops keep depth equal to width and hide trestle legs', () => {
  const t = PRODUCT_BY_ID.diningTable;
  const round = applyPreset(t, defaultConfig(t), t.presets.find((x) => x.id === 'round')!);
  assert.equal(round.opts.shape, 'round');
  assert.equal(round.d, round.w);
  // Switching to round from a trestle table repairs the leg choice and clamps width.
  const base = defaultConfig(t);
  const switched = normalizeConfig(t, { ...base, opts: { ...base.opts, shape: 'round', legs: 'trestle' } });
  assert.equal(switched.opts.legs, 'pedestal');
  assert.equal(switched.d, switched.w);
  assert.ok(switched.w <= 1200, 'diameter limited by depth range');
  const legs = t.options.find((o) => o.id === 'legs');
  assert.ok(legs && legs.type === 'choice');
  assert.ok(!visibleChoices(legs, round).some((c) => c.id === 'trestle'));
  assert.equal(allowedRange(t, round).w.max, 1200);
});

test('invalid input is repaired rather than trusted', () => {
  const p = PRODUCT_BY_ID.credenza;
  const c = normalizeConfig(p, {
    w: 99999,
    d: -5,
    h: Number.NaN,
    slots: { frame: 'nope', surface: 'brass' },
    opts: { layout: 'banana', front: 42 as never },
    note: 'x'.repeat(500),
  });
  assert.equal(c.w, p.dims.w.max);
  assert.equal(c.d, p.dims.d.min);
  assert.equal(c.slots.frame, 'beng');
  assert.equal(c.slots.surface, 'cane-natural');
  assert.equal(c.opts.layout, 'doors');
  assert.equal(c.note.length, 280);
  assert.ok(Number.isFinite(c.h));
});

test('share links round-trip and stay short for default builds', () => {
  for (const p of PRODUCTS) {
    const def = defaultConfig(p);
    assert.equal(serializeConfig(p, def), '');
    const custom = normalizeConfig(p, {
      ...def,
      w: Math.min(p.dims.w.max, def.w + p.dims.w.step * 3),
      h: Math.max(p.dims.h.min, def.h - p.dims.h.step * 2),
    });
    const back = parseConfig(p, serializeConfig(p, custom));
    assert.equal(configKey(p, back), configKey(p, custom), p.id);
  }
  const bed = PRODUCT_BY_ID.bed;
  const parsed = parseConfig(bed, 'w=junk&f=ghost&o.headboard=slatted');
  assert.equal(parsed.w, bed.dims.w.def);
  assert.equal(parsed.slots.frame, 'neangnuon');
  assert.equal(parsed.opts.headboard, 'slatted');
});

test('lead time: stock only for standard sizes in standard finishes', () => {
  const chair = PRODUCT_BY_ID.armchair;
  const base = defaultConfig(chair);
  assert.deepEqual(leadTime(chair, base), { kind: 'stock', days: 5 });
  const silk = { ...base, slots: { ...base.slots, surface: 'indigo' } };
  assert.equal(leadTime(chair, silk).kind, 'made');
  const custom = normalizeConfig(chair, { ...base, w: 800 });
  const lt = leadTime(chair, custom);
  assert.equal(lt.kind, 'made');
  if (lt.kind === 'made') {
    assert.equal(lt.custom, true);
    assert.deepEqual(lt.weeks, [chair.leadWeeks[0] + 1, chair.leadWeeks[1] + 1]);
  }
});

test('insights respond to the custom size', () => {
  const sofa = PRODUCT_BY_ID.sofa;
  const base = defaultConfig(sofa);
  const two = insightsFor(sofa, normalizeConfig(sofa, { ...base, w: 1800 }));
  const four = insightsFor(sofa, normalizeConfig(sofa, { ...base, w: 3000 }));
  assert.match(two[0].text.en, /Seats 2/);
  assert.match(four[0].text.en, /Seats 4/);

  const bed = PRODUCT_BY_ID.bed;
  const king = insightsFor(bed, defaultConfig(bed))[0].text.en;
  assert.match(king, /King/);
  const odd = insightsFor(bed, normalizeConfig(bed, { ...defaultConfig(bed), w: 1700 }))[0].text.en;
  assert.match(odd, /custom/i);

  for (const p of PRODUCTS) {
    for (const i of insightsFor(p, defaultConfig(p))) {
      assert.ok(i.text.km.length > 0 && i.text.en.length > 0);
    }
    assert.ok(weightKg(p, defaultConfig(p)) > 0);
  }
});

test('money and length formatting', () => {
  assert.equal(formatMoney(3450, 'USD'), '$3,450');
  assert.equal(formatMoney(-35, 'USD'), '−$35');
  assert.equal(formatMoney(120, 'USD', { signed: true }), '+$120');
  assert.ok(formatMoney(1000, 'KHR').endsWith('៛'));
  assert.equal(formatLength(785, 'cm'), '78.5 cm');
  assert.equal(formatLength(780, 'cm'), '78 cm');
  assert.equal(formatLength(780, 'mm'), '780 mm');
  assert.equal(formatLength(780, 'in'), '30.7″');
});
