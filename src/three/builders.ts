import * as THREE from 'three';
import type { Config, OptionValue, Product } from '../data/types';
import {
  BED_HEADBOARD_MM,
  BED_SIDE_MM,
  cabinetBays,
  clamp,
  dividerCount,
  loungeSeatHeightMm,
  shelfRows,
  sofaArmMm,
  sofaSeatHeightMm,
  sofaSeats,
  tableTopMm,
} from '../data/rules';
import {
  duvetGeometry,
  pillowGeometry,
  projectUV,
  roundCushionGeometry,
  roundedBox,
  slabGeometry,
  strutGeometry,
  tileOf,
  topOutline,
  type TopShape,
} from './geometry';

export interface Mats {
  frame: THREE.Material;
  surface: THREE.Material;
  accent: THREE.Material;
  /** Plain off-white linen for mattresses and pillows. */
  neutral: THREE.Material;
}

type V3 = [number, number, number];

/**
 * Geometry cache. Furniture repeats parts (slats, doors, legs), and while a
 * slider is dragged most parts keep their size, so building each shape once
 * makes live resizing cheap. Cached geometries are shared, so they are never
 * disposed with a piece; the cache frees itself when it grows too large.
 */
const GEO_CACHE = new Map<string, THREE.BufferGeometry>();
const GEO_CACHE_MAX = 900;
const q = (n: number) => Math.round(n * 10000);

function cachedGeometry(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const hit = GEO_CACHE.get(key);
  if (hit) return hit;
  if (GEO_CACHE.size >= GEO_CACHE_MAX) {
    // Disposing is safe: anything still in use is simply re-uploaded.
    for (const g of GEO_CACHE.values()) g.dispose();
    GEO_CACHE.clear();
  }
  const geo = make();
  geo.userData.cached = true;
  GEO_CACHE.set(key, geo);
  return geo;
}

export function clearGeometryCache(): void {
  for (const g of GEO_CACHE.values()) g.dispose();
  GEO_CACHE.clear();
}

/** Drawing context: dimensions in metres, helpers that place meshes. */
class Ctx {
  readonly g = new THREE.Group();
  readonly W: number;
  readonly D: number;
  readonly H: number;

  constructor(
    readonly cfg: Config,
    readonly m: Mats,
  ) {
    this.W = cfg.w / 1000;
    this.D = cfg.d / 1000;
    this.H = cfg.h / 1000;
  }

  str(id: string): string {
    const v: OptionValue | undefined = this.cfg.opts[id];
    return typeof v === 'string' ? v : '';
  }
  flag(id: string): boolean {
    return this.cfg.opts[id] === true;
  }
  num(id: string): number {
    const v = this.cfg.opts[id];
    return typeof v === 'number' ? v : 0;
  }

  mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, rot?: V3, uv = true): THREE.Mesh {
    if (uv) projectUV(geo, tileOf(mat));
    const me = new THREE.Mesh(geo, mat);
    me.position.set(...pos);
    if (rot) me.rotation.set(...rot);
    me.castShadow = true;
    me.receiveShadow = true;
    this.g.add(me);
    return me;
  }

  box(mat: THREE.Material, size: V3, pos: V3, r = 0.004, rot?: V3) {
    const tile = tileOf(mat);
    const geo = cachedGeometry(`b|${q(size[0])}|${q(size[1])}|${q(size[2])}|${q(r)}|${q(tile)}`, () => {
      const g = roundedBox(size[0], size[1], size[2], r);
      projectUV(g, tile);
      return g;
    });
    return this.mesh(geo, mat, pos, rot, false);
  }

  cyl(mat: THREE.Material, rTop: number, rBot: number, h: number, pos: V3, seg = 28, rot?: V3) {
    const tile = tileOf(mat);
    const geo = cachedGeometry(`c|${q(rTop)}|${q(rBot)}|${q(h)}|${seg}|${q(tile)}`, () => {
      const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
      projectUV(g, tile);
      return g;
    });
    return this.mesh(geo, mat, pos, rot, false);
  }

  strut(mat: THREE.Material, a: V3, b: V3, rA: number, rB: number, seg = 14) {
    const { geo, position, quaternion } = strutGeometry(new THREE.Vector3(...a), new THREE.Vector3(...b), rA, rB, seg);
    const me = this.mesh(geo, mat, [position.x, position.y, position.z]);
    me.quaternion.copy(quaternion);
    return me;
  }

  /** A square tapered leg standing on y0. */
  leg(mat: THREE.Material, x: number, z: number, h: number, wTop: number, wBot: number, y0 = 0) {
    const tile = tileOf(mat);
    const geo = cachedGeometry(`l|${q(wTop)}|${q(wBot)}|${q(h)}|${q(tile)}`, () => {
      const g = new THREE.CylinderGeometry(wTop / Math.SQRT2, wBot / Math.SQRT2, h, 4, 1);
      g.rotateY(Math.PI / 4);
      projectUV(g, tile);
      return g;
    });
    return this.mesh(geo, mat, [x, y0 + h / 2, z], undefined, false);
  }

  /** Small metal cap at the foot of a leg. */
  ferrule(x: number, z: number, r: number) {
    return this.cyl(this.m.accent, r, r * 0.95, 0.012, [x, 0.006, z], 16);
  }

  slab(mat: THREE.Material, outline: THREE.Shape, thick: number, y: number, x = 0, z = 0, bevel = 0.004) {
    return this.mesh(slabGeometry(outline, thick, bevel), mat, [x, y, z]);
  }
}

// ── Seating ────────────────────────────────────────────────────────────────

