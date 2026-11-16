import { getMaterial, TIER_PREMIUM } from './materials';
import { clamp } from './rules';
import type {
  ChoiceItem,
  Config,
  Insight,
  LocalizedText,
  OptionSpec,
  OptionValue,
  Preset,
  Product,
  SlotRole,
  SlotSpec,
} from './types';

const round5 = (n: number) => Math.round(n / 5) * 5;
const snap = (v: number, step: number, min: number) => min + Math.round((v - min) / step) * step;

// ── Defaults & validation ──────────────────────────────────────────────────

export function defaultConfig(p: Product): Config {
  const slots: Partial<Record<SlotRole, string>> = {};
  for (const s of p.slots) slots[s.id] = s.default;
  const opts: Record<string, OptionValue> = {};
  for (const o of p.options) opts[o.id] = o.default;
  return normalizeConfig(p, { w: p.dims.w.def, d: p.dims.d.def, h: p.dims.h.def, slots, opts, note: '' });
}

function validChoice(o: Extract<OptionSpec, { type: 'choice' }>, v: unknown): string {
  return typeof v === 'string' && o.choices.some((c) => c.id === v) ? v : o.default;
}

/**
 * Make any config safe: clamp and snap sizes, drop unknown materials and
 * options, apply the product's own constraints (e.g. round tops).
 */
export function normalizeConfig(p: Product, raw: Config): Config {
  const opts: Record<string, OptionValue> = {};
  for (const o of p.options) {
    const v = raw.opts[o.id];
    if (o.type === 'choice') opts[o.id] = validChoice(o, v);
    else if (o.type === 'toggle') opts[o.id] = typeof v === 'boolean' ? v : o.default;
    else opts[o.id] = clamp(Math.round(typeof v === 'number' ? v : o.default), o.min, o.max);
  }

  const slots: Partial<Record<SlotRole, string>> = {};
  for (const s of p.slots) {
    const v = raw.slots[s.id];
    slots[s.id] = v && s.materials.includes(v) ? v : s.default;
  }

  const fit = (v: number, d: Product['dims']['w']) =>
    clamp(snap(clamp(Number.isFinite(v) ? v : d.def, d.min, d.max), d.step, d.min), d.min, d.max);
  let w = fit(raw.w, p.dims.w);
  let d = fit(raw.d, p.dims.d);
  const h = fit(raw.h, p.dims.h);

  if (p.roundWhen?.(opts)) {
    const lo = Math.max(p.dims.w.min, p.dims.d.min);
    const hi = Math.min(p.dims.w.max, p.dims.d.max);
    w = clamp(snap(clamp(w, lo, hi), Math.min(p.dims.w.step, p.dims.d.step), lo), lo, hi);
    d = w;
  }

  let cfg: Config = { w, d, h, slots, opts, note: (raw.note ?? '').slice(0, 280) };
  if (p.constrain) cfg = p.constrain(cfg);
  return cfg;
}

export function isRound(p: Product, cfg: Config): boolean {
  return !!p.roundWhen?.(cfg.opts);
}

export function visibleOptions(p: Product, cfg: Config): OptionSpec[] {
  return p.options.filter((o) => !o.when || o.when(cfg.opts));
}

export function visibleChoices(o: Extract<OptionSpec, { type: 'choice' }>, cfg: Config): ChoiceItem[] {
  return o.choices.filter((c) => !c.hidden || !c.hidden(cfg.opts));
}

export function visibleSlots(p: Product, cfg: Config): SlotSpec[] {
  return p.slots.filter((s) => !s.when || s.when(cfg.opts));
}

export function allowedRange(p: Product, cfg: Config) {
  if (!isRound(p, cfg)) return { w: p.dims.w, d: p.dims.d, h: p.dims.h };
  const lo = Math.max(p.dims.w.min, p.dims.d.min);
  const hi = Math.min(p.dims.w.max, p.dims.d.max);
  const step = Math.min(p.dims.w.step, p.dims.d.step);
  const dia = { min: lo, max: hi, step, def: clamp(p.dims.w.def, lo, hi) };
  return { w: dia, d: dia, h: p.dims.h };
}

// ── Presets & standard sizes ───────────────────────────────────────────────

export function presetMatches(pr: Preset, cfg: Config): boolean {
  if (pr.w !== undefined && pr.w !== cfg.w) return false;
  if (pr.d !== undefined && pr.d !== cfg.d) return false;
  if (pr.h !== undefined && pr.h !== cfg.h) return false;
  if (pr.opts) for (const [k, v] of Object.entries(pr.opts)) if (cfg.opts[k] !== v) return false;
  return true;
}

