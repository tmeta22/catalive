import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Loader2, Minus, Move3d, Plus, RotateCcw, RotateCw, Smartphone, X } from 'lucide-react';
import { normalizeConfig, priceBreakdown, visibleSlots } from '../data/config';
import { getMaterial } from '../data/materials';
import type { Config, Product } from '../data/types';
import { useApp } from '../lib/app';
import { arSupported, ArSession, type ArState } from '../three/ar';
import { swatchStyle } from './ui';

/**
 * "View it in your room": starts a WebXR AR session, drops the piece on the
 * real floor and lets you walk around it. On devices without immersive AR we
 * explain what is needed instead of failing silently.
 */
export default function ARViewer({
  open,
  onClose,
  product,
  cfg,
  onConfigChange,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  cfg: Config;
  onConfigChange: (cfg: Config) => void;
}) {
  const { t, tt, money, len, toast } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<ArSession | null>(null);
  const cfgRef = useRef(cfg);

  const [support, setSupport] = useState<'checking' | 'yes' | 'no'>('checking');
  const [state, setState] = useState<ArState>('idle');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);

  cfgRef.current = cfg;

  // Check what this device can do before we ask for the camera.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setSupport('checking');
    setError(null);
    setState('idle');
    arSupported().then((ok) => {
      if (alive) setSupport(ok ? 'yes' : 'no');
    });
    return () => {
      alive = false;
    };
  }, [open]);

  // Tear the session down whenever the overlay closes.
  useEffect(() => {
    if (open) return;
    const s = sessionRef.current;
    sessionRef.current = null;
    if (s) s.dispose();
    setState('idle');
    setStarting(false);
  }, [open]);

  // Keep the model in step with the configurator while the session runs.
  useEffect(() => {
    const s = sessionRef.current;
    if (!s) return;
    s.setProduct(product, cfg);
  }, [product, cfg]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const start = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStarting(true);
    setError(null);
    try {
      const session = new ArSession(canvas);
      sessionRef.current = session;
      session.onEnd = () => {
        sessionRef.current = null;
        // The canvas is bound to a finished session; start the next one fresh.
        setCanvasKey((k) => k + 1);
        setState('ended');
      };
      // Some runtimes never settle the session promise; don't leave the
      // customer staring at a spinner.
      await Promise.race([
        session.start({
          overlay: document.getElementById('ar-overlay')!,
          onState: (s) => setState(s),
          onError: (m) => setError(m),
        }),
        new Promise((_, reject) =>
          window.setTimeout(() => reject(new Error(t('arTimeout'))), 15000),
        ),
      ]);
      session.setProduct(product, cfgRef.current);
      setState(session.state);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setState('idle');
      const s = sessionRef.current;
      sessionRef.current = null;
      if (s) s.dispose();
    } finally {
      setStarting(false);
    }
  }, [product, t]);

  const close = useCallback(() => {
    const s = sessionRef.current;
    sessionRef.current = null;
    if (s) s.dispose();
    onClose();
  }, [onClose]);

  const turn = useCallback((delta: number) => {
    sessionRef.current?.rotate(delta);
  }, []);

  const move = useCallback(() => {
    sessionRef.current?.reset();
    setState('scanning');
  }, []);

  const setWidth = useCallback(
    (delta: number) => {
      const step = product.dims.w.step;
      const next = normalizeConfig(product, { ...cfgRef.current, w: cfgRef.current.w + delta * step });
      onConfigChange(next);
    },
    [product, onConfigChange],
  );

  const setSlot = useCallback(
    (slotId: 'frame' | 'surface' | 'accent', materialId: string) => {
      onConfigChange(normalizeConfig(product, { ...cfgRef.current, slots: { ...cfgRef.current.slots, [slotId]: materialId } }));
    },
    [product, onConfigChange],
  );

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast(t('copied'));
    } catch {
      toast(t('copyFailed'));
    }
  }, [t, toast]);

  if (!open) return null;

  const slots = visibleSlots(product, cfg);
  const price = priceBreakdown(product, cfg);
  const live = state === 'scanning' || state === 'placed';

  return (
    <div className="fixed inset-0 z-[70] bg-ink text-white">
      <canvas key={canvasKey} ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={t('arViewerLabel')} />

      {/* ── In-session overlay ─────────────────────────────────────────── */}
      <div id="ar-overlay" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3 p-3">
          <div className="pointer-events-auto rounded-2xl bg-ink/70 px-3.5 py-2 backdrop-blur">
            <p className="text-[0.9rem] font-bold leading-tight">{tt(product.name)}</p>
            <p className="text-[0.78rem] text-white/75">
              {len(cfg.w)} × {len(cfg.d)} × {len(cfg.h)} · {money(price.total)}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t('arExit')}
            className="pointer-events-auto grid size-11 shrink-0 place-items-center rounded-full bg-ink/70 backdrop-blur"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 px-3 pb-4">
          {live && (
            <p className="rounded-full bg-ink/70 px-4 py-1.5 text-center text-[0.85rem] font-medium backdrop-blur">
              {state === 'placed' ? t('arPlaced') : t('arPointAtFloor')}
            </p>
          )}

          <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-3xl bg-ink/75 p-2.5 backdrop-blur">
            {slots.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-[0.75rem] font-semibold text-white/70">{tt(s.label)}</span>
                <div className="scroll-x flex flex-1 gap-1.5">
                  {s.materials.map((id) => {
                    const m = getMaterial(id);
                    const on = cfg.slots[s.id] === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-label={tt(m.name)}
                        aria-pressed={on}
                        onClick={() => setSlot(s.id, id)}
                        className={`size-8 shrink-0 rounded-full ring-2 transition ${on ? 'ring-white' : 'ring-white/25'}`}
                        style={swatchStyle(m.hex, m.kind)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 border-t border-white/15 pt-2">
              <button
                type="button"
                onClick={() => turn(-Math.PI / 12)}
                aria-label={t('arRotateLeft')}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => turn(Math.PI / 12)}
                aria-label={t('arRotateRight')}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10"
              >
                <RotateCw className="size-4" />
              </button>
              <button
                type="button"
                onClick={move}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[0.8rem] font-semibold"
              >
                <Move3d className="size-4" />
                {t('arMove')}
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setWidth(-1)}
                  aria-label={t('arNarrower')}
                  className="grid size-10 place-items-center rounded-full bg-white/10"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-14 text-center text-[0.8rem] font-bold tabular-nums">{len(cfg.w, false)}</span>
                <button
                  type="button"
                  onClick={() => setWidth(1)}
                  aria-label={t('arWider')}
                  className="grid size-10 place-items-center rounded-full bg-white/10"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Before the session starts ──────────────────────────────────── */}
      {!live && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-gradient-to-t from-ink via-ink/85 to-ink/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-card p-5 text-ink shadow-float">
            {support === 'checking' && (
              <div className="flex items-center gap-3 py-6 text-ink-soft">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm">{t('arChecking')}</span>
              </div>
            )}

            {support === 'no' && (
              <>
                <Smartphone className="size-7 text-indigo" />
                <h2 className="mt-2 text-lg font-bold">{t('arUnsupportedTitle')}</h2>
                <p className="mt-1 text-sm text-ink-soft">{t('arUnsupportedBody')}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={copyLink}
                    className="tap flex flex-1 items-center justify-center gap-2 rounded-full bg-indigo px-4 font-semibold text-white"
                  >
                    <Copy className="size-4" />
                    {t('copyLink')}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="tap flex-1 rounded-full border border-line-strong px-4 font-semibold"
                  >
                    {t('close')}
                  </button>
                </div>
              </>
            )}

            {support === 'yes' && (
              <>
                <h2 className="text-lg font-bold">{t('arTitle')}</h2>
                <p className="mt-1 text-sm text-ink-soft">{t('arIntro')}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                  <li>1. {t('arStep1')}</li>
                  <li>2. {t('arStep2')}</li>
                  <li>3. {t('arStep3')}</li>
                </ul>
                {error && <p className="mt-3 rounded-xl bg-rose-wash px-3 py-2 text-sm text-rose">{error}</p>}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={start}
                    disabled={starting}
                    className="tap flex flex-1 items-center justify-center gap-2 rounded-full bg-indigo px-4 font-semibold text-white disabled:opacity-60"
                  >
                    {starting ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
                    {t('arStart')}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="tap flex-1 rounded-full border border-line-strong px-4 font-semibold"
                  >
                    {t('close')}
                  </button>
                </div>
              </>
            )}

            {error && support !== 'yes' && <p className="mt-3 rounded-xl bg-rose-wash px-3 py-2 text-sm text-rose">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
