import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PRODUCTS } from '../data/products';
import { applyPreset, defaultConfig, normalizeConfig } from '../data/config';
import type { Config, Product } from '../data/types';
import { buildFurniture, disposeGroup } from './builders';

const mk = () => new THREE.MeshStandardMaterial();
const mats = { frame: mk(), surface: mk(), accent: mk(), neutral: mk(), inside: mk() };

function measure(p: Product, cfg: Config) {
  const g = buildFurniture(p, cfg, mats);
  const box = new THREE.Box3().setFromObject(g);
  const size = new THREE.Vector3();
  box.getSize(size);
  // Count real meshes, not top-level groups: movable parts are grouped under
  // pivots so they can hinge together.
  let meshes = 0;
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes++;
  });
  disposeGroup(g);
  return { w: size.x * 1000, d: size.z * 1000, h: size.y * 1000, floor: box.min.y * 1000, meshes };
}

/** Every option value for one product, one at a time. */
function optionVariants(p: Product): Config[] {
  const base = defaultConfig(p);
  const out: Config[] = [base];
  for (const o of p.options) {
    const values: (string | number | boolean)[] =
      o.type === 'choice' ? o.choices.map((c) => c.id) : o.type === 'toggle' ? [true, false] : [o.min, o.max];
    for (const v of values) out.push(normalizeConfig(p, { ...base, opts: { ...base.opts, [o.id]: v } }));
  }
  return out;
}

test('built models match the requested size at default, minimum and maximum', () => {
  for (const p of PRODUCTS) {
    const def = defaultConfig(p);
    const cfgs = [
      def,
      normalizeConfig(p, { ...def, w: p.dims.w.min, d: p.dims.d.min, h: p.dims.h.min }),
      normalizeConfig(p, { ...def, w: p.dims.w.max, d: p.dims.d.max, h: p.dims.h.max }),
    ];
    for (const cfg of cfgs) {
      const r = measure(p, cfg);
      const within = (got: number, want: number) => Math.abs(got - want) <= Math.max(25, want * 0.06);
      assert.ok(within(r.w, cfg.w), `${p.id} width ${r.w.toFixed(0)} vs ${cfg.w}`);
      assert.ok(within(r.d, cfg.d), `${p.id} depth ${r.d.toFixed(0)} vs ${cfg.d}`);
      assert.ok(within(r.h, cfg.h), `${p.id} height ${r.h.toFixed(0)} vs ${cfg.h}`);
      assert.ok(r.floor > -15, `${p.id} stays above the floor (${r.floor.toFixed(1)})`);
    }
  }
});

test('every option value builds, stays on size, and changes the model where it should', () => {
  for (const p of PRODUCTS) {
    const seen = new Set<string>();
    for (const cfg of optionVariants(p)) {
      const r = measure(p, cfg);
      assert.ok(r.meshes > 0, `${p.id} produced geometry`);
      assert.ok(Math.abs(r.w - cfg.w) <= Math.max(30, cfg.w * 0.07), `${p.id} ${JSON.stringify(cfg.opts)} width`);
      // Stool height is the seat height; a backrest rises above it.
      const hOk = p.id === 'barStool' ? r.h >= cfg.h - 30 : Math.abs(r.h - cfg.h) <= Math.max(30, cfg.h * 0.07);
      assert.ok(hOk, `${p.id} ${JSON.stringify(cfg.opts)} height ${r.h.toFixed(0)} vs ${cfg.h}`);
      seen.add(`${r.meshes}`);
    }
    // Products with options should produce at least two distinct builds.
    if (p.options.some((o) => o.type !== 'choice' || o.choices.length > 1)) {
      assert.ok(seen.size > 1 || p.id === 'armchair', `${p.id} options visibly change the model`);
    }
  }
});

test('cabinet interiors are hollow, not a solid block', () => {
  for (const id of ['credenza', 'wardrobe', 'dresser', 'tvUnit', 'nightstand']) {
    const p = PRODUCTS.find((x) => x.id === id)!;
    const g = buildFurniture(p, defaultConfig(p), mats);
    let blockers = 0;
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      mesh.geometry.boundingBox!.getSize(size);
      // A slab spanning most of the width, height and depth is the old
      // shortcut that filled the carcase and showed through open doors.
      if (size.x > 0.5 && size.y > 0.3 && size.z > 0.3) blockers++;
    });
    assert.equal(blockers, 0, `${id} has a hollow interior`);
    disposeGroup(g);
  }
});

test('every preset builds at its stated size', () => {
  for (const p of PRODUCTS) {
    for (const pr of p.presets) {
      const cfg = applyPreset(p, defaultConfig(p), pr);
      const r = measure(p, cfg);
      assert.ok(Math.abs(r.w - cfg.w) <= Math.max(25, cfg.w * 0.06), `${p.id}/${pr.id} width`);
      assert.ok(Math.abs(r.d - cfg.d) <= Math.max(25, cfg.d * 0.06), `${p.id}/${pr.id} depth`);
    }
  }
});

test('width changes the model: wider sofas gain seats, wider cabinets gain doors', () => {
  const sofa = PRODUCTS.find((p) => p.id === 'sofa')!;
  const sd = defaultConfig(sofa);
  const small = measure(sofa, normalizeConfig(sofa, { ...sd, w: 1500 })).meshes;
  const big = measure(sofa, normalizeConfig(sofa, { ...sd, w: 3600 })).meshes;
  assert.ok(big > small);
  const cred = PRODUCTS.find((p) => p.id === 'credenza')!;
  const cd = defaultConfig(cred);
  assert.ok(
    measure(cred, normalizeConfig(cred, { ...cd, w: 2600 })).meshes > measure(cred, normalizeConfig(cred, { ...cd, w: 1200 })).meshes,
  );
});
