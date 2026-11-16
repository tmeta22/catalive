import { useEffect, useState, type ReactNode } from 'react';
import { Check, Minus, Plus, RotateCcw } from 'lucide-react';
import {
  allowedRange,
  applyPreset,
  defaultConfig,
  isRound,
  matchingPreset,
  normalizeConfig,
  priceBreakdown,
  visibleChoices,
  visibleOptions,
  visibleSlots,
} from '../data/config';
import { getMaterial } from '../data/materials';
import type { Config, DimSpec, OptionSpec, OptionValue, Product } from '../data/types';
import { useApp } from '../lib/app';
import { fromUnit, toUnit, unitDecimals } from '../i18n/translations';
import { Segmented, swatchStyle } from './ui';

export function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[1.25rem] border border-line bg-card p-4 sm:p-5">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[1.05rem] font-bold">{title}</h2>
          {hint && <p className="mt-0.5 text-[0.85rem] text-ink-soft">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

interface EditProps {
  product: Product;
  cfg: Config;
  onChange: (c: Config) => void;
}

const deltaText = (n: number, money: (v: number, s?: boolean) => string) => (n === 0 ? '' : money(n, true));

// ── Size ───────────────────────────────────────────────────────────────────

function DimRow({
  label,
  mm,
  range,
  onCommit,
}: {
  label: string;
  mm: number;
  range: DimSpec;
  onCommit: (mm: number) => void;
}) {
  const { unit, len, t } = useApp();
  const dec = unitDecimals(unit);
  const shown = toUnit(mm, unit).toFixed(dec).replace(/\.0+$/, '');
  const [text, setText] = useState(shown);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(shown);
  }, [shown, focus]);

  const commit = () => {
    const v = Number.parseFloat(text.replace(',', '.'));
    if (Number.isFinite(v)) onCommit(fromUnit(v, unit));
    else setText(shown);
  };
  const pct = ((mm - range.min) / (range.max - range.min)) * 100;
  const atEdge = mm <= range.min ? 'min' : mm >= range.max ? 'max' : null;
  const id = `dim-${label}`;

  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[0.95rem] font-semibold">
          {label}
        </label>
        <div className="flex items-center rounded-xl border border-line-strong bg-paper focus-within:border-indigo focus-within:ring-2 focus-within:ring-indigo/20">
          <input
            id={id}
            inputMode="decimal"
            value={text}
            onFocus={(e) => (setFocus(true), e.currentTarget.select())}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => (setFocus(false), commit())}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), undefined)}
            className="h-11 w-20 bg-transparent pl-3 pr-1 text-right text-[1rem] font-bold tabular-nums outline-none"
          />
          <span className="pr-3 text-[0.85rem] text-ink-soft">{unit === 'in' ? '″' : unit}</span>
        </div>
      </div>
      <input
        type="range"
        className="slider mt-1"
        min={range.min}
        max={range.max}
        step={range.step}
        value={mm}
        style={{ ['--fill' as string]: `${pct}%` }}
        aria-label={label}
        aria-valuetext={len(mm)}
        onChange={(e) => onCommit(Number(e.target.value))}
      />
      <div className="-mt-1 flex justify-between text-[0.75rem] text-ink-faint">
        <span>{len(range.min, false)}</span>
        <span className={atEdge ? 'font-semibold text-amber' : ''}>{atEdge === 'min' ? t('smallest') : atEdge === 'max' ? t('largest') : ''}</span>
        <span>{len(range.max)}</span>
      </div>
    </div>
  );
}

