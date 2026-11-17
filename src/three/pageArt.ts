import { defaultConfig, leadTime } from '../data/config';
import { getMaterial } from '../data/materials';
import { CATEGORIES, PRODUCTS } from '../data/products';
import type { Product } from '../data/types';
import { S, type StrKey } from '../i18n/strings';
import { formatLength, formatMoney, pick, type Currency, type Locale, type Unit } from '../i18n/translations';
import { renderDrawingViews } from './studio';

export const PAGE_W = 720;
export const PAGE_H = 1022;

export interface ArtEnv {
  locale: Locale;
  currency: Currency;
  unit: Unit;
}

const FONT = "'Kantumruy Pro','Noto Sans Khmer',system-ui,sans-serif";
const C = { paper: '#fbfaf6', ink: '#1e2a2f', soft: '#536168', faint: '#7d898e', line: '#dcdfd6', indigo: '#2e3c86', amber: '#b87d1f' };
const M = 58;

export const tr = (key: StrKey, env: ArtEnv, vars?: Record<string, string | number>): string => {
  let s = pick(S[key], env.locale);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
};

/** Make sure Latin and Khmer glyphs are ready before anything is drawn. */
export async function loadFonts(): Promise<void> {
  if (!document.fonts?.load) return;
  const jobs: Promise<unknown>[] = [];
  for (const w of [400, 500, 600, 700]) {
    jobs.push(document.fonts.load(`${w} 32px "Kantumruy Pro"`, 'Aa'));
    jobs.push(document.fonts.load(`${w} 32px "Kantumruy Pro"`, 'កខគ'));
  }
  await Promise.allSettled(jobs);
}

export function newPageCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = PAGE_W;
  c.height = PAGE_H;
  return c;
}

