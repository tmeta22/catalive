import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', notify);
  window.addEventListener('popstate', notify);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export type Route =
  | { name: 'home' }
  | { name: 'product'; id: string; query: URLSearchParams }
  | { name: 'bag' }
  | { name: 'book'; query: URLSearchParams };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'p' && parts[1]) return { name: 'product', id: decodeURIComponent(parts[1]), query: new URLSearchParams(qs) };
  if (parts[0] === 'bag') return { name: 'bag' };
  if (parts[0] === 'book') return { name: 'book', query: new URLSearchParams(qs) };
  return { name: 'home' };
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => '');
}

export function useRoute(): Route {
  const hash = useHash();
  // Parse from the pathname part only, so config edits (replaceState) never re-route.
  return parseHash(hash);
}

export function navigate(to: string): void {
  const next = to.startsWith('#') ? to : `#${to}`;
  if (window.location.hash === next) return;
  window.location.hash = next;
}

/** Update the address bar without adding history or re-rendering. */
export function replaceHash(to: string): void {
  const next = to.startsWith('#') ? to : `#${to}`;
  window.history.replaceState(window.history.state, '', next);
}

export function goBack(fallback = '/'): void {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}