export function SizeSection({ product, cfg, onChange, onRefit }: EditProps & { onRefit: () => void }) {
  const { t, tt, unit, setUnit } = useApp();
  const range = allowedRange(product, cfg);
  const round = isRound(product, cfg);
  const preset = matchingPreset(product, cfg);
  const def = defaultConfig(product);
  const changed = cfg.w !== def.w || cfg.d !== def.d || cfg.h !== def.h;
  const set = (patch: Partial<Config>) => onChange(normalizeConfig(product, { ...cfg, ...patch }));

  return (
    <Section
      title={t('sizeTitle')}
      hint={t('sizeHint')}
      action={
        <Segmented
          size="sm"
          label={t('units')}
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'cm', label: 'cm' },
            { value: 'mm', label: 'mm' },
            { value: 'in', label: 'in' },
          ]}
        />
      }
    >
      <div className="-mx-1 mb-3 flex flex-wrap gap-2 px-1">
        {product.presets.map((pr) => {
          const on = preset?.id === pr.id;
          return (
            <button
              key={pr.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                onChange(applyPreset(product, cfg, pr));
                onRefit();
              }}
              className={`tap rounded-full border px-4 text-[0.9rem] font-semibold transition-colors ${
                on ? 'border-indigo bg-indigo-wash text-indigo' : 'border-line-strong bg-card text-ink hover:border-ink-soft'
              }`}
            >
              {tt(pr.label)}
            </button>
          );
        })}
        {!preset && (
          <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-amber-wash px-4 text-[0.9rem] font-semibold text-amber">
            {t('yourSize')}
          </span>
        )}
      </div>

      <div className="divide-y divide-line">
        <DimRow label={round ? t('diameter') : t('width')} mm={cfg.w} range={range.w} onCommit={(mm) => set({ w: mm })} />
        {!round && <DimRow label={t('depth')} mm={cfg.d} range={range.d} onCommit={(mm) => set({ d: mm })} />}
        <DimRow label={product.heightLabel ? tt(product.heightLabel) : t('height')} mm={cfg.h} range={range.h} onCommit={(mm) => set({ h: mm })} />
      </div>

      {changed && (
        <button
          type="button"
          onClick={() => {
            onChange(normalizeConfig(product, { ...cfg, w: def.w, d: def.d, h: def.h }));
            onRefit();
          }}
          className="tap mt-2 inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-indigo hover:underline"
        >
          <RotateCcw className="size-4" />
          {t('resetSize')}
        </button>
      )}
    </Section>
  );
}

// ── Materials ──────────────────────────────────────────────────────────────

