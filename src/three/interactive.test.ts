import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { defaultConfig } from '../data/config';
import { getProduct } from '../data/products';
import type { PartKind } from '../three/interactive';
import { Interaction, hasInteractiveParts } from '../three/interactive';
import { buildFurniture, clearGeometryCache, disposeGroup, type Mats } from '../three/builders';

function mats(): Mats {
  const m = () => new THREE.MeshBasicMaterial();
  return { frame: m(), surface: m(), accent: m(), neutral: m(), inside: m() };
}

function piece(id: string) {
  const p = getProduct(id)!;
  const group = buildFurniture(p, defaultConfig(p), mats());
  return { p, group };
}

test('cabinet doors are tagged and can be opened', () => {
  const { group } = piece('credenza');
  const camera = new THREE.PerspectiveCamera();
  const ix = new Interaction(camera);
  ix.refresh(group);

  const doors = ix.parts.filter((p) => p.spec.kind === 'door');
  assert.ok(doors.length >= 2, 'a credenza has at least two doors');
  assert.ok(hasInteractiveParts(group));

  const door = doors[0];
  const closedY = door.object.rotation.y;
  ix.toggle(door);
  assert.equal(door.target, 1);
  for (let i = 0; i < 40; i++) ix.update(1 / 60);
  assert.ok(Math.abs(door.object.rotation.y - closedY) > 1, 'the door swung open');
  assert.ok(Math.abs(door.current - 1) < 0.02);

  ix.reset();
  for (let i = 0; i < 40; i++) ix.update(1 / 60);
  assert.ok(Math.abs(door.object.rotation.y - closedY) < 0.02, 'the door closes again');
  disposeGroup(group);
  clearGeometryCache();
});

test('drawers slide out and return', () => {
  const { group } = piece('dresser');
  const ix = new Interaction(new THREE.PerspectiveCamera());
  ix.refresh(group);
  const drawers = ix.parts.filter((p) => p.spec.kind === 'drawer');
  assert.ok(drawers.length >= 3, 'a dresser has several drawers');

  const d = drawers[0];
  const z = d.object.position.z;
  ix.toggle(d);
  for (let i = 0; i < 40; i++) ix.update(1 / 60);
  assert.ok(d.object.position.z > z + 0.1, 'the drawer pulled out');

  ix.reset();
  for (let i = 0; i < 40; i++) ix.update(1 / 60);
  assert.ok(Math.abs(d.object.position.z - z) < 0.01, 'the drawer slid back');
  disposeGroup(group);
  clearGeometryCache();
});

test('beds have liftable pillows and a duvet', () => {
  const { group } = piece('bed');
  const ix = new Interaction(new THREE.PerspectiveCamera());
  ix.refresh(group);
  const kinds = new Set<PartKind>(ix.parts.map((p) => p.spec.kind));
  assert.ok(kinds.has('pillow'), 'bed has pillows');
  assert.ok(kinds.has('duvet'), 'bed has a duvet');

  const pillow = ix.parts.find((p) => p.spec.kind === 'pillow')!;
  const y = pillow.object.position.y;
  ix.toggle(pillow);
  for (let i = 0; i < 40; i++) ix.update(1 / 60);
  assert.ok(pillow.object.position.y > y + 0.1, 'the pillow lifted');
  disposeGroup(group);
  clearGeometryCache();
});

test('every tagged part rests at its original transform', () => {
  for (const id of ['sofa', 'armchair', 'bed', 'daybed', 'credenza', 'bookshelf']) {
    const { group } = piece(id);
    group.updateMatrixWorld(true);
    const start = new Map<string, string>();
    group.traverse((o) => {
      if (o.userData.interactive) start.set(o.uuid, `${o.position.toArray()}|${o.rotation.toArray()}`);
    });
    const ix = new Interaction(new THREE.PerspectiveCamera());
    ix.refresh(group);
    assert.equal(ix.parts.length, start.size);
    for (const p of ix.parts) {
      assert.equal(`${p.pos.toArray()}|${p.rot.toArray()}`, start.get(p.object.uuid));
      assert.equal(p.target, 0);
    }
    disposeGroup(group);
  }
  clearGeometryCache();
});
