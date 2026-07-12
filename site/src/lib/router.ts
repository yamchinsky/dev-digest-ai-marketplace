import { useMemo, useSyncExternalStore } from 'react';
import type { TypeFilter } from './search';

export type Route =
  | { name: 'home' }
  | { name: 'search'; q: string; type: TypeFilter }
  | { name: 'plugin'; plugin: string }
  | { name: 'artifact'; plugin: string; artifact: string }
  | { name: 'whats-new' }
  | { name: 'getting-started' };

const TYPE_FILTERS: readonly TypeFilter[] = ['all', 'plugin', 'skill', 'agent'];

/** Parses a `location.hash` value into a Route. Unknown routes map to home. */
export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryAt = raw.indexOf('?');
  const pathPart = queryAt >= 0 ? raw.slice(0, queryAt) : raw;
  const queryPart = queryAt >= 0 ? raw.slice(queryAt + 1) : '';
  const segments = pathPart
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  if (segments.length === 0) return { name: 'home' };

  switch (segments[0]) {
    case 'search': {
      const params = new URLSearchParams(queryPart);
      const q = params.get('q') ?? '';
      const rawType = params.get('type') ?? 'all';
      const type = TYPE_FILTERS.includes(rawType as TypeFilter) ? (rawType as TypeFilter) : 'all';
      return { name: 'search', q, type };
    }
    case 'plugin': {
      if (segments[1]) return { name: 'plugin', plugin: segments[1] };
      break;
    }
    case 'artifact': {
      const id = segments[1] ?? '';
      const colonAt = id.indexOf(':');
      if (colonAt > 0 && colonAt < id.length - 1) {
        return { name: 'artifact', plugin: id.slice(0, colonAt), artifact: id.slice(colonAt + 1) };
      }
      break;
    }
    case 'whats-new':
      return { name: 'whats-new' };
    case 'getting-started':
      return { name: 'getting-started' };
  }
  return { name: 'home' };
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

function getHash(): string {
  return window.location.hash;
}

/** The hash router: current Route, re-rendered on every `hashchange`. */
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash);
  return useMemo(() => parseHash(hash), [hash]);
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}

/** Builds a `#/search` href for a query + type filter. */
export function searchHref(q: string, type: TypeFilter = 'all'): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (type !== 'all') params.set('type', type);
  const query = params.toString();
  return `#/search${query ? `?${query}` : ''}`;
}