function buildLounge(c: Ctx) {
  const { W, D, H, m } = c;
  const seatH = loungeSeatHeightMm(c.cfg.h) / 1000;
  const arms = c.str('arms');
  const squareLegs = c.str('legs') === 'square';
  const legH = 0.17;
  const legW = 0.045;
  const lx = W / 2 - 0.045;
  const zf = D / 2 - 0.04;
  const zb = -D / 2 + 0.12;

  for (const sx of [-1, 1]) {
    for (const z of [zf, zb]) {
      c.leg(m.frame, sx * lx, z, legH, legW, squareLegs ? legW : 0.03);
      c.ferrule(sx * lx, z, squareLegs ? 0.018 : 0.014);
    }
  }
  // seat deck rails
  const deckY = legH + 0.035;
  for (const sx of [-1, 1]) c.box(m.frame, [0.04, 0.07, zf - zb + 0.04], [sx * lx, deckY, (zf + zb) / 2]);
  c.box(m.frame, [W - 0.1, 0.06, 0.04], [0, deckY, zf]);
  c.box(m.frame, [W - 0.1, 0.06, 0.04], [0, deckY, zb]);

  // back posts, leaning back
  const lean = -0.2;
  const postTop = H - 0.02;
  const postLen = (postTop - legH) / Math.cos(lean);
  for (const sx of [-1, 1]) {
    const cy = legH + (postTop - legH) / 2;
    const cz = zb + Math.sin(lean) * (postLen / 2);
    c.box(m.frame, [0.045, postLen, 0.04], [sx * lx, cy, cz], 0.006, [lean, 0, 0]);
  }

  const armW = arms === 'upholstered' ? 0.13 : 0;
  const innerW = W - 2 * (arms === 'upholstered' ? armW : 0.09);
  const deckTop = deckY + 0.035;
  const cushT = Math.max(0.1, seatH - deckTop);
  c.box(m.surface, [innerW, cushT, D - 0.14], [0, deckTop + cushT / 2, 0.06], 0.035);

  // back cushion
  const backH = H - seatH - 0.02;
  const backZ = zb + 0.03 + Math.sin(lean) * (backH / 2);
  c.box(m.surface, [innerW, backH, 0.12], [0, seatH + backH / 2 * Math.cos(lean), backZ], 0.04, [lean, 0, 0]);

  if (arms === 'wood') {
    const armTop = seatH + 0.2;
    for (const sx of [-1, 1]) {
      c.box(m.frame, [0.045, armTop - legH, 0.045], [sx * lx, legH + (armTop - legH) / 2, zf]);
      c.box(m.frame, [0.07, 0.04, D - 0.07], [sx * lx, armTop, 0.0], 0.012);
      c.cyl(m.accent, 0.009, 0.009, 0.06, [sx * lx, armTop - 0.012, zf], 12, [0, 0, 0]);
    }
  } else if (arms === 'upholstered') {
    const armH = seatH + 0.2 - legH;
    for (const sx of [-1, 1]) {
      c.box(m.surface, [armW, armH, D - 0.05], [sx * (W / 2 - armW / 2), legH + armH / 2, 0.0], 0.05);
    }
  }
}

function buildDiningChair(c: Ctx) {
  const { W, D, H, m } = c;
  const seatH = clamp(H * 0.54, 0.4, 0.5);
  const lw = 0.04;
  const lx = W / 2 - 0.03;
  const zf = D / 2 - 0.03;
  const zb = -D / 2 + 0.03;
  const arms = c.flag('arms');
  const squareLegs = c.str('legs') === 'square';

  for (const sx of [-1, 1]) {
    c.leg(m.frame, sx * lx, zf, arms ? seatH + 0.2 : seatH - 0.04, lw, squareLegs ? lw : 0.028);
    c.leg(m.frame, sx * lx, zb, H, lw, squareLegs ? lw : 0.03);
    c.ferrule(sx * lx, zf, 0.015);
    c.ferrule(sx * lx, zb, 0.015);
  }
  const railY = seatH - 0.075;
  for (const sx of [-1, 1]) c.box(m.frame, [0.025, 0.06, D - 0.06], [sx * lx, railY, 0]);
  c.box(m.frame, [W - 0.06, 0.06, 0.025], [0, railY, zf]);
  c.box(m.frame, [W - 0.06, 0.06, 0.025], [0, railY, zb]);

  if (c.str('seat') === 'wood') {
    c.box(m.frame, [W, 0.035, D], [0, seatH - 0.0175, 0], 0.012);
  } else {
    c.box(m.frame, [W - 0.05, 0.02, D - 0.05], [0, seatH - 0.06, 0]);
    c.box(m.surface, [W - 0.02, 0.07, D - 0.02], [0, seatH - 0.035, 0], 0.025);
  }

  const back = c.str('back');
  const bw = 2 * lx - lw;
  const topRailY = H - 0.04;
  c.box(m.frame, [bw, 0.07, 0.03], [0, topRailY, zb], 0.01);
  if (back === 'cane') {
    const lowY = seatH + 0.12;
    c.box(m.frame, [bw, 0.035, 0.028], [0, lowY, zb]);
    const ph = topRailY - 0.035 - (lowY + 0.0175);
    c.box(m.accent, [bw - 0.01, ph, 0.012], [0, lowY + 0.0175 + ph / 2, zb], 0.003);
  } else if (back === 'slat') {
    const n = Math.max(3, Math.round(bw / 0.07));
    const sh = topRailY - 0.035 - (seatH + 0.02);
    for (let i = 0; i < n; i++) {
      const x = -bw / 2 + (bw * (i + 0.5)) / n;
      c.box(m.frame, [bw / n - 0.02, sh, 0.02], [x, seatH + 0.02 + sh / 2, zb], 0.005);
    }
  } else {
    const ph = topRailY - 0.035 - (seatH + 0.1);
    c.box(m.surface, [bw - 0.006, ph, 0.05], [0, seatH + 0.1 + ph / 2, zb + 0.005], 0.025);
  }
  if (arms) {
    for (const sx of [-1, 1]) c.box(m.frame, [0.045, 0.03, D - 0.1], [sx * lx, seatH + 0.2, -0.0], 0.01);
  }
}

