import { useMemo } from 'react';
import { useI18n } from '../lib/i18n';
import { useIndex } from '../lib/data';
import { getSearchEngine, runSearch, type TypeFilter } from '../lib/search';
import { searchHref } from '../lib/router';
import { SearchBox } from '../components/SearchBox';
import { ResultList } from '../components/ResultList';

const FILTERS: readonly TypeFilter[] = ['all', 'plugin', 'skill', 'agent'];

export function SearchPage({ q, type }: { q: string; type: TypeFilter }) {
  const { t } = useI18n();
  const { data: index, error } = useIndex();

  const hits = useMemo(
    () => (index ? runSearch(getSearchEngine(index), q, type) : []),
    [index, q, type],
  );

  if (error) return <p className="status">{t('common.error')}</p>;
  if (!index) return <p className="status">{t('common.loading')}</p>;

  return (
    <div className="page search-page">
      <h1>{t('search.title')}</h1>
      <SearchBox key={`${q}:${type}`} initialQuery={q} type={type} autoFocus />
      <div className="chips">
        {FILTERS.map((filter) => (
          <a
            key={filter}
            className={`chip${filter === type ? ' chip-active' : ''}`}
            href={searchHref(q, filter)}
          >
            {t(`search.filter.${filter}`)}
          </a>
        ))}
      </div>
      <p className="result-count">{t('search.results', { n: hits.length })}</p>
      {hits.length === 0 ? (
        <p className="status">{t('search.noResults')}</p>
      ) : (
        <ResultList hits={hits} />
      )}
    </div>
  );
}
