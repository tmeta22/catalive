import { useState } from 'react';
import { Check, ChevronDown, Copy, Printer, Send, Share2, ShoppingBag, Truck } from 'lucide-react';
import { describeOptions, insightsFor, leadTime, priceBreakdown, weightKg } from '../data/config';
import type { Config, Product } from '../data/types';
import { useApp } from '../lib/app';
import { telegramShareUrl } from '../lib/orders';
import { useStill } from '../lib/useStill';
import { Btn, BrandMark, Segmented, Sheet } from './ui';

export function useLeadText(p: Product, cfg: Config): { short: string; long: string; stock: boolean } {
  const { t } = useApp();
  const lt = leadTime(p, cfg);
  if (lt.kind === 'stock') {
    const s = t('leadStock', { days: lt.days });
    return { short: s, long: s, stock: true };
  }
  const s = t('leadMade', { a: lt.weeks[0], b: lt.weeks[1] });
  return { short: s, long: lt.custom ? `${s} · ${t('leadCustomNote')}` : s, stock: false };
}

// ── Price bar & breakdown ──────────────────────────────────────────────────

export function PriceBar({ product, cfg, onAdd, added }: { product: Product; cfg: Config; onAdd: () => void; added: boolean }) {
  const { t, money } = useApp();
  const [open, setOpen] = useState(false);
  const { total } = priceBreakdown(product, cfg);
  const lead = useLeadText(product, cfg);

  return (
    <>
      <div className="pb-safe no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 px-4 pt-3 shadow-bar backdrop-blur lg:sticky lg:inset-x-auto lg:bottom-4 lg:rounded-2xl lg:border lg:px-5 lg:shadow-float">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 rounded-xl py-0.5 text-left" aria-label={t('seePrice')}>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[1.4rem] font-bold leading-tight tabular-nums">{money(total)}</span>
              <span className="whitespace-nowrap text-[0.78rem] font-semibold text-indigo underline decoration-indigo/30 underline-offset-2">{t('seePrice')}</span>
            </div>
            <div className={`flex items-center gap-1.5 truncate text-[0.82rem] ${lead.stock ? 'font-semibold text-moss' : 'text-ink-soft'}`}>
              <Truck className="size-3.5 shrink-0" />
              <span className="truncate">{lead.short}</span>
            </div>
          </button>
          <Btn variant="primary" onClick={onAdd} className="h-12 shrink-0 px-6" aria-live="polite">
            {added ? (
              <>
                <Check className="size-5" strokeWidth={3} />
                {t('added')}
              </>
            ) : (
              <>
                <ShoppingBag className="size-5" />
                {t('addToBag')}
              </>
            )}
          </Btn>
        </div>
      </div>
      <PriceSheet open={open} onClose={() => setOpen(false)} product={product} cfg={cfg} />
    </>
  );
}

export function PriceSheet({ open, onClose, product, cfg }: { open: boolean; onClose: () => void; product: Product; cfg: Config }) {
  const { t, tt, money, currency, setCurrency, len } = useApp();
  const b = priceBreakdown(product, cfg);
  const lead = useLeadText(product, cfg);
  const row = 'flex items-baseline justify-between gap-4 py-2.5';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('priceTitle')}
      footer={
        <div className="flex items-center justify-between gap-3 pb-1">
          <span className="text-[0.85rem] text-ink-soft">{t('showPricesIn')}</span>
          <Segmented
            label={t('currency')}
            value={currency}
            onChange={setCurrency}
            options={[
              { value: 'USD', label: 'USD $' },
              { value: 'KHR', label: 'រៀល ៛', aria: 'Riel' },
            ]}
          />
        </div>
      }
    >
      <div className="px-5 py-3">
        <div className="divide-y divide-line">
          <div className={row}>
            <span>{t('basePiece')}</span>
            <span className="font-semibold tabular-nums">{money(b.base)}</span>
          </div>
          {b.size !== 0 && (
            <div className={row}>
              <span>
                {t('sizeAdjust')}
                <span className="block text-[0.8rem] text-ink-soft">
                  {len(cfg.w, false)} × {len(cfg.d, false)} × {len(cfg.h)}
                </span>
              </span>
              <span className="font-semibold tabular-nums">{money(b.size, true)}</span>
            </div>
          )}
          {b.lines.map((l) => (
            <div key={l.key} className={row}>
              <span>
                {tt(l.label)}
                {l.detail && <span className="block text-[0.8rem] text-ink-soft">{tt(l.detail)}</span>}
              </span>
              <span className={`font-semibold tabular-nums ${l.amount < 0 ? 'text-moss' : ''}`}>{money(l.amount, true)}</span>
            </div>
          ))}
          <div className={`${row} text-[1.15rem]`}>
            <span className="font-bold">{t('total')}</span>
            <span className="font-bold tabular-nums">{money(b.total)}</span>
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-paper px-3.5 py-2.5 text-[0.85rem] text-ink-soft">
          <Truck className="mr-1.5 inline size-4 align-[-3px]" />
          {lead.long}. {t('deliveryNote')}
        </p>
      </div>
    </Sheet>
  );
}

// ── Specifications ─────────────────────────────────────────────────────────

