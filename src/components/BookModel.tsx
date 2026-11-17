import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clampZoom, zoomDistance } from '../data/catalogue';
import type { Config, Product } from '../data/types';
import { useApp } from '../lib/app';
import { Studio, type ViewName } from '../three/studio';

export interface BookModelHandle {
  /** Move the camera to a named view. */
  setView: (v: ViewName) => void;
  /** Zoom as a percentage of the framed size: 100 fits the piece exactly. */
  setZoom: (pct: number) => void;
  /** Current zoom percentage. */
  zoom: () => number;
  /** Re-frame the piece. */
  fit: () => void;
  /** A PNG of the page as it looks right now, for the page turn. */
  capture: () => string | null;
}

interface Tween {
  fromPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPos: THREE.Vector3;
  toTarget: THREE.Vector3;
  start: number;
  dur: number;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The live model in the catalogue book. Same engine as the product viewer,
 * but driven from the book's control bar: named views, a zoom percentage and
 * optional measurement guides.
 */
const BookModel = forwardRef<
  BookModelHandle,
  { product: Product; cfg: Config; guides: boolean; autoRotate: boolean; onZoom?: (pct: number) => void }
>(function BookModel({ product, cfg, guides, autoRotate, onZoom }, ref) {
  const { len } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<Studio | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cfgRef = useRef(cfg);
  const dirty = useRef(true);
  const tween = useRef<Tween | null>(null);
  const zoomRef = useRef(100);
  const guidesRef = useRef(guides);
  const autoRef = useRef(autoRotate);
  const labelRefs = { w: useRef<HTMLSpanElement>(null), d: useRef<HTMLSpanElement>(null), h: useRef<HTMLSpanElement>(null) };

  cfgRef.current = cfg;
  guidesRef.current = guides;
  autoRef.current = autoRotate;

  useEffect(() => {
    dirty.current = true;
  }, [cfg]);

  useEffect(() => {
    const s = studioRef.current;
    if (!s) return;
    s.setGuides(guides);
    dirty.current = true;
  }, [guides]);

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.autoRotate = autoRotate;
    dirty.current = true;
  }, [autoRotate]);

