import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, Minus, PackageOpen, Pencil, Plus, Printer, Send, Trash2, Truck } from 'lucide-react';
import Header from '../components/Header';
import { Btn, Segmented, Sheet } from '../components/ui';
import { computeTotals, DELIVERY, PROMO_CODE, unitPrice, type BagLine, type DeliveryZone } from '../data/bag';
import { describeOptions, leadTime, serializeConfig } from '../data/config';
import { PRODUCT_BY_ID } from '../data/products';
import type { LocalizedText } from '../i18n/translations';
import { useApp } from '../lib/app';
import { buildOrderMessage, newOrderNo, submitOrder, telegramShareUrl, validateCustomer, type Customer, type Order } from '../lib/orders';
import { navigate } from '../lib/router';
import { useStill } from '../lib/useStill';

const L = (en: string, km: string): LocalizedText => ({ en, km });
const PROVINCES: LocalizedText[] = [
  L('Banteay Meanchey', 'បន្ទាយមានជ័យ'), L('Battambang', 'បាត់ដំបង'), L('Kampong Cham', 'កំពង់ចាម'),
  L('Kampong Chhnang', 'កំពង់ឆ្នាំង'), L('Kampong Speu', 'កំពង់ស្ពឺ'), L('Kampong Thom', 'កំពង់ធំ'),
  L('Kampot', 'កំពត'), L('Kandal', 'កណ្តាល'), L('Kep', 'កែប'), L('Koh Kong', 'កោះកុង'), L('Kratie', 'ក្រចេះ'),
  L('Mondulkiri', 'មណ្ឌលគិរី'), L('Oddar Meanchey', 'ឧត្តរមានជ័យ'), L('Pailin', 'ប៉ៃលិន'),
  L('Preah Sihanouk', 'ព្រះសីហនុ'), L('Preah Vihear', 'ព្រះវិហារ'), L('Prey Veng', 'ព្រៃវែង'), L('Pursat', 'ពោធិ៍សាត់'),
  L('Ratanakiri', 'រតនគិរី'), L('Siem Reap', 'សៀមរាប'), L('Stung Treng', 'ស្ទឹងត្រែង'), L('Svay Rieng', 'ស្វាយរៀង'),
  L('Takeo', 'តាកែវ'), L('Tboung Khmum', 'ត្បូងឃ្មុំ'),
];

