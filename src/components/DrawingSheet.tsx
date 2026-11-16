import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { Config, Product } from '../data/types';
import { useApp } from '../lib/app';
import { renderDrawingViews, type DrawingView } from '../three/studio';
import DrawingSvg, { drawingLayout, drawingNumber } from './DrawingSvg';
import { Btn, Sheet } from './ui';

export default function DrawingSheet({ open, onClose, product, cfg }: { open: boolean; onClose: () => void; product: Product; cfg: Config }) {
  const { t } = useApp();
  const [views, setViews] = useState<DrawingView[] | 'error' | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!open) return;
    setViews(null);
    const id = window.setTimeout(() => {
      try {
        setViews(renderDrawingViews(product, cfg) ?? 'error');
      } catch {
        setViews('error');
      }
    }, 80);
    return () => window.clearTimeout(id);
  }, [open, product, cfg]);

  const drawingNo = useMemo(() => drawingNumber(product, cfg), [product, cfg]);
  const layout = useMemo(() => drawingLayout(cfg), [cfg]);

  const download = () => {
    const el = svgRef.current;
    if (!el) return;
    const xml = new XMLSerializer().serializeToString(el);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${drawingNo}.svg`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      printable
      title={t('drawingTitle')}
      footer={
        <div className="flex gap-2 pb-1">
          <Btn full onClick={download} disabled={!Array.isArray(views)} className="h-12">
            <Download className="size-5" />
            {t('downloadSvg')}
          </Btn>
          <Btn variant="primary" full onClick={() => window.print()} disabled={!Array.isArray(views)} className="h-12">
            <Printer className="size-5" />
            {t('print')}
          </Btn>
        </div>
      }
    >
      <div className="drawing-page overflow-x-auto bg-paper-deep p-3 sm:p-5">
        {views === null && (
          <div className="grid aspect-[420/297] place-items-center rounded-lg bg-white text-ink-soft">
            <div className="text-center">
              <div className="skeleton mx-auto mb-3 h-2 w-40 rounded-full" />
              {t('drawingLoading')}
            </div>
          </div>
        )}
        {views === 'error' && (
          <div className="grid aspect-[420/297] place-items-center rounded-lg bg-white p-6 text-center text-ink-soft">{t('drawingError')}</div>
        )}
        {Array.isArray(views) && (
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <DrawingSvg ref={svgRef} views={views} product={product} cfg={cfg} drawingNo={drawingNo} layout={layout} />
          </div>
        )}
      </div>
    </Sheet>
  );
}