function buildSofa(c: Ctx) {
  const { W, D, H, m } = c;
  const arms = c.str('arms');
  const armW = sofaArmMm(arms) / 1000;
  const n = sofaSeats(c.cfg.w, arms);
  const seatH = sofaSeatHeightMm(c.cfg.h) / 1000;
  const plinth = c.str('base') !== 'legs';
  const baseH = plinth ? 0.09 : 0.14;

  if (plinth) {
    c.box(m.frame, [W - 0.05, baseH, D - 0.06], [0, baseH / 2, 0], 0.006);
  } else {
    const xs = [-W / 2 + 0.09, W / 2 - 0.09];
    const zs = [-D / 2 + 0.09, D / 2 - 0.09];
    for (const x of xs) for (const z of zs) {
      c.leg(m.frame, x, z, baseH, 0.06, 0.04);
      c.ferrule(x, z, 0.02);
    }
    if (W > 2.6) {
      c.leg(m.frame, 0, zs[0], baseH, 0.06, 0.04);
      c.leg(m.frame, 0, zs[1], baseH, 0.06, 0.04);
    }
  }

  const bodyH = 0.2;
  c.box(m.surface, [W, bodyH, D], [0, baseH + bodyH / 2, 0], 0.04);
  const armH = seatH + 0.2 - baseH;
  for (const sx of [-1, 1]) {
    c.box(m.surface, [armW, armH, D], [sx * (W / 2 - armW / 2), baseH + armH / 2, 0], arms === 'wide' ? 0.09 : 0.06);
  }

  const innerW = W - 2 * armW;
  const cw = innerW / n;
  const cushT = Math.max(0.08, seatH - (baseH + bodyH));
  const backD = 0.2;
  const backH = H - (baseH + bodyH) - 0.02;
  for (let i = 0; i < n; i++) {
    const x = -innerW / 2 + cw * (i + 0.5);
    c.box(m.surface, [cw - 0.012, cushT, D - backD - 0.03], [x, baseH + bodyH + cushT / 2, backD / 2 + 0.005], 0.04);
    const lean = -0.12;
    c.box(
      m.surface,
      [cw - 0.012, backH - 0.06, 0.17],
      [x, baseH + bodyH + (backH - 0.06) / 2 + cushT * 0.4, -D / 2 + backD / 2 + 0.03],
      0.05,
      [lean, 0, 0],
    );
  }
  // solid back frame
  c.box(m.surface, [innerW + 0.02, backH * 0.55, 0.12], [0, baseH + bodyH + backH * 0.275, -D / 2 + 0.06], 0.04);
}

function buildStool(c: Ctx) {
  const { W, D, H, m } = c;
  const round = c.str('seat') === 'round';
  const seatT = 0.05;
  const seatTop = H;
  const r = W / 2;
  const legs = c.str('legs') === 'three' ? 3 : 4;

  if (round) {
    const geo = roundCushionGeometry(r, seatT, 0.02);
    c.mesh(geo, m.surface, [0, seatTop - seatT, 0]);
    c.cyl(m.frame, r - 0.01, r - 0.012, 0.03, [0, seatTop - seatT - 0.015, 0], 36);
  } else {
    c.box(m.surface, [W, seatT, D], [0, seatTop - seatT / 2, 0], 0.022);
    c.box(m.frame, [W - 0.03, 0.03, D - 0.03], [0, seatTop - seatT - 0.015, 0], 0.008);
  }

  const inset = Math.min(r, D / 2) - 0.06;
  const footY = H * 0.34;
  for (let i = 0; i < legs; i++) {
    const a = (Math.PI * 2 * i) / legs + (legs === 4 ? Math.PI / 4 : Math.PI / 2);
    const top: V3 = [Math.cos(a) * inset, seatTop - seatT - 0.02, Math.sin(a) * inset];
    const bot: V3 = [Math.cos(a) * (inset + 0.03), 0, Math.sin(a) * (inset + 0.03)];
    c.strut(m.frame, top, bot, 0.019, 0.014);
    c.ferrule(bot[0], bot[2], 0.015);
  }
  const ringR = inset + 0.03 * (1 - footY / H) + 0.0;
  c.mesh(new THREE.TorusGeometry(ringR, 0.008, 10, 40), m.accent, [0, footY, 0], [Math.PI / 2, 0, 0], false);

  if (c.str('back') === 'low') {
    const arc = Math.PI * 1.05;
    const geo = new THREE.TorusGeometry(Math.min(r, D / 2) - 0.015, 0.015, 10, 32, arc);
    geo.rotateZ(Math.PI / 2 - arc / 2);
    geo.rotateX(-Math.PI / 2);
    c.mesh(geo, m.frame, [0, seatTop + 0.12, 0], undefined, false);
    for (const a of [Math.PI / 2 - arc / 2 + 0.15, Math.PI / 2 + arc / 2 - 0.15]) {
      const x = Math.cos(a) * (Math.min(r, D / 2) - 0.015);
      const z = -Math.sin(a) * (Math.min(r, D / 2) - 0.015);
      c.cyl(m.frame, 0.012, 0.012, 0.12, [x, seatTop + 0.06, z], 12);
    }
  }
}

function buildBench(c: Ctx) {
  const { W, D, H, m } = c;
  const upholstered = c.str('top') === 'upholstered';
  const legs = c.str('legs');
  const topT = upholstered ? 0.075 : 0.04;
  const frameTop = H - topT;

  if (upholstered) {
    c.box(m.frame, [W - 0.01, 0.04, D - 0.01], [0, frameTop - 0.02, 0], 0.006);
    c.box(m.surface, [W, topT, D], [0, H - topT / 2, 0], 0.03);
  } else {
    c.box(m.frame, [W, topT, D], [0, H - topT / 2, 0], 0.012);
  }
  const under = upholstered ? frameTop - 0.04 : frameTop;
  if (legs === 'slab') {
    for (const sx of [-1, 1]) c.box(m.frame, [0.045, under, D - 0.06], [sx * (W / 2 - 0.12), under / 2, 0], 0.006);
    c.box(m.frame, [W - 0.3, 0.07, 0.025], [0, under - 0.1, 0], 0.004);
  } else if (legs === 'four') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (W / 2 - 0.06);
      const z = sz * (D / 2 - 0.06);
      c.leg(m.frame, x, z, under, 0.05, 0.035);
      c.ferrule(x, z, 0.016);
    }
  } else {
    c.box(m.frame, [W - 0.12, under, D - 0.1], [0, under / 2, 0], 0.006);
  }
}

