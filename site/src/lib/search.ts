import MiniSearch from 'minisearch';
import type { MarketplaceIndex } from './data';

export type DocType = 'plugin' | 'skill' | 'agent';
export type TypeFilter = 'all' | DocType;

/** One searchable document — either a plugin or a nested skill/agent. */
export interface SearchDoc {
  id: string;
  docType: DocType;
  name: string;
  description: string;
  keywords: string;
  searchText: string;
  /** Owning plugin name (for plugin docs, the plugin itself). */
  plugin: string;
  /** Hash link to the detail page. */
  link: string;
}

export interface SearchHit {
  id: string;
  docType: DocType;
  name: string;
  description: string;
  searchText: string;
  plugin: string;
  link: string;
  /** Query terms that matched — used for snippet highlighting. */
  terms: string[];
}

export interface SearchEngine {
  mini: MiniSearch<SearchDoc>;
  docs: SearchDoc[];
}

const engines = new WeakMap<MarketplaceIndex, SearchEngine>();

/** Builds (and memoizes) the MiniSearch index over plugins AND artifacts. */
export function getSearchEngine(index: MarketplaceIndex): SearchEngine {
  const existing = engines.get(index);
  if (existing) return existing;

  const docs: SearchDoc[] = [];
  for (const plugin of index.plugins) {
    docs.push({
      id: `plugin:${plugin.name}`,
      docType: 'plugin',
      name: plugin.name,
      description: plugin.description,
      keywords: plugin.keywords.join(' '),
      searchText: [plugin.name, plugin.description, plugin.category ?? '', ...(plugin.tags ?? [])]
        .join(' ')
        .trim(),
      plugin: plugin.name,
      link: `#/plugin/${plugin.name}`,
    });
    for (const artifact of plugin.artifacts) {
      docs.push({
        id: `artifact:${artifact.id}`,
        docType: artifact.type,
        name: artifact.name,
        description: artifact.description,
        keywords: '',
        searchText: artifact.searchText,
        plugin: plugin.name,
        link: `#/artifact/${artifact.id}`,
      });
    }
  }

  const mini = new MiniSearch<SearchDoc>({
    fields: ['name', 'description', 'keywords', 'searchText'],
    storeFields: ['docType', 'name', 'description', 'searchText', 'plugin', 'link'],
    searchOptions: { prefix: true, fuzzy: 0.2, boost: { name: 3 } },
  });
  mini.addAll(docs);

  const engine: SearchEngine = { mini, docs };
  engines.set(index, engine);
  return engine;
}

/** Runs a query; an empty query lists every document of the requested type. */
export function runSearch(engine: SearchEngine, query: string, type: TypeFilter): SearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return engine.docs
      .filter((doc) => type === 'all' || doc.docType === type)
      .map((doc) => ({ ...doc, terms: [] }));
  }
  const results = engine.mini.search(trimmed, {
    filter: type === 'all' ? undefined : (result) => result.docType === type,
  });
  return results.map((result) => ({
    id: String(result.id),
    docType: result.docType as DocType,
    name: result.name as string,
    description: result.description as string,
    searchText: result.searchText as string,
    plugin: result.plugin as string,
    link: result.link as string,
    terms: result.terms,
  }));
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Safe highlighting: the text is HTML-escaped FIRST, then matched terms are
 * wrapped in <mark>. The output contains no markup other than <mark> tags.
 */
export function highlightHtml(text: string, terms: string[]): string {
  const escaped = escapeHtml(text);
  const usable = terms.map((term) => term.trim()).filter((term) => term.length > 0);
  if (usable.length === 0) return escaped;
  const pattern = new RegExp(`(${usable.map(escapeRegExp).join('|')})`, 'gi');
  return escaped.replace(pattern, '<mark>$1</mark>');
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/**
 * Builds a plain-text snippet for a hit: the description when it contains a
 * matched term, otherwise a window of `searchText` around the first match.
 */
export function makeSnippet(hit: SearchHit, maxLength = 200): string {
  const lowerTerms = hit.terms.map((term) => term.toLowerCase()).filter(Boolean);

  const firstMatch = (text: string): number => {
    const lower = text.toLowerCase();
    let first = -1;
    for (const term of lowerTerms) {
      const at = lower.indexOf(term);
      if (at >= 0 && (first < 0 || at < first)) first = at;
    }
    return first;
  };

  if (lowerTerms.length === 0 || firstMatch(hit.description) >= 0 || !hit.searchText) {
    return truncate(hit.description, maxLength);
  }

  const at = firstMatch(hit.searchText);
  if (at < 0) return truncate(hit.description, maxLength);

  const start = Math.max(0, at - 60);
  const window = hit.searchText.slice(start, start + maxLength);
  const prefix = start > 0 ? '…' : '';
  const suffix = start + maxLength < hit.searchText.length ? '…' : '';
  return `${prefix}${window}${suffix}`;
}
