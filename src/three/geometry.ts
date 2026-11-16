import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Metres of surface covered by one texture tile. Overridable per material. */
export const DEFAULT_TILE = 0.5;

export function tileOf(mat: THREE.Material): number {
  return (mat.userData?.tile as number | undefined) ?? DEFAULT_TILE;
}

/**
 * Box-project UVs in real-world metres so grain and weave keep a constant
 * scale however the piece is resized. The long in-plane axis becomes "v",
 * which is the direction wood grain runs in the texture.
 */
export function projectUV(geo: THREE.BufferGeometry, tile: number): void {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  if (!pos || !nor) return;
  geo.computeBoundingBox();
  const size = new THREE.Vector3();
  geo.boundingBox!.getSize(size);
  const uv = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let a: number;
    let b: number;
    let sa: number;
    let sb: number;
    if (ax >= ay && ax >= az) {
      a = z; b = y; sa = size.z; sb = size.y;
    } else if (ay >= az) {
      a = x; b = z; sa = size.x; sb = size.z;
    } else {
      a = x; b = y; sa = size.x; sb = size.y;
    }
    // Put the longer in-plane dimension on v (grain direction).
    const [u, v] = sb >= sa ? [a, b] : [b, a];
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export function roundedBox(
  w: number,
  h: number,
  d: number,
  radius = 0.004,
): THREE.BufferGeometry {
  const r = Math.min(radius, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5);
  if (r < 0.0015) return new THREE.BoxGeometry(w, h, d);
  return new RoundedBoxGeometry(w, h, d, r > 0.012 ? 3 : 2, r);
}

export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  const rad = Math.max(0.0001, Math.min(r, hw, hh));
  s.moveTo(-hw + rad, -hh);
  s.lineTo(hw - rad, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  s.lineTo(hw, hh - rad);
  s.quadraticCurveTo(hw, hh, hw - rad, hh);
  s.lineTo(-hw + rad, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - rad);
  s.lineTo(-hw, -hh + rad);
  s.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  return s;
}

export type TopShape = 'rect' | 'soft' | 'oval' | 'round';

export function topOutline(shape: TopShape, w: number, d: number): THREE.Shape {
  if (shape === 'round' || shape === 'oval') {
    const s = new THREE.Shape();
    s.absellipse(0, 0, w / 2, d / 2, 0, Math.PI * 2, false, 0);
    return s;
  }
  const r = shape === 'soft' ? Math.min(0.2, Math.min(w, d) * 0.2) : 0.01;
  return roundedRectShape(w, d, r);
}

/** A flat slab from a 2D outline, lying in XZ with its underside at y = 0. */
export function slabGeometry(outline: THREE.Shape, thickness: number, bevel = 0.004): THREE.BufferGeometry {
  const b = Math.min(bevel, thickness / 3);
  const geo = new THREE.ExtrudeGeometry(outline, {
    depth: Math.max(0.002, thickness - b * 2),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 28,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, b, 0);
  geo.computeVertexNormals();
  return geo;
}

/** Cylinder-like strut between two points with independent end radii. */
export function strutGeometry(
  a: THREE.Vector3,
  b: THREE.Vector3,
  rA: number,
  rB: number,
  segments = 12,
): { geo: THREE.BufferGeometry; position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(rB, rA, len, segments, 1);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const position = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  return { geo, position, quaternion };
}

/** A plump pillow: a subdivided box pushed up in the middle. */
export function pillowGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d, 16, 6, 16);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = x / (w / 2);
    const nz = z / (d / 2);
    const falloff = Math.max(0.14, 1 - 0.56 * (nx * nx * 0.65 + nz * nz * 0.65));
    const puff = Math.cos(nx * Math.PI * 0.45) * Math.cos(nz * Math.PI * 0.45);
    pos.setY(i, y * falloff + (y > 0 ? puff * h * 0.24 : 0) + h * 0.5);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A duvet with soft ripples and drooping edges. */
export function duvetGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d, 26, 4, 26);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = x / (w / 2);
    const nz = z / (d / 2);
    const ripple = Math.sin(nx * 5.2 + nz * 2.4) * 0.009 + Math.cos(nz * 6.5 - nx * 1.8) * 0.006;
    const droop = Math.pow(Math.abs(nx), 4.5) * 0.05 + Math.pow(Math.max(0, nz), 4.5) * 0.03;
    pos.setY(i, y + h * 0.5 + (y > 0 ? ripple : 0) - droop);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Lathe profile for a plump round cushion, base at y = 0. */
export function roundCushionGeometry(radius: number, height: number, edge = 0.035): THREE.BufferGeometry {
  const e = Math.min(edge, radius * 0.5, height * 0.5);
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0001, 0)];
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= 6; i++) {
      const t = a0 + ((a1 - a0) * i) / 6;
      pts.push(new THREE.Vector2(cx + Math.cos(t) * e, cy + Math.sin(t) * e));
    }
  };
  arc(radius - e, e, -Math.PI / 2, 0);
  arc(radius - e, height - e, 0, Math.PI / 2);
  pts.push(new THREE.Vector2(0.0001, height));
  const geo = new THREE.LatheGeometry(pts, 48);
  geo.computeVertexNormals();
  return geo;
}
