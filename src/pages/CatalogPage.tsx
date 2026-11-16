import { useMemo, useState } from 'react';
import { BookOpen, Compass, Hammer, Ruler, Search, Send, Truck, X } from 'lucide-react';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import { BrandMark, Segmented, swatchStyle } from '../components/ui';
import { defaultConfig, normalizeConfig } from '../data/config';
import { getMaterial } from '../data/materials';
import { CATEGORIES, PRODUCT_BY_ID, PRODUCTS } from '../data/products';
import type { CategoryId } from '../data/types';
import { useApp } from '../lib/app';
import { navigate } from '../lib/router';
import { useStill } from '../lib/useStill';

type Sort = 'featured' | 'priceAsc' | 'priceDesc';

function Hero() {
  const { t, tt, len } = useApp();
  const sofa = PRODUCT_BY_ID.sofa;
  const base = defaultConfig(sofa);
  const cfg = normalizeConfig(sofa, { ...base, w: 2600 });
  const { url } = useStill(sofa, cfg, 720);
  const m = getMaterial(cfg.slots.surface ?? 'chalk');

  return (
    <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-5 px-4 pb-5 pt-5 sm:px-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-10 md:pb-10 md:pt-12">
      <div>
        <h1 className="text-[1.75rem] font-bold leading-[1.2] tracking-tight sm:text-[2.6rem] lg:text-[3.1rem]">{t('heroTitle')}</h1>
        <p className="mt-3 max-w-xl text-[0.98rem] text-ink-soft">{t('heroBody')}</p>
        <div className="scroll-x -mx-4 mt-4 flex gap-2 px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {[
            [Ruler, t('trustSize')],
            [Truck, t('trustDelivery')],
            [Hammer, t('trustMade')],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Ruler;
            return (
              <span key={label as string} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-[0.85rem] font-semibold">
                <I className="size-4 text-indigo" />
                {label as string}
              </span>
            );
          })}
        </div>
        <a
          href="#catalog"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          className="tap mt-5 inline-flex items-center rounded-full bg-indigo px-6 py-3 font-semibold text-white hover:bg-indigo-deep"
        >
          {t('heroCta')}
        </a>
      </div>

      <button
        type="button"
        onClick={() => navigate('/p/sofa?w=2600')}
        aria-label={tt(sofa.name)}
        className="relative aspect-[16/11] overflow-hidden rounded-[2rem] md:aspect-[5/4] border border-line bg-[radial-gradient(120%_100%_at_50%_0%,#ffffff_0%,#e7eaf6_100%)] text-left"
      >
        {url ? <img src={url} alt={tt(sofa.name)} className="size-full object-contain p-3" /> : <div className="skeleton size-full" />}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1 text-[0.82rem] font-semibold shadow-sm">
          <Ruler className="size-3.5 text-indigo" />
          {t('width')} {len(cfg.w)}
        </span>
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-card/95 px-3 py-1 text-[0.82rem] font-semibold shadow-sm">
          <span className="size-4 rounded-full ring-1 ring-line-strong" style={swatchStyle(m.hex, m.kind)} />
          {tt(m.name)}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-ink px-3 py-1 text-[0.82rem] font-semibold text-white">{t('tryIt')}</span>
      </button>
    </section>
  );
}

