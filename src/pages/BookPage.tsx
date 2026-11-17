import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, LayoutGrid, Maximize2, Minimize2, Sun, Sunrise, Sunset } from 'lucide-react';
import Header from '../components/Header';
import { Btn, Segmented, Sheet } from '../components/ui';
import { defaultConfig } from '../data/config';
import { CATEGORIES, PRODUCTS } from '../data/products';
import type { Product } from '../data/types';
import { useApp } from '../lib/app';
import { navigate, replaceHash } from '../lib/router';
import { useStill } from '../lib/useStill';
import { BookScene, type BookLight, type BookView } from '../three/book';
import { webglAvailable } from '../three/studio';

const BG: Record<BookLight, string> = {
  morning: 'radial-gradient(120% 90% at 50% 0%, #fff6e6 0%, #f4e2c8 100%)',
  noon: 'radial-gradient(120% 90% at 50% 0%, #ffffff 0%, #e8eae2 100%)',
  evening: 'radial-gradient(120% 90% at 50% 0%, #ffeadf 0%, #d3d6ee 100%)',
};

function Thumb({ p }: { p: Product }) {
  const { url } = useStill(p, defaultConfig(p), 240);
  return url ? <img src={url} alt="" className="size-full object-contain p-1" /> : <div className="skeleton size-full" />;
}