  useEffect(() => {
    if (!canvasRef.current || !hostRef.current) return;
    const canvas = canvasRef.current;
    const host = hostRef.current;

    let studio: Studio;
    try {
      studio = new Studio(canvas, { shadowMapSize: 1024 });
    } catch {
      return;
    }
    studioRef.current = studio;

    const controls = new OrbitControls(studio.camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.enablePan = false;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.8;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.autoRotate = autoRef.current;
    controls.autoRotateSpeed = 1.1;
    controls.addEventListener('start', () => {
      tween.current = null;
    });
    controlsRef.current = controls;

    const resize = () => {
      const r = host.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      studio.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
      // Keep the zoom the reader chose, whatever shape the page takes.
      if (!tween.current) {
        const dir = studio.camera.position.clone().sub(controls.target).normalize();
        const need = studio.fitDistance(dir);
        const dist = zoomDistance(need, zoomRef.current);
        studio.camera.position.copy(controls.target).addScaledVector(dir, dist);
      }
      dirty.current = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    studio.setProduct(product, cfgRef.current);
    const first = studio.poseFor('three');
    studio.camera.position.copy(first.position);
    controls.target.copy(first.target);
    controls.update();

    const dir = new THREE.Vector3();
    const proj = new THREE.Vector3();
    const place = (el: HTMLSpanElement | null, world: THREE.Vector3) => {
      if (!el) return;
      proj.copy(world).project(studio.camera);
      const r = host.getBoundingClientRect();
      const visible = guidesRef.current && proj.z < 1;
      el.style.opacity = visible ? '1' : '0';
      el.style.transform = `translate(${((proj.x + 1) / 2) * r.width}px, ${((1 - proj.y) / 2) * r.height}px) translate(-50%, -50%)`;
    };
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      let needs = false;

      if (dirty.current) {
        dirty.current = false;
        studio.setProduct(product, cfgRef.current);
        if (!tween.current) {
          dir.copy(studio.camera.position).sub(controls.target).normalize();
          const need = studio.fitDistance(dir);
          const center = new THREE.Vector3(0, studio.size.y / 2, 0);
          const cur = studio.camera.position.distanceTo(controls.target);
          controls.target.copy(center);
          if (cur < need) studio.camera.position.copy(center).addScaledVector(dir, need);
          controls.minDistance = need * 0.25;
          controls.maxDistance = Math.max(need * 2.6, cur);
        }
        needs = true;
      }

      const tw = tween.current;
      if (tw) {
        const k = Math.min(1, (now - tw.start) / tw.dur);
        const e = ease(k);
        studio.camera.position.lerpVectors(tw.fromPos, tw.toPos, e);
        controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e);
        if (k >= 1) tween.current = null;
        needs = true;
      }

      const moved = controls.update();
      if (moved || needs) {
        studio.render();
        const fit = studio.fitDistance(dir.copy(studio.camera.position).sub(controls.target).normalize());
        const dist = studio.camera.position.distanceTo(controls.target);
        const pct = clampZoom((fit / Math.max(dist, 0.01)) * 100);
        if (pct !== zoomRef.current) {
          zoomRef.current = pct;
          onZoom?.(pct);
        }
        if (guidesRef.current) {
          const a = studio.guideAnchors();
          place(labelRefs.w.current, a.w);
          place(labelRefs.d.current, a.d);
          place(labelRefs.h.current, a.h);
        }
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      studio.dispose();
      studioRef.current = null;
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setView(v: ViewName) {
        const s = studioRef.current;
        const c = controlsRef.current;
        if (!s || !c) return;
        c.autoRotate = false;
        const pose = s.poseFor(v);
        tween.current = {
          fromPos: s.camera.position.clone(),
          fromTarget: c.target.clone(),
          toPos: pose.position,
          toTarget: pose.target,
          start: performance.now(),
          dur: 620,
        };
      },
      setZoom(pct: number) {
        const s = studioRef.current;
        const c = controlsRef.current;
        if (!s || !c) return;
        const z = clampZoom(pct);
        zoomRef.current = z;
        const dir = s.camera.position.clone().sub(c.target).normalize();
        const need = s.fitDistance(dir);
        const dist = zoomDistance(need, z);
        c.target.copy(new THREE.Vector3(0, s.size.y / 2, 0));
        s.camera.position.copy(c.target).addScaledVector(dir, dist);
        tween.current = null;
        dirty.current = true;
      },
      zoom() {
        return zoomRef.current;
      },
      capture() {
        const s = studioRef.current;
        if (!s) return null;
        try {
          return s.grabCurrent();
        } catch {
          return null;
        }
      },
      fit() {
        const s = studioRef.current;
        const c = controlsRef.current;
        if (!s || !c) return;
        const dir = s.camera.position.clone().sub(c.target).normalize();
        const need = s.fitDistance(dir);
        c.target.copy(new THREE.Vector3(0, s.size.y / 2, 0));
        s.camera.position.copy(c.target).addScaledVector(dir, need);
        zoomRef.current = 100;
        tween.current = null;
        dirty.current = true;
      },
    }),
    [],
  );

  return (
    <div ref={hostRef} className="relative size-full overflow-hidden bg-[radial-gradient(120%_100%_at_50%_0%,#ffffff_0%,#eef0e8_75%,#e6e9df_100%)]">
      <canvas ref={canvasRef} className="block size-full touch-none outline-none" />
      {(['w', 'd', 'h'] as const).map((k) => (
        <span
          key={k}
          ref={labelRefs[k]}
          className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full bg-indigo px-2 py-0.5 text-[0.75rem] font-bold tabular-nums text-white opacity-0 shadow-sm transition-opacity"
        >
          {k === 'w' ? len(cfg.w) : k === 'd' ? len(cfg.d) : len(cfg.h)}
        </span>
      ))}
    </div>
  );
});

export default BookModel;