export default function CatalogPage() {
  const { t, tt, currency, setCurrency } = useApp();
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('featured');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = PRODUCTS.filter((p) => cat === 'all' || p.category === cat);
    if (needle) {
      out = out.filter((p) => [p.name.km, p.name.en, p.tagline.en, p.tagline.km, p.sku, ...(p.keywords ?? [])].some((s) => s.toLowerCase().includes(needle)));
    }
    if (sort === 'priceAsc') out = [...out].sort((a, b) => a.basePrice - b.basePrice);
    if (sort === 'priceDesc') out = [...out].sort((a, b) => b.basePrice - a.basePrice);
    return out;
  }, [cat, q, sort]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: PRODUCTS.length };
    for (const p of PRODUCTS) m[p.category] = (m[p.category] ?? 0) + 1;
    return m;
  }, []);

  const chips: { id: CategoryId | 'all'; label: string }[] = [{ id: 'all', label: t('all') }, ...CATEGORIES.map((c) => ({ id: c.id, label: tt(c.label) }))];
  const tg = (import.meta.env.VITE_TELEGRAM_USERNAME as string | undefined)?.replace(/^@/, '');

  return (
    <>
      <Header />
      <main>
        <Hero />

        <section id="catalog" className="scroll-mt-16">
          <div className="sticky top-14 z-20 border-y border-line bg-paper/92 backdrop-blur-md">
            <div className="scroll-x mx-auto flex max-w-7xl gap-2 px-4 py-2.5 sm:px-6" role="tablist" aria-label={t('categories')}>
              {chips.map((c) => {
                const on = cat === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setCat(c.id)}
                    className={`tap shrink-0 rounded-full border px-4 text-[0.92rem] font-semibold transition-colors ${
                      on ? 'border-ink bg-ink text-white' : 'border-line-strong bg-card hover:border-ink-soft'
                    }`}
                  >
                    {c.label}
                    <span className={`ml-1.5 text-[0.78rem] ${on ? 'text-white/70' : 'text-ink-faint'}`}>{counts[c.id]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <label className="relative min-w-0 flex-1 basis-56">
                <span className="sr-only">{t('search')}</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[1.15rem] -translate-y-1/2 text-ink-faint" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="h-11 w-full rounded-full border border-line-strong bg-card pl-10 pr-10 outline-none placeholder:text-ink-faint focus:border-indigo focus:ring-2 focus:ring-indigo/20"
                />
                {q && (
                  <button type="button" onClick={() => setQ('')} aria-label={t('clear')} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-soft hover:bg-paper-deep">
                    <X className="size-4" />
                  </button>
                )}
              </label>
              <label className="flex items-center gap-2 text-[0.88rem] text-ink-soft">
                <span className="sr-only sm:not-sr-only">{t('sort')}</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="tap rounded-full border border-line-strong bg-card px-3.5 font-semibold text-ink outline-none focus:border-indigo"
                >
                  <option value="featured">{t('sortFeatured')}</option>
                  <option value="priceAsc">{t('sortPriceAsc')}</option>
                  <option value="priceDesc">{t('sortPriceDesc')}</option>
                </select>
              </label>
              <Segmented
                label={t('currency')}
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: 'USD', label: '$' },
                  { value: 'KHR', label: '៛' },
                ]}
              />
              <button
                type="button"
                onClick={() => navigate('/book')}
                className="tap inline-flex items-center gap-2 rounded-full border border-line-strong bg-card px-3.5 font-semibold text-ink hover:border-ink-soft"
              >
                <BookOpen className="size-4 text-indigo" />
                {t('bookTitle')}
              </button>
            </div>

            {list.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-line-strong bg-card px-6 py-14 text-center">
                <Compass className="mx-auto mb-3 size-9 text-ink-faint" />
                <p className="font-semibold">{t('noResults')}</p>
                <button
                  type="button"
                  onClick={() => (setQ(''), setCat('all'))}
                  className="tap mt-3 rounded-full bg-indigo px-5 font-semibold text-white"
                >
                  {t('clearFilters')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
                {list.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-paper-deep">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <div className="flex items-center gap-2.5">
              <BrandMark />
              <span className="text-lg font-bold">Atelier Solis</span>
            </div>
            <p className="mt-3 text-[0.92rem] text-ink-soft">{t('footerAbout')}</p>
          </div>
          <div className="text-[0.92rem]">
            <p className="font-semibold">{t('footerTalk')}</p>
            <p className="mt-1 text-ink-soft">{t('footerHours')}</p>
            {tg && (
              <a href={`https://t.me/${tg}`} target="_blank" rel="noopener noreferrer" className="tap mt-3 inline-flex items-center gap-2 rounded-full bg-indigo px-5 font-semibold text-white">
                <Send className="size-4" />
                Telegram
              </a>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}