export function MaterialsSection({ product, cfg, onChange }: EditProps) {
  const { t, tt, money } = useApp();
  const slots = visibleSlots(product, cfg);
  const total = priceBreakdown(product, cfg).total;
  const bd = priceBreakdown(product, cfg);

  return (
    <Section title={t('materialsTitle')} hint={t('materialsHint')}>
      <div className="space-y-6">
        {slots.map((slot) => {
          const current = getMaterial(cfg.slots[slot.id] ?? slot.default);
          const saved = bd.lines.find((l) => l.key === `slot:${slot.id}`)?.amount ?? 0;
          return (
            <div key={slot.id}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-[0.95rem] font-semibold">{tt(slot.label)}</h3>
                {slot.help && <span className="text-[0.78rem] text-ink-faint">{tt(slot.help)}</span>}
              </div>
              <div role="radiogroup" aria-label={tt(slot.label)} className="flex flex-wrap gap-x-2 gap-y-3">
                {slot.materials.map((id) => {
                  const m = getMaterial(id);
                  const on = id === current.id;
                  const next = normalizeConfig(product, { ...cfg, slots: { ...cfg.slots, [slot.id]: id } });
                  const delta = on ? 0 : priceBreakdown(product, next).total - total;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${tt(m.name)}${delta ? `, ${deltaText(delta, money)}` : ''}`}
                      onClick={() => onChange(next)}
                      className="group flex w-[3.6rem] flex-col items-center gap-1"
                    >
                      <span
                        className={`relative grid size-12 place-items-center rounded-full ring-offset-2 transition-shadow ${
                          on ? 'ring-2 ring-indigo' : 'ring-1 ring-line-strong group-hover:ring-ink-soft'
                        }`}
                        style={swatchStyle(m.hex, m.kind)}
                      >
                        {on && (
                          <span className="grid size-5 place-items-center rounded-full bg-white/95 text-indigo shadow">
                            <Check className="size-3.5" strokeWidth={3} />
                          </span>
                        )}
                      </span>
                      <span className="h-4 text-[0.68rem] font-medium tabular-nums text-ink-faint">{deltaText(delta, money)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 rounded-xl bg-paper px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.92rem] font-semibold">{tt(current.name)}</span>
                  {saved !== 0 && <span className="text-[0.8rem] font-semibold tabular-nums text-amber">{money(saved, true)}</span>}
                </div>
                <p className="text-[0.82rem] text-ink-soft">{tt(current.note)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── Detail options ─────────────────────────────────────────────────────────

export function OptionsSection({ product, cfg, onChange }: EditProps) {
  const { t, tt, money } = useApp();
  const opts = visibleOptions(product, cfg);
  if (opts.length === 0) return null;
  const total = priceBreakdown(product, cfg).total;

  const set = (id: string, v: OptionValue) => onChange(normalizeConfig(product, { ...cfg, opts: { ...cfg.opts, [id]: v } }));
  const deltaOf = (id: string, v: OptionValue) =>
    priceBreakdown(product, normalizeConfig(product, { ...cfg, opts: { ...cfg.opts, [id]: v } })).total - total;

  return (
    <Section title={t('detailsTitle')} hint={t('detailsHint')}>
      <div className="space-y-5">
        {opts.map((o) => (
          <OptionControl key={o.id} o={o} cfg={cfg} set={set} deltaOf={deltaOf} tt={tt} money={money} />
        ))}
      </div>
    </Section>
  );
}

function OptionControl({
  o,
  cfg,
  set,
  deltaOf,
  tt,
  money,
}: {
  o: OptionSpec;
  cfg: Config;
  set: (id: string, v: OptionValue) => void;
  deltaOf: (id: string, v: OptionValue) => number;
  tt: ReturnType<typeof useApp>['tt'];
  money: ReturnType<typeof useApp>['money'];
}) {
  const label = (
    <div className="mb-2">
      <h3 className="text-[0.95rem] font-semibold">{tt(o.label)}</h3>
      {o.help && <p className="text-[0.8rem] text-ink-faint">{tt(o.help)}</p>}
    </div>
  );

  if (o.type === 'choice') {
    const cur = cfg.opts[o.id];
    return (
      <div>
        {label}
        <div role="radiogroup" aria-label={tt(o.label)} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visibleChoices(o, cfg).map((c) => {
            const on = cur === c.id;
            const d = on ? 0 : deltaOf(o.id, c.id);
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set(o.id, c.id)}
                className={`tap flex flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors ${
                  on ? 'border-indigo bg-indigo-wash' : 'border-line-strong bg-card hover:border-ink-soft'
                }`}
              >
                <span className={`text-[0.9rem] font-semibold leading-tight ${on ? 'text-indigo' : ''}`}>{tt(c.label)}</span>
                {d !== 0 && <span className="text-[0.75rem] font-medium tabular-nums text-ink-soft">{money(d, true)}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (o.type === 'toggle') {
    const on = cfg.opts[o.id] === true;
    const d = deltaOf(o.id, !on);
    return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-[0.95rem] font-semibold">{tt(o.label)}</h3>
          <p className="text-[0.8rem] tabular-nums text-ink-soft">{d !== 0 ? (on ? `${money(-d, true)} ` : `${money(d, true)}`) : o.help ? tt(o.help) : ''}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={tt(o.label)}
          onClick={() => set(o.id, !on)}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? 'bg-indigo' : 'bg-line-strong'}`}
        >
          <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
        </button>
      </div>
    );
  }

  const n = Number(cfg.opts[o.id]);
  const step = (dv: number) => set(o.id, Math.max(o.min, Math.min(o.max, n + dv)));
  const up = n < o.max ? deltaOf(o.id, n + 1) : 0;
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h3 className="text-[0.95rem] font-semibold">{tt(o.label)}</h3>
        {up !== 0 && <p className="text-[0.8rem] tabular-nums text-ink-soft">{money(up, true)} / +1</p>}
      </div>
      <div className="flex items-center rounded-full border border-line-strong">
        <button
          type="button"
          aria-label="−"
          disabled={n <= o.min}
          onClick={() => step(-1)}
          className="grid size-11 place-items-center rounded-full hover:bg-paper-deep disabled:opacity-30"
        >
          <Minus className="size-4" />
        </button>
        <span className="w-8 text-center text-[1rem] font-bold tabular-nums" aria-live="polite">
          {n}
        </span>
        <button
          type="button"
          aria-label="+"
          disabled={n >= o.max}
          onClick={() => step(1)}
          className="grid size-11 place-items-center rounded-full hover:bg-paper-deep disabled:opacity-30"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ── Notes ──────────────────────────────────────────────────────────────────

export function NotesSection({ cfg, onChange }: { cfg: Config; onChange: (c: Config) => void }) {
  const { t } = useApp();
  return (
    <Section title={t('notesTitle')} hint={t('notesHint')}>
      <textarea
        value={cfg.note}
        maxLength={280}
        rows={3}
        onChange={(e) => onChange({ ...cfg, note: e.target.value })}
        placeholder={t('notesPlaceholder')}
        className="w-full resize-none rounded-xl border border-line-strong bg-paper px-3.5 py-3 text-[0.95rem] outline-none placeholder:text-ink-faint focus:border-indigo focus:ring-2 focus:ring-indigo/20"
      />
      <div className="mt-1 text-right text-[0.75rem] tabular-nums text-ink-faint">{cfg.note.length}/280</div>
    </Section>
  );
}
