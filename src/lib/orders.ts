import { computeTotals, unitPrice, type BagLine, type DeliveryZone } from '../data/bag';
import { describeOptions, leadTime, priceBreakdown } from '../data/config';
import { PRODUCT_BY_ID } from '../data/products';
import { formatLength, formatMoney, pick, type Currency, type Locale } from '../i18n/translations';
import { readJson, writeJson } from './storage';

export interface Customer {
  name: string;
  phone: string;
  email: string;
  province: string;
  address: string;
  note: string;
  payment: 'khqr' | 'card' | 'bank';
}

export interface Order {
  no: string;
  createdAt: string;
  lines: BagLine[];
  zone: DeliveryZone;
  promo: string;
  customer: Customer;
  totalUsd: number;
}

export function newOrderNo(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const rand = Math.floor(Math.random() * 36 ** 3).toString(36).toUpperCase().padStart(3, '0');
  return `AS-${String(now.getFullYear()).slice(2)}${p(now.getMonth() + 1)}${p(now.getDate())}-${rand}`;
}

export function validateCustomer(c: Customer, zone: DeliveryZone): Partial<Record<keyof Customer, 'required' | 'invalid'>> {
  const e: Partial<Record<keyof Customer, 'required' | 'invalid'>> = {};
  if (c.name.trim().length < 2) e.name = 'required';
  const digits = c.phone.replace(/\D/g, '');
  if (!c.phone.trim()) e.phone = 'required';
  else if (digits.length < 8 || digits.length > 15) e.phone = 'invalid';
  if (c.email.trim() && !/^\S+@\S+\.\S+$/.test(c.email.trim())) e.email = 'invalid';
  if (!c.address.trim()) e.address = 'required';
  if (zone !== 'phnomPenh' && !c.province.trim()) e.province = 'required';
  return e;
}

/** Plain-text order summary, suitable for Telegram, email or print. */
export function buildOrderMessage(o: Order, locale: Locale, currency: Currency = 'USD'): string {
  const money = (n: number) => formatMoney(n, currency);
  const t = computeTotals(o.lines, o.zone, o.promo);
  const out: string[] = [];
  out.push(`Atelier Solis · ${o.no}`);
  out.push('');
  for (const l of o.lines) {
    const p = PRODUCT_BY_ID[l.productId];
    if (!p) continue;
    out.push(`${l.qty} × ${pick(p.name, locale)} (${p.sku})`);
    out.push(`  ${formatLength(l.cfg.w, 'cm')} × ${formatLength(l.cfg.d, 'cm')} × ${formatLength(l.cfg.h, 'cm')}`);
    for (const d of describeOptions(p, l.cfg)) out.push(`  ${pick(d.label, locale)}: ${pick(d.value, locale)}`);
    if (l.cfg.note.trim()) out.push(`  “${l.cfg.note.trim()}”`);
    const lt = leadTime(p, l.cfg);
    out.push(`  ${lt.kind === 'stock' ? (locale === 'km' ? `មានក្នុងស្តុក ${lt.days} ថ្ងៃ` : `In stock, ${lt.days} days`) : locale === 'km' ? `${lt.weeks[0]}–${lt.weeks[1]} សប្តាហ៍` : `${lt.weeks[0]}–${lt.weeks[1]} weeks`}`);
    out.push(`  ${money(unitPrice(l))} × ${l.qty} = ${money(unitPrice(l) * l.qty)}`);
    out.push('');
  }
  out.push(`Subtotal: ${money(t.subtotal)}`);
  if (t.discount) out.push(`Discount (${o.promo.toUpperCase()}): −${money(t.discount)}`);
  out.push(`Delivery: ${t.deliveryFee ? money(t.deliveryFee) : locale === 'km' ? 'ឥតគិតថ្លៃ' : 'Free'}`);
  out.push(`Total: ${money(t.total)}`);
  out.push('');
  out.push(`${o.customer.name} · ${o.customer.phone}`);
  out.push([o.customer.address, o.customer.province].filter(Boolean).join(', '));
  if (o.customer.note.trim()) out.push(o.customer.note.trim());
  return out.join('\n');
}

const ORDERS_KEY = 'solis.orders.v1';

export function saveOrder(o: Order): void {
  const all = readJson<Order[]>(ORDERS_KEY, []);
  writeJson(ORDERS_KEY, [o, ...all].slice(0, 20));
}

/**
 * Sends the order to your backend when VITE_ORDER_ENDPOINT is set.
 * With no endpoint the order is only stored on this device and shared by the
 * customer (Telegram / copy / print), so nothing is silently lost or faked.
 */
export async function submitOrder(o: Order, locale: Locale): Promise<'sent' | 'local'> {
  saveOrder(o);
  const endpoint = import.meta.env.VITE_ORDER_ENDPOINT as string | undefined;
  if (!endpoint) return 'local';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: o, message: buildOrderMessage(o, locale), totalUsd: o.totalUsd }),
  });
  if (!res.ok) throw new Error(`Order endpoint responded ${res.status}`);
  return 'sent';
}

export function telegramShareUrl(text: string): string {
  const handle = (import.meta.env.VITE_TELEGRAM_USERNAME as string | undefined)?.replace(/^@/, '');
  if (handle) return `https://t.me/${handle}?text=${encodeURIComponent(text)}`;
  return `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(text)}`;
}

export { priceBreakdown };
