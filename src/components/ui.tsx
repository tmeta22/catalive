import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useApp } from '../lib/app';

// ── Buttons ────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BTN: Record<BtnVariant, string> = {
  primary: 'bg-indigo text-white hover:bg-indigo-deep active:bg-indigo-deep disabled:bg-line-strong disabled:text-ink-faint',
  secondary: 'bg-card text-ink border border-line-strong hover:border-ink-soft hover:bg-paper disabled:opacity-50',
  ghost: 'bg-transparent text-ink-soft hover:bg-paper-deep hover:text-ink',
  danger: 'bg-rose-wash text-rose hover:bg-rose hover:text-white',
};

export function Btn({
  variant = 'secondary',
  full,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; full?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`tap inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-[0.95rem] font-semibold transition-colors ${BTN[variant]} ${full ? 'w-full' : ''} ${className}`}
    />
  );
}

// ── Segmented control ──────────────────────────────────────────────────────

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; aria?: string }[];
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-paper-deep p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.aria}
            onClick={() => onChange(o.value)}
            className={`rounded-full font-semibold transition-colors ${size === 'sm' ? 'min-h-8 px-3 text-[0.8rem]' : 'min-h-9 px-3.5 text-[0.85rem]'} ${
              on ? 'bg-card text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Sheet: bottom sheet on phones, dialog on larger screens ────────────────

export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
  footer,
  printable,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
  printable?: boolean;
}) {
  const { t } = useApp();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = 'hidden';
    if (scrollbar > 0) document.documentElement.style.paddingRight = `${scrollbar}px`;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onNav = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onNav);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onNav);
      document.documentElement.style.overflow = '';
      document.documentElement.style.paddingRight = '';
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center ${printable ? 'print-sheet-host' : ''}`}>
      <div className="anim-fade no-print absolute inset-0 bg-ink/45" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`anim-sheet relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl bg-card shadow-float outline-none sm:max-h-[90svh] sm:rounded-3xl ${
          wide ? 'sm:max-w-5xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="no-print flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-paper-deep"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="no-print pb-safe border-t border-line bg-card px-5 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ── Toasts ─────────────────────────────────────────────────────────────────

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8"
    >
      {toasts.map((x) => (
        <div
          key={x.id}
          className="anim-sheet pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-ink py-2 pl-5 pr-2 text-sm text-white shadow-float"
        >
          <span>{x.text}</span>
          {x.actionLabel && (
            <button
              type="button"
              onClick={() => {
                x.onAction?.();
                dismissToast(x.id);
              }}
              className="tap rounded-full bg-white/15 px-4 font-semibold hover:bg-white/25"
            >
              {x.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Brand mark ─────────────────────────────────────────────────────────────

export function BrandMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#2E3C86" />
      <path d="M9 27Q24 25 32 11Q40 25 55 27Q42 29 32 23Q22 29 9 27Z" fill="#F3F4EF" />
      <rect x="18" y="31" width="4" height="21" rx="2" fill="#F3F4EF" />
      <rect x="42" y="31" width="4" height="21" rx="2" fill="#F3F4EF" />
      <rect x="13" y="44" width="38" height="5" rx="2.5" fill="#C58B2A" />
    </svg>
  );
}

/** Round swatch with a hint of the material's surface. */
export function swatchStyle(hex: string, kind: string): React.CSSProperties {
  const overlay =
    kind === 'timber'
      ? 'repeating-linear-gradient(98deg, rgb(0 0 0 / 0.07) 0 2px, transparent 2px 6px)'
      : kind === 'cane'
        ? 'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.22) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, rgb(0 0 0 / 0.1) 0 2px, transparent 2px 6px)'
        : kind === 'fabric' || kind === 'boucle'
          ? 'repeating-linear-gradient(0deg, rgb(255 255 255 / 0.14) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgb(0 0 0 / 0.06) 0 1px, transparent 1px 3px)'
          : kind === 'metal'
            ? 'linear-gradient(135deg, rgb(255 255 255 / 0.5), transparent 45%, rgb(0 0 0 / 0.18))'
            : kind === 'stone'
              ? 'radial-gradient(circle at 30% 25%, rgb(255 255 255 / 0.4), transparent 55%), linear-gradient(160deg, transparent 40%, rgb(0 0 0 / 0.12))'
              : 'linear-gradient(160deg, rgb(255 255 255 / 0.25), transparent 50%)';
  return { backgroundColor: hex, backgroundImage: overlay };
}
