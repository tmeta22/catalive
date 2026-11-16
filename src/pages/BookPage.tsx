import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Layers,
  Package,
  RotateCcw,
  Ruler,
  ShoppingBag,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import ARViewer from '../components/ARViewer';
import BookModel, { type BookModelHandle } from '../components/BookModel';
import DrawingSvg, { drawingLayout, drawingNumber } from '../components/DrawingSvg';
import { Btn, Segmented, swatchStyle } from '../components/ui';
import { bookIndex, clampZoom, turnPage } from '../data/catalogue';
import {
  applyPreset,
  defaultConfig,
  insightsFor,
  isStandardSize,
  leadTime,
  materialDelta,
  normalizeConfig,
  priceBreakdown,
  visibleChoices,
  visibleOptions,
  visibleSlots,
  weightKg,
} from '../data/config';
import { getMaterial } from '../data/materials';
import { CATEGORIES, PRODUCTS } from '../data/products';
import type { Config, OptionSpec, Product } from '../data/types';
import type { StrKey } from '../i18n/strings';
import { useApp } from '../lib/app';
import { goBack, navigate } from '../lib/router';
import { readWishlist, toggleWishlist, type WishItem } from '../lib/wishlist';
import { renderDrawingViews, type DrawingView, type ViewName } from '../three/studio';

type Tab = 'details' | 'materials' | 'options' | 'stock' | 'orders';
type Mode = '3d' | '2d';

const TABS: { id: Tab; icon: typeof Layers; label: StrKey }[] = [
  { id: 'details', icon: BookOpen, label: 'bookTabDetails' },
  { id: 'materials', icon: Layers, label: 'bookTabMaterials' },
  { id: 'options', icon: Sparkles, label: 'bookTabOptions' },
  { id: 'stock', icon: Package, label: 'bookTabStock' },
  { id: 'orders', icon: Heart, label: 'bookTabOrders' },
];

const VIEWS: { id: ViewName; label: string }[] = [
  { id: 'three', label: '3D' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'top', label: 'Top' },
];