function buildOttoman(c: Ctx) {
  const { W, D, H, m } = c;
  const base = c.str('base');
  const baseH = base === 'legs' ? 0.09 : base === 'plinth' ? 0.045 : 0;
  const bodyH = H - baseH;
  const round = c.str('shape') === 'round';

  if (round) {
    c.mesh(roundCushionGeometry(W / 2, bodyH, Math.min(0.05, bodyH * 0.35)), m.surface, [0, baseH, 0]);
    if (base === 'plinth') c.cyl(m.frame, W / 2 - 0.05, W / 2 - 0.05, baseH, [0, baseH / 2, 0], 40);
    if (base === 'legs') {
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI * 2 * i) / 4 + Math.PI / 4;
        const x = Math.cos(a) * (W / 2 - 0.09);
        const z = Math.sin(a) * (W / 2 - 0.09);
        c.strut(m.frame, [x, baseH + 0.01, z], [x * 1.08, 0.012, z * 1.08], 0.022, 0.015);
        c.ferrule(x * 1.08, z * 1.08, 0.016);
      }
    }
  } else {
    c.box(m.surface, [W, bodyH, D], [0, baseH + bodyH / 2, 0], Math.min(0.06, bodyH * 0.4));
    if (base === 'plinth') c.box(m.frame, [W - 0.1, baseH, D - 0.1], [0, baseH / 2, 0], 0.005);
    if (base === 'legs') {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * (W / 2 - 0.07);
        const z = sz * (D / 2 - 0.07);
        c.leg(m.frame, x, z, baseH + 0.01, 0.045, 0.03);
        c.ferrule(x, z, 0.015);
      }
    }
  }
}

// ── Tables ─────────────────────────────────────────────────────────────────

const TABLE_TOP_MM: Record<string, number> = { coffee: 40, side: 32, desk: 35, console: 32 };
const TABLE_LEG_MM: Record<string, number> = { dining: 0.07, coffee: 0.05, side: 0.032, desk: 0.05, console: 0.042 };

function buildTable(c: Ctx, variant: string) {
  const { W, D, H, m } = c;
  const shape = (c.str('shape') || 'rect') as TopShape;
  const topT = (variant === 'dining' ? tableTopMm(c.str('thickness')) : TABLE_TOP_MM[variant] ?? 35) / 1000;
  const topY = H - topT;
  const legs = c.str('legs') || 'four';
  const ls = TABLE_LEG_MM[variant] ?? 0.05;
  const curved = shape === 'round' || shape === 'oval';

  c.slab(m.surface, topOutline(shape, W, D), topT, topY, 0, 0, Math.min(0.006, topT / 3));

  // Leg positions follow the outline.
  const legPts: [number, number][] = curved
    ? [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [sx * W * 0.29, sz * D * 0.29])
    : [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [sx * (W / 2 - ls / 2 - 0.05), sz * (D / 2 - ls / 2 - 0.05)]);

  const underTop = topY - 0.0;
  const shelfY = variant === 'coffee' ? H * 0.28 : variant === 'console' ? H * 0.3 : 0;

  if (legs === 'four') {
    for (const [x, z] of legPts) {
      c.leg(m.frame, x, z, underTop, ls, ls * 0.72);
      c.ferrule(x, z, ls * 0.36);
    }
    if (!curved && variant !== 'side') {
      const ah = variant === 'dining' ? 0.08 : 0.06;
      const ay = underTop - ah / 2;
      const xi = W / 2 - ls / 2 - 0.05;
      const zi = D / 2 - ls / 2 - 0.05;
      c.box(m.frame, [2 * xi - ls, ah, 0.02], [0, ay, zi]);
      c.box(m.frame, [2 * xi - ls, ah, 0.02], [0, ay, -zi]);
      c.box(m.frame, [0.02, ah, 2 * zi - ls], [xi, ay, 0]);
      c.box(m.frame, [0.02, ah, 2 * zi - ls], [-xi, ay, 0]);
    }
  } else if (legs === 'trestle' || legs === 'slab' || legs === 'panel') {
    const thick = legs === 'trestle' ? 0.08 : legs === 'slab' ? 0.04 : 0.032;
    const depthFrac = legs === 'trestle' ? 0.62 : 1;
    const dz = legs === 'panel' ? D - 0.06 : D * depthFrac * (legs === 'slab' ? 0.8 : 1);
    const x = legs === 'trestle' ? W / 2 - 0.3 : W / 2 - (legs === 'panel' ? 0.04 : 0.12);
    for (const sx of [-1, 1]) {
      c.box(m.frame, [thick, underTop, dz], [sx * x, underTop / 2, 0], 0.01);
    }
    if (legs === 'trestle') c.box(m.frame, [2 * x, 0.08, 0.06], [0, underTop - 0.12, 0], 0.006);
    if (legs === 'panel' && variant === 'desk') c.box(m.frame, [2 * x, 0.22, 0.02], [0, underTop - 0.12, -D / 2 + 0.06], 0.004);
  } else if (legs === 'pedestal') {
    const pedestal = (x: number, r: number, baseR: number) => {
      c.cyl(m.frame, baseR, baseR * 1.02, 0.04, [x, 0.02, 0], 40);
      c.cyl(m.frame, r, r * 1.15, underTop - 0.05, [x, 0.04 + (underTop - 0.05) / 2, 0], 36);
      c.cyl(m.frame, r * 1.7, r * 1.4, 0.03, [x, underTop - 0.015, 0], 36);
    };
    const r = variant === 'dining' ? 0.12 : variant === 'coffee' ? 0.07 : 0.045;
    if (variant === 'dining' && !curved && W > 1.7) {
      pedestal(-W * 0.24, r, Math.min(D * 0.34, 0.3));
      pedestal(W * 0.24, r, Math.min(D * 0.34, 0.3));
    } else {
      pedestal(0, r, Math.min(Math.min(W, D) * 0.34, variant === 'dining' ? 0.34 : 0.22));
    }
  } else if (legs === 'tripod') {
    const rr = Math.min(W, D) / 2;
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (Math.PI * 2 * i) / 3;
      const top: V3 = [Math.cos(a) * rr * 0.45, underTop, Math.sin(a) * rr * 0.45];
      const bot: V3 = [Math.cos(a) * rr * 0.78, 0, Math.sin(a) * rr * 0.78];
      c.strut(m.frame, top, bot, ls * 0.62, ls * 0.45);
      c.ferrule(bot[0], bot[2], ls * 0.5);
    }
  }

  if (c.flag('shelf') && shelfY > 0 && (legs === 'four' || legs === 'slab' || legs === 'panel')) {
    const sw = legs === 'four' ? W - 2 * (ls + 0.06) : W - 0.3;
    const sd = legs === 'four' ? D - 2 * (ls + 0.06) : D * 0.78;
    c.slab(m.frame, topOutline(shape === 'round' || shape === 'oval' ? shape : 'rect', Math.max(0.1, sw), Math.max(0.1, sd)), 0.024, shelfY, 0, 0, 0.004);
  }

  if (variant === 'dining' && !curved) {
    // Butterfly keys across the seam.
    for (const x of [-W * 0.26, 0, W * 0.26]) {
      c.box(m.accent, [0.11, 0.003, 0.034], [x, H + 0.0005, D * 0.08], 0.001, [0, 0.0, 0]);
    }
  }

  if (variant === 'desk') {
    const side = c.str('drawers');
    if (side === 'left' || side === 'right') {
      const sx = side === 'left' ? -1 : 1;
      const uw = 0.42;
      const ux = sx * (W / 2 - uw / 2 - 0.05);
      const uh = underTop - 0.06;
      c.box(m.frame, [uw, uh, D - 0.1], [ux, 0.06 + uh / 2, -0.02], 0.006);
      const rows = 3;
      const gh = (uh - 0.05) / rows;
      for (let i = 0; i < rows; i++) {
        const y = 0.06 + 0.025 + gh * (i + 0.5);
        c.box(m.surface, [uw - 0.03, gh - 0.008, 0.018], [ux, y, D / 2 - 0.059], 0.004);
        c.box(m.accent, [0.1, 0.012, 0.012], [ux, y, D / 2 - 0.035], 0.005);
      }
    }
    if (c.flag('cable')) c.cyl(m.accent, 0.03, 0.03, 0.002, [-W * 0.3, H + 0.0004, -D / 2 + 0.09], 24);
  }

  if (variant === 'console' && c.flag('drawer')) {
    const dw = Math.min(0.6, W - 0.4);
    c.box(m.surface, [dw, 0.1, 0.018], [0, underTop - 0.06, D / 2 - 0.06], 0.004);
    c.box(m.accent, [0.09, 0.011, 0.012], [0, underTop - 0.06, D / 2 - 0.035], 0.005);
  }
}

