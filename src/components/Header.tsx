import { ArrowLeft, BookOpen, ShoppingBag } from 'lucide-react';
import { useApp } from '../lib/app';
import { goBack, navigate } from '../lib/router';
import { BrandMark, Segmented } from './ui';

export default function Header({ title, backTo }: { title?: string; backTo?: string }) {
  const { t, locale, setLocale, bagCount } = useApp();
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:px-6">
        {backTo ? (
          <button
            type="button"
            onClick={() => goBack(backTo)}
            aria-label={t('back')}
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-paper-deep"
          >
            <ArrowLeft className="size-5" />
          </button>
        ) : null}
        {title ? (
          <h1 className="min-w-0 flex-1 truncate text-[1.02rem] font-bold">{title}</h1>
        ) : (
          <a href="#/" onClick={(e) => (e.preventDefault(), navigate('/'))} className="flex min-w-0 flex-1 items-center gap-2.5">
            <BrandMark />
            <span className="truncate text-[1.12rem] font-bold tracking-tight">Atelier Solis</span>
          </a>
        )}
        <Segmented
          size="sm"
          label={t('language')}
          value={locale}
          onChange={setLocale}
          options={[
            { value: 'km', label: 'ខ្មែរ', aria: 'ភាសាខ្មែរ' },
            { value: 'en', label: 'EN', aria: 'English' },
          ]}
        />
        <button
          type="button"
          onClick={() => navigate('/book')}
          aria-label={t('bookTitle')}
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-paper-deep"
        >
          <BookOpen className="size-[1.25rem]" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/bag')}
          aria-label={`${t('bag')} (${bagCount})`}
          className="relative grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-paper-deep"
        >
          <ShoppingBag className="size-[1.35rem]" />
          {bagCount > 0 && (
            <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-indigo px-1 text-[0.7rem] font-bold leading-5 text-white">
              {bagCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