export function matchingPreset(p: Product, cfg: Config): Preset | undefined {
  return p.presets.find((pr) => presetMatches(pr, cfg));
}

export function applyPreset(p: Product, cfg: Config, pr: Preset): Config {
  return normalizeConfig(p, {
    ...cfg,
    w: pr.w ?? cfg.w,
    d: pr.d ?? cfg.d,
    h: pr.h ?? cfg.h,
    opts: { ...cfg.opts, ...(pr.opts ?? {}) },
  });
}

/** True when the size matches one of the product's standard presets. */
export function isStandardSize(p: Product, cfg: Config): boolean {
  return p.presets.some((pr) => pr.w === cfg.w && pr.d === cfg.d && pr.h === cfg.h);
}

export function isDefaultFinish(p: Product, cfg: Config): boolean {
  return visibleSlots(p, cfg).every((s) => cfg.slots[s.id] === s.default);
}

// ── Pricing ────────────────────────────────────────────────────────────────

export interface PriceLine {
  key: string;
  label: LocalizedText;
  detail?: LocalizedText;
  amount: number;
}

export interface PriceBreakdown {
  base: number;
  size: number;
  lines: PriceLine[];
  total: number;
}

function sizeFactor(p: Product, cfg: Config): number {
  const { w, d, h } = p.dims;
  const c = p.sizeCurve;
  return Math.pow(cfg.w / w.def, c.w) * Math.pow(cfg.d / d.def, c.d) * Math.pow(cfg.h / h.def, c.h);
}

/**
 * Prices are always relative to the default configuration, so the headline
 * "from" price equals the default build and any change shows exactly what it
 * adds or saves.
 */
export function priceBreakdown(p: Product, cfg: Config): PriceBreakdown {
  const factor = sizeFactor(p, cfg);
  const sizedBase = round5(p.basePrice * factor);
  const size = sizedBase - p.basePrice;
  const lines: PriceLine[] = [];

  for (const s of visibleSlots(p, cfg)) {
    const chosen = getMaterial(cfg.slots[s.id] ?? s.default);
    const def = getMaterial(s.default);
    const delta = round5(sizedBase * s.weight * (TIER_PREMIUM[chosen.tier] - TIER_PREMIUM[def.tier]));
    if (delta !== 0) lines.push({ key: `slot:${s.id}`, label: s.label, detail: chosen.name, amount: delta });
  }

  for (const o of visibleOptions(p, cfg)) {
    const v = cfg.opts[o.id];
    let amount = 0;
    let detail: LocalizedText | undefined;
    if (o.type === 'choice') {
      const cur = o.choices.find((c) => c.id === v);
      const def = o.choices.find((c) => c.id === o.default);
      const price = (c?: ChoiceItem) => (c ? (c.flat ?? 0) + round5(sizedBase * (c.pct ?? 0)) : 0);
      amount = price(cur) - price(def);
      detail = cur?.label;
    } else if (o.type === 'toggle') {
      const on = v === true;
      const def = o.default;
      const unit = (o.flat ?? 0) + round5(sizedBase * (o.pct ?? 0));
      amount = (on ? 1 : 0) * unit - (def ? 1 : 0) * unit;
    } else {
      amount = (Number(v) - o.default) * (o.flatPer ?? 0);
    }
    amount = round5(amount);
    if (amount !== 0) lines.push({ key: `opt:${o.id}`, label: o.label, detail, amount });
  }

  const total = sizedBase + lines.reduce((a, l) => a + l.amount, 0);
  return { base: p.basePrice, size, lines, total };
}

/** Surcharge a single material swatch would add or save in its slot. */
export function materialDelta(p: Product, cfg: Config, slotId: SlotRole, materialId: string): number {
  const s = p.slots.find((x) => x.id === slotId);
  if (!s) return 0;
  const sizedBase = round5(p.basePrice * sizeFactor(p, cfg));
  const chosen = getMaterial(materialId);
  const cur = getMaterial(cfg.slots[slotId] ?? s.default);
  return round5(sizedBase * s.weight * (TIER_PREMIUM[chosen.tier] - TIER_PREMIUM[cur.tier]));
}

// ── Lead time, weight, insights ────────────────────────────────────────────

export type LeadTime =
  | { kind: 'stock'; days: number }
  | { kind: 'made'; weeks: [number, number]; custom: boolean };