// ── Cabinets ───────────────────────────────────────────────────────────────

const LEG_H: Record<string, number> = { credenza: 0.16, media: 0.12, nightstand: 0.14, dresser: 0.16, wardrobe: 0.08 };

function buildCabinet(c: Ctx, variant: string) {
  const { W, D, H, m } = c;
  const handles = c.str('handles') || 'pull';
  const hp = handles === 'pull' ? 0.024 : handles === 'knob' ? 0.028 : 0;
  const Dc = D - hp;
  const zc = -D / 2 + Dc / 2;
  const zFront = -D / 2 + Dc - 0.009;
  const legsBase = variant !== 'wardrobe' && c.str('base') === 'legs';
  const legH = legsBase ? LEG_H[variant] ?? 0.14 : variant === 'wardrobe' ? 0.08 : 0.065;
  const topT = 0.028;
  const bodyTop = H - topT;
  const gap = 0.004;

  // base
  if (legsBase) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (W / 2 - 0.05);
      const z = zc + sz * (Dc / 2 - 0.05);
      c.leg(m.frame, x, z, legH, 0.048, 0.03);
      c.ferrule(x, z, 0.015);
    }
  } else {
    c.box(m.frame, [W - 0.05, legH, Dc - 0.04], [0, legH / 2, zc], 0.004);
  }

  // shell
  c.box(m.frame, [W, topT, Dc + 0.012], [0, H - topT / 2, zc + 0.006], 0.008);
  const shellH = bodyTop - legH;
  const sideT = 0.018;
  for (const sx of [-1, 1]) c.box(m.frame, [sideT, shellH, Dc - 0.012], [sx * (W / 2 - sideT / 2), legH + shellH / 2, zc - 0.006], 0.002);
  c.box(m.frame, [W - 0.01, shellH, 0.012], [0, legH + shellH / 2, -D / 2 + 0.006], 0.002);
  c.box(m.frame, [W - 0.01, 0.02, Dc - 0.016], [0, legH + 0.01, zc - 0.006], 0.002);

  const fx0 = -W / 2 + sideT;
  const fy0 = legH + 0.02;
  const fy1 = bodyTop - 0.002;
  const Wf = W - 2 * sideT;
  const Hf = fy1 - fy0;
  const fillD = Dc - 0.03;

  const fill = (x0: number, x1: number, y0: number, y1: number) => {
    if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
    c.box(m.frame, [x1 - x0, y1 - y0, fillD], [(x0 + x1) / 2, (y0 + y1) / 2, zc - 0.012], 0.002);
  };

  const style = c.str('front') || 'panel';
  const front = (cx: number, cy: number, w: number, h: number) => {
    const t = 0.018;
    const z = zFront;
    if (style === 'panel') {
      c.box(m.surface, [w, h, t], [cx, cy, z], 0.006);
    } else if (style === 'framed') {
      const r = Math.min(0.05, w * 0.2, h * 0.3);
      c.box(m.frame, [w, r, t], [cx, cy + h / 2 - r / 2, z], 0.004);
      c.box(m.frame, [w, r, t], [cx, cy - h / 2 + r / 2, z], 0.004);
      c.box(m.frame, [r, h - 2 * r, t], [cx - w / 2 + r / 2, cy, z], 0.004);
      c.box(m.frame, [r, h - 2 * r, t], [cx + w / 2 - r / 2, cy, z], 0.004);
      c.box(m.surface, [w - 2 * r + 0.006, h - 2 * r + 0.006, 0.008], [cx, cy, z - 0.004], 0.002);
    } else {
      c.box(m.frame, [w - 0.002, h - 0.002, 0.006], [cx, cy, z - 0.006], 0.002);
      const n = Math.max(3, Math.round(w / 0.034));
      const sw = (w / n) * 0.72;
      for (let i = 0; i < n; i++) {
        c.box(m.surface, [sw, h, t * 0.8], [cx - w / 2 + (w * (i + 0.5)) / n, cy, z], 0.004);
      }
    }
  };

  const handle = (cx: number, cy: number, orient: 'h' | 'v', w: number, h: number, edge = 0) => {
    if (handles === 'none') return;
    const z = zFront + 0.009;
    if (handles === 'knob') {
      const kx = edge === 0 ? cx : cx + edge * (w / 2 - 0.05);
      c.mesh(new THREE.SphereGeometry(0.0165, 18, 14), m.accent, [kx, cy, z + 0.012], undefined, false);
      return;
    }
    if (orient === 'h') {
      const len = Math.min(0.14, w * 0.45);
      c.cyl(m.accent, 0.006, 0.006, len, [cx, cy, z + 0.016], 12, [0, 0, Math.PI / 2]);
      for (const s of [-1, 1]) c.cyl(m.accent, 0.004, 0.004, 0.016, [cx + s * (len / 2 - 0.01), cy, z + 0.008], 8, [Math.PI / 2, 0, 0]);
    } else {
      const len = Math.min(variant === 'wardrobe' ? 0.34 : 0.16, h * 0.4);
      const hx = cx + edge * (w / 2 - 0.035);
      c.cyl(m.accent, 0.006, 0.006, len, [hx, cy, z + 0.016], 12);
      for (const s of [-1, 1]) c.cyl(m.accent, 0.004, 0.004, 0.016, [hx, cy + s * (len / 2 - 0.012), z + 0.008], 8, [Math.PI / 2, 0, 0]);
    }
  };

  const bays = (n: number, x0: number, width: number) => {
    const bw = (width - gap * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => ({ cx: x0 + bw * (i + 0.5) + gap * i, w: bw }));
  };

  const doorRow = (x0: number, width: number, n: number, y0: number, y1: number) => {
    const h = y1 - y0;
    bays(n, x0, width).forEach((b, i) => {
      front(b.cx, y0 + h / 2, b.w, h);
      // Pair doors so pulls meet in the middle of each pair.
      handle(b.cx, variant === 'wardrobe' ? y0 + h * 0.5 : y1 - h * 0.35, 'v', b.w, h, n === 1 ? 1 : i % 2 === 0 ? 1 : -1);
    });
  };

  const drawerStack = (x0: number, width: number, rows: number, cols: number, y0: number, y1: number) => {
    const rh = (y1 - y0 - gap * (rows - 1)) / rows;
    bays(cols, x0, width).forEach((b) => {
      for (let r = 0; r < rows; r++) {
        const cy = y0 + rh * (r + 0.5) + gap * r;
        front(b.cx, cy, b.w, rh);
        handle(b.cx, cy, 'h', b.w, rh);
      }
    });
  };

  if (variant === 'credenza') {
    fill(fx0, fx0 + Wf, fy0, fy1);
    const n = Math.max(2, cabinetBays(c.cfg.w, 500));
    const layout = c.str('layout');
    if (layout === 'drawers') {
      drawerStack(fx0, Wf, Hf > 0.42 ? 2 : 1, n, fy0, fy1);
    } else if (layout === 'mixed' && n >= 3) {
      const bayW = (Wf - gap * (n - 1)) / n;
      const left = Math.floor((n - 1) / 2);
      const right = n - 1 - left;
      if (left > 0) doorRow(fx0, left * bayW + gap * (left - 1), left, fy0, fy1);
      drawerStack(fx0 + left * (bayW + gap), bayW, Hf > 0.4 ? 3 : 2, 1, fy0, fy1);
      if (right > 0) doorRow(fx0 + (left + 1) * (bayW + gap), right * bayW + gap * (right - 1), right, fy0, fy1);
    } else {
      doorRow(fx0, Wf, n, fy0, fy1);
    }
  } else if (variant === 'media') {
    if (c.flag('openBay')) {
      const sideW = clamp(W * 0.28, 0.3, 0.7);
      fill(fx0, fx0 + sideW, fy0, fy1);
      fill(fx0 + Wf - sideW, fx0 + Wf, fy0, fy1);
      // Open bay: back panel shows, with a slim shelf.
      c.box(m.frame, [Wf - 2 * sideW, 0.018, Dc - 0.03], [0, fy0 + Hf * 0.5, zc - 0.012], 0.002);
      const n = sideW > 0.5 ? 2 : 1;
      doorRow(fx0, sideW, n, fy0, fy1);
      doorRow(fx0 + Wf - sideW, sideW, n, fy0, fy1);
    } else {
      fill(fx0, fx0 + Wf, fy0, fy1);
      doorRow(fx0, Wf, Math.max(2, cabinetBays(c.cfg.w, 550)), fy0, fy1);
    }
  } else if (variant === 'wardrobe') {
    fill(fx0, fx0 + Wf, fy0, fy1);
    doorRow(fx0, Wf, Math.max(2, cabinetBays(c.cfg.w, 550)), fy0, fy1);
  } else if (variant === 'nightstand') {
    const dr = Math.max(1, c.num('drawers'));
    const open = c.flag('openShelf');
    const lowerH = open ? Hf * 0.32 : 0;
    fill(fx0, fx0 + Wf, fy0 + lowerH, fy1);
    if (open) c.box(m.frame, [Wf, 0.018, Dc - 0.03], [0, fy0 + lowerH, zc - 0.012], 0.002);
    drawerStack(fx0, Wf, dr, 1, fy0 + lowerH + (open ? 0.012 : 0), fy1);
  } else if (variant === 'dresser') {
    fill(fx0, fx0 + Wf, fy0, fy1);
    drawerStack(fx0, Wf, Math.max(3, c.num('rows')), W > 1.3 ? 2 : 1, fy0, fy1);
  }

  if (variant === 'wardrobe') {
    // Crown moulding line for a finished top.
    c.box(m.frame, [W + 0.02, 0.03, Dc + 0.03], [0, H - 0.015, zc + 0.012], 0.006);
  }
}

