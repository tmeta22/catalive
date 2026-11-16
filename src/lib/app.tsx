import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatLength, formatMoney, pick, type Currency, type Locale, type LocalizedText, type Unit } from '../i18n/translations';
import { S, type StrKey } from '../i18n/strings';
import { makeLine, type BagLine } from '../data/bag';
import type { Config } from '../data/types';
import { readJson, writeJson } from './storage';

export interface Toast {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface AppState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  unit: Unit;
  setUnit: (u: Unit) => void;
  t: (key: StrKey, vars?: Record<string, string | number>) => string;
  tt: (text: LocalizedText) => string;
  money: (usd: number, signed?: boolean) => string;
  len: (mm: number, withUnit?: boolean) => string;

  bag: BagLine[];
  bagCount: number;
  addToBag: (productId: string, cfg: Config) => void;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  clearBag: () => void;

  toasts: Toast[];
  toast: (text: string, action?: { label: string; run: () => void }) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}

function initialLocale(): Locale {
  const q = new URLSearchParams(window.location.search).get('lang');
  if (q === 'en' || q === 'km') return q;
  const saved = readJson<string | null>('solis.locale', null);
  return saved === 'en' || saved === 'km' ? saved : 'km';
}

const BAG_KEY = 'solis.bag.v1';

export function AppProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [currency, setCurrencyState] = useState<Currency>(() => (readJson<string>('solis.currency', 'USD') === 'KHR' ? 'KHR' : 'USD'));
  const [unit, setUnitState] = useState<Unit>(() => {
    const u = readJson<string>('solis.unit', 'cm');
    return u === 'mm' || u === 'in' ? u : 'cm';
  });
  const [bag, setBag] = useState<BagLine[]>(() => {
    const raw = readJson<BagLine[]>(BAG_KEY, []);
    // Re-validate stored lines against the current catalog.
    return raw.map((l) => makeLine(l.productId, l.cfg, Math.max(1, Math.min(99, l.qty | 0)))).filter((l): l is BagLine => !!l);
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    document.documentElement.lang = locale;
    writeJson('solis.locale', locale);
  }, [locale]);
  useEffect(() => writeJson('solis.currency', currency), [currency]);
  useEffect(() => writeJson('solis.unit', unit), [unit]);
  useEffect(() => writeJson(BAG_KEY, bag), [bag]);

  const t = useCallback(
    (key: StrKey, vars?: Record<string, string | number>) => {
      let s = pick(S[key], locale);
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [locale],
  );
  const tt = useCallback((text: LocalizedText) => pick(text, locale), [locale]);
  const money = useCallback((usd: number, signed = false) => formatMoney(usd, currency, { signed }), [currency]);
  const len = useCallback((mm: number, withUnit = true) => formatLength(mm, unit, withUnit), [unit]);

  const dismissToast = useCallback((id: number) => setToasts((x) => x.filter((y) => y.id !== id)), []);
  const toast = useCallback(
    (text: string, action?: { label: string; run: () => void }) => {
      const id = ++toastId.current;
      setToasts((x) => [...x.slice(-1), { id, text, actionLabel: action?.label, onAction: action?.run }]);
      window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast],
  );

  const addToBag = useCallback((productId: string, cfg: Config) => {
    const line = makeLine(productId, cfg);
    if (!line) return;
    setBag((prev) => {
      const hit = prev.find((l) => l.key === line.key);
      if (hit) return prev.map((l) => (l.key === line.key ? { ...l, qty: Math.min(99, l.qty + 1) } : l));
      return [...prev, line];
    });
  }, []);
  const setQty = useCallback((key: string, qty: number) => {
    setBag((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty: Math.min(99, qty) } : l))));
  }, []);
  const removeLine = useCallback((key: string) => setBag((prev) => prev.filter((l) => l.key !== key)), []);
  const clearBag = useCallback(() => setBag([]), []);

  const value = useMemo<AppState>(
    () => ({
      locale,
      setLocale: setLocaleState,
      currency,
      setCurrency: setCurrencyState,
      unit,
      setUnit: setUnitState,
      t,
      tt,
      money,
      len,
      bag,
      bagCount: bag.reduce((a, l) => a + l.qty, 0),
      addToBag,
      setQty,
      removeLine,
      clearBag,
      toasts,
      toast,
      dismissToast,
    }),
    [locale, currency, unit, t, tt, money, len, bag, addToBag, setQty, removeLine, clearBag, toasts, toast, dismissToast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
