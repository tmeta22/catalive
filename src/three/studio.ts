import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { getMaterial } from '../data/materials';
import type { Config, Product, SlotRole } from '../data/types';
import { buildFurniture, disposeGroup } from './builders';
import { MaterialSet } from './materials';

export type ViewName = 'three' | 'front' | 'side' | 'top';

export interface ViewPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const VIEW_DIRS: Record<ViewName, THREE.Vector3> = {
  three: new THREE.Vector3(0.78, 0.5, 1.0).normalize(),
  front: new THREE.Vector3(0, 0.1, 1).normalize(),
  side: new THREE.Vector3(1, 0.1, 0).normalize(),
  top: new THREE.Vector3(0.0001, 1, 0.0012).normalize(),
};

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function contactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, 'rgba(40,30,22,0.55)');
  g.addColorStop(0.5, 'rgba(40,30,22,0.22)');
  g.addColorStop(1, 'rgba(40,30,22,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface StudioOptions {
  alpha?: boolean;
  shadowMapSize?: number;
}

export class Studio {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
  readonly materials = new MaterialSet();

  /** Overall size of the current piece, in metres. */
  readonly size = new THREE.Vector3(1, 1, 1);

  private furniture: THREE.Group | null = null;
  private readonly key: THREE.DirectionalLight;
  private readonly ground: THREE.Mesh;
  private readonly blob: THREE.Mesh;
  private readonly blobTex = contactShadowTexture();
  private guides: THREE.Group | null = null;
  private pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget;