// ── Shelving ───────────────────────────────────────────────────────────────

function buildShelf(c: Ctx) {
  const { W, D, H, m } = c;
  const t = 0.024;
  const plinthH = 0.06;
  const hasBase = c.flag('base');
  const baseH = hasBase ? 0.5 : 0;

  // plinth
  c.box(m.frame, [W - 0.04, plinthH, D - 0.04], [0, plinthH / 2, 0], 0.004);
  const y0 = plinthH;
  const bodyH = H - y0;

  for (const sx of [-1, 1]) c.box(m.frame, [t, bodyH, D], [sx * (W / 2 - t / 2), y0 + bodyH / 2, 0], 0.003);
  c.box(m.frame, [W, t, D], [0, H - t / 2, 0], 0.003);
  c.box(m.frame, [W - 2 * t, t, D], [0, y0 + t / 2, 0], 0.002);
  if (c.flag('back')) c.box(m.frame, [W - 2 * t, bodyH - 2 * t, 0.01], [0, y0 + bodyH / 2, -D / 2 + 0.005], 0.001);

  const shelfBottom = y0 + t + baseH;
  const shelfTop = H - t;
  const rows = shelfRows(c.cfg.h - (hasBase ? 500 : 0));
  const innerW = W - 2 * t;
  const dv = dividerCount(c.cfg.w);

  if (hasBase) {
    c.box(m.frame, [innerW, t, D - 0.01], [0, shelfBottom - t / 2, 0.0], 0.002);
    const n = Math.max(1, cabinetBays(c.cfg.w, 520));
    const bw = (innerW - 0.004 * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const cx = -innerW / 2 + bw * (i + 0.5) + 0.004 * i;
      const cy = y0 + t + baseH / 2;
      c.box(m.frame, [bw, baseH - 0.006, 0.018], [cx, cy, D / 2 - 0.009], 0.004);
      c.box(m.surface, [bw - 0.09, baseH - 0.096, 0.01], [cx, cy, D / 2 - 0.004], 0.002);
      c.cyl(m.accent, 0.005, 0.005, 0.12, [cx + (i % 2 === 0 ? 1 : -1) * (bw / 2 - 0.03), cy, D / 2 + 0.012], 10);
    }
  }

  const span = shelfTop - shelfBottom;
  for (let i = 1; i < rows; i++) {
    const y = shelfBottom + (span * i) / rows;
    c.box(m.frame, [innerW, t * 0.9, D - 0.012], [0, y, 0.004], 0.002);
  }
  for (let i = 1; i <= dv; i++) {
    const x = -innerW / 2 + (innerW * i) / (dv + 1);
    c.box(m.frame, [t * 0.9, span, D - 0.012], [x, shelfBottom + span / 2, 0.004], 0.002);
  }
}

