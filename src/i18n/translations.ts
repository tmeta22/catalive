export type Locale = 'km' | 'en';
export type Currency = 'USD' | 'KHR';
export type Unit = 'cm' | 'mm' | 'in';

export interface LocalizedText {
  km: string;
  en: string;
}

export const LOCALES: Locale[] = ['km', 'en'];

/** Approximate market rate used for riel prices. */
export const KHR_PER_USD = 4080;

export function pick(text: LocalizedText, locale: Locale): string {
  return text[locale] || text.en;
}

/** "$3,450", "−$35" or "14,076,000 ៛". Riel amounts round to the nearest 1,000. */
export function formatMoney(usd: number, currency: Currency, opts: { signed?: boolean } = {}): string {
  const sign = usd < 0 ? '−' : opts.signed && usd > 0 ? '+' : '';
  const abs = Math.abs(usd);
  if (currency === 'KHR') {
    const riel = Math.round((abs * KHR_PER_USD) / 1000) * 1000;
    return `${sign}${riel.toLocaleString('en-US')} ៛`;
  }
  return `${sign}$${abs.toLocaleString('en-US')}`;
}

const trim = (n: number, digits: number) => {
  const s = n.toFixed(digits);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};

export function toUnit(mm: number, unit: Unit): number {
  if (unit === 'cm') return mm / 10;
  if (unit === 'in') return mm / 25.4;
  return mm;
}

export function fromUnit(value: number, unit: Unit): number {
  if (unit === 'cm') return value * 10;
  if (unit === 'in') return value * 25.4;
  return value;
}

export function unitDecimals(unit: Unit): number {
  return unit === 'mm' ? 0 : 1;
}

export function formatLength(mm: number, unit: Unit, withUnit = true): string {
  const v = trim(toUnit(mm, unit), unitDecimals(unit));
  if (!withUnit) return v;
  return unit === 'in' ? `${v}″` : `${v} ${unit}`;
}
