import { useEffect, useState } from 'react';
import { configKey } from '../data/config';
import type { Config, Product } from '../data/types';
import { renderStill } from '../three/studio';

const cache = new Map<string, string | null>();
const queue: (() => void)[] = [];
let running = false;

function pump() {
  if (running) return;
  const job = queue.shift();
  if (!job) return;
  running = true;
  window.setTimeout(() => {
    try {
      job();
    } finally {
      running = false;
      pump();
    }
  }, 0);
}

/**
 * A rendered picture of a configured piece, made by the same 3D engine as the
 * viewer. Jobs run one at a time so a long catalog never blocks scrolling.
 */
export function useStill(p: Product, cfg: Config, size = 480): { url: string | null; failed: boolean } {
  const key = `${configKey(p, cfg)}|${size}`;
  const [state, setState] = useState<{ key: string; url: string | null; done: boolean }>(() => ({
    key,
    url: cache.get(key) ?? null,
    done: cache.has(key),
  }));

  useEffect(() => {
    if (cache.has(key)) {
      setState({ key, url: cache.get(key) ?? null, done: true });
      return;
    }
    let cancelled = false;
    queue.push(() => {
      if (cancelled) return;
      const url = cache.has(key) ? (cache.get(key) ?? null) : renderStill(p, cfg, size);
      cache.set(key, url);
      setState({ key, url, done: true });
    });
    pump();
    return () => {
      cancelled = true;
    };
    // p/cfg are captured via key; re-running on identity changes would re-queue needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = state.key === key ? state : { url: cache.get(key) ?? null, done: cache.has(key) };
  return { url: current.url, failed: current.done && !current.url };
}