export function SpecList({ product, cfg }: { product: Product; cfg: Config }) {
  const { t, tt, len, locale } = useApp();
  const lead = useLeadText(product, cfg);
  const rows: [string, string][] = [
    [t('dimensions'), `${len(cfg.w, false)} × ${len(cfg.d, false)} × ${len(cfg.h)}  (${t('whd')})`],
    [t('weight'), `≈ ${weightKg(product, cfg)} kg`],
    ...describeOptions(product, cfg).map((d) => [tt(d.label), tt(d.value)] as [string, string]),
    [t('leadTime'), lead.long],
    [t('construction'), tt(product.construction)],
    [t('care'), tt(product.care)],
    [t('warranty'), tt(product.warranty)],
    [t('origin'), tt(product.origin)],
    [t('sku'), product.sku],
  ];
  const notes = cfg.note.trim();
  if (notes) rows.splice(2, 0, [t('notesTitle'), notes]);
  void locale;
  return (
    <dl className="divide-y divide-line text-[0.92rem]">
      {rows.map(([k, v], i) => (
        <div key={`${k}-${i}`} className="grid grid-cols-[7.5rem_1fr] gap-3 py-2.5 sm:grid-cols-[10rem_1fr]">
          <dt className="text-ink-soft">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SpecAccordion({ product, cfg }: { product: Product; cfg: Config }) {
  const { t } = useApp();
  return (
    <details className="group rounded-[1.25rem] border border-line bg-card" open>
      <summary className="tap flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <h2 className="text-[1.05rem] font-bold">{t('specsTitle')}</h2>
        <ChevronDown className="size-5 text-ink-soft transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-3 sm:px-5">
        <SpecList product={product} cfg={cfg} />
      </div>
    </details>
  );
}

export function Insights({ product, cfg }: { product: Product; cfg: Config }) {
  const { tt } = useApp();
  const items = insightsFor(product, cfg);
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((i) => (
        <li key={i.id} className="rounded-full bg-moss-wash px-3.5 py-1 text-[0.85rem] font-semibold text-moss">
          {tt(i.text)}
        </li>
      ))}
    </ul>
  );
}

// ── Share ──────────────────────────────────────────────────────────────────

export function ShareSheet({ open, onClose, product, cfg }: { open: boolean; onClose: () => void; product: Product; cfg: Config }) {
  const { t, tt, money, toast, len } = useApp();
  const link = () => window.location.href;
  const summary = () =>
    `${tt(product.name)}\n${len(cfg.w, false)} × ${len(cfg.d, false)} × ${len(cfg.h)}\n${money(priceBreakdown(product, cfg).total)}\n${link()}`;
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link());
      toast(t('linkCopied'));
    } catch {
      toast(t('copyFailed'));
    }
    onClose();
  };

  const row = 'tap flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3 text-left font-semibold hover:bg-paper';
  return (
    <Sheet open={open} onClose={onClose} title={t('shareTitle')}>
      <div className="space-y-2.5 px-5 py-4">
        <p className="mb-1 text-[0.9rem] text-ink-soft">{t('shareHint')}</p>
        <button type="button" className={row} onClick={copy}>
          <Copy className="size-5 text-indigo" />
          {t('copyLink')}
        </button>
        <a className={row} href={telegramShareUrl(summary())} target="_blank" rel="noopener noreferrer" onClick={onClose}>
          <Send className="size-5 text-indigo" />
          {t('sendTelegram')}
        </a>
        {canShare && (
          <button
            type="button"
            className={row}
            onClick={() => {
              navigator.share({ title: tt(product.name), text: summary(), url: link() }).catch(() => undefined);
              onClose();
            }}
          >
            <Share2 className="size-5 text-indigo" />
            {t('moreShare')}
          </button>
        )}
      </div>
    </Sheet>
  );
}

// ── Printable spec sheet ───────────────────────────────────────────────────

export function SpecSheet({ open, onClose, product, cfg }: { open: boolean; onClose: () => void; product: Product; cfg: Config }) {
  const { t, tt, money } = useApp();
  const { url } = useStill(product, cfg, 640);
  const b = priceBreakdown(product, cfg);
  const insights = insightsFor(product, cfg);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('specSheetTitle')}
      printable
      footer={
        <Btn variant="primary" full onClick={() => window.print()} className="mb-1 h-12">
          <Printer className="size-5" />
          {t('print')}
        </Btn>
      }
    >
      <div className="print-doc px-6 py-5">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-9" />
            <div>
              <div className="font-bold leading-tight">Atelier Solis</div>
              <div className="text-[0.78rem] text-ink-soft">{t('tagline')}</div>
            </div>
          </div>
          <div className="text-right text-[0.8rem] text-ink-soft">
            {product.sku}
            <br />
            {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </div>
        <div className="grid gap-5 py-4 sm:grid-cols-[14rem_1fr]">
          <div>
            {url && <img src={url} alt={tt(product.name)} className="aspect-square w-full rounded-2xl bg-paper object-contain" />}
            <div className="mt-3 text-[1.5rem] font-bold tabular-nums">{money(b.total)}</div>
          </div>
          <div>
            <h3 className="text-[1.35rem] font-bold leading-tight">{tt(product.name)}</h3>
            <p className="mt-1 text-ink-soft">{tt(product.tagline)}</p>
            {insights.length > 0 && <p className="mt-2 text-[0.9rem] font-semibold text-moss">{insights.map((i) => tt(i.text)).join(' · ')}</p>}
            <div className="mt-3">
              <SpecList product={product} cfg={cfg} />
            </div>
          </div>
        </div>
        <p className="border-t border-line pt-3 text-[0.78rem] text-ink-soft">{t('specSheetFoot')}</p>
      </div>
    </Sheet>
  );
}
