import { forwardRef } from 'react';
import { configKey, describeOptions } from '../data/config';
import type { Config, Product } from '../data/types';
import { useApp } from '../lib/app';
import type { DrawingView } from '../three/studio';

const NICE_SCALES = [2, 2.5, 4, 5, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100];

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

// A3 landscape in millimetres of paper.
const CELLS: Record<DrawingView['view'], Cell> = {
  front: { x: 14, y: 14, w: 212, h: 140 },
  side: { x: 232, y: 14, w: 174, h: 140 },
  top: { x: 14, y: 160, w: 212, h: 123 },
};
const TITLE: Cell = { x: 232, y: 160, w: 174, h: 123 };

export function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

/** A stable drawing number for a product and configuration. */
export function drawingNumber(p: Product, cfg: Config): string {
  return `AS-DWG-${p.sku.replace('AS-KH-', '')}-${hash(configKey(p, cfg))}`;
}

export interface DrawingLayout {
  scale: number;
  denom: number;
  dimsOf: (v: DrawingView['view']) => { w: number; h: number };
}

/** The largest scale at which all three elevations still fit their cells. */
export function drawingLayout(cfg: Config): DrawingLayout {
  const dimsOf = (v: DrawingView['view']) =>
    ({
      front: { w: cfg.w, h: cfg.h },
      side: { w: cfg.d, h: cfg.h },
      top: { w: cfg.w, h: cfg.d },
    })[v];
  const margin = 30; // space for dimension lines
  let max = Infinity;
  for (const v of ['front', 'side', 'top'] as const) {
    const d = dimsOf(v);
    max = Math.min(max, (CELLS[v].w - margin) / d.w, (CELLS[v].h - margin - 8) / d.h);
  }
  const denom = NICE_SCALES.find((n) => 1 / n <= max) ?? NICE_SCALES[NICE_SCALES.length - 1];
  return { scale: 1 / denom, denom, dimsOf };
}

/**
 * The A3 drawing sheet as SVG: three shaded elevations with dimension lines,
 * plus a title block. Shared by the technical-drawing sheet and the catalogue
 * book's 2D mode.
 */
const DrawingSvg = forwardRef<
  SVGSVGElement,
  { views: DrawingView[]; product: Product; cfg: Config; drawingNo: string; layout: DrawingLayout }