/** Paper with a soft shadow where the page curves into the gutter. */
function paper(ctx: CanvasRenderingContext2D, side: 'left' | 'right') {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  const g = ctx.createLinearGradient(side === 'left' ? PAGE_W : 0, 0, side === 'left' ? PAGE_W * 0.72 : PAGE_W * 0.28, 0);
  g.addColorStop(0, 'rgba(60,50,35,0.16)');
  g.addColorStop(1, 'rgba(60,50,35,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
}

/** Wrap text to a width. Khmer has no spaces between words, so use the word segmenter. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, locale: Locale): string[] {
  let tokens: string[];
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: 'word' }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) tokens = Array.from(new Seg(locale, { granularity: 'word' }).segment(text), (x) => x.segment);
  else tokens = locale === 'km' ? Array.from(text) : text.split(/(\s+)/);

  const lines: string[] = [];
  let line = '';
  for (const tok of tokens) {
    const test = line + tok;
    if (ctx.measureText(test).width <= maxW || !line) {
      line = test;
      if (ctx.measureText(line).width > maxW) {
        // A single token wider than the line: break by character.
        let cur = '';
        for (const ch of Array.from(line)) {
          if (ctx.measureText(cur + ch).width > maxW && cur) {
            lines.push(cur);
            cur = ch;
          } else cur += ch;
        }
        line = cur;
      }
    } else {
      lines.push(line.trimEnd());
      line = tok.trimStart();
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

interface TextOpts {
  size: number;
  weight?: number;
  color?: string;
  align?: CanvasTextAlign;
  maxW?: number;
  maxLines?: number;
  lineH?: number;
}

/** Draws wrapped text; returns the y after the last line. */
function text(ctx: CanvasRenderingContext2D, env: ArtEnv, s: string, x: number, y: number, o: TextOpts): number {
  ctx.font = `${o.weight ?? 400} ${o.size}px ${FONT}`;
  ctx.fillStyle = o.color ?? C.ink;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  const lh = o.lineH ?? o.size * (env.locale === 'km' ? 1.62 : 1.32);
  let lines = o.maxW ? wrapText(ctx, s, o.maxW, env.locale) : [s];
  if (o.maxLines && lines.length > o.maxLines) {
    lines = lines.slice(0, o.maxLines);
    lines[o.maxLines - 1] = lines[o.maxLines - 1].replace(/[\s,.;]+$/, '') + '…';
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + lines.length * lh;
}

function folio(ctx: CanvasRenderingContext2D, env: ArtEnv, n: number, side: 'left' | 'right') {
  text(ctx, env, String(n), side === 'left' ? M : PAGE_W - M, PAGE_H - 44, { size: 22, color: C.faint, align: side === 'left' ? 'left' : 'right', weight: 500 });
}

function rule(ctx: CanvasRenderingContext2D, y: number) {
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, y);
  ctx.lineTo(PAGE_W - M, y);
  ctx.stroke();
}

// ── Intro spread ───────────────────────────────────────────────────────────

export function drawIntroLeft(c: HTMLCanvasElement, env: ArtEnv): void {
  const ctx = c.getContext('2d')!;
  paper(ctx, 'left');
  // Brand mark: a sala roof over a daybed.
  ctx.save();
  ctx.translate(M, 92);
  ctx.scale(1.15, 1.15);
  ctx.fillStyle = C.indigo;
  ctx.beginPath();
  ctx.roundRect(0, 0, 64, 64, 16);
  ctx.fill();
  ctx.fillStyle = C.paper;
  ctx.beginPath();
  ctx.moveTo(9, 27);
  ctx.quadraticCurveTo(24, 25, 32, 11);
  ctx.quadraticCurveTo(40, 25, 55, 27);
  ctx.quadraticCurveTo(42, 29, 32, 23);
  ctx.quadraticCurveTo(22, 29, 9, 27);
  ctx.fill();
  ctx.fillRect(18, 31, 4, 21);
  ctx.fillRect(42, 31, 4, 21);
  ctx.fillStyle = '#c58b2a';
  ctx.beginPath();
  ctx.roundRect(13, 44, 38, 5, 2.5);
  ctx.fill();
  ctx.restore();

  text(ctx, env, 'Atelier Solis', M, 240, { size: 30, weight: 700 });
  let y = text(ctx, env, tr('heroTitle', env), M, 360, { size: 58, weight: 700, maxW: PAGE_W - M * 2, lineH: env.locale === 'km' ? 88 : 68 });
  y = text(ctx, env, tr('heroBody', env), M, y + 24, { size: 27, color: C.soft, maxW: PAGE_W - M * 2 - 20, maxLines: 8 });
  rule(ctx, PAGE_H - 150);
  text(ctx, env, tr('bookIntroHint', env), M, PAGE_H - 100, { size: 24, color: C.indigo, weight: 600, maxW: PAGE_W - M * 2, maxLines: 2 });
  folio(ctx, env, 1, 'left');
}

export function drawIntroRight(c: HTMLCanvasElement, env: ArtEnv): void {
  const ctx = c.getContext('2d')!;
  paper(ctx, 'right');
  text(ctx, env, tr('bookContents', env), M, 128, { size: 44, weight: 700 });
  let y = 196;
  for (const cat of CATEGORIES) {
    ctx.fillStyle = C.indigo;
    text(ctx, env, pick(cat.label, env.locale), M, y, { size: 25, weight: 700, color: C.indigo });
    y += 14;
    for (const p of PRODUCTS.filter((x) => x.category === cat.id)) {
      y += env.locale === 'km' ? 44 : 38;
      ctx.font = `500 24px ${FONT}`;
      const name = pick(p.name, env.locale);
      const num = String(3 + 2 * PRODUCTS.indexOf(p));
      text(ctx, env, name, M, y, { size: 24, weight: 500, maxW: PAGE_W - M * 2 - 70, maxLines: 1 });
      text(ctx, env, num, PAGE_W - M, y, { size: 22, color: C.faint, align: 'right' });
    }
    y += 34;
  }
  folio(ctx, env, 2, 'right');
}

// ── Product spread ─────────────────────────────────────────────────────────

export interface DrawingImages {
  front: HTMLImageElement;
  side: HTMLImageElement;
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

/** Hidden-line front and side elevations of the standard build. */
export async function loadDrawingImages(p: Product): Promise<DrawingImages | null> {
  try {
    const views = renderDrawingViews(p, defaultConfig(p), 520);
    if (!views) return null;
    const [front, side] = await Promise.all([loadImg(views[0].url), loadImg(views[1].url)]);
    return { front, side };
  } catch {
    return null;
  }
}

export function drawProductLeft(c: HTMLCanvasElement, p: Product, env: ArtEnv, n: number, art: DrawingImages | null): void {
  const ctx = c.getContext('2d')!;
  paper(ctx, 'left');
  const cat = CATEGORIES.find((x) => x.id === p.category)!;
  const cfg = defaultConfig(p);
  const len = (mm: number, withUnit = false) => formatLength(mm, env.unit, withUnit);

  text(ctx, env, pick(cat.label, env.locale), M, 96, { size: 25, weight: 600, color: C.indigo });
  let y = text(ctx, env, pick(p.name, env.locale), M, 162, { size: 50, weight: 700, maxW: PAGE_W - M * 2, maxLines: 2, lineH: env.locale === 'km' ? 80 : 60 });
  y = text(ctx, env, pick(p.tagline, env.locale), M, y + 10, { size: 25, color: C.soft, maxW: PAGE_W - M * 2, maxLines: 3 });

  // Elevations.
  const top = Math.max(y + 24, 360);
  const boxW = (PAGE_W - M * 2 - 24) / 2;
  const boxH = 270;
  const drawAt = (img: HTMLImageElement | undefined, x: number, caption: string, dims: string) => {
    ctx.fillStyle = '#f4f3ee';
    ctx.beginPath();
    ctx.roundRect(x, top, boxW, boxH, 18);
    ctx.fill();
    if (img) {
      const k = Math.min((boxW - 30) / img.width, (boxH - 30) / img.height);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      const dx = x + (boxW - img.width * k) / 2;
      const dy = top + (boxH - img.height * k) / 2;
      // Twice, so the thin linework prints dark enough to read on a small page.
      ctx.drawImage(img, dx, dy, img.width * k, img.height * k);
      ctx.drawImage(img, dx, dy, img.width * k, img.height * k);
      ctx.restore();
    } else {
      ctx.fillStyle = C.line;
      ctx.fillRect(x + boxW / 2 - 40, top + boxH / 2 - 2, 80, 4);
    }
    text(ctx, env, caption, x + 8, top + boxH + 34, { size: 21, weight: 600 });
    text(ctx, env, dims, x + 8, top + boxH + 62, { size: 20, color: C.faint });
  };
  drawAt(art?.front, M, tr('viewFront', env), `${len(cfg.w)} × ${len(cfg.h, true)}`);
  drawAt(art?.side, M + boxW + 24, tr('viewSide', env), `${len(cfg.d)} × ${len(cfg.h, true)}`);

  // Specs.
  let sy = top + boxH + 130;
  rule(ctx, sy - 38);
  const lt = leadTime(p, cfg);
  const lead = lt.kind === 'stock' ? tr('leadStock', env, { days: lt.days }) : tr('leadMade', env, { a: lt.weeks[0], b: lt.weeks[1] });
  const rows: [string, string][] = [
    [tr('bookSizeRange', env), `${len(p.dims.w.min)}–${len(p.dims.w.max)} · ${len(p.dims.h.min)}–${len(p.dims.h.max, true)}`],
    [tr('from', env), formatMoney(p.basePrice, env.currency)],
    [tr('leadTime', env), lead],
  ];
  for (const [k, v] of rows) {
    text(ctx, env, k, M, sy, { size: 22, color: C.faint, weight: 500 });
    text(ctx, env, v, PAGE_W - M, sy, { size: 23, weight: 600, align: 'right', maxW: 380, maxLines: 1 });
    sy += env.locale === 'km' ? 52 : 46;
  }

  // Standard materials.
  sy += 10;
  let x = M;
  for (const s of p.slots.filter((q) => !q.when).slice(0, 3)) {
    const m = getMaterial(s.default);
    ctx.fillStyle = m.hex;
    ctx.beginPath();
    ctx.arc(x + 20, sy + 4, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, env, pick(m.name, env.locale), x + 50, sy + 12, { size: 19, color: C.soft, maxW: 130, maxLines: 1 });
    x += 210;
  }
  folio(ctx, env, n, 'left');
}

export function drawProductRight(c: HTMLCanvasElement, _p: Product, env: ArtEnv, n: number): void {
  const ctx = c.getContext('2d')!;
  paper(ctx, 'right');
  // A soft plate for the pop-up piece to stand on.
  const g = ctx.createRadialGradient(PAGE_W * 0.5, PAGE_H * 0.52, 30, PAGE_W * 0.5, PAGE_H * 0.52, PAGE_W * 0.46);
  g.addColorStop(0, 'rgba(46,60,134,0.10)');
  g.addColorStop(1, 'rgba(46,60,134,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(PAGE_W * 0.5, PAGE_H * 0.52, PAGE_W * 0.46, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, env, 'Atelier Solis', PAGE_W - M, 96, { size: 22, color: C.faint, weight: 500, align: 'right' });
  text(ctx, env, tr('bookPopHint', env), PAGE_W / 2, PAGE_H - 130, { size: 21, color: C.faint, align: 'center', maxW: PAGE_W - M * 2, maxLines: 2 });
  folio(ctx, env, n, 'right');
}
