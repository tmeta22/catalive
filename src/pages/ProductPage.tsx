import { useEffect, useRef, useState } from 'react';
import { BookOpen, FileText, PencilRuler, Share2, Smartphone } from 'lucide-react';
import ARViewer from '../components/ARViewer';
import DrawingSheet from '../components/DrawingSheet';
import { MaterialsSection, NotesSection, OptionsSection, SizeSection } from '../components/Configurator';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import { Insights, PriceBar, ShareSheet, SpecAccordion, SpecSheet } from '../components/ProductBits';
import { Btn } from '../components/ui';
import Viewer from '../components/Viewer';
import { parseConfig, serializeConfig } from '../data/config';
import { CATEGORIES, getProduct, PRODUCTS } from '../data/products';
import type { Product } from '../data/types';
import { useApp } from '../lib/app';
import { navigate, replaceHash } from '../lib/router';

export default function ProductPage({ id, query }: { id: string; query: URLSearchParams }) {
  const p = getProduct(id);
  const { t } = useApp();
  if (!p) {
    return (
      <>
        <Header backTo="/" />
        <main className="mx-auto max-w-lg px-6 py-20 text-center">
          <h1 className="text-xl font-bold">{t('notFoundTitle')}</h1>
          <p className="mt-2 text-ink-soft">{t('notFoundBody')}</p>
          <Btn variant="primary" className="mt-6" onClick={() => navigate('/')}>
            {t('browseAll')}
          </Btn>
        </main>
      </>
    );
  }
  return <ProductInner key={p.id} product={p} query={query} />;
}

function ProductInner({ product, query }: { product: Product; query: URLSearchParams }) {
  const { t, tt, addToBag, toast } = useApp();
  const [cfg, setCfg] = useState(() => parseConfig(product, query));
  const [refit, setRefit] = useState(0);
  const [added, setAdded] = useState(false);
  const [sheet, setSheet] = useState<'drawing' | 'spec' | 'share' | null>(null);
  const [ar, setAr] = useState(false);
  const addedTimer = useRef<number>(0);

  // Keep the address bar shareable without piling up history entries.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const q = serializeConfig(product, cfg);
      replaceHash(`/p/${product.id}${q ? `?${q}` : ''}`);
    }, 250);
    return () => window.clearTimeout(id);
  }, [cfg, product]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = `${tt(product.name)} · Atelier Solis`;
  }, [product, tt]);

  const add = () => {
    addToBag(product.id, cfg);
    setAdded(true);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(false), 1800);
    toast(t('addedToast'), { label: t('viewBag'), run: () => navigate('/bag') });
  };

  const cat = CATEGORIES.find((c) => c.id === product.category)!;
  const related = PRODUCTS.filter((x) => x.category === product.category && x.id !== product.id).slice(0, 4);
  const act = 'tap flex-col gap-1 rounded-2xl px-2 py-2 text-[0.82rem] h-auto min-h-[4.2rem]';

  return (
    <>
      <Header title={tt(product.name)} backTo="/" />
      <main className="lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-[minmax(0,1fr)_30rem] lg:items-start lg:gap-8 lg:px-6 lg:py-6 xl:grid-cols-[minmax(0,1fr)_34rem]">
        <div className="sticky top-14 z-20 h-[40svh] max-h-[430px] min-h-[250px] border-b border-line lg:top-[4.75rem] lg:h-[calc(100svh-6.5rem)] lg:max-h-none lg:overflow-hidden lg:rounded-[1.75rem] lg:border">
          <Viewer product={product} cfg={cfg} refitKey={refit} />
        </div>

        <div className="space-y-4 px-4 pb-44 pt-5 lg:px-0 lg:pb-6 lg:pt-0">
          <div className="space-y-2.5 px-1">
            <p className="text-[0.85rem] font-semibold text-indigo">{tt(cat.label)}</p>
            <h1 className="text-[1.65rem] font-bold leading-tight">{tt(product.name)}</h1>
            <p className="text-ink-soft">{tt(product.tagline)}</p>
            <Insights product={product} cfg={cfg} />
          </div>

          <SizeSection product={product} cfg={cfg} onChange={setCfg} onRefit={() => setRefit((n) => n + 1)} />
          <MaterialsSection product={product} cfg={cfg} onChange={setCfg} />
          <OptionsSection product={product} cfg={cfg} onChange={setCfg} />
          <NotesSection cfg={cfg} onChange={setCfg} />
          <SpecAccordion product={product} cfg={cfg} />

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Btn className={act} onClick={() => setAr(true)}>
              <Smartphone className="size-5 text-indigo" />
              {t('arInRoom')}
            </Btn>
            <Btn className={act} onClick={() => setSheet('drawing')}>
              <PencilRuler className="size-5 text-indigo" />
              {t('drawing')}
            </Btn>
            <Btn className={act} onClick={() => setSheet('spec')}>
              <FileText className="size-5 text-indigo" />
              {t('specSheet')}
            </Btn>
            <Btn className={act} onClick={() => setSheet('share')}>
              <Share2 className="size-5 text-indigo" />
              {t('share')}
            </Btn>
          </div>

          <Btn variant="secondary" full onClick={() => navigate(`/book?p=${product.id}`)} className="h-11">
            <BookOpen className="size-4 text-indigo" />
            {t('bookTitle')}
          </Btn>

          <PriceBar product={product} cfg={cfg} onAdd={add} added={added} />
        </div>
      </main>

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-40 pt-4 sm:px-6 lg:pb-16">
          <h2 className="mb-3 text-[1.2rem] font-bold">{t('moreIn', { category: tt(cat.label) })}</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {related.map((r) => (
              <ProductCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      )}

      <DrawingSheet open={sheet === 'drawing'} onClose={() => setSheet(null)} product={product} cfg={cfg} />
      <SpecSheet open={sheet === 'spec'} onClose={() => setSheet(null)} product={product} cfg={cfg} />
      <ShareSheet open={sheet === 'share'} onClose={() => setSheet(null)} product={product} cfg={cfg} />
      <ARViewer open={ar} onClose={() => setAr(false)} product={product} cfg={cfg} onConfigChange={setCfg} />
    </>
  );
}