function BagRow({ line }: { line: BagLine }) {
  const { t, tt, money, len, setQty, removeLine } = useApp();
  const p = PRODUCT_BY_ID[line.productId];
  const { url } = useStill(p, line.cfg, 240);
  const q = serializeConfig(p, line.cfg);
  const lt = leadTime(p, line.cfg);
  const details = describeOptions(p, line.cfg)
    .slice(0, 3)
    .map((d) => tt(d.value))
    .join(' · ');

  return (
    <li className="flex gap-3.5 rounded-[1.25rem] border border-line bg-card p-3 sm:gap-4 sm:p-4">
      <button
        type="button"
        onClick={() => navigate(`/p/${p.id}${q ? `?${q}` : ''}`)}
        className="size-24 shrink-0 overflow-hidden rounded-2xl bg-[radial-gradient(120%_90%_at_50%_0%,#fff_0%,#eef0e8_100%)] sm:size-28"
        aria-label={`${t('edit')}: ${tt(p.name)}`}
      >
        {url ? <img src={url} alt="" className="size-full object-contain p-1" /> : <div className="skeleton size-full" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold leading-snug">{tt(p.name)}</h3>
          <button type="button" onClick={() => removeLine(line.key)} aria-label={t('remove')} className="-mr-1 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-rose-wash hover:text-rose">
            <Trash2 className="size-[1.1rem]" />
          </button>
        </div>
        <p className="text-[0.85rem] tabular-nums text-ink-soft">
          {len(line.cfg.w, false)} × {len(line.cfg.d, false)} × {len(line.cfg.h)}
        </p>
        <p className="truncate text-[0.85rem] text-ink-soft">{details}</p>
        <p className={`mt-0.5 flex items-center gap-1.5 text-[0.8rem] ${lt.kind === 'stock' ? 'font-semibold text-moss' : 'text-ink-soft'}`}>
          <Truck className="size-3.5" />
          {lt.kind === 'stock' ? t('leadStock', { days: lt.days }) : t('leadMade', { a: lt.weeks[0], b: lt.weeks[1] })}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex items-center rounded-full border border-line-strong">
            <button type="button" aria-label="−" onClick={() => setQty(line.key, line.qty - 1)} className="grid size-10 place-items-center rounded-full hover:bg-paper-deep">
              <Minus className="size-4" />
            </button>
            <span className="w-7 text-center font-bold tabular-nums" aria-live="polite">{line.qty}</span>
            <button type="button" aria-label="+" onClick={() => setQty(line.key, line.qty + 1)} className="grid size-10 place-items-center rounded-full hover:bg-paper-deep">
              <Plus className="size-4" />
            </button>
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={() => navigate(`/p/${p.id}${q ? `?${q}` : ''}`)}
              className="mb-0.5 inline-flex items-center gap-1 text-[0.8rem] font-semibold text-indigo hover:underline"
            >
              <Pencil className="size-3" />
              {t('edit')}
            </button>
            <div className="text-[1.05rem] font-bold tabular-nums">{money(unitPrice(line) * line.qty)}</div>
          </div>
        </div>
      </div>
    </li>
  );
}

function Field({
  label,
  error,
  optional,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  htmlFor: string;
}) {
  const { t } = useApp();
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 flex items-baseline justify-between text-[0.9rem] font-semibold">
        {label}
        {optional && <span className="text-[0.75rem] font-normal text-ink-faint">{t('optional')}</span>}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-err`} className="mt-1 text-[0.82rem] font-medium text-rose">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = (err?: string) =>
  `h-12 w-full rounded-xl border bg-paper px-3.5 text-[1rem] outline-none transition-colors placeholder:text-ink-faint focus:bg-card focus:ring-2 ${
    err ? 'border-rose focus:ring-rose/20' : 'border-line-strong focus:border-indigo focus:ring-indigo/20'
  }`;

export default function BagPage() {
  const { t, tt, money, locale, currency, setCurrency, bag, clearBag, toast } = useApp();
  const [zone, setZone] = useState<DeliveryZone>('phnomPenh');
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState('');
  const [promoState, setPromoState] = useState<'idle' | 'ok' | 'bad'>('idle');
  const [c, setC] = useState<Customer>({ name: '', phone: '', email: '', province: '', address: '', note: '', payment: 'khqr' });
  const [errors, setErrors] = useState<ReturnType<typeof validateCustomer>>({});
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<{ order: Order; mode: 'sent' | 'local' } | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const totals = useMemo(() => computeTotals(bag, zone, promo), [bag, zone, promo]);

  const longest = useMemo(() => {
    let w = 0;
    let stock = true;
    for (const l of bag) {
      const lt = leadTime(PRODUCT_BY_ID[l.productId], l.cfg);
      if (lt.kind === 'made') {
        stock = false;
        w = Math.max(w, lt.weeks[1]);
      }
    }
    return { weeks: w, stock };
  }, [bag]);

  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => {
    setC((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const errText = (k: keyof Customer) => (errors[k] === 'required' ? t('errRequired') : errors[k] === 'invalid' ? t('errInvalid') : undefined);

  const applyPromo = () => {
    const v = promoInput.trim().toUpperCase();
    if (!v) return;
    if (v === PROMO_CODE) {
      setPromo(v);
      setPromoState('ok');
    } else {
      setPromo('');
      setPromoState('bad');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateCustomer(c, zone);
    setErrors(errs);
    const first = (Object.keys(errs) as (keyof Customer)[])[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`#f-${first}`)?.focus();
      return;
    }
    setBusy(true);
    const order: Order = {
      no: newOrderNo(),
      createdAt: new Date().toISOString(),
      lines: bag,
      zone,
      promo,
      customer: c,
      totalUsd: totals.total,
    };
    try {
      const mode = await submitOrder(order, locale);
      setPlaced({ order, mode });
      clearBag();
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch {
      toast(t('orderFailed'));
    } finally {
      setBusy(false);
    }
  };

  // ── Confirmation ─────────────────────────────────────────────────────────
  if (placed) {
    const text = buildOrderMessage(placed.order, locale, currency);
    return (
      <>
        <Header title={t('orderReceived')} />
        <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <div className="rounded-[1.75rem] border border-line bg-card p-6 text-center sm:p-8">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-moss-wash text-moss">
              <Check className="size-8" strokeWidth={3} />
            </div>
            <h1 className="text-[1.6rem] font-bold">{t('orderReceived')}</h1>
            <p className="mt-1 text-[1.05rem] font-semibold tabular-nums text-indigo">{placed.order.no}</p>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">{placed.mode === 'sent' ? t('orderSentBody') : t('orderLocalBody')}</p>

            <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
              <a
                href={telegramShareUrl(text)}
                target="_blank"
                rel="noopener noreferrer"
                className={`tap inline-flex items-center justify-center gap-2 rounded-full px-5 font-semibold ${
                  placed.mode === 'local' ? 'bg-indigo text-white hover:bg-indigo-deep sm:col-span-3' : 'border border-line-strong bg-card hover:bg-paper'
                }`}
              >
                <Send className="size-5" />
                {t('sendTelegram')}
              </a>
              <Btn
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(text);
                    toast(t('copied'));
                  } catch {
                    toast(t('copyFailed'));
                  }
                }}
              >
                <Copy className="size-5" />
                {t('copy')}
              </Btn>
              <Btn onClick={() => setPrintOpen(true)}>
                <Printer className="size-5" />
                {t('print')}
              </Btn>
              <Btn variant="ghost" onClick={() => navigate('/')}>
                {t('continueShopping')}
              </Btn>
            </div>
          </div>
          <pre className="mt-5 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-line bg-card p-4 text-[0.85rem] leading-relaxed text-ink-soft">{text}</pre>
        </main>
        <Sheet
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          title={t('orderReceived')}
          printable
          footer={
            <Btn variant="primary" full onClick={() => window.print()} className="mb-1 h-12">
              <Printer className="size-5" />
              {t('print')}
            </Btn>
          }
        >
          <pre className="whitespace-pre-wrap p-5 text-[0.9rem] leading-relaxed">{text}</pre>
        </Sheet>
      </>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────
  if (bag.length === 0) {
    return (
      <>
        <Header title={t('bag')} backTo="/" />
        <main className="mx-auto max-w-md px-6 py-20 text-center">
          <PackageOpen className="mx-auto mb-4 size-14 text-ink-faint" strokeWidth={1.4} />
          <h1 className="text-xl font-bold">{t('bagEmptyTitle')}</h1>
          <p className="mt-2 text-ink-soft">{t('bagEmptyBody')}</p>
          <Btn variant="primary" className="mt-6 h-12" onClick={() => navigate('/')}>
            {t('browseAll')}
          </Btn>
        </main>
      </>
    );
  }

  const zoneOpts: { id: DeliveryZone; label: string }[] = [
    { id: 'phnomPenh', label: t('zonePP') },
    { id: 'provinces', label: t('zoneProv') },
    { id: 'international', label: t('zoneIntl') },
  ];

  return (
    <>
      <Header title={`${t('bag')} (${totals.itemCount})`} backTo="/" />
      <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:py-8">
        <ul className="space-y-3">
          {bag.map((l) => (
            <BagRow key={l.key} line={l} />
          ))}
        </ul>

        <form ref={formRef} onSubmit={submit} noValidate className="space-y-4 lg:sticky lg:top-20">
          <section className="rounded-[1.25rem] border border-line bg-card p-4 sm:p-5">
            <h2 className="mb-3 text-[1.05rem] font-bold">{t('delivery')}</h2>
            <div role="radiogroup" aria-label={t('delivery')} className="grid gap-2">
              {zoneOpts.map((z) => {
                const on = zone === z.id;
                const d = DELIVERY[z.id];
                return (
                  <button
                    key={z.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setZone(z.id)}
                    className={`tap flex flex-wrap items-center justify-between gap-x-3 gap-y-0 rounded-xl border px-3.5 py-2 text-left ${on ? 'border-indigo bg-indigo-wash' : 'border-line-strong hover:border-ink-soft'}`}
                  >
                    <span className="font-semibold">{z.label}</span>
                    <span className="text-[0.82rem] text-ink-soft">
                      {money(d.fee)}
                      {d.freeFrom ? ` · ${t('freeFrom', { amount: money(d.freeFrom) })}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            {totals.toFree !== null && totals.toFree > 0 && (
              <p className="mt-2.5 rounded-xl bg-amber-wash px-3 py-2 text-[0.85rem] text-amber">{t('addForFree', { amount: money(totals.toFree) })}</p>
            )}
          </section>

          <section className="rounded-[1.25rem] border border-line bg-card p-4 sm:p-5">
            <h2 className="mb-3 text-[1.05rem] font-bold">{t('yourDetails')}</h2>
            <div className="space-y-3.5">
              <Field label={t('fName')} htmlFor="f-name" error={errText('name')}>
                <input id="f-name" autoComplete="name" value={c.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'f-name-err' : undefined} className={inputCls(errors.name)} />
              </Field>
              <Field label={t('fPhone')} htmlFor="f-phone" error={errText('phone')}>
                <input id="f-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="012 345 678" value={c.phone} onChange={(e) => set('phone', e.target.value)} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'f-phone-err' : undefined} className={inputCls(errors.phone)} />
              </Field>
              <Field label={t('fEmail')} htmlFor="f-email" error={errText('email')} optional>
                <input id="f-email" type="email" inputMode="email" autoComplete="email" value={c.email} onChange={(e) => set('email', e.target.value)} aria-invalid={!!errors.email} className={inputCls(errors.email)} />
              </Field>
              {zone === 'provinces' && (
                <Field label={t('fProvince')} htmlFor="f-province" error={errText('province')}>
                  <select id="f-province" value={c.province} onChange={(e) => set('province', e.target.value)} aria-invalid={!!errors.province} className={inputCls(errors.province)}>
                    <option value="">{t('choose')}</option>
                    {PROVINCES.map((p) => (
                      <option key={p.en} value={p.en}>
                        {tt(p)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {zone === 'international' && (
                <Field label={t('fCountry')} htmlFor="f-province" error={errText('province')}>
                  <input id="f-province" autoComplete="country-name" value={c.province} onChange={(e) => set('province', e.target.value)} aria-invalid={!!errors.province} className={inputCls(errors.province)} />
                </Field>
              )}
              <Field label={t('fAddress')} htmlFor="f-address" error={errText('address')}>
                <textarea id="f-address" rows={2} autoComplete="street-address" value={c.address} onChange={(e) => set('address', e.target.value)} aria-invalid={!!errors.address} className={`${inputCls(errors.address)} h-auto resize-none py-3`} />
              </Field>
              <Field label={t('fNote')} htmlFor="f-note" optional>
                <textarea id="f-note" rows={2} value={c.note} onChange={(e) => set('note', e.target.value)} placeholder={t('fNotePlaceholder')} className={`${inputCls()} h-auto resize-none py-3`} />
              </Field>
            </div>
          </section>

          <section className="rounded-[1.25rem] border border-line bg-card p-4 sm:p-5">
            <h2 className="mb-1 text-[1.05rem] font-bold">{t('payment')}</h2>
            <p className="mb-3 text-[0.85rem] text-ink-soft">{t('paymentNote')}</p>
            <div role="radiogroup" aria-label={t('payment')} className="grid gap-2">
              {([
                ['khqr', t('payKhqr')],
                ['bank', t('payBank')],
                ['card', t('payCard')],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={c.payment === id}
                  onClick={() => set('payment', id)}
                  className={`tap flex items-center gap-3 rounded-xl border px-3.5 py-2 text-left font-semibold ${c.payment === id ? 'border-indigo bg-indigo-wash' : 'border-line-strong hover:border-ink-soft'}`}
                >
                  <span className={`grid size-5 place-items-center rounded-full border-2 ${c.payment === id ? 'border-indigo' : 'border-line-strong'}`}>
                    {c.payment === id && <span className="size-2.5 rounded-full bg-indigo" />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[1.25rem] border border-line bg-card p-4 sm:p-5">
            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => (setPromoInput(e.target.value), setPromoState('idle'))}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyPromo())}
                placeholder={t('promoPlaceholder')}
                aria-label={t('promo')}
                className={`${inputCls()} uppercase`}
              />
              <Btn onClick={applyPromo} className="h-12">
                {t('apply')}
              </Btn>
            </div>
            {promoState === 'ok' && <p className="mt-2 text-[0.85rem] font-semibold text-moss">{t('promoOk')}</p>}
            {promoState === 'bad' && <p className="mt-2 text-[0.85rem] font-semibold text-rose">{t('promoBad')}</p>}

            <dl className="mt-4 space-y-2 text-[0.95rem]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">{t('subtotal')}</dt>
                <dd className="font-semibold tabular-nums">{money(totals.subtotal)}</dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-moss">
                  <dt>{t('discount')}</dt>
                  <dd className="font-semibold tabular-nums">−{money(totals.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-soft">{t('deliveryFee')}</dt>
                <dd className="font-semibold tabular-nums">{totals.deliveryFee ? money(totals.deliveryFee) : t('free')}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3 text-[1.25rem]">
                <dt className="font-bold">{t('total')}</dt>
                <dd className="font-bold tabular-nums">{money(totals.total)}</dd>
              </div>
            </dl>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[0.82rem] text-ink-soft">{t('showPricesIn')}</span>
              <Segmented
                size="sm"
                label={t('currency')}
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: 'USD', label: 'USD $' },
                  { value: 'KHR', label: 'រៀល ៛' },
                ]}
              />
            </div>

            <p className="mt-3 flex items-start gap-2 rounded-xl bg-paper px-3 py-2.5 text-[0.84rem] text-ink-soft">
              <Truck className="mt-0.5 size-4 shrink-0" />
              {longest.stock ? t('bagLeadStock') : t('bagLeadMade', { weeks: longest.weeks })}
            </p>

            <Btn type="submit" variant="primary" full disabled={busy} className="mt-4 h-13 min-h-[3.25rem] text-[1.05rem]">
              {busy ? t('placing') : t('placeOrder')}
            </Btn>
            <p className="mt-2 text-center text-[0.78rem] text-ink-faint">{t('placeOrderNote')}</p>
          </section>
        </form>
      </main>
    </>
  );
}
