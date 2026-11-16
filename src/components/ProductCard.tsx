import { Package } from 'lucide-react';
import { defaultConfig, leadTime } from '../data/config';
import { getMaterial } from '../data/materials';
import type { Product } from '../data/types';
import { useApp } from '../lib/app';
import { navigate } from '../lib/router';
import { useStill } from '../lib/useStill';
import { swatchStyle } from './ui';

export default function ProductCard({ p }: { p: Product }) {
  const { t, tt, money, len } = useApp();
  const cfg = defaultConfig(p);
  const { url, failed } = useStill(p, cfg, 480);
  const lt = leadTime(p, cfg);
  const dots = p.slots.filter((s) => !s.when).slice(0, 3);
  const widthRange = `${len(p.dims.w.min, false)}–${len(p.dims.w.max)}`;

  return (
    <a
      href={`#/p/${p.id}`}
      onClick={(e) => {
        e.preventDefault();
        navigate(`/p/${p.id}`);
      }}
      className="group flex flex-col overflow-hidden rounded-[1.25rem] border border-line bg-card transition-shadow hover:shadow-float focus-visible:shadow-float"
    >
      <div className="relative aspect-square bg-[radial-gradient(120%_90%_at_50%_0%,#ffffff_0%,#eef0e8_100%)]">
        {url ? (
          <img
            src={url}
            alt={tt(p.name)}
            width={480}
            height={480}
            className="size-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : failed ? (
          <div className="grid size-full place-items-center text-ink-faint">
            <Package className="size-10" />
          </div>
        ) : (
          <div className="skeleton size-full" />
        )}
        {lt.kind === 'stock' && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-moss-wash px-2.5 py-0.5 text-[0.72rem] font-semibold text-moss">
            {t('inStock')}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5 pt-3">
        <h3 className="line-clamp-2 text-[0.98rem] font-bold leading-snug">{tt(p.name)}</h3>
        <p className="text-[0.82rem] text-ink-soft">
          {t('widthRange')} {widthRange}
        </p>
        <div className="mt-auto flex items-end justify-between pt-1.5">
          <div>
            <div className="text-[0.72rem] text-ink-faint">{t('from')}</div>
            <div className="text-[1.05rem] font-bold tabular-nums">{money(p.basePrice)}</div>
          </div>
          <div className="flex -space-x-1.5" aria-hidden>
            {dots.map((s) => {
              const m = getMaterial(s.default);
              return <span key={s.id} className="size-5 rounded-full ring-2 ring-white" style={swatchStyle(m.hex, m.kind)} />;
            })}
          </div>
        </div>
      </div>
    </a>
  );
}
