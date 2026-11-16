import * as THREE from 'three';
import { PRODUCTS } from '../src/data/products';
import { defaultConfig, normalizeConfig } from '../src/data/config';
import { buildFurniture, disposeGroup } from '../src/three/builders';
const mk = () => new THREE.MeshStandardMaterial();
const mats = { frame: mk(), surface: mk(), accent: mk(), neutral: mk() };
const rows: { id: string; ms: number; meshes: number }[] = [];
for (const p of PRODUCTS) {
  const def = defaultConfig(p);
  // Simulate dragging the width slider: every build has a new width.
  const steps = 40;
  const t0 = performance.now();
  let meshes = 0;
  for (let i = 0; i < steps; i++) {
    const w = p.dims.w.min + ((p.dims.w.max - p.dims.w.min) * i) / (steps - 1);
    const g = buildFurniture(p, normalizeConfig(p, { ...def, w }), mats);
    meshes = g.children.length;
    disposeGroup(g);
  }
  rows.push({ id: p.id, ms: +((performance.now() - t0) / steps).toFixed(1), meshes });
}
rows.sort((a, b) => b.ms - a.ms);
console.table(rows.slice(0, 7));
console.log('median ms/build while dragging width:', rows.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)]);
