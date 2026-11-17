import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { defaultConfig } from '../data/config';
import { getMaterial } from '../data/materials';
import { PRODUCTS } from '../data/products';
import type { Config, Product, SlotRole } from '../data/types';
import { formatLength } from '../i18n/translations';
import { buildFurniture, disposeGroup } from './builders';
import { buildCage, buildGuides, disposeGroup as disposeAll, guideAnchors } from './guides';
import { MaterialSet } from './materials';
import {
  drawIntroLeft,
  drawIntroRight,
  drawProductLeft,
  drawProductRight,
  loadDrawingImages,
  loadFonts,
  newPageCanvas,
  type ArtEnv,
} from './pageArt';

export type BookView = 'three' | 'top' | 'close' | 'low';
export type BookLight = 'morning' | 'noon' | 'evening';

const PW = 1;
const PH = 1.42;
const BOARD = 0.03;
const STACK = 0.07;

interface LightPreset {
  color: number;
  intensity: number;
  pos: [number, number, number];
  env: number;
  fill: number;
}

export const LIGHTS: Record<BookLight, LightPreset> = {
  morning: { color: 0xffd7a6, intensity: 2.5, pos: [-3.2, 2.4, 2.6], env: 0.6, fill: 0.5 },
  noon: { color: 0xfff6e8, intensity: 2.6, pos: [1.2, 5.2, 1.6], env: 0.7, fill: 0.6 },
  evening: { color: 0xff9d6a, intensity: 2.3, pos: [3.8, 1.7, 1.4], env: 0.4, fill: 0.9 },
};