// ── Beds ───────────────────────────────────────────────────────────────────

function buildBed(c: Ctx) {
  const { W, D, H, m } = c;
  const hbT = 0.1;
  const platform = c.str('frame') !== 'legs';
  const legH = platform ? 0.06 : 0.2;
  const railH = platform ? 0.2 : 0.1;
  const frameTop = legH + railH;
  const mW = W - (BED_SIDE_MM * 2) / 1000;
  const mL = D - BED_HEADBOARD_MM / 1000;
  const mT = 0.24;

  const bodyD = D - hbT;
  const bodyZ = D / 2 - bodyD / 2;
  if (platform) {
    c.box(m.frame, [W - 0.04, railH, bodyD - 0.04], [0, legH + railH / 2, bodyZ], 0.01);
    c.box(m.frame, [W - 0.1, legH, bodyD - 0.1], [0, legH / 2, bodyZ], 0.004);
  } else {
    for (const sx of [-1, 1]) c.box(m.frame, [0.05, railH, bodyD], [sx * (W / 2 - 0.025), legH + railH / 2, bodyZ], 0.008);
    c.box(m.frame, [W - 0.1, railH, 0.05], [0, legH + railH / 2, D / 2 - 0.025], 0.008);
    c.box(m.frame, [W - 0.1, 0.03, bodyD - 0.04], [0, frameTop - 0.015, bodyZ], 0.002);
    for (const sx of [-1, 1]) for (const z of [D / 2 - 0.06, -D / 2 + hbT + 0.06]) {
      c.leg(m.frame, sx * (W / 2 - 0.05), z, legH, 0.07, 0.045);
      c.ferrule(sx * (W / 2 - 0.05), z, 0.022);
    }
  }

  // headboard
  const hbZ = -D / 2 + hbT / 2;
  const hbBottom = 0.08;
  const hb = c.str('headboard');
  c.box(m.frame, [W, 0.05, hbT], [0, H - 0.025, hbZ], 0.008);
  if (hb === 'channel') {
    c.box(m.frame, [W - 0.04, H - hbBottom - 0.05, 0.03], [0, hbBottom + (H - hbBottom - 0.05) / 2, hbZ - 0.02], 0.003);
    const n = Math.max(4, Math.round(W / 0.24));
    const ph = H - hbBottom - 0.08;
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + 0.04 + ((W - 0.08) * (i + 0.5)) / n;
      c.box(m.surface, [(W - 0.08) / n - 0.012, ph, 0.07], [x, hbBottom + 0.01 + ph / 2, hbZ + 0.0], 0.03);
    }
  } else if (hb === 'slatted') {
    for (const sx of [-1, 1]) c.box(m.frame, [0.06, H - hbBottom, hbT], [sx * (W / 2 - 0.03), hbBottom + (H - hbBottom) / 2, hbZ], 0.006);
    const n = Math.max(6, Math.round(W / 0.09));
    const inner = W - 0.12;
    for (let i = 0; i < n; i++) {
      const x = -inner / 2 + (inner * (i + 0.5)) / n;
      c.box(m.frame, [inner / n - 0.028, H - hbBottom - 0.07, 0.04], [x, hbBottom + (H - hbBottom - 0.07) / 2 + 0.0, hbZ], 0.006);
    }
  } else {
    c.box(m.frame, [W - 0.04, H - hbBottom - 0.05, 0.03], [0, hbBottom + (H - hbBottom - 0.05) / 2, hbZ - 0.02], 0.003);
    c.box(m.surface, [W - 0.1, H - hbBottom - 0.1, 0.075], [0, hbBottom + 0.01 + (H - hbBottom - 0.1) / 2, hbZ + 0.0], 0.04);
  }

  // mattress & dressing
  const mz = -D / 2 + hbT + mL / 2 + 0.005;
  c.box(m.neutral, [mW, mT, mL], [0, frameTop + mT / 2, mz], 0.05);
  const mTop = frameTop + mT;
  const pillowW = Math.min(0.62, mW / 2 - 0.08);
  const pillows = mW > 1.15 ? 2 : 1;
  for (let i = 0; i < pillows; i++) {
    const x = pillows === 1 ? 0 : (i === 0 ? -1 : 1) * (mW / 4);
    const p = c.mesh(pillowGeometry(pillowW, 0.13, 0.4), m.neutral, [x, mTop + 0.0, -D / 2 + hbT + 0.28], [-0.1, 0, 0]);
    p.position.y = mTop;
  }
  const dl = mL * 0.62;
  const duvet = c.mesh(duvetGeometry(mW + 0.04, 0.07, dl), m.neutral, [0, mTop, mz + mL / 2 - dl / 2 + 0.01]);
  duvet.position.y = mTop - 0.005;
  // Throw folded across the duvet, resting on top of it.
  const throwL = 0.42;
  c.box(m.accent, [mW + 0.04, 0.022, throwL], [0, mTop + 0.088, mz + mL / 2 - dl * 0.42], 0.01);
}

