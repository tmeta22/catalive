import * as THREE from 'three';

/** Offset of the measuring lines from the piece. */
function offset(size: THREE.Vector3): number {
  return Math.max(0.12, Math.max(size.x, size.z) * 0.06);
}

/** Three measuring lines (width, depth, height) around a piece standing on y = 0. */
export function buildGuides(size: THREE.Vector3, color = 0x2b3a87): THREE.Group {
  const { x: W, y: H, z: D } = size;
  const off = offset(size);
  const t = Math.min(0.03, Math.max(W, D, H) * 0.03);
  const pts: number[] = [];
  const seg = (a: number[], b: number[]) => pts.push(...a, ...b);

  const wz = D / 2 + off;
  seg([-W / 2, 0, wz], [W / 2, 0, wz]);
  seg([-W / 2, 0, wz - t], [-W / 2, 0, wz + t]);
  seg([W / 2, 0, wz - t], [W / 2, 0, wz + t]);

  const dx = W / 2 + off;
  seg([dx, 0, -D / 2], [dx, 0, D / 2]);
  seg([dx - t, 0, -D / 2], [dx + t, 0, -D / 2]);
  seg([dx - t, 0, D / 2], [dx + t, 0, D / 2]);

  const hx = -W / 2 - off;
  seg([hx, 0, wz], [hx, H, wz]);
  seg([hx - t, 0, wz], [hx + t, 0, wz]);
  seg([hx - t, H, wz], [hx + t, H, wz]);

  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
  line.renderOrder = 20;
  const g = new THREE.Group();
  g.add(line);
  return g;
}

/** A thin bounding box around the piece, like a CAD envelope. */
export function buildCage(size: THREE.Vector3, color = 0x2b3a87): THREE.LineSegments {
  const box = new THREE.BoxGeometry(size.x, size.y, size.z);
  const edges = new THREE.EdgesGeometry(box);
  box.dispose();
  edges.translate(0, size.y / 2, 0);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, depthTest: false }));
  line.renderOrder = 19;
  return line;
}

/** World-space anchors (relative to the piece) for the three labels. */
export function guideAnchors(size: THREE.Vector3): { w: THREE.Vector3; d: THREE.Vector3; h: THREE.Vector3 } {
  const { x: W, y: H, z: D } = size;
  const off = offset(size);
  return {
    w: new THREE.Vector3(0, 0, D / 2 + off),
    d: new THREE.Vector3(W / 2 + off, 0, 0),
    h: new THREE.Vector3(-W / 2 - off, H / 2, D / 2 + off),
  };
}

export function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
