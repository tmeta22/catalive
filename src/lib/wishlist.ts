import type { Config } from '../data/types';
import { readJson, writeJson } from './storage';

const KEY = 'solis.wishlist.v1';

export interface WishItem {
  productId: string;
  cfg: Config;
  at: number;
}

/** Designs the customer saved for later, kept on their device. */
export function readWishlist(): WishItem[] {
  const raw = readJson<WishItem[]>(KEY, []);
  return raw.filter((x) => x && typeof x.productId === 'string' && !!x.cfg);
}

export function writeWishlist(items: WishItem[]): void {
  writeJson(KEY, items);
}

/** Add a design to the saved list, or remove it if it is already there. */
export function toggleWishlist(productId: string, cfg: Config): { items: WishItem[]; added: boolean } {
  const items = readWishlist();
  const hit = items.find((x) => x.productId === productId && sameConfig(x.cfg, cfg));
  if (hit) {
    const next = items.filter((x) => x !== hit);
    writeWishlist(next);
    return { items: next, added: false };
  }
  const next = [...items, { productId, cfg, at: Date.now() }];
  writeWishlist(next);
  return { items: next, added: true };
}

function sameConfig(a: Config, b: Config): boolean {
  return (
    a.w === b.w &&
    a.d === b.d &&
    a.h === b.h &&
    JSON.stringify(a.slots) === JSON.stringify(b.slots) &&
    JSON.stringify(a.opts) === JSON.stringify(b.opts)
  );
}
