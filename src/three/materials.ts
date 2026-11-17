import * as THREE from 'three';
import type { Material, SlotRole } from '../data/types';
import type { Mats } from './builders';
import {
  createBoucleTextures,
  createFabricWeaveTexture,
  createLeatherTextures,
  createRattanCaneTextures,
  createWalnutTextures,
  type PBRTextureSet,
} from './textures';

interface TexSet {
  map?: THREE.Texture;
  bumpMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  /** Metres per texture tile. */
  tile: number;
  bumpScale: number;
}

const ANISO = 8;
const cache = new Map<string, TexSet>();

function fromPBR(set: PBRTextureSet, tile: number, bumpScale: number, wrap: THREE.Wrapping = THREE.RepeatWrapping): TexSet {
  for (const t of [set.map, set.bumpMap, set.roughnessMap]) {
    t.wrapS = t.wrapT = wrap;
    t.repeat.set(1, 1);
  }
  return { map: set.map, bumpMap: set.bumpMap, roughnessMap: set.roughnessMap, tile, bumpScale };
}

/** A soft grey veined stone texture, tinted by the material colour. */
function stoneTextures(): TexSet {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const noise = (x: number, y: number, s: number) => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453;
    return n - Math.floor(n);
  };
  const smooth = (x: number, y: number, s: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = noise(xi, yi, s);
    const b = noise(xi + 1, yi, s);
    const c = noise(xi, yi + 1, s);
    const d = noise(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const cloud = smooth(nx * 6, ny * 6, 3) * 0.6 + smooth(nx * 14, ny * 14, 7) * 0.4;
      const vein = Math.abs(Math.sin((nx * 3 + ny * 2 + smooth(nx * 4, ny * 4, 11) * 2.2) * Math.PI * 2));
      const v = 1 - Math.pow(1 - vein, 14) * 0.5;
      const val = Math.round(220 + (cloud - 0.5) * 36 - (1 - v) * 70);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(120, Math.min(255, val));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.MirroredRepeatWrapping;
  map.anisotropy = ANISO;
  return { map, tile: 0.9, bumpScale: 0 };
}

function weave(): TexSet {
  const w = createFabricWeaveTexture([236, 232, 224], 34, 1, ANISO);
  for (const t of [w.map, w.bumpMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 1);
  }
  return { map: w.map, bumpMap: w.bumpMap, tile: 0.09, bumpScale: 0.35 };
}

/** Flatten a canvas texture toward its mean so tinted light timbers read as calm grain. */
function soften(tex: THREE.Texture, keep: number, lift = 0): void {
  const canvas = tex.image as HTMLCanvasElement | undefined;
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
  const mean = sum / (d.length / 4) / 3;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = mean + (d[i + c] - mean) * keep + lift;
      d[i + c] = Math.max(0, Math.min(255, v));
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.needsUpdate = true;
}

function texturesFor(kind: Material['kind']): TexSet | null {
  if (kind === 'metal' || kind === 'paint') return null;
  const hit = cache.get(kind);
  if (hit) return hit;
  let set: TexSet;
  switch (kind) {
    case 'timber': {
      set = fromPBR(createWalnutTextures('tintable', ANISO), 1.0, 0.01, THREE.MirroredRepeatWrapping);
      if (set.map) soften(set.map, 0.34, 34);
      break;
    }
    case 'leather': set = fromPBR(createLeatherTextures(ANISO), 0.22, 0.016); break;
    case 'boucle': set = fromPBR(createBoucleTextures(ANISO), 0.26, 0.02); break;
    case 'cane': set = fromPBR(createRattanCaneTextures(ANISO), 0.15, 0.02); break;
    case 'stone': set = stoneTextures(); break;
    default: set = weave();
  }
  cache.set(kind, set);
  return set;
}

function makeMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color: '#cccccc', roughness: 0.6, metalness: 0 });
}

/** Apply a library material to a live three.js material in place. */
export function applyLibraryMaterial(target: THREE.MeshPhysicalMaterial, mat: Material): void {
  const tex = texturesFor(mat.kind);
  target.color.set(mat.hex);
  target.roughness = mat.roughness;
  target.metalness = mat.kind === 'metal' ? 0.92 : 0.02;
  target.clearcoat = mat.kind === 'leather' ? 0.14 : mat.kind === 'paint' ? 0.18 : mat.kind === 'stone' && mat.roughness < 0.4 ? 0.5 : 0;
  target.clearcoatRoughness = 0.45;
  // Sheen is tinted by the cloth itself, so dark silks stay dark instead of washing out.
  target.sheen = mat.kind === 'fabric' && mat.roughness < 0.7 ? 0.55 : mat.kind === 'boucle' ? 0.35 : 0;
  target.sheenRoughness = 0.55;
  target.sheenColor.set(mat.hex).lerp(new THREE.Color('#ffffff'), 0.22);
  target.map = tex?.map ?? null;
  target.bumpMap = tex?.bumpMap ?? null;
  target.bumpScale = tex?.bumpScale ?? 0;
  // Only timber, leather, bouclé and cane carry a baked roughness map.
  target.roughnessMap = tex?.roughnessMap && mat.kind !== 'fabric' ? tex.roughnessMap : null;
  target.userData.tile = tex?.tile ?? 0.5;
  target.needsUpdate = true;
}

export class MaterialSet {
  readonly mats: Mats;
  private readonly slots: Record<SlotRole, THREE.MeshPhysicalMaterial>;

  constructor() {
    const frame = makeMaterial();
    const surface = makeMaterial();
    const accent = makeMaterial();
    const neutral = makeMaterial();
    // A dark, matte lining for the inside of cabinets and shelves.
    const inside = makeMaterial();
    inside.color.set('#3a2c21');
    inside.roughness = 0.92;

    this.slots = { frame, surface, accent };
    this.mats = { frame, surface, accent, neutral, inside };
    applyLibraryMaterial(neutral, {
      id: 'neutral',
      kind: 'fabric',
      name: { km: '', en: '' },
      note: { km: '', en: '' },
      hex: '#F4F0E8',
      roughness: 0.9,
      tier: 0,
    });
  }

  set(role: SlotRole, mat: Material): void {
    applyLibraryMaterial(this.slots[role], mat);
  }

  dispose(): void {
    for (const m of Object.values(this.mats)) m.dispose();
  }
}