>(function DrawingSvg({ views, product, cfg, drawingNo, layout }, ref) {
  const { t, tt, len, unit } = useApp();

  const fmt = (mm: number) => len(mm, false);
  const FONT = "'Kantumruy Pro','Noto Sans Khmer',sans-serif";

  const renderView = (v: DrawingView) => {
    const cell = CELLS[v.view];
    const s = layout.scale;
    const pw = v.widthMm * s;
    const ph = v.heightMm * s;
    const x0 = cell.x + (cell.w - pw) / 2;
    const y0 = cell.y + (cell.h - 8 - ph) / 2;
    const pad = v.padMm * s;
    const tick = (x: number, y: number) => <line x1={x - 1.2} y1={y + 1.2} x2={x + 1.2} y2={y - 1.2} stroke="#1e1b18" strokeWidth={0.3} />;
    const dimY = y0 + ph + 9;
    const dimX = x0 + pw + 9;
    const label = { front: t('viewFront'), side: t('viewSide'), top: t('viewTop') }[v.view];
    return (
      <g key={v.view}>
        <image href={v.url} x={x0 - pad} y={y0 - pad} width={pw + pad * 2} height={ph + pad * 2} preserveAspectRatio="none" />
        <g stroke="#1e1b18" strokeWidth={0.3} fill="none">
          <line x1={x0} y1={y0 + ph + 1.5} x2={x0} y2={dimY + 2} />
          <line x1={x0 + pw} y1={y0 + ph + 1.5} x2={x0 + pw} y2={dimY + 2} />
          <line x1={x0} y1={dimY} x2={x0 + pw} y2={dimY} />
          <line x1={x0 + pw + 1.5} y1={y0} x2={dimX + 2} y2={y0} />
          <line x1={x0 + pw + 1.5} y1={y0 + ph} x2={dimX + 2} y2={y0 + ph} />
          <line x1={dimX} y1={y0} x2={dimX} y2={y0 + ph} />
        </g>
        {tick(x0, dimY)}
        {tick(x0 + pw, dimY)}
        {tick(dimX, y0)}
        {tick(dimX, y0 + ph)}
        <text x={x0 + pw / 2} y={dimY - 1.4} fontSize={3.4} textAnchor="middle" fontFamily={FONT} fill="#1e1b18">
          {fmt(v.widthMm)}
        </text>
        <text
          x={dimX - 1.4}
          y={y0 + ph / 2}
          fontSize={3.4}
          textAnchor="middle"
          fontFamily={FONT}
          fill="#1e1b18"
          transform={`rotate(-90 ${dimX - 1.4} ${y0 + ph / 2})`}
        >
          {fmt(v.heightMm)}
        </text>
        <text x={cell.x + 2} y={cell.y + cell.h - 1} fontSize={3.6} fontWeight={700} fontFamily={FONT} fill="#1e1b18">
          {label}
        </text>
      </g>
    );
  };

  const lines = describeOptions(product, cfg).slice(0, 9);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 420 297"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${tt(product.name)} – ${t('drawingTitle')}`}
    >
      <rect x={0} y={0} width={420} height={297} fill="#ffffff" />
      <rect x={7} y={7} width={406} height={283} fill="none" stroke="#1e1b18" strokeWidth={0.6} />
      {views.map(renderView)}

      <g fontFamily={FONT} fill="#1e1b18">
        <rect x={TITLE.x} y={TITLE.y} width={TITLE.w} height={TITLE.h} fill="none" stroke="#1e1b18" strokeWidth={0.5} />
        <text x={TITLE.x + 5} y={TITLE.y + 11} fontSize={7} fontWeight={700}>
          {tt(product.name)}
        </text>
        <text x={TITLE.x + 5} y={TITLE.y + 18} fontSize={3.6} fill="#55646b">
          Atelier Solis · {product.sku}
        </text>
        <line x1={TITLE.x} y1={TITLE.y + 22} x2={TITLE.x + TITLE.w} y2={TITLE.y + 22} stroke="#1e1b18" strokeWidth={0.3} />
        {lines.map((l, i) => (
          <g key={i}>
            <text x={TITLE.x + 5} y={TITLE.y + 29 + i * 5.2} fontSize={3.3} fill="#55646b">
              {tt(l.label)}
            </text>
            <text x={TITLE.x + 62} y={TITLE.y + 29 + i * 5.2} fontSize={3.3} fontWeight={600}>
              {tt(l.value)}
            </text>
          </g>
        ))}
        <line x1={TITLE.x} y1={TITLE.y + TITLE.h - 30} x2={TITLE.x + TITLE.w} y2={TITLE.y + TITLE.h - 30} stroke="#1e1b18" strokeWidth={0.3} />
        <text x={TITLE.x + 5} y={TITLE.y + TITLE.h - 22} fontSize={3.3} fill="#55646b">
          {t('drawingNo')}
        </text>
        <text x={TITLE.x + 5} y={TITLE.y + TITLE.h - 17} fontSize={4} fontWeight={700}>
          {drawingNo}
        </text>
        <text x={TITLE.x + 62} y={TITLE.y + TITLE.h - 22} fontSize={3.3} fill="#55646b">
          {t('scale')}
        </text>
        <text x={TITLE.x + 62} y={TITLE.y + TITLE.h - 17} fontSize={4} fontWeight={700}>
          1:{layout.denom}
        </text>
        <text x={TITLE.x + 112} y={TITLE.y + TITLE.h - 22} fontSize={3.3} fill="#55646b">
          {t('date')}
        </text>
        <text x={TITLE.x + 112} y={TITLE.y + TITLE.h - 17} fontSize={4} fontWeight={700}>
          {today}
        </text>
        <text x={TITLE.x + 5} y={TITLE.y + TITLE.h - 8} fontSize={3} fill="#55646b">
          {t('drawingUnits', { unit: unit === 'in' ? 'in' : unit })} · {t('drawingTolerance')}
        </text>
        <text x={TITLE.x + 5} y={TITLE.y + TITLE.h - 3.5} fontSize={3} fill="#55646b">
          {t('drawingNote')}
        </text>
      </g>
    </svg>
  );
});

export default DrawingSvg;