export function leadTime(p: Product, cfg: Config): LeadTime {
  const standard = isStandardSize(p, cfg);
  if (p.stockDays && standard && isDefaultFinish(p, cfg)) return { kind: 'stock', days: p.stockDays };
  const extra = standard ? 0 : 1;
  return { kind: 'made', weeks: [p.leadWeeks[0] + extra, p.leadWeeks[1] + extra], custom: !standard };
}

export function weightKg(p: Product, cfg: Config): number {
  const m3 = (cfg.w / 1000) * (cfg.d / 1000) * (cfg.h / 1000);
  const stoneExtra = cfg.slots.surface && getMaterial(cfg.slots.surface).kind === 'stone' ? 1.5 : 1;
  return Math.max(1, Math.round(m3 * p.density * stoneExtra));
}

export function insightsFor(p: Product, cfg: Config): Insight[] {
  return p.insights ? p.insights(cfg) : [];
}

// ── Descriptions (for the bag, spec sheet and order message) ───────────────

export interface DescribedLine {
  label: LocalizedText;
  value: LocalizedText;
}

export function describeOptions(p: Product, cfg: Config): DescribedLine[] {
  const out: DescribedLine[] = [];
  for (const s of visibleSlots(p, cfg)) {
    out.push({ label: s.label, value: getMaterial(cfg.slots[s.id] ?? s.default).name });
  }
  for (const o of visibleOptions(p, cfg)) {
    const v = cfg.opts[o.id];
    if (o.type === 'choice') {
      const c = o.choices.find((x) => x.id === v);
      if (c) out.push({ label: o.label, value: c.label });
    } else if (o.type === 'toggle') {
      out.push({ label: o.label, value: v ? { km: 'បាទ/ចាស', en: 'Yes' } : { km: 'ទេ', en: 'No' } });
    } else {
      out.push({ label: o.label, value: { km: String(v), en: String(v) } });
    }
  }
  return out;
}

// ── Shareable links ────────────────────────────────────────────────────────

const SLOT_KEYS: Record<SlotRole, string> = { frame: 'f', surface: 's', accent: 'a' };

/** Compact query string with only the values that differ from the default. */
export function serializeConfig(p: Product, cfg: Config): string {
  const def = defaultConfig(p);
  const q = new URLSearchParams();
  if (cfg.w !== def.w) q.set('w', String(cfg.w));
  if (cfg.d !== def.d) q.set('d', String(cfg.d));
  if (cfg.h !== def.h) q.set('h', String(cfg.h));
  for (const s of p.slots) {
    const v = cfg.slots[s.id];
    if (v && v !== def.slots[s.id]) q.set(SLOT_KEYS[s.id], v);
  }
  for (const o of p.options) {
    const v = cfg.opts[o.id];
    if (v !== def.opts[o.id]) q.set(`o.${o.id}`, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return q.toString();
}

export function parseConfig(p: Product, search: string | URLSearchParams): Config {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const def = defaultConfig(p);
  const num = (k: string, fallback: number) => {
    const v = Number.parseFloat(q.get(k) ?? '');
    return Number.isFinite(v) ? v : fallback;
  };
  const slots = { ...def.slots };
  for (const s of p.slots) {
    const v = q.get(SLOT_KEYS[s.id]);
    if (v) slots[s.id] = v;
  }
  const opts = { ...def.opts };
  for (const o of p.options) {
    const v = q.get(`o.${o.id}`);
    if (v === null) continue;
    if (o.type === 'toggle') opts[o.id] = v === '1';
    else if (o.type === 'count') opts[o.id] = Number.parseInt(v, 10);
    else opts[o.id] = v;
  }
  return normalizeConfig(p, {
    w: num('w', def.w),
    d: num('d', def.d),
    h: num('h', def.h),
    slots,
    opts,
    note: '',
  });
}

/** Stable identity of a configuration, used to merge identical bag lines. */
export function configKey(p: Product, cfg: Config): string {
  const q = new URLSearchParams();
  q.set('w', String(cfg.w));
  q.set('d', String(cfg.d));
  q.set('h', String(cfg.h));
  for (const s of p.slots) q.set(SLOT_KEYS[s.id], cfg.slots[s.id] ?? '');
  for (const o of p.options) q.set(`o.${o.id}`, String(cfg.opts[o.id]));
  q.set('n', cfg.note.trim());
  return `${p.id}?${q.toString()}`;
}