  constructor(canvas: HTMLCanvasElement, opts: StudioOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: opts.alpha ?? true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.7;

    this.key = new THREE.DirectionalLight(0xfff4e4, 2.6);
    this.key.castShadow = true;
    const ms = opts.shadowMapSize ?? 2048;
    this.key.shadow.mapSize.set(ms, ms);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.radius = 5;
    this.scene.add(this.key, this.key.target);

    const fill = new THREE.DirectionalLight(0xe6eeff, 0.7);
    fill.position.set(-3, 2, -2);
    this.scene.add(fill);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2),
      new THREE.ShadowMaterial({ color: 0x2a2018, opacity: 0.17 }),
    );
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false, opacity: 0.9 }),
    );
    this.blob.position.y = 0.0015;
    this.scene.add(this.blob);
  }

  resize(width: number, height: number, dpr = Math.min(window.devicePixelRatio || 1, 2)): void {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** Rebuild the piece from a configuration and apply its materials. */
  setProduct(p: Product, cfg: Config): void {
    // Defaults first so builders never see an unset slot.
    this.materials.set('frame', getMaterial('koki'));
    this.materials.set('surface', getMaterial('linen'));
    this.materials.set('accent', getMaterial('brass'));
    for (const role of Object.keys(cfg.slots) as SlotRole[]) {
      const id = cfg.slots[role];
      if (id) this.materials.set(role, getMaterial(id));
    }

    if (this.furniture) {
      this.scene.remove(this.furniture);
      disposeGroup(this.furniture);
    }
    this.furniture = buildFurniture(p, cfg, this.materials.mats);
    this.scene.add(this.furniture);

    const W = cfg.w / 1000;
    const D = cfg.d / 1000;
    const H = cfg.h / 1000;
    this.size.set(W, H, D);

    const span = Math.max(W, D, H);
    this.blob.scale.set(W * 1.5 + 0.3, 1, D * 1.5 + 0.3);
    this.key.position.set(span * 1.1 + 1.2, span * 1.8 + 2.4, span * 0.9 + 1.8);
    this.key.target.position.set(0, H * 0.3, 0);
    const half = Math.max(W, D) * 0.95 + 0.6;
    const sc = this.key.shadow.camera;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 0.5;
    sc.far = span * 6 + 8;
    sc.updateProjectionMatrix();

    if (this.guides) this.setGuides(true);
  }

  /** The current piece, so callers can move it in the world (AR placement). */
  get piece(): THREE.Group | null {
    return this.furniture;
  }

  /**
   * Move the piece in the world and turn it about its own axis.
   * The piece keeps its base at the given point, so a floor pose drops it
   * straight onto the floor.
   */
  placePiece(position: THREE.Vector3, rotationY = 0): void {
    if (!this.furniture) return;
    this.furniture.position.copy(position);
    this.furniture.rotation.y = rotationY;
    this.furniture.updateMatrixWorld(true);
  }

  /** Hide the painted contact shadow — real light takes over in AR. */
  setContactShadow(visible: boolean): void {
    this.blob.visible = visible;
  }

  /** Keep the shadow catcher under the piece — in AR the piece moves around a room. */
  moveShadowCatcher(position: THREE.Vector3): void {
    this.ground.position.set(position.x, 0, position.z);
  }

  /** Aim the key light from `from` at `at`, so lighting can follow the viewer. */
  aimLight(from: THREE.Vector3, at: THREE.Vector3): void {
    this.key.position.copy(from);
    this.key.target.position.copy(at);
    this.key.target.updateMatrixWorld();
  }

  /** Distance from the piece's centre at which it just fits the frame along `dir`. */
  fitDistance(dir: THREE.Vector3, aspect = this.camera.aspect, margin = 0.84): number {
    const [W, H, D] = [this.size.x, this.size.y, this.size.z];
    const center = new THREE.Vector3(0, H / 2, 0);
    const cam = this.camera.clone();
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    const d = dir.clone().normalize();

    const corners: THREE.Vector3[] = [];
    for (const x of [-W / 2, W / 2]) for (const y of [0, H]) for (const z of [-D / 2, D / 2]) corners.push(new THREE.Vector3(x, y, z));

    const extent = (t: number) => {
      cam.position.copy(center).addScaledVector(d, t);
      cam.lookAt(center);
      cam.updateMatrixWorld(true);
      let m = 0;
      for (const c of corners) {
        const p = c.clone().project(cam);
        m = Math.max(m, Math.abs(p.x), Math.abs(p.y));
      }
      return m;
    };
    let lo = 0.3;
    let hi = 40;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (extent(mid) > margin) lo = mid;
      else hi = mid;
    }
    return hi;
  }

  /** Camera placement that fits the current piece for a named view. */
  poseFor(view: ViewName, aspect = this.camera.aspect): ViewPose {
    const center = new THREE.Vector3(0, this.size.y / 2, 0);
    const dir = VIEW_DIRS[view].clone();
    return { position: center.clone().addScaledVector(dir, this.fitDistance(dir, aspect)), target: center };
  }

  /** Dimension guides: three measuring lines around the piece. */
  setGuides(visible: boolean): void {
    if (this.guides) {
      this.scene.remove(this.guides);
      this.guides.traverse((o) => {
        const m = o as THREE.Line;
        if (m.geometry) m.geometry.dispose();
      });
      this.guides = null;
    }
    if (!visible) return;
    const [W, H, D] = [this.size.x, this.size.y, this.size.z];
    const off = Math.max(0.12, Math.max(W, D) * 0.06);
    const t = 0.03;
    const pts: number[] = [];
    const seg = (a: number[], b: number[]) => pts.push(...a, ...b);
    // Width, along the front-bottom edge.
    const wz = D / 2 + off;
    seg([-W / 2, 0, wz], [W / 2, 0, wz]);
    seg([-W / 2, 0, wz - t], [-W / 2, 0, wz + t]);
    seg([W / 2, 0, wz - t], [W / 2, 0, wz + t]);
    // Depth, along the right-bottom edge.
    const dx = W / 2 + off;
    seg([dx, 0, -D / 2], [dx, 0, D / 2]);
    seg([dx - t, 0, -D / 2], [dx + t, 0, -D / 2]);
    seg([dx - t, 0, D / 2], [dx + t, 0, D / 2]);
    // Height, at the front-left corner.
    const hx = -W / 2 - off;
    seg([hx, 0, wz], [hx, H, wz]);
    seg([hx - t, 0, wz], [hx + t, 0, wz]);
    seg([hx - t, H, wz], [hx + t, H, wz]);

    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x2b3a87, depthTest: false, transparent: true }),
    );
    line.renderOrder = 20;
    this.guides = new THREE.Group();
    this.guides.add(line);
    this.scene.add(this.guides);
  }

  /** World-space label anchors for the three measurements. */
  guideAnchors(): { w: THREE.Vector3; d: THREE.Vector3; h: THREE.Vector3 } {
    const [W, H, D] = [this.size.x, this.size.y, this.size.z];
    const off = Math.max(0.12, Math.max(W, D) * 0.06);
    return {
      w: new THREE.Vector3(0, 0, D / 2 + off),
      d: new THREE.Vector3(W / 2 + off, 0, 0),
      h: new THREE.Vector3(-W / 2 - off, H / 2, D / 2 + off),
    };
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Render a still of the current piece. Returns a transparent PNG data URL. */
  snapshot(width: number, height: number, view: ViewName = 'three'): string {
    const prevGuides = !!this.guides;
    if (prevGuides) this.setGuides(false);
    this.resize(width, height, 1);
    const pose = this.poseFor(view, width / height);
    this.camera.position.copy(pose.position);
    this.camera.lookAt(pose.target);
    this.camera.updateMatrixWorld();
    this.render();
    const url = this.renderer.domElement.toDataURL('image/png');
    if (prevGuides) this.setGuides(true);
    return url;
  }

  dispose(): void {
    if (this.furniture) disposeGroup(this.furniture);
    this.setGuides(false);
    this.materials.dispose();
    this.blobTex.dispose();
    this.envTarget.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}

// ── Shared offscreen studio (thumbnails, bag pictures) ─────────────────────

let offscreen: Studio | null = null;

function getOffscreen(): Studio | null {
  if (offscreen) return offscreen;
  if (!webglAvailable()) return null;
  const canvas = document.createElement('canvas');
  offscreen = new Studio(canvas, { alpha: true, shadowMapSize: 1024 });
  return offscreen;
}

/** Render a piece to a PNG data URL without touching the live viewer. */
export function renderStill(p: Product, cfg: Config, size = 480, view: ViewName = 'three'): string | null {
  const s = getOffscreen();
  if (!s) return null;
  try {
    s.setProduct(p, cfg);
    return s.snapshot(size, size, view);
  } catch {
    return null;
  }
}

// ── Technical drawing views ────────────────────────────────────────────────

export interface DrawingView {
  view: 'front' | 'side' | 'top';
  url: string;
  /** Millimetres of margin around the piece inside the image. */
  padMm: number;
  widthMm: number;
  heightMm: number;
}

/**
 * Hidden-line orthographic renders (shaded fill + edge lines) for the
 * blueprint sheet. Dimension lines are drawn over them in SVG in millimetres.
 */
export function renderDrawingViews(p: Product, cfg: Config, maxPx = 1500): DrawingView[] | null {
  if (!webglAvailable()) return null;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setClearColor(0xffffff, 1);
  renderer.setPixelRatio(1);

  const fill = new THREE.MeshLambertMaterial({
    color: 0xf1efe9,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const group = buildFurniture(p, cfg, { frame: fill, surface: fill, accent: fill, neutral: fill });
  const lineMats: LineMaterial[] = [];
  const edgeGeos: LineSegmentsGeometry[] = [];
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  for (const mesh of meshes) {
    const edges = new THREE.EdgesGeometry(mesh.geometry, 32);
    if (edges.getAttribute('position').count === 0) {
      edges.dispose();
      continue;
    }
    const g = new LineSegmentsGeometry().fromEdgesGeometry(edges);
    edges.dispose();
    const mat = new LineMaterial({ color: 0x1e1b18, linewidth: 3.6, worldUnits: false });
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -1;
    mesh.add(new LineSegments2(g, mat));
    lineMats.push(mat);
    edgeGeos.push(g);
  }

  const scene = new THREE.Scene();
  scene.add(group);
  scene.add(new THREE.AmbientLight(0xffffff, 1.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(0.6, 1.2, 1.6);
  scene.add(sun);

  const W = cfg.w;
  const D = cfg.d;
  const H = cfg.h;
  const pad = Math.max(W, D, H) * 0.05;

  const defs: { view: DrawingView['view']; w: number; h: number; place: (c: THREE.OrthographicCamera) => void }[] = [
    { view: 'front', w: W, h: H, place: (c) => { c.position.set(0, H / 2000, 10); c.up.set(0, 1, 0); c.lookAt(0, H / 2000, 0); } },
    { view: 'side', w: D, h: H, place: (c) => { c.position.set(10, H / 2000, 0); c.up.set(0, 1, 0); c.lookAt(0, H / 2000, 0); } },
    { view: 'top', w: W, h: D, place: (c) => { c.position.set(0, 10, 0); c.up.set(0, 0, -1); c.lookAt(0, 0, 0); } },
  ];

  const out: DrawingView[] = [];
  for (const d of defs) {
    const wMm = d.w + pad * 2;
    const hMm = d.h + pad * 2;
    const scale = maxPx / Math.max(wMm, hMm);
    const pxW = Math.round(wMm * scale);
    const pxH = Math.round(hMm * scale);
    renderer.setSize(pxW, pxH, false);
    for (const m of lineMats) m.resolution.set(pxW, pxH);
    const cam = new THREE.OrthographicCamera(-wMm / 2000, wMm / 2000, hMm / 2000, -hMm / 2000, 0.1, 50);
    d.place(cam);
    cam.updateMatrixWorld(true);
    sun.position.copy(cam.position).add(new THREE.Vector3(0.4, 0.8, 0.3));
    renderer.render(scene, cam);
    out.push({ view: d.view, url: canvas.toDataURL('image/png'), padMm: pad, widthMm: d.w, heightMm: d.h });
  }

  for (const g of edgeGeos) g.dispose();
  for (const m of lineMats) m.dispose();
  disposeGroup(group);
  fill.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