function buildDaybed(c: Ctx) {
  const { W, D, H, m } = c;
  const deck = H * 0.7;
  const matT = 0.13;
  const railTop = deck - matT;
  const post = 0.06;
  const plinth = c.str('base') === 'plinth';
  const px = W / 2 - post / 2;
  const pz = D / 2 - post / 2;

  if (plinth) {
    c.box(m.frame, [W, railTop, D], [0, railTop / 2, 0], 0.01);
  } else {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const isBack = sz < 0;
      const h = isBack && c.flag('backrail') ? H : railTop;
      c.box(m.frame, [post, h, post], [sx * px, h / 2, sz * pz], 0.01);
      c.ferrule(sx * px, sz * pz, 0.022);
    }
    const rh = 0.1;
    const ry = railTop - rh / 2;
    for (const sz of [-1, 1]) c.box(m.frame, [W - 2 * post, rh, 0.04], [0, ry, sz * (D / 2 - 0.02)], 0.006);
    for (const sx of [-1, 1]) c.box(m.frame, [0.04, rh, D - 2 * post], [sx * (W / 2 - 0.02), ry, 0], 0.006);
    const slats = Math.max(8, Math.round(W / 0.12));
    for (let i = 0; i < slats; i++) {
      const x = -W / 2 + post + ((W - 2 * post) * (i + 0.5)) / slats;
      c.box(m.frame, [0.05, 0.02, D - 0.1], [x, railTop - 0.012, 0], 0.003);
    }
  }
  c.box(m.surface, [W - 0.05, matT, D - 0.05], [0, railTop + matT / 2, 0], 0.045);

  if (c.flag('backrail')) {
    const top = H;
    const bz = -pz;
    c.box(m.frame, [W - 2 * post, 0.07, 0.04], [0, top - 0.035, bz], 0.008);
    const slatsH = top - 0.07 - railTop;
    const n = Math.max(6, Math.round(W / 0.14));
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + post + ((W - 2 * post) * (i + 0.5)) / n;
      c.box(m.frame, [0.03, slatsH, 0.03], [x, railTop + slatsH / 2, bz], 0.005);
    }
  }

  const bolsters = c.num('bolsters');
  const br = clamp(H * 0.15, 0.06, 0.095);
  const bl = Math.min(D - 0.16, 0.8);
  const by = railTop + matT + br;
  const makeBolster = (x: number, z: number, alongZ: boolean) =>
    c.mesh(
      new THREE.CylinderGeometry(br, br, bl, 28, 1),
      m.surface,
      [x, by, z],
      alongZ ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2],
    );
  if (bolsters >= 1) makeBolster(W / 2 - 0.15, 0.02, true);
  if (bolsters >= 2) makeBolster(-W / 2 + 0.15, 0.02, true);
  if (bolsters >= 3) makeBolster(0, -D / 2 + 0.18, false);
}

// ── Entry point ────────────────────────────────────────────────────────────

export function buildFurniture(p: Product, cfg: Config, mats: Mats): THREE.Group {
  const c = new Ctx(cfg, mats);
  switch (p.kind) {
    case 'lounge': buildLounge(c); break;
    case 'diningChair': buildDiningChair(c); break;
    case 'sofa': buildSofa(c); break;
    case 'stool': buildStool(c); break;
    case 'bench': buildBench(c); break;
    case 'ottoman': buildOttoman(c); break;
    case 'table': buildTable(c, p.variant ?? 'dining'); break;
    case 'cabinet': buildCabinet(c, p.variant ?? 'credenza'); break;
    case 'shelf': buildShelf(c); break;
    case 'bed': buildBed(c); break;
    case 'daybed': buildDaybed(c); break;
  }
  return c.g;
}

export function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !mesh.geometry.userData.cached) mesh.geometry.dispose();
  });
}