export default function BookPage({ query }: { query: URLSearchParams }) {
  const { t, tt, locale, currency, unit, money } = useApp();
  const supported = useMemo(webglAvailable, []);
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = { w: useRef<HTMLSpanElement>(null), d: useRef<HTMLSpanElement>(null), h: useRef<HTMLSpanElement>(null) };
  const sceneRef = useRef<BookScene | null>(null);

  const startIndex = Math.max(0, PRODUCTS.findIndex((p) => p.id === query.get('p')) + 1);
  const [spread, setSpread] = useState(startIndex);
  const [pop, setPop] = useState(100);
  const [cad, setCad] = useState(false);
  const [view, setView] = useState<BookView>('three');
  const [light, setLight] = useState<BookLight>('noon');
  const [collapsed, setCollapsed] = useState(false);
  const [contents, setContents] = useState(false);
  const [full, setFull] = useState(false);
  const [hint, setHint] = useState(true);

  const total = PRODUCTS.length + 1;
  const product = spread > 0 ? PRODUCTS[spread - 1] : null;

  // Create the scene once.
  useEffect(() => {
    if (!supported || !canvasRef.current) return;
    const { w, d, h } = labelRefs;
    let scene: BookScene;
    try {
      scene = new BookScene({
        canvas: canvasRef.current,
        labels: { w: w.current!, d: d.current!, h: h.current! },
        env: { locale, currency, unit },
        onSpread: (i) => {
          setSpread(i);
          replaceHash(i === 0 ? '/book' : `/book?p=${PRODUCTS[i - 1].id}`);
        },
        onInteract: () => setHint(false),
      });
    } catch (err) {
      console.error('Catalogue book failed to start', err);
      return;
    }
    sceneRef.current = scene;
    setView(scene.initialView);
    scene.goTo(startIndex, false);
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // The scene is created once; later changes are pushed through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  useEffect(() => sceneRef.current?.setEnv({ locale, currency, unit }), [locale, currency, unit]);
  useEffect(() => sceneRef.current?.setPopUp(pop / 100), [pop]);
  useEffect(() => sceneRef.current?.setCage(cad), [cad]);
  useEffect(() => sceneRef.current?.setLight(light), [light]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') sceneRef.current?.next();
      if (e.key === 'ArrowLeft') sceneRef.current?.prev();
    };
    const onFs = () => setFull(!!document.fullscreenElement);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setHint(false), 6000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    document.title = `${t('bookTitle')} · Atelier Solis`;
  }, [t]);

  const chooseView = (v: BookView) => {
    setView(v);
    sceneRef.current?.setView(v);
  };
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else stageRef.current?.requestFullscreen?.();
  };
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  const round =
    'grid size-12 place-items-center rounded-full bg-card/95 text-ink shadow-float transition-transform active:scale-95 disabled:opacity-30';
  const chip = (on: boolean) =>
    `tap shrink-0 rounded-full px-2.5 text-[0.82rem] font-semibold transition-colors sm:px-3.5 sm:text-[0.85rem] ${on ? 'bg-ink text-white' : 'bg-card text-ink-soft hover:text-ink'}`;

  const grouped = CATEGORIES.map((c) => ({ c, items: PRODUCTS.filter((p) => p.category === c.id) }));

  return (
    <>
      {!full && <Header title={t('bookTitle')} backTo="/" />}
      <div
        ref={stageRef}
        className={`relative w-full overflow-hidden ${full ? 'h-svh' : 'h-[calc(100svh-3.5rem)]'}`}
        style={{ background: BG.noon }}
      >
        {(['morning', 'noon', 'evening'] as BookLight[]).map((l) => (
          <div key={l} className="absolute inset-0 transition-opacity duration-700" style={{ background: BG[l], opacity: l === light ? 1 : 0 }} />
        ))}

        <div ref={hostRef} className="absolute inset-0">
          {supported ? (
            <canvas ref={canvasRef} className="block size-full touch-none outline-none" aria-label={t('bookTitle')} />
          ) : (
            <div className="grid size-full place-items-center p-6 text-center">
              <div className="max-w-xs">
                <Box className="mx-auto mb-3 size-10 text-ink-faint" />
                <p className="font-semibold">{t('no3dTitle')}</p>
                <Btn variant="primary" className="mt-4" onClick={() => navigate('/')}>
                  {t('browseAll')}
                </Btn>
              </div>
            </div>
          )}
          {(['w', 'd', 'h'] as const).map((k) => (
            <span
              key={k}
              ref={labelRefs[k]}
              className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full bg-indigo px-2 py-0.5 text-[0.75rem] font-bold tabular-nums text-white opacity-0 shadow-sm transition-opacity"
            />
          ))}
        </div>

        {supported && (
          <>
            {/* Page controls */}
            <div className="pointer-events-none absolute inset-x-0 top-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setContents(true)}
                className="pointer-events-auto tap flex items-center gap-2 rounded-full bg-card/95 px-4 text-[0.9rem] font-semibold shadow-float"
              >
                <LayoutGrid className="size-4 text-indigo" />
                <span className="tabular-nums">{t('bookPageOf', { n: spread + 1, total })}</span>
              </button>
            </div>
            <button
              type="button"
              aria-label={t('bookPrev')}
              disabled={spread === 0}
              onClick={() => sceneRef.current?.prev()}
              className={`${round} absolute left-2 top-[38%] sm:left-5`}
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              aria-label={t('bookNext')}
              disabled={spread === total - 1}
              onClick={() => sceneRef.current?.next()}
              className={`${round} absolute right-2 top-[38%] sm:right-5`}
            >
              <ChevronRight className="size-6" />
            </button>

            {hint && <p className="pointer-events-none absolute inset-x-0 top-16 text-center text-[0.8rem] font-medium text-ink-soft">{t('bookPopHint')}</p>}

            {/* Product card + control panel */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:p-4">
              {product && (
                <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl bg-card/95 p-2.5 pl-4 shadow-float">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold leading-tight">{tt(product.name)}</p>
                    <p className="text-[0.82rem] text-ink-soft">
                      {t('from')} {money(product.basePrice)}
                    </p>
                  </div>
                  <Btn variant="primary" className="h-11 shrink-0 px-4 text-[0.88rem]" onClick={() => navigate(`/p/${product.id}`)}>
                    <span className="sm:hidden">{t('bookCustomiseShort')}</span>
                    <span className="hidden sm:inline">{t('bookCustomise')}</span>
                  </Btn>
                </div>
              )}

              <div className="pointer-events-auto w-full max-w-xl rounded-3xl bg-card/95 shadow-float backdrop-blur">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => !c)}
                  aria-expanded={!collapsed}
                  className="tap mx-auto flex items-center gap-1.5 px-4 text-[0.8rem] font-semibold text-ink-soft"
                >
                  {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  {collapsed ? t('bookShow') : t('bookHide')}
                </button>
                {!collapsed && (
                  <div className="space-y-2.5 px-3.5 pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 text-[0.78rem] font-semibold text-ink-soft">{t('bookFlat')}</span>
                      <input
                        type="range"
                        className="slider min-w-0 flex-1"
                        min={0}
                        max={100}
                        value={pop}
                        style={{ ['--fill' as string]: `${pop}%` }}
                        aria-label={t('bookPopUp')}
                        aria-valuetext={`${pop}%`}
                        onChange={(e) => setPop(Number(e.target.value))}
                      />
                      <span className="w-14 text-right text-[0.78rem] font-semibold tabular-nums text-ink-soft">
                        {pop}% {t('bookFull')}
                      </span>
                      <button
                        type="button"
                        aria-pressed={cad}
                        onClick={() => setCad((c) => !c)}
                        className={`tap flex shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.85rem] font-semibold ${cad ? 'bg-indigo text-white' : 'bg-paper-deep text-ink'}`}
                      >
                        <Box className="size-4" />
                        <span className="hidden min-[420px]:inline">{t('bookCad')}</span>
                      </button>
                      {canFull && (
                        <button type="button" onClick={toggleFull} aria-label={full ? t('bookExitFullscreen') : t('bookFullscreen')} className="tap grid size-11 shrink-0 place-items-center rounded-full bg-paper-deep">
                          {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2.5">
                      <div className="scroll-x flex min-w-0 gap-0.5 rounded-full bg-paper-deep p-0.5" role="radiogroup" aria-label={t('bookView')}>
                        {([
                          ['three', t('viewThreeQuarter')],
                          ['top', t('viewTop')],
                          ['close', t('viewClose')],
                          ['low', t('viewLow')],
                        ] as [BookView, string][]).map(([v, label]) => (
                          <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => chooseView(v)} className={chip(view === v)}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <Segmented
                        size="sm"
                        label={t('bookLight')}
                        value={light}
                        onChange={setLight}
                        options={[
                          { value: 'morning', label: <Sunrise className="size-4" />, aria: t('lightMorning') },
                          { value: 'noon', label: <Sun className="size-4" />, aria: t('lightNoon') },
                          { value: 'evening', label: <Sunset className="size-4" />, aria: t('lightEvening') },
                        ]}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <Sheet open={contents} onClose={() => setContents(false)} title={t('bookContents')} wide>
        <div className="space-y-6 p-5">
          <button
            type="button"
            onClick={() => (sceneRef.current?.goTo(0), setContents(false))}
            className="tap w-full rounded-2xl border border-line px-4 py-3 text-left font-semibold hover:bg-paper"
          >
            {t('bookCover')}
          </button>
          {grouped.map(({ c, items }) => (
            <section key={c.id}>
              <h3 className="mb-2 text-[0.95rem] font-bold text-indigo">{tt(c.label)}</h3>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                {items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => (sceneRef.current?.goTo(PRODUCTS.indexOf(p) + 1), setContents(false))}
                    className={`overflow-hidden rounded-2xl border text-left transition-colors ${product?.id === p.id ? 'border-indigo bg-indigo-wash' : 'border-line hover:border-ink-soft'}`}
                  >
                    <div className="aspect-square bg-[radial-gradient(120%_90%_at_50%_0%,#fff_0%,#eef0e8_100%)]">
                      <Thumb p={p} />
                    </div>
                    <p className="line-clamp-2 px-2 py-1.5 text-[0.78rem] font-semibold leading-snug">{tt(p.name)}</p>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Sheet>
    </>
  );
}
