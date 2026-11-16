import assert from 'node:assert/strict';
import test from 'node:test';
import { BOOK_ORDER, bookIndex, clampZoom, turnPage, zoomDistance, ZOOM_MAX, ZOOM_MIN } from './catalogue';
import { PRODUCTS } from './products';

test('the book lists every piece in the catalogue, once', () => {
  assert.equal(BOOK_ORDER.length, PRODUCTS.length);
  assert.equal(new Set(BOOK_ORDER).size, PRODUCTS.length);
});

test('the book opens on the requested piece, or the first one', () => {
  assert.equal(bookIndex(PRODUCTS[3].id), 3);
  assert.equal(bookIndex(null), 0);
  assert.equal(bookIndex('not-a-piece'), 0);
});

test('turning a page wraps around both ends', () => {
  assert.equal(turnPage(0, 1), 1);
  assert.equal(turnPage(2, -1), 1);
  assert.equal(turnPage(0, -1), BOOK_ORDER.length - 1);
  assert.equal(turnPage(BOOK_ORDER.length - 1, 1), 0);
  assert.equal(turnPage(0, 0), 0);
});

test('zoom is clamped to the range the book offers', () => {
  assert.equal(clampZoom(0), ZOOM_MIN);
  assert.equal(clampZoom(1000), ZOOM_MAX);
  assert.equal(clampZoom(135), 135);
  assert.equal(clampZoom(134.6), 135);
  assert.equal(clampZoom(Number.NaN), 100);
});

test('100% frames the piece and 200% is twice as close', () => {
  assert.equal(zoomDistance(4, 100), 4);
  assert.equal(zoomDistance(4, 200), 2);
  assert.equal(zoomDistance(4, 50), 8);
  // The percentage is clamped first, so the camera never dives inside the piece.
  assert.equal(zoomDistance(4, 2000), 2);
  assert.equal(zoomDistance(4, 0), 8);
});
