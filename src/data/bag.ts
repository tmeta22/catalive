import { configKey, normalizeConfig, priceBreakdown } from './config';
import { PRODUCT_BY_ID } from './products';
import type { Config } from './types';

export type DeliveryZone = 'phnomPenh' | 'provinces' | 'international';

export interface BagLine {
  key: string;
  productId: string;
  cfg: Config;
  qty: number;
}

export const PROMO_CODE = 'SOLIS10';

export function makeLine(productId: string, cfg: Config, qty = 1): BagLine | null {
  const p = PRODUCT_BY_ID[productId];
  if (!p) return null;
  // Always store a valid config, even if it came from an older catalog or a hand-edited link.
  const safe = normalizeConfig(p, cfg);
  return { key: configKey(p, safe), productId, cfg: safe, qty };
}

export function unitPrice(line: BagLine): number {
  const p = PRODUCT_BY_ID[line.productId];
  return p ? priceBreakdown(p, line.cfg).total : 0;
}

export interface Totals {
  itemCount: number;
  subtotal: number;
  discount: number;
  promoApplied: boolean;
  deliveryFee: number;
  freeThreshold: number | null;
  /** How much more the customer needs to spend for free delivery, if applicable. */
  toFree: number | null;
  total: number;
}

export const DELIVERY: Record<DeliveryZone, { fee: number; freeFrom: number | null }> = {
  phnomPenh: { fee: 120, freeFrom: 4500 },
  provinces: { fee: 280, freeFrom: 6000 },
  international: { fee: 850, freeFrom: null },
};

export function computeTotals(lines: BagLine[], zone: DeliveryZone, promo: string): Totals {
  const itemCount = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + unitPrice(l) * l.qty, 0);
  const promoApplied = promo.trim().toUpperCase() === PROMO_CODE && subtotal > 0;
  const discount = promoApplied ? Math.round(subtotal * 0.1) : 0;
  const after = Math.max(0, subtotal - discount);
  const z = DELIVERY[zone];
  let deliveryFee = 0;
  let toFree: number | null = null;
  if (subtotal > 0) {
    if (z.freeFrom !== null && after >= z.freeFrom) deliveryFee = 0;
    else {
      deliveryFee = z.fee;
      toFree = z.freeFrom === null ? null : z.freeFrom - after;
    }
  }
  return { itemCount, subtotal, discount, promoApplied, deliveryFee, freeThreshold: z.freeFrom, toFree, total: after + deliveryFee };
}