export default function BookPage({ query }: { query: URLSearchParams }) {
  const { t, tt, money, locale, setLocale, bag, addToBag, toast } = useApp();

  const [index, setIndex] = useState(() => bookIndex(query.get('p')));
  const [configs, setConfigs] = useState<Record<string, Config>>({});
  const [tab, setTab] = useState<Tab>('details');
  const [mode, setMode] = useState<Mode>('3d');
  const [zoom, setZoom] = useState(100);
  const [guides, setGuides] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [views, setViews] = useState<DrawingView[] | null>(null);
  const [exportViews, setExportViews] = useState<DrawingView[] | null>(null);
  const [arOpen, setArOpen] = useState(false);
  const [wish, setWish] = useState<WishItem[]>(() => readWishlist());

  const modelRef = useRef<BookModelHandle>(null);
  const exportRef = useRef<SVGSVGElement>(null);

  const product = PRODUCTS[index];
  // Keep a stable identity for the config, or every render would restart the
  // drawing effect before it could finish.
  const cfg = useMemo(() => configs[product.id] ?? defaultConfig(product), [configs, product]);
  const setCfg = useCallback(
    (next: Config) => setConfigs((prev) => ({ ...prev, [product.id]: normalizeConfig(product, next) })),
    [product],
  );

  const price = useMemo(() => priceBreakdown(product, cfg), [product, cfg]);
  const layout = useMemo(() => drawingLayout(cfg), [cfg]);
  const drawingNo = useMemo(() => drawingNumber(product, cfg), [product, cfg]);
  const cat = CATEGORIES.find((c) => c.id === product.category)!;

  // Page turns.
  const turn = useCallback((delta: number) => {
    setIndex((i) => turnPage(i, delta));
    setMode('3d');
    setZoom(100);
    setTab('details');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') turn(1);
      else if (e.key === 'ArrowLeft') turn(-1);
      else if (e.key === 'Escape') goBack('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn]);

  useEffect(() => {
    document.title = `${t('bookTitle')} · Atelier Solis`;
  }, [t]);

  // The 2D sheet is only drawn when it is asked for.
  useEffect(() => {
    if (mode !== '2d') {
      setViews(null);
      return;
    }
    let alive = true;
    setViews(null);
    const id = window.setTimeout(() => {
      try {
        const v = renderDrawingViews(product, cfg);
        if (alive) setViews(v);
      } catch {
        if (alive) setViews(null);
      }
    }, 90);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [mode, product, cfg]);

  const exportCad = useCallback(async () => {
    let v = views;
    if (!v) {
      try {
        v = renderDrawingViews(product, cfg);
      } catch {
        v = null;
      }
      if (!v) {
        toast(t('drawingError'));
        return;
      }
      setExportViews(v);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    const el = exportRef.current;
    if (!el) {
      toast(t('drawingError'));
      setExportViews(null);
      return;
    }
    const xml = new XMLSerializer().serializeToString(el);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${drawingNo}.svg`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setExportViews(null);
    toast(t('cadExported'));
  }, [views, product, cfg, drawingNo, t, toast]);

  const save = useCallback(() => {
    const { items, added } = toggleWishlist(product.id, cfg);
    setWish(items);
    toast(added ? t('savedToast') : t('removedFromSaved'));
  }, [product, cfg, t, toast]);

  const savedHere = wish.some((w) => w.productId === product.id);
  const standard = isStandardSize(product, cfg);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-paper-deep">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-paper/95 px-3 backdrop-blur sm:px-5">
        <button
          type="button"
          onClick={() => goBack('/')}
          aria-label={t('close')}
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-paper-deep"
        >
          <X className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.95rem] font-bold leading-tight">{t('bookTitle')}</p>
          <p className="truncate text-[0.75rem] text-ink-faint">
            {tt(cat.label)} · {product.sku}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => turn(-1)}
            aria-label={t('bookPrev')}
            className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-paper-deep"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => turn(1)}
            aria-label={t('bookNext')}
            className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-paper-deep"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <Segmented
          size="sm"
          label={t('language')}
          value={locale}
          onChange={setLocale}
          options={[
            { value: 'km', label: 'ខ្មែរ', aria: 'ភាសាខ្មែរ' },
            { value: 'en', label: 'EN', aria: 'English' },
          ]}
        />
        <button
          type="button"
          onClick={() => navigate('/bag')}
          aria-label={t('bag')}
          className="relative grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-paper-deep"
        >
          <Heart className="size-[1.2rem]" />
          {bag.length > 0 && (
            <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-indigo px-1 text-[0.7rem] font-bold leading-5 text-white">
              {bag.length}
            </span>
          )}
        </button>
      </header>

      {/* ── The spread ───────────────────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 sm:p-5 lg:grid-cols-2 lg:gap-5 lg:overflow-hidden lg:px-16 lg:py-5">
        <section className="order-2 flex min-h-0 flex-col overflow-y-auto rounded-2xl bg-card p-5 shadow-sm lg:order-1">
          <PageHeading product={product} price={price.total} money={money} standard={standard} />
          <div className="mt-4 flex-1">{renderTab()}</div>
        </section>

        <section className="order-1 flex min-h-[46svh] flex-col overflow-hidden rounded-2xl bg-card shadow-sm lg:order-2 lg:min-h-0">
          <div className="relative min-h-0 flex-1">
            {mode === '3d' ? (
              <BookModel
                key={product.id}
                ref={modelRef}
                product={product}
                cfg={cfg}
                guides={guides}
                autoRotate={autoRotate}
                onZoom={(pct) => setZoom(clampZoom(pct))}
              />
            ) : (
              <div className="size-full bg-white p-3">
                {views ? (
                  <DrawingSvg views={views} product={product} cfg={cfg} drawingNo={drawingNo} layout={layout} />
                ) : (
                  <div className="grid size-full place-items-center text-ink-soft">
                    <div className="text-center">
                      <div className="skeleton mx-auto mb-3 h-2 w-40 rounded-full" />
                      {t('drawingLoading')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-line px-3 py-2">
            <div className="flex gap-1">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => modelRef.current?.setView(v.id)}
                  className="tap rounded-full px-2.5 text-[0.75rem] font-semibold text-ink-soft hover:bg-paper-deep"
                >
                  {v.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setGuides((g) => !g)}
              aria-pressed={guides}
              className={`tap ml-auto flex items-center gap-1.5 rounded-full px-2.5 text-[0.75rem] font-semibold ${
                guides ? 'bg-indigo text-white' : 'text-ink-soft hover:bg-paper-deep'
              }`}
            >
              <Ruler className="size-3.5" />
              {t('measurements')}
            </button>
            <button
              type="button"
              onClick={() => setAutoRotate((a) => !a)}
              aria-pressed={autoRotate}
              className={`tap flex items-center gap-1.5 rounded-full px-2.5 text-[0.75rem] font-semibold ${
                autoRotate ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper-deep'
              }`}
            >
              <RotateCcw className="size-3.5" />
              {t('bookSpin')}
            </button>
          </div>
        </section>
      </div>

      {/* ── Control bar ──────────────────────────────────────────────────── */}
      <div className="no-print shrink-0 border-t border-line bg-card px-3 py-2 sm:px-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
          <div role="tablist" aria-label={t('bookSections')} className="scroll-x flex gap-1">
            {TABS.map((x) => {
              const Icon = x.icon;
              const on = tab === x.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(x.id)}
                  className={`tap flex shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.8rem] font-semibold transition-colors ${
                    on ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper-deep'
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{t(x.label)}</span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              label={t('bookMode')}
              value={mode}
              onChange={(m) => setMode(m)}
              options={[
                { value: '2d', label: t('book2d') },
                { value: '3d', label: t('book3d') },
              ]}
            />

            <label className="flex items-center gap-2">
              <span className="sr-only">{t('bookZoom')}</span>
              <input
                type="range"
                className="slider w-28"
                min={50}
                max={200}
                step={5}
                value={zoom}
                onChange={(e) => {
                  const pct = clampZoom(Number(e.target.value));
                  setZoom(pct);
                  modelRef.current?.setZoom(pct);
                }}
                style={{ '--fill': `${((zoom - 50) / 150) * 100}%` } as React.CSSProperties}
              />
              <span className="w-12 shrink-0 text-right text-[0.78rem] font-bold tabular-nums">{zoom}%</span>
            </label>

            <Btn className="h-10 px-3 text-[0.8rem]" onClick={exportCad}>
              <Download className="size-4" />
              <span className="hidden sm:inline">{t('bookExportCad')}</span>
            </Btn>
            <Btn className="h-10 px-3 text-[0.8rem]" onClick={save}>
              <Bookmark className={`size-4 ${savedHere ? 'fill-indigo text-indigo' : ''}`} />
              <span className="hidden sm:inline">{savedHere ? t('saved') : t('bookSave')}</span>
            </Btn>
            <Btn
              className="h-10 px-3 text-[0.8rem]"
              onClick={() => {
                addToBag(product.id, cfg);
                toast(t('addedToast'));
              }}
            >
              <ShoppingBag className="size-4" />
              <span className="hidden sm:inline">{t('addToBag')}</span>
            </Btn>
            <Btn variant="primary" className="h-10 px-3 text-[0.8rem]" onClick={() => setArOpen(true)}>
              <Smartphone className="size-4" />
              <span className="hidden sm:inline">{t('bookAr')}</span>
            </Btn>
          </div>
        </div>
      </div>

      {/* Page turn arrows float over the spread. */}
      <button
        type="button"
        onClick={() => turn(-1)}
        aria-label={t('bookPrev')}
        className="absolute left-1 top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-card/90 text-ink shadow-sm backdrop-blur hover:bg-card lg:grid"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => turn(1)}
        aria-label={t('bookNext')}
        className="absolute right-1 top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-card/90 text-ink shadow-sm backdrop-blur hover:bg-card lg:grid"
      >
        <ChevronRight className="size-5" />
      </button>

      {/* Off-screen sheet used for the CAD export. */}
      {exportViews && (
        <div className="pointer-events-none fixed left-[-9999px] top-0 size-[8px]">
          <DrawingSvg ref={exportRef} views={exportViews} product={product} cfg={cfg} drawingNo={drawingNo} layout={layout} />
        </div>
      )}

      <ARViewer open={arOpen} onClose={() => setArOpen(false)} product={product} cfg={cfg} onConfigChange={setCfg} />
    </div>
  );

  // ── Tab panels ───────────────────────────────────────────────────────────

  function renderTab() {
    switch (tab) {
      case 'materials':
        return <MaterialsTab product={product} cfg={cfg} onChange={setCfg} />;
      case 'options':
        return <OptionsTab product={product} cfg={cfg} onChange={setCfg} />;
      case 'stock':
        return <StockTab product={product} cfg={cfg} />;
      case 'orders':
        return <OrdersTab wish={wish} />;
      default:
        return <DetailsTab product={product} cfg={cfg} onChange={setCfg} />;
    }
  }
}

// ── Page heading ────────────────────────────────────────────────────────────

function PageHeading({
  product,
  price,
  money,
  standard,
}: {
  product: Product;
  price: number;
  money: (usd: number, signed?: boolean) => string;
  standard: boolean;
}) {
  const { t, tt } = useApp();
  return (
    <div className="border-b border-line pb-4">
      <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-indigo">{tt(product.tagline)}</p>
      <h1 className="mt-1 text-[1.5rem] font-bold leading-tight">{tt(product.name)}</h1>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[1.1rem] font-bold">{money(price)}</span>
        {standard && (
          <span className="rounded-full bg-moss-wash px-2.5 py-0.5 text-[0.72rem] font-bold text-moss">{t('inStock')}</span>
        )}
        <span className="text-[0.78rem] text-ink-faint">{product.sku}</span>
      </div>
    </div>
  );
}

// ── Details ────────────────────────────────────────────────────────────────

function DetailsTab({ product, cfg, onChange }: { product: Product; cfg: Config; onChange: (c: Config) => void }) {
  const { t, tt, len, money } = useApp();
  const price = priceBreakdown(product, cfg);
  const insights = insightsFor(product, cfg);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['width', cfg.w],
            ['depth', cfg.d],
            ['height', cfg.h],
          ] as const
        ).map(([key, mm]) => (
          <div key={key} className="rounded-xl bg-paper-deep px-3 py-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-faint">{t(key)}</p>
            <p className="text-[1rem] font-bold tabular-nums">{len(mm)}</p>
          </div>
        ))}
      </div>

      {product.presets.length > 0 && (
        <div>
          <p className="mb-2 text-[0.82rem] font-bold">{t('sizeTitle')}</p>
          <div className="flex flex-wrap gap-1.5">
            {product.presets.map((pr) => {
              const on = pr.w === cfg.w && pr.d === cfg.d && pr.h === cfg.h;
              return (
                <button
                  key={pr.id}
                  type="button"
                  onClick={() => onChange(applyPreset(product, cfg, pr))}
                  className={`tap rounded-full px-3 text-[0.78rem] font-semibold ${
                    on ? 'bg-ink text-white' : 'bg-paper-deep text-ink-soft hover:bg-line-strong'
                  }`}
                >
                  {tt(pr.label)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {insights.length > 0 && (
        <ul className="space-y-1.5">
          {insights.map((i) => (
            <li key={i.id} className="flex gap-2 text-[0.85rem] text-ink-soft">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo" />
              {tt(i.text)}
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="mb-2 text-[0.82rem] font-bold">{t('priceTitle')}</p>
        <dl className="space-y-1 text-[0.85rem]">
          <Row label={t('basePiece')} value={money(price.base)} />
          {price.size !== 0 && <Row label={t('sizeAdjust')} value={money(price.size, true)} />}
          {price.lines.map((l) => (
            <Row key={l.key} label={`${tt(l.label)}${l.detail ? ` · ${tt(l.detail)}` : ''}`} value={money(l.amount, true)} />
          ))}
          <div className="mt-1 flex justify-between border-t border-line pt-1.5 font-bold">
            <span>{t('total')}</span>
            <span className="tabular-nums">{money(price.total)}</span>
          </div>
        </dl>
      </div>

      <dl className="space-y-2 text-[0.85rem]">
        <Row label={t('weight')} value={`${weightKg(product, cfg)} kg`} />
        <Row label={t('construction')} value={tt(product.construction)} />
        <Row label={t('care')} value={tt(product.care)} />
        <Row label={t('warranty')} value={tt(product.warranty)} />
        <Row label={t('origin')} value={tt(product.origin)} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-soft">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

// ── Materials ──────────────────────────────────────────────────────────────

function MaterialsTab({ product, cfg, onChange }: { product: Product; cfg: Config; onChange: (c: Config) => void }) {
  const { t, tt, money } = useApp();
  const slots = visibleSlots(product, cfg);

  return (
    <div className="space-y-5">
      <p className="text-[0.8rem] text-ink-soft">{t('materialsHint')}</p>
      {slots.map((s) => (
        <div key={s.id}>
          <p className="mb-2 text-[0.82rem] font-bold">{tt(s.label)}</p>
          <div className="grid grid-cols-2 gap-2">
            {s.materials.map((id) => {
              const m = getMaterial(id);
              const on = cfg.slots[s.id] === id;
              const delta = materialDelta(product, cfg, s.id, id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange(normalizeConfig(product, { ...cfg, slots: { ...cfg.slots, [s.id]: id } }))}
                  className={`flex items-center gap-2.5 rounded-xl border p-2 text-left transition ${
                    on ? 'border-indigo bg-indigo-wash' : 'border-line hover:border-line-strong'
                  }`}
                >
                  <span className="size-8 shrink-0 rounded-full ring-1 ring-line-strong" style={swatchStyle(m.hex, m.kind)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.82rem] font-semibold">{tt(m.name)}</span>
                    <span className="block truncate text-[0.7rem] text-ink-faint">
                      {delta === 0 ? t('included') : money(delta, true)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Options ────────────────────────────────────────────────────────────────

function OptionsTab({ product, cfg, onChange }: { product: Product; cfg: Config; onChange: (c: Config) => void }) {
  const { t } = useApp();
  const options = visibleOptions(product, cfg);

  if (options.length === 0) return <p className="text-sm text-ink-soft">{t('bookNoOptions')}</p>;

  return (
    <div className="space-y-5">
      {options.map((o) => (
        <OptionRow key={o.id} o={o} product={product} cfg={cfg} onChange={onChange} />
      ))}
    </div>
  );
}

function OptionRow({
  o,
  product,
  cfg: c,
  onChange,
}: {
  o: OptionSpec;
  product: Product;
  cfg: Config;
  onChange: (c: Config) => void;
}) {
  const { t, tt } = useApp();
  const value = c.opts[o.id];

  if (o.type === 'choice') {
    return (
      <div>
        <p className="mb-2 text-[0.82rem] font-bold">{tt(o.label)}</p>
        <div className="flex flex-wrap gap-1.5">
          {visibleChoices(o, c).map((ch) => {
            const on = value === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onChange(normalizeConfig(product, { ...c, opts: { ...c.opts, [o.id]: ch.id } }))}
                className={`tap rounded-full px-3 text-[0.78rem] font-semibold ${
                  on ? 'bg-ink text-white' : 'bg-paper-deep text-ink-soft hover:bg-line-strong'
                }`}
              >
                {tt(ch.label)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (o.type === 'toggle') {
    const on = value === true;
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(normalizeConfig(product, { ...c, opts: { ...c.opts, [o.id]: !on } }))}
        className="flex w-full items-center justify-between rounded-xl border border-line px-3 py-2.5 text-left"
      >
        <span className="text-[0.82rem] font-semibold">{tt(o.label)}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold ${on ? 'bg-moss-wash text-moss' : 'bg-paper-deep text-ink-faint'}`}>
          {on ? t('yes') : t('no')}
        </span>
      </button>
    );
  }

  const n = Number(value);
  return (
    <div>
      <p className="mb-2 text-[0.82rem] font-bold">{tt(o.label)}</p>
      <div className="flex items-center gap-2">
        <input
          type="range"
          className="slider flex-1"
          min={o.min}
          max={o.max}
          step={1}
          value={n}
          onChange={(e) => onChange(normalizeConfig(product, { ...c, opts: { ...c.opts, [o.id]: Number(e.target.value) } }))}
          style={{ '--fill': `${((n - o.min) / Math.max(1, o.max - o.min)) * 100}%` } as React.CSSProperties}
        />
        <span className="w-8 text-right text-[0.82rem] font-bold tabular-nums">{n}</span>
      </div>
    </div>
  );
}

// ── Stock ──────────────────────────────────────────────────────────────────

function StockTab({ product, cfg }: { product: Product; cfg: Config }) {
  const { t, tt } = useApp();
  const lead = leadTime(product, cfg);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-paper-deep p-4">
        <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint">{t('leadTime')}</p>
        <p className="mt-1 text-[1.05rem] font-bold">
          {lead.kind === 'stock' ? t('leadStock', { days: lead.days }) : t('leadMade', { a: lead.weeks[0], b: lead.weeks[1] })}
        </p>
        {lead.kind === 'made' && lead.custom && <p className="mt-1 text-[0.8rem] text-ink-soft">{t('leadCustomNote')}</p>}
      </div>

      <dl className="space-y-2 text-[0.85rem]">
        <Row label={t('dimensions')} value={`${cfg.w} × ${cfg.d} × ${cfg.h} mm`} />
        <Row label={t('weight')} value={`${weightKg(product, cfg)} kg`} />
        <Row label={t('sku')} value={product.sku} />
        <Row label={t('origin')} value={tt(product.origin)} />
      </dl>

      <p className="text-[0.8rem] text-ink-soft">{t('deliveryNote')}</p>
    </div>
  );
}

// ── Orders (bag + saved designs) ───────────────────────────────────────────

function OrdersTab({ wish }: { wish: WishItem[] }) {
  const { t, tt, money, bag } = useApp();

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[0.82rem] font-bold">{t('bag')}</p>
        {bag.length === 0 ? (
          <p className="text-[0.85rem] text-ink-soft">{t('bagEmptyBody')}</p>
        ) : (
          <ul className="space-y-1.5">
            {bag.map((l) => {
              const p = PRODUCTS.find((x) => x.id === l.productId);
              if (!p) return null;
              return (
                <li key={l.key} className="flex items-baseline justify-between gap-3 text-[0.85rem]">
                  <span className="truncate">
                    {tt(p.name)} <span className="text-ink-faint">×{l.qty}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{money(priceBreakdown(p, l.cfg).total * l.qty)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-[0.82rem] font-bold">{t('bookSaved')}</p>
        {wish.length === 0 ? (
          <p className="text-[0.85rem] text-ink-soft">{t('bookSavedEmpty')}</p>
        ) : (
          <ul className="space-y-1.5">
            {wish.map((w, i) => {
              const p = PRODUCTS.find((x) => x.id === w.productId);
              if (!p) return null;
              return (
                <li key={`${w.productId}-${i}`} className="flex items-baseline justify-between gap-3 text-[0.85rem]">
                  <span className="truncate">{tt(p.name)}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{money(priceBreakdown(p, w.cfg).total)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
