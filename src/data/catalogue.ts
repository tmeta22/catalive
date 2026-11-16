import { PRODUCTS } from './products';

/**
 * The catalogue book: the order pieces appear in, how a page turns and how
 * the zoom percentage maps to the camera. Pure logic, so it can be tested
 * without a browser.
 */

/** Product ids in the order the book shows them. */
export const BOOK_ORDER: string[] = PRODUCTS.map((p) => p.id);

/** The lowest and highest zoom the book offers, as a percentage of the fit. */
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;

/** Clamp a zoom percentage into the range the book offers. */
export function clampZoom(pct: number): number {
  if (!Number.isFinite(pct)) return 100;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(pct)));
}

/** Index of a product in the book, or 0 when it is not in the catalogue. */
export function bookIndex(id: string | null | undefined): number {
  if (!id) return 0;
  const i = BOOK_ORDER.indexOf(id);
  return i >= 0 ? i : 0;
}

/** Turn the page, wrapping around at both ends. */
export function turnPage(index: number, delta: number, count = BOOK_ORDER.length): number {
  if (count <= 0) return 0;
  return ((index + delta) % count + count) % count;
}

/**
 * The distance from the camera to the piece for a given zoom: 100% frames the
 * piece exactly, 200% is twice as close.
 */
export function zoomDistance(fitDistance: number, pct: number): number {
  return Math.max(fitDistance * (100 / clampZoom(pct)), fitDistance * 0.2);
}
