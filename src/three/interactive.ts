import * as THREE from 'three';
import type { StrKey } from '../i18n/strings';

/** Translation key for each kind of movable part. */
export function partLabelKey(kind: PartKind): StrKey {
  switch (kind) {
    case 'door': return 'partDoor';
    case 'drawer': return 'partDrawer';
    case 'pillow': return 'partPillow';
    case 'cushion': return 'partCushion';
    case 'bolster': return 'partBolster';
    case 'duvet': return 'partDuvet';
  }
}

/**
 * Small, honest interactions with the piece: open a door, pull a drawer,
 * lift a pillow. Builders tag the relevant meshes while they assemble the
 * furniture; this module animates and picks them.
 */

export type PartKind = 'door' | 'drawer' | 'pillow' | 'cushion' | 'bolster' | 'duvet';

export interface PartSpec {
  kind: PartKind;
  /** Offset from the resting position when fully open, in the part's parent. */
  move?: [number, number, number];
  /** Rotation from the resting angle when fully open, in radians. */
  spin?: [number, number, number];
}

interface TaggedUserData {
  interactive?: {
    spec: PartSpec;
    pos: THREE.Vector3;
    rot: THREE.Euler;
  };
}

/** Mark an object as movable and remember where it rests. */
export function tagInteractive(object: THREE.Object3D, spec: PartSpec): void {
  (object.userData as TaggedUserData).interactive = {
    spec,
    pos: object.position.clone(),
    rot: object.rotation.clone(),
  };
}

/** True when the product has at least one thing the customer can try. */
export function hasInteractiveParts(root: THREE.Object3D | null): boolean {
  if (!root) return false;
  let found = false;
  root.traverse((o) => {
    if ((o.userData as TaggedUserData).interactive) found = true;
  });
  return found;
}

export interface Part {
  object: THREE.Object3D;
  spec: PartSpec;
  pos: THREE.Vector3;
  rot: THREE.Euler;
  /** How open it is right now (0 = closed, 1 = open). */
  current: number;
  target: number;
}

const SPEED = 7;

/** Collects and animates the movable parts of one built piece. */
export class Interaction {
  readonly parts: Part[] = [];

  constructor(private readonly camera: THREE.Camera) {}

  /** Re-read the live scene after the piece was rebuilt. */
  refresh(root: THREE.Object3D | null): void {
    this.parts.length = 0;
    root?.traverse((o) => {
      const tag = (o.userData as TaggedUserData).interactive;
      if (!tag) return;
      this.parts.push({
        object: o,
        spec: tag.spec,
        pos: tag.pos,
        rot: tag.rot,
        current: 0,
        target: 0,
      });
    });
  }

  get active(): boolean {
    return this.parts.some((p) => p.target > 0);
  }

  /** Open a closed part, close an open one. Returns the part that changed. */
  toggle(part: Part): Part {
    part.target = part.target > 0 ? 0 : 1;
    return part;
  }

  /** Put every part back. */
  reset(): void {
    for (const p of this.parts) p.target = 0;
  }

  /**
   * Ease every part towards its target. Returns true while anything is still
   * moving, so the caller knows whether another frame needs rendering.
   */
  update(dt: number): boolean {
    let moving = false;
    const k = 1 - Math.exp(-SPEED * Math.min(dt, 0.1));
    for (const p of this.parts) {
      if (Math.abs(p.target - p.current) > 0.001) {
        p.current += (p.target - p.current) * k;
        moving = true;
      } else if (p.current !== p.target) {
        p.current = p.target;
        moving = true;
      } else {
        continue;
      }
      const [dx = 0, dy = 0, dz = 0] = p.spec.move ?? [];
      const [rx = 0, ry = 0, rz = 0] = p.spec.spin ?? [];
      p.object.position.set(p.pos.x + dx * p.current, p.pos.y + dy * p.current, p.pos.z + dz * p.current);
      p.object.rotation.set(p.rot.x + rx * p.current, p.rot.y + ry * p.current, p.rot.z + rz * p.current);
    }
    return moving;
  }

  /**
   * Hover feedback and click-to-move on a canvas. Ignoring clicks that follow
   * a drag keeps orbiting the camera from opening doors by accident.
   */
  bind(canvas: HTMLCanvasElement, onPick: (part: Part) => void): () => void {
    let down: { x: number; y: number } | null = null;
    const rect = () => canvas.getBoundingClientRect();
    const move = (e: PointerEvent) => {
      canvas.style.cursor = this.pick(e.clientX, e.clientY, rect()) ? 'pointer' : '';
    };
    const press = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const release = (e: PointerEvent) => {
      if (!down) return;
      const travelled = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (travelled > 6) return;
      const part = this.pick(e.clientX, e.clientY, rect());
      if (part) onPick(part);
    };
    const leave = () => {
      canvas.style.cursor = '';
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', press);
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointerleave', leave);
    return () => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerdown', press);
      canvas.removeEventListener('pointerup', release);
      canvas.removeEventListener('pointerleave', leave);
      canvas.style.cursor = '';
    };
  }

  /** Find the tagged part under a pointer position in CSS pixels. */
  pick(clientX: number, clientY: number, rect: DOMRect): Part | null {
    if (!this.parts.length) return null;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const objects = this.parts.map((p) => p.object);
    const hits = ray.intersectObjects(objects, true);
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o) {
        const part = this.parts.find((p) => p.object === o);
        if (part) return part;
        o = o.parent;
      }
    }
    return null;
  }
}
