import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Box, Ruler, Undo2 } from 'lucide-react';
import type { Config, Product } from '../data/types';
import { useApp } from '../lib/app';
import { hasInteractiveParts, Interaction, partLabelKey } from '../three/interactive';
import { Studio, webglAvailable, type ViewName } from '../three/studio';

interface Tween {
  fromPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPos: THREE.Vector3;
  toTarget: THREE.Vector3;
  start: number;
  dur: number;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export default function Viewer({
  product,
  cfg,
  refitKey,
}: {
  product: Product;
  cfg: Config;
  /** Bump to re-frame the piece (e.g. after choosing a standard size). */
  refitKey: number;
}) {
  const { t, len, toast } = useApp();
  const supported = useMemo(webglAvailable, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<Studio | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cfgRef = useRef(cfg);
  const dirty = useRef(true);
  const tween = useRef<Tween | null>(null);
  const guidesOn = useRef(false);
  const labelRefs = { w: useRef<HTMLSpanElement>(null), d: useRef<HTMLSpanElement>(null), h: useRef<HTMLSpanElement>(null) };

  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewName>('three');
  const [guides, setGuides] = useState(false);
  const [touched, setTouched] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const interactionRef = useRef<Interaction | null>(null);

  cfgRef.current = cfg;
  useEffect(() => {
    dirty.current = true;
  }, [cfg]);

  useEffect(() => {
    guidesOn.current = guides;
    const s = studioRef.current;
    if (s) {
      s.setGuides(guides);
      dirty.current = true;
    }
  }, [guides]);

  // Setup and teardown.
  useEffect(() => {
    if (!supported || !canvasRef.current || !hostRef.current) return;
    const canvas = canvasRef.current;
    const host = hostRef.current;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dprCap = coarse ? 1.75 : 2;

    let studio: Studio;
    try {
      studio = new Studio(canvas, { shadowMapSize: coarse ? 1024 : 2048 });
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
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 1.1;
    controlsRef.current = controls;

    const stopAuto = () => {
      controls.autoRotate = false;
      setTouched(true);
      tween.current = null;
    };
    controls.addEventListener('start', stopAuto);

    const resize = () => {
      const r = host.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      studio.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, dprCap));
      dirty.current = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    studio.setProduct(product, cfgRef.current);
    const interaction = new Interaction(studio.camera);
    interaction.refresh(studio.piece);
    interactionRef.current = interaction;
    setInteractive(hasInteractiveParts(studio.piece));
    const unbind = interaction.bind(canvas, (part) => {
      interaction.toggle(part);
      setTouched(true);
      toast(`${t(partLabelKey(part.spec.kind))} · ${part.target ? t('interactOpened') : t('interactClosed')}`);
    });
    const first = studio.poseFor('three');
    studio.camera.position.copy(first.position);
    controls.target.copy(first.target);
    controls.update();
    dirty.current = false;
    if (guidesOn.current) studio.setGuides(true);

    const dir = new THREE.Vector3();
    const proj = new THREE.Vector3();
    const place = (el: HTMLSpanElement | null, world: THREE.Vector3) => {
      if (!el) return;
      proj.copy(world).project(studio.camera);
      const r = host.getBoundingClientRect();
      const visible = guidesOn.current && proj.z < 1;
      el.style.opacity = visible ? '1' : '0';
      el.style.transform = `translate(${((proj.x + 1) / 2) * r.width}px, ${((1 - proj.y) / 2) * r.height}px) translate(-50%, -50%)`;
    };

    let raf = 0;
    let firstFrame = true;
    let lastFrame = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      let needs = false;

      if (dirty.current) {
        dirty.current = false;
        studio.setProduct(product, cfgRef.current);
        interaction.refresh(studio.piece);
        setInteractive(hasInteractiveParts(studio.piece));
        // Zoom out if the piece outgrew the frame; never zoom in on its own,
        // so growing a slider visibly grows the piece.
        if (!tween.current) {
          dir.copy(studio.camera.position).sub(controls.target).normalize();
          const need = studio.fitDistance(dir);
          const center = new THREE.Vector3(0, studio.size.y / 2, 0);
          const cur = studio.camera.position.distanceTo(controls.target);
          controls.target.copy(center);
          if (cur < need) studio.camera.position.copy(center).addScaledVector(dir, need);
          controls.minDistance = need * 0.35;
          controls.maxDistance = Math.max(need * 2.4, cur);
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

      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      if (interaction.update(dt)) needs = true;

      const moved = controls.update();
      if (moved || needs || firstFrame) {
        studio.render();
        if (guidesOn.current) {
          const a = studio.guideAnchors();
          place(labelRefs.w.current, a.w);
          place(labelRefs.d.current, a.d);
          place(labelRefs.h.current, a.h);
        }
        if (firstFrame) {
          firstFrame = false;
          setReady(true);
        }
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      unbind();
      controls.removeEventListener('start', stopAuto);
      controls.dispose();
      studio.dispose();
      studioRef.current = null;
      controlsRef.current = null;
      interactionRef.current = null;
    };
    // The viewer is keyed by product id, so `product` never changes while mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const goTo = (v: ViewName) => {
    const s = studioRef.current;
    const c = controlsRef.current;
    if (!s || !c) return;
    c.autoRotate = false;
    setTouched(true);
    setView(v);
    const pose = s.poseFor(v);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    tween.current = {
      fromPos: s.camera.position.clone(),
      fromTarget: c.target.clone(),
      toPos: pose.position,
      toTarget: pose.target,
      start: performance.now(),
      dur: reduce ? 1 : 650,
    };
  };

  // Re-frame when a preset is chosen.
  const lastRefit = useRef(refitKey);
  useEffect(() => {
    if (lastRefit.current === refitKey) return;
    lastRefit.current = refitKey;
    window.setTimeout(() => {
      const s = studioRef.current;
      const c = controlsRef.current;
      if (!s || !c) return;
      const dir = s.camera.position.clone().sub(c.target).normalize();
      const center = new THREE.Vector3(0, s.size.y / 2, 0);
      tween.current = {
        fromPos: s.camera.position.clone(),
        fromTarget: c.target.clone(),
        toPos: center.clone().addScaledVector(dir, s.fitDistance(dir)),
        toTarget: center,
        start: performance.now(),
        dur: 500,
      };
    }, 30);
  }, [refitKey]);

  const views: { id: ViewName; label: string }[] = [
    { id: 'three', label: t('view3d') },
    { id: 'front', label: t('viewFront') },
    { id: 'side', label: t('viewSide') },
    { id: 'top', label: t('viewTop') },
  ];

  if (!supported) {
    return (
      <div className="grid size-full place-items-center bg-paper-deep p-6 text-center">
        <div className="max-w-xs">
          <Box className="mx-auto mb-3 size-10 text-ink-faint" />
          <p className="font-semibold">{t('no3dTitle')}</p>
          <p className="mt-1 text-sm text-ink-soft">{t('no3dBody')}</p>
        </div>
      </div>
    );
  }

  const chip = 'rounded-full px-3 text-[0.8rem] font-semibold transition-colors min-h-9';

  return (
    <div
      ref={hostRef}
      className="relative size-full overflow-hidden bg-[radial-gradient(110%_85%_at_50%_15%,#ffffff_0%,#eef0e8_70%,#e6e9df_100%)]"
    >
      <canvas ref={canvasRef} className="block size-full touch-none outline-none" aria-label={t('viewerLabel')} />
      {!ready && <div className="skeleton absolute inset-0" />}

      <div className="no-print pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
        <div role="radiogroup" aria-label={t('viewAngle')} className="pointer-events-auto flex rounded-full bg-card/90 p-0.5 shadow-sm backdrop-blur">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={view === v.id}
              onClick={() => goTo(v.id)}
              className={`${chip} ${view === v.id ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-auto flex gap-1.5">
          {interactive && (
            <button
              type="button"
              onClick={() => interactionRef.current?.reset()}
              aria-label={t('interactReset')}
              className="flex min-h-9 items-center gap-1.5 rounded-full bg-card/90 px-3 text-[0.8rem] font-semibold text-ink-soft shadow-sm backdrop-blur hover:text-ink"
            >
              <Undo2 className="size-4" />
            </button>
          )}
          <button
            type="button"
            aria-pressed={guides}
            onClick={() => setGuides((g) => !g)}
            className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[0.8rem] font-semibold shadow-sm backdrop-blur ${
              guides ? 'bg-indigo text-white' : 'bg-card/90 text-ink-soft hover:text-ink'
            }`}
          >
            <Ruler className="size-4" />
            <span className="hidden min-[400px]:inline">{t('measurements')}</span>
          </button>
        </div>
      </div>

      {ready && !touched && (
        <div className="anim-fade pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-1.5">
          {interactive && (
            <span className="rounded-full bg-indigo px-3.5 py-1.5 text-[0.78rem] font-medium text-white shadow-sm">{t('interactHint')}</span>
          )}
          <span className="rounded-full bg-ink/75 px-3.5 py-1.5 text-[0.78rem] font-medium text-white backdrop-blur">{t('dragHint')}</span>
        </div>
      )}

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
}
