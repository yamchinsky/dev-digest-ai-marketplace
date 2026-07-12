import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types mirroring the data contracts in docs/SITE-SPEC.md
// ---------------------------------------------------------------------------

export interface MarketplaceMeta {
  name: string;
  description: string;
  owner: string;
  repoUrl: string;
  addCommand: string;
}

export interface PluginDependency {
  name: string;
  version: string;
}

export type ArtifactType = 'skill' | 'agent';

export interface Artifact {
  /** `<plugin>:<name>` — the deep-link key. */
  id: string;
  plugin: string;
  type: ArtifactType;
  name: string;
  description: string;
  tools?: string;
  model?: string;
  bodyPath: string;
  searchText: string;
}

export interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  keywords: string[];
  category?: string;
  tags?: string[];
  /** First line of COMPATIBILITY.md, when the file exists. */
  compatibility?: string;
  dependencies: PluginDependency[];
  installCommand: string;
  counts: { skills: number; agents: number };
  readmePath: string;
  changelogPath?: string;
  updatedAt?: string;
  artifacts: Artifact[];
}

export interface MarketplaceIndex {
  generatedAt: string;
  marketplace: MarketplaceMeta;
  plugins: Plugin[];
}

export interface ReleaseEntry {
  plugin: string;
  version: string;
  date: string;
  tag: string;
  highlights: string[];
}

export interface Stats {
  generatedAt: string;
  totals: { plugins: number; skills: number; agents: number };
  byPlugin: Record<string, { skills: number; agents: number }>;
}

// ---------------------------------------------------------------------------
// Loaders — cached, and every fetch respects the Vite base URL.
// ---------------------------------------------------------------------------

const cache = new Map<string, Promise<unknown>>();

function fetchCached<T>(file: string, asText: boolean): Promise<T> {
  const cached = cache.get(file);
  if (cached) return cached as Promise<T>;
  const promise = fetch(`${import.meta.env.BASE_URL}${file}`).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${file}: HTTP ${response.status}`);
    }
    return (asText ? response.text() : response.json()) as Promise<T>;
  });
  // Drop failed fetches from the cache so a reload can retry them.
  promise.catch(() => cache.delete(file));
  cache.set(file, promise);
  return promise;
}

export function loadIndex(): Promise<MarketplaceIndex> {
  return fetchCached<MarketplaceIndex>('index.json', false);
}

export function loadReleases(): Promise<ReleaseEntry[]> {
  return fetchCached<ReleaseEntry[]>('releases.json', false);
}

export function loadStats(): Promise<Stats> {
  return fetchCached<Stats>('stats.json', false);
}

/** Bodies are fetched lazily, one file per plugin README / artifact body. */
export function loadBody(bodyPath: string): Promise<string> {
  return fetchCached<string>(bodyPath, true);
}

/** Strips the YAML frontmatter block from skill/agent bodies before rendering. */
export function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

// ---------------------------------------------------------------------------
// React hooks over the loaders
// ---------------------------------------------------------------------------

export interface Loaded<T> {
  data: T | undefined;
  error: boolean;
  loading: boolean;
}

function useLoad<T>(key: string | undefined, load: (key: string) => Promise<T>): Loaded<T> {
  const [state, setState] = useState<{ forKey?: string; data?: T; error: boolean }>({
    error: false,
  });

  useEffect(() => {
    if (key === undefined) return;
    let alive = true;
    load(key).then(
      (data) => {
        if (alive) setState({ forKey: key, data, error: false });
      },
      () => {
        if (alive) setState({ forKey: key, data: undefined, error: true });
      },
    );
    return () => {
      alive = false;
    };
    // `load` is a stable module-level loader; `key` fully identifies the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const settled = key !== undefined && state.forKey === key;
  return {
    data: settled && !state.error ? state.data : undefined,
    error: settled && state.error,
    loading: key !== undefined && !settled,
  };
}

export function useIndex(): Loaded<MarketplaceIndex> {
  return useLoad('index.json', loadIndex);
}

export function useReleases(): Loaded<ReleaseEntry[]> {
  return useLoad('releases.json', loadReleases);
}

export function useStats(): Loaded<Stats> {
  return useLoad('stats.json', loadStats);
}

export function useBody(bodyPath: string | undefined): Loaded<string> {
  return useLoad(bodyPath, loadBody);
}