export interface BookOptions {
  canvas: HTMLCanvasElement;
  labels: { w: HTMLElement; d: HTMLElement; h: HTMLElement };
  env: ArtEnv;
  onSpread: (index: number) => void;
  onInteract?: () => void;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t: number) => {
  const c1 = 1.9;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

interface Flip {
  from: number;
  to: number;
  start: number;
  dur: number;
  dir: 1 | -1;
}

export class BookScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
  readonly controls: OrbitControls;
  readonly count = PRODUCTS.length + 1;

  private env: ArtEnv;
  private opts: BookOptions;
  private raf = 0;
  private disposed = false;
  private dirty = true;
  private ready = false;

  private spread = 0;
  private flip: Flip | null = null;
  private queued: number | null = null;

  // Light
  private key: THREE.DirectionalLight;
  private fill: THREE.HemisphereLight;
  private lightFrom: LightPreset = LIGHTS.noon;
  private lightTo: LightPreset = LIGHTS.noon;
  private lightT = 1;
  private lightStart = 0;

  // Book
  private book = new THREE.Group();
  private leftStack: THREE.Mesh;
  private rightStack: THREE.Mesh;
  private leftPage: THREE.Mesh;
  private rightPage: THREE.Mesh;
  private leafFront: THREE.Mesh;
  private leafBack: THREE.Mesh;
  private leafGeo: THREE.BufferGeometry;
  private leafGeoBack: THREE.BufferGeometry;
  private leftMat = this.pageMaterial();
  private rightMat = this.pageMaterial();
  private frontMat = this.pageMaterial(THREE.FrontSide);
  private backMat = this.pageMaterial(THREE.BackSide);
  private tableMat = new THREE.MeshStandardMaterial({ color: 0xbdb5a5, roughness: 0.88 });
  private table: THREE.Mesh;

  // Pop-up piece
  private pop = new THREE.Group();
  private inner = new THREE.Group();
  private modelMats = new MaterialSet();
  private model: THREE.Group | null = null;
  private overlay: THREE.Group | null = null;
  private product: Product | null = null;
  private size = new THREE.Vector3(1, 1, 1);
  private popUser = 1;
  private popAnim = 0;
  private popAnimFrom = 0;
  private popAnimStart = 0;
  private popAnimDur = 0;
  private popAnimTarget = 0;
  private cageOn = false;

  // Camera tween
  private tween: { fp: THREE.Vector3; ft: THREE.Vector3; tp: THREE.Vector3; tt: THREE.Vector3; start: number; dur: number } | null = null;
  private view: BookView = 'three';
  private userMoved = false;

  // Page textures
  private tex = new Map<string, THREE.CanvasTexture>();
  private pending = new Set<string>();
  private ro: ResizeObserver;
  private down: { x: number; y: number; t: number } | null = null;
  private reduce: boolean;

  constructor(opts: BookOptions) {
    this.opts = opts;
    this.env = opts.env;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMappingExposure = 0.82;

    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();

    this.key = new THREE.DirectionalLight(0xfff6e8, 3);
    this.key.castShadow = true;
    const ms = coarse ? 1024 : 2048;
    this.key.shadow.mapSize.set(ms, ms);
    this.key.shadow.bias = -0.0012;
    this.key.shadow.normalBias = 0.04;
    this.key.shadow.radius = 5;
    const sc = this.key.shadow.camera;
    sc.left = -2.8;
    sc.right = 2.8;
    sc.top = 2.8;
    sc.bottom = -2.8;
    sc.near = 0.5;
    sc.far = 14;
    this.scene.add(this.key, this.key.target);
    this.fill = new THREE.HemisphereLight(0xffffff, 0xd9d2c4, 0.6);
    this.scene.add(this.fill);

    // Table: pale washed timber.
    const tg = new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2);
    this.table = new THREE.Mesh(tg, this.tableMat);
    this.table.receiveShadow = true;
    this.scene.add(this.table);

    // Book: boards, page stacks, pages.
    const board = new THREE.MeshStandardMaterial({ color: 0x232d6a, roughness: 0.8 });
    const cover = new THREE.Mesh(new THREE.BoxGeometry(PW * 2 + 0.1, BOARD, PH + 0.08), board);
    cover.position.y = BOARD / 2;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.07, BOARD + STACK + 0.01, PH + 0.08), board);
    spine.position.set(0, (BOARD + STACK + 0.01) / 2, 0);
    for (const m of [cover, spine]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.book.add(m);
    }
    const edge = new THREE.MeshStandardMaterial({ color: 0xece6d8, roughness: 0.95 });
    this.leftStack = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.02, 1, PH - 0.02), edge);
    this.rightStack = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.02, 1, PH - 0.02), edge);
    for (const m of [this.leftStack, this.rightStack]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.book.add(m);
    }
    const mkPage = (mat: THREE.Material) => {
      const g = new THREE.PlaneGeometry(PW, PH, 28, 1).rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      m.castShadow = false;
      this.book.add(m);
      return m;
    };
    this.leftPage = mkPage(this.leftMat);
    this.rightPage = mkPage(this.rightMat);
    this.dip(this.leftPage, -1);
    this.dip(this.rightPage, 1);

    // Turning leaf (two-sided).
    this.leafGeo = new THREE.BufferGeometry();
    const N = 28;
    const verts = (N + 1) * 2;
    this.leafGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    this.leafGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(verts * 2), 2));
    const idx: number[] = [];
    for (let i = 0; i < N; i++) {
      const a = i * 2;
      // Counter-clockwise seen from above, so the front face points up when the leaf lies flat.
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.leafGeo.setIndex(idx);
    // The back face shares the sheet's vertices but counts u from the outer edge.
    this.leafGeoBack = new THREE.BufferGeometry();
    this.leafGeoBack.setAttribute('position', this.leafGeo.getAttribute('position'));
    this.leafGeoBack.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(verts * 2), 2));
    this.leafGeoBack.setIndex(idx);
    this.leafFront = new THREE.Mesh(this.leafGeo, this.frontMat);
    this.leafBack = new THREE.Mesh(this.leafGeoBack, this.backMat);
    for (const m of [this.leafFront, this.leafBack]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.visible = false;
      m.frustumCulled = false;
      this.book.add(m);
    }
    this.scene.add(this.book);

    this.pop.add(this.inner);
    this.book.add(this.pop);

    this.controls = new OrbitControls(this.camera, opts.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.rotateSpeed = 0.7;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 9;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.addEventListener('start', () => {
      this.userMoved = true;
      this.tween = null;
      this.opts.onInteract?.();
    });
    this.controls.addEventListener('change', () => (this.dirty = true));

    opts.canvas.addEventListener('pointerdown', this.onDown);
    opts.canvas.addEventListener('pointerup', this.onUp);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(opts.canvas.parentElement ?? opts.canvas);
    this.resize();

    this.layoutStacks(0);
    this.setLight('noon', true);
    this.applyView(this.camera.aspect < 0.9 ? 'close' : 'three', true);
    this.raf = requestAnimationFrame(this.tick);

    loadFonts().then(() => {
      if (this.disposed) return;
      this.ready = true;
      this.showSpread(this.spread);
      this.setProductForSpread(this.spread, true);
      this.dirty = true;
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────

  get initialView(): BookView {
    return this.view;
  }

  get current(): number {
    return this.spread;
  }

  get productId(): string | null {
    return this.product?.id ?? null;
  }

  setEnv(env: ArtEnv): void {
    this.env = env;
    this.clearTextures();
    this.showSpread(this.flip ? this.flip.to : this.spread);
    this.updateLabels();
    this.dirty = true;
  }

  goTo(target: number, animate = true): void {
    const t = Math.max(0, Math.min(this.count - 1, Math.round(target)));
    if (this.flip) {
      this.queued = t;
      return;
    }
    if (t === this.spread) return;
    if (!animate || !this.ready) {
      this.spread = t;
      this.layoutStacks(t);
      this.showSpread(t);
      this.setProductForSpread(t, !this.reduce);
      this.opts.onSpread(t);
      this.dirty = true;
      return;
    }
    const dir: 1 | -1 = t > this.spread ? 1 : -1;
    const dur = this.reduce ? 1 : Math.min(1500, 820 + Math.abs(t - this.spread) * 90);
    this.beginFlip({ from: this.spread, to: t, start: performance.now(), dur, dir });
  }

  next(): void {
    this.goTo((this.flip ? this.flip.to : this.spread) + 1);
  }

  prev(): void {
    this.goTo((this.flip ? this.flip.to : this.spread) - 1);
  }

  /** 0 = flat on the page, 1 = fully popped up. */
  setPopUp(amount: number, instant = false): void {
    this.popUser = Math.max(0, Math.min(1, amount));
    if (instant) this.popAnim = this.popAnimTarget;
    this.dirty = true;
  }

  setCage(on: boolean): void {
    this.cageOn = on;
    this.rebuildOverlay();
    this.dirty = true;
  }

  setLight(l: BookLight, instant = false): void {
    this.lightFrom = this.currentLight();
    this.lightTo = LIGHTS[l];
    this.lightT = instant || this.reduce ? 1 : 0;
    this.lightStart = performance.now();
    this.dirty = true;
  }

  setView(v: BookView): void {
    this.applyView(v, false);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.opts.canvas.removeEventListener('pointerdown', this.onDown);
    this.opts.canvas.removeEventListener('pointerup', this.onUp);
    this.controls.dispose();
    this.clearTextures();
    if (this.model) disposeGroup(this.model);
    if (this.overlay) disposeAll(this.overlay);
    this.modelMats.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.geometry.userData.cached) m.geometry.dispose();
    });
    this.renderer.dispose();
  }

  // ── Setup helpers ────────────────────────────────────────────────────────

  private pageMaterial(side: THREE.Side = THREE.FrontSide): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color: 0xfbfaf6, roughness: 0.92, side, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  }

  /** Move a page to its side of the spine (local x runs -0.5..0.5). */
  private dip(mesh: THREE.Mesh, side: 1 | -1): void {
    const g = mesh.geometry;
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + side * (PW / 2);
      pos.setX(i, wx);
      // Flat: the gutter shading is painted into the page art. A geometric dip would sink
      // the page below the paper stack and let its top face poke through.
      pos.setY(i, 0);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  }

  private resize(): void {
    const el = this.opts.canvas.parentElement ?? this.opts.canvas;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2));
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    if (!this.userMoved) this.applyView(this.view, true);
    this.dirty = true;
  }

  // ── Stacks, pages and textures ───────────────────────────────────────────

  private stackHeights(t: number): { l: number; r: number } {
    const f = t / Math.max(1, this.count - 1);
    return { l: 0.012 + STACK * f, r: 0.012 + STACK * (1 - f) };
  }

  private layoutStacks(t: number): void {
    const { l, r } = this.stackHeights(t);
    this.setStack(this.leftStack, -PW / 2, l);
    this.setStack(this.rightStack, PW / 2, r);
    this.leftPage.position.y = BOARD + l;
    this.rightPage.position.y = BOARD + r;
    this.pop.position.set(PW * 0.5, BOARD + r, 0.02);
  }

  private setStack(m: THREE.Mesh, x: number, h: number): void {
    m.scale.y = h;
    m.position.set(x, BOARD + h / 2, 0);
  }

  private key2(i: number, side: 'L' | 'R'): string {
    const e = this.env;
    return `${e.locale}|${e.currency}|${e.unit}|${i}|${side}`;
  }

  private clearTextures(): void {
    for (const t of this.tex.values()) t.dispose();
    this.tex.clear();
    this.pending.clear();
  }

  private evictFar(center: number): void {
    for (const [k, t] of this.tex) {
      const i = Number(k.split('|')[3]);
      if (Math.abs(i - center) > 2) {
        t.dispose();
        this.tex.delete(k);
      }
    }
  }

  private texture(i: number, side: 'L' | 'R'): THREE.CanvasTexture {
    const key = this.key2(i, side);
    const hit = this.tex.get(key);
    if (hit) return hit;
    const canvas = newPageCanvas();
    this.paint(canvas, i, side, null);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    this.tex.set(key, t);

    // Product left pages get their hidden-line drawings a moment later.
    if (side === 'L' && i > 0 && !this.pending.has(key)) {
      this.pending.add(key);
      const p = PRODUCTS[i - 1];
      window.setTimeout(async () => {
        const art = await loadDrawingImages(p);
        if (this.disposed || !art || this.tex.get(key) !== t) return;
        this.paint(canvas, i, side, art);
        t.needsUpdate = true;
        this.dirty = true;
      }, 60);
    }
    return t;
  }

  private paint(canvas: HTMLCanvasElement, i: number, side: 'L' | 'R', art: Parameters<typeof drawProductLeft>[4]): void {
    if (i === 0) {
      if (side === 'L') drawIntroLeft(canvas, this.env);
      else drawIntroRight(canvas, this.env);
      return;
    }
    const p = PRODUCTS[i - 1];
    if (side === 'L') drawProductLeft(canvas, p, this.env, 2 * i + 1, art);
    else drawProductRight(canvas, p, this.env, 2 * i + 2);
  }

  private showSpread(i: number): void {
    if (!this.ready) return;
    this.leftMat.map = this.texture(i, 'L');
    this.rightMat.map = this.texture(i, 'R');
    this.leftMat.needsUpdate = true;
    this.rightMat.needsUpdate = true;
    // Warm neighbours so turning is instant.
    window.setTimeout(() => {
      if (this.disposed) return;
      if (i + 1 < this.count) (this.texture(i + 1, 'L'), this.texture(i + 1, 'R'));
      if (i - 1 >= 0) (this.texture(i - 1, 'L'), this.texture(i - 1, 'R'));
      this.evictFar(i);
    }, 120);
  }

  // ── Page turn ────────────────────────────────────────────────────────────

  private beginFlip(f: Flip): void {
    this.flip = f;
    const fwd = f.dir === 1;
    // The leaf carries the right page of one spread and the left page of the other.
    const a = fwd ? f.from : f.to;
    const b = fwd ? f.to : f.from;
    this.frontMat.map = this.texture(a, 'R');
    this.backMat.map = this.texture(b, 'L');
    this.frontMat.needsUpdate = true;
    this.backMat.needsUpdate = true;
    // What is revealed underneath.
    this.leftMat.map = this.texture(fwd ? f.from : f.to, 'L');
    this.rightMat.map = this.texture(fwd ? f.to : f.from, 'R');
    this.leftMat.needsUpdate = true;
    this.rightMat.needsUpdate = true;
    this.leafFront.visible = true;
    this.leafBack.visible = true;
    this.startPop(0, 0.18);
    this.dirty = true;
  }

  private updateFlip(now: number): void {
    const f = this.flip;
    if (!f) return;
    const k = Math.min(1, (now - f.start) / f.dur);
    const e = easeInOut(k);
    const theta = f.dir === 1 ? Math.PI * e : Math.PI * (1 - e);

    const h0 = this.stackHeights(f.from);
    const h1 = this.stackHeights(f.to);
    const hl = h0.l + (h1.l - h0.l) * e;
    const hr = h0.r + (h1.r - h0.r) * e;
    this.setStack(this.leftStack, -PW / 2, hl);
    this.setStack(this.rightStack, PW / 2, hr);
    this.leftPage.position.y = BOARD + hl;
    this.rightPage.position.y = BOARD + hr;

    this.poseLeaf(theta, BOARD + hr, BOARD + hl);

    if (k >= 1) {
      this.flip = null;
      this.spread = f.to;
      this.leafFront.visible = false;
      this.leafBack.visible = false;
      this.layoutStacks(f.to);
      this.showSpread(f.to);
      this.setProductForSpread(f.to, !this.reduce);
      this.opts.onSpread(f.to);
      if (this.queued !== null && this.queued !== this.spread) {
        const q = this.queued;
        this.queued = null;
        this.goTo(q);
      } else this.queued = null;
    }
  }

  /** Bend the leaf: the further it is turned, the more its tip trails behind. */
  private poseLeaf(theta: number, yRight: number, yLeft: number): void {
    const pos = this.leafGeo.getAttribute('position') as THREE.BufferAttribute;
    const uvF = this.leafGeo.getAttribute('uv') as THREE.BufferAttribute;
    const uvB = this.leafGeoBack.getAttribute('uv') as THREE.BufferAttribute;
    const N = pos.count / 2 - 1;
    const ds = PW / N;
    const curl = 0.75 * Math.sin(theta);
    const yBase = yRight + (yLeft - yRight) * (theta / Math.PI) + 0.003;
    let x = 0;
    let y = 0;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      for (let j = 0; j < 2; j++) {
        const v = i * 2 + j;
        pos.setXYZ(v, x, yBase + y, j === 0 ? -PH / 2 : PH / 2);
        uvF.setXY(v, s, j === 0 ? 1 : 0);
        uvB.setXY(v, 1 - s, j === 0 ? 1 : 0);
      }
      const a = theta + curl * s;
      x += Math.cos(a) * ds;
      y += Math.sin(a) * ds;
    }
    pos.needsUpdate = true;
    uvF.needsUpdate = true;
    uvB.needsUpdate = true;
    this.leafGeo.computeVertexNormals();
    this.leafGeoBack.setAttribute('normal', this.leafGeo.getAttribute('normal'));
    this.leafGeo.computeBoundingSphere();
    this.leafGeoBack.computeBoundingSphere();
  }

  // ── Pop-up piece ─────────────────────────────────────────────────────────

  private startPop(target: number, dur: number): void {
    this.popAnimFrom = this.popAnim;
    this.popAnimTarget = target;
    this.popAnimStart = performance.now();
    this.popAnimDur = this.reduce ? 1 : dur * 1000;
    this.dirty = true;
  }

  private setProductForSpread(i: number, animate: boolean): void {
    const p = i === 0 ? null : PRODUCTS[i - 1];
    this.product = p;
    if (this.model) {
      this.inner.remove(this.model);
      disposeGroup(this.model);
      this.model = null;
    }
    if (!p) {
      this.rebuildOverlay();
      this.popAnim = 0;
      this.popAnimTarget = 0;
      this.updateLabels();
      return;
    }
    const cfg: Config = defaultConfig(p);
    this.modelMats.set('frame', getMaterial('koki'));
    this.modelMats.set('surface', getMaterial('linen'));
    this.modelMats.set('accent', getMaterial('brass'));
    for (const role of Object.keys(cfg.slots) as SlotRole[]) {
      const id = cfg.slots[role];
      if (id) this.modelMats.set(role, getMaterial(id));
    }
    this.model = buildFurniture(p, cfg, this.modelMats.mats);
    this.inner.add(this.model);
    this.size.set(cfg.w / 1000, cfg.h / 1000, cfg.d / 1000);
    // Fit the piece to the page.
    const k = Math.min(0.64 / Math.max(this.size.x, this.size.z), 0.8 / this.size.y);
    this.inner.scale.setScalar(k);
    this.inner.userData.k = k;
    this.rebuildOverlay();
    this.popAnim = 0;
    this.popAnimFrom = 0;
    this.popAnimTarget = 1;
    this.popAnimStart = performance.now() + (animate ? 120 : 0);
    this.popAnimDur = animate ? 800 : 1;
    this.updateLabels();
    this.dirty = true;
  }

  private rebuildOverlay(): void {
    if (this.overlay) {
      this.inner.remove(this.overlay);
      disposeAll(this.overlay);
      this.overlay = null;
    }
    if (!this.cageOn || !this.product) return;
    this.overlay = new THREE.Group();
    this.overlay.add(buildCage(this.size), buildGuides(this.size));
    this.inner.add(this.overlay);
  }

  private updateLabels(): void {
    const { w, d, h } = this.opts.labels;
    const p = this.product;
    if (!p) return;
    const cfg = defaultConfig(p);
    w.textContent = formatLength(cfg.w, this.env.unit);
    d.textContent = formatLength(cfg.d, this.env.unit);
    h.textContent = formatLength(cfg.h, this.env.unit);
  }

  private placeLabels(): void {
    const { w, d, h } = this.opts.labels;
    const els = [w, d, h];
    if (!this.cageOn || !this.product || this.popAnim < 0.4) {
      els.forEach((e) => (e.style.opacity = '0'));
      return;
    }
    const a = guideAnchors(this.size);
    const r = this.opts.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    [a.w, a.d, a.h].forEach((anchor, i) => {
      v.copy(anchor);
      this.inner.localToWorld(v);
      v.project(this.camera);
      const el = els[i];
      el.style.opacity = v.z < 1 ? '1' : '0';
      el.style.transform = `translate(${((v.x + 1) / 2) * r.width}px, ${((1 - v.y) / 2) * r.height}px) translate(-50%, -50%)`;
    });
  }

  // ── Light & camera ───────────────────────────────────────────────────────

  private currentLight(): LightPreset {
    const t = easeInOut(this.lightT);
    const a = this.lightFrom;
    const b = this.lightTo;
    const col = new THREE.Color(a.color).lerp(new THREE.Color(b.color), t);
    return {
      color: col.getHex(),
      intensity: a.intensity + (b.intensity - a.intensity) * t,
      pos: [0, 1, 2].map((i) => a.pos[i] + (b.pos[i] - a.pos[i]) * t) as [number, number, number],
      env: a.env + (b.env - a.env) * t,
      fill: a.fill + (b.fill - a.fill) * t,
    };
  }

  private applyLight(): void {
    const l = this.currentLight();
    this.key.color.setHex(l.color);
    this.key.intensity = l.intensity;
    this.key.position.set(...l.pos);
    this.scene.environmentIntensity = l.env;
    this.fill.intensity = l.fill;
  }

  /** Distance along `dir` at which the box fits the frame. */
  private fit(dir: THREE.Vector3, min: THREE.Vector3, max: THREE.Vector3, margin = 0.86): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const center = min.clone().add(max).multiplyScalar(0.5);
    const cam = this.camera.clone();
    const d = dir.clone().normalize();
    const corners: THREE.Vector3[] = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push(new THREE.Vector3(x, y, z));
    let lo = 0.4;
    let hi = 30;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      cam.position.copy(center).addScaledVector(d, mid);
      cam.lookAt(center);
      cam.updateMatrixWorld(true);
      let m = 0;
      for (const c of corners) {
        const p = c.clone().project(cam);
        m = Math.max(m, Math.abs(p.x), Math.abs(p.y));
      }
      if (m > margin) lo = mid;
      else hi = mid;
    }
    return { pos: center.clone().addScaledVector(d, hi), target: center };
  }

  private applyView(v: BookView, instant: boolean): void {
    this.view = v;
    const spread = { min: new THREE.Vector3(-PW - 0.06, 0, -PH / 2 - 0.05), max: new THREE.Vector3(PW + 0.06, 0.95, PH / 2 + 0.05) };
    const right = { min: new THREE.Vector3(0, 0, -PH / 2 + 0.2), max: new THREE.Vector3(PW + 0.04, 1.0, PH / 2 - 0.1) };
    let pose: { pos: THREE.Vector3; target: THREE.Vector3 };
    if (v === 'top') pose = this.fit(new THREE.Vector3(0, 1, 0.001), spread.min, spread.max, this.camera.aspect < 0.9 ? 0.86 : 0.95);
    else if (v === 'close') pose = this.fit(new THREE.Vector3(-0.35, 0.8, 1), right.min, right.max, 0.9);
    else if (v === 'low') pose = this.fit(new THREE.Vector3(0.1, 0.22, 1), spread.min, spread.max);
    else pose = this.fit(new THREE.Vector3(0.5, 0.95, 1.25), spread.min, spread.max, this.camera.aspect < 0.9 ? 0.86 : 0.96);
    // Lift the book clear of the control panel at the bottom of the screen.
    const dir = pose.pos.clone().sub(pose.target);
    const dist = dir.length();
    dir.normalize();
    const worldUp = Math.abs(dir.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(worldUp, dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, side).normalize();
    const worldH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const frac = this.camera.aspect < 0.9 ? 0.42 : 0.36;
    const shift = up.multiplyScalar(-worldH * frac * 0.5);
    pose.pos.add(shift);
    pose.target.add(shift);
    this.userMoved = false;
    if (instant || this.reduce) {
      this.camera.position.copy(pose.pos);
      this.controls.target.copy(pose.target);
      this.camera.lookAt(pose.target);
      this.controls.update();
    } else {
      this.tween = {
        fp: this.camera.position.clone(),
        ft: this.controls.target.clone(),
        tp: pose.pos,
        tt: pose.target,
        start: performance.now(),
        dur: 750,
      };
    }
    this.dirty = true;
  }

  // ── Interaction: tap a page to turn it ───────────────────────────────────

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || this.disposed) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7 || performance.now() - d.t > 380) return;
    const r = this.opts.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    if (this.model && this.popAnim > 0.3 && ray.intersectObject(this.model, true).length) return;
    const hit = ray.intersectObjects([this.leftPage, this.rightPage], false)[0];
    if (!hit) return;
    if (hit.object === this.rightPage) this.next();
    else this.prev();
  };

  // ── Loop ─────────────────────────────────────────────────────────────────

  private tick = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    let animating = false;

    if (this.flip) {
      this.updateFlip(now);
      animating = true;
    }

    if (this.lightT < 1) {
      this.lightT = Math.min(1, (now - this.lightStart) / 900);
      this.applyLight();
      animating = true;
    } else if (this.lightFrom !== this.lightTo) {
      this.lightFrom = this.lightTo;
      this.applyLight();
    }

    // Pop-up animation.
    if (this.popAnim !== this.popAnimTarget) {
      const k = Math.max(0, Math.min(1, (now - this.popAnimStart) / Math.max(1, this.popAnimDur)));
      const up = this.popAnimTarget > this.popAnimFrom;
      const e = up ? backOut(k) : ease(k);
      this.popAnim = this.popAnimFrom + (this.popAnimTarget - this.popAnimFrom) * e;
      if (k >= 1) this.popAnim = this.popAnimTarget;
      animating = true;
    }
    const a = Math.max(0.0005, this.popAnim * this.popUser);
    const k = (this.inner.userData.k as number | undefined) ?? 1;
    this.inner.scale.set(k, k * a, k);
    this.inner.visible = !!this.product && this.popAnim > 0.001;

    const tw = this.tween;
    if (tw) {
      const t = easeInOut(Math.min(1, (now - tw.start) / tw.dur));
      this.camera.position.lerpVectors(tw.fp, tw.tp, t);
      this.controls.target.lerpVectors(tw.ft, tw.tt, t);
      if (t >= 1) this.tween = null;
      animating = true;
    }

    const moved = this.controls.update();
    if (moved || animating || this.dirty) {
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
      this.placeLabels();
    }
  };
}

export type { LightPreset };
