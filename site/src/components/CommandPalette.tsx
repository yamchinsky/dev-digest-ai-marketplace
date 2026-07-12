import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import DOMPurify from 'dompurify';
import { useI18n } from '../lib/i18n';
import { useIndex } from '../lib/data';
import { getSearchEngine, highlightHtml, runSearch } from '../lib/search';
import { navigate } from '../lib/router';

const MAX_RESULTS = 8;

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { data: index } = useIndex();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => {
    if (!index) return [];
    return runSearch(getSearchEngine(index), query, 'all').slice(0, MAX_RESULTS);
  }, [index, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, hits.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hit = hits[active];
      if (hit) {
        navigate(hit.link);
        onClose();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="palette-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="palette" onClick={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('palette.placeholder')}
          aria-label={t('header.search')}
        />
        {hits.length === 0 ? (
          <p className="palette-empty">{t('palette.noResults')}</p>
        ) : (
          <ul className="palette-results">
            {hits.map((hit, i) => (
              <li key={hit.id}>
                <a
                  href={hit.link}
                  className={i === active ? 'active' : undefined}
                  onMouseEnter={() => setActive(i)}
                  onClick={onClose}
                >
                  <span className={`badge badge-${hit.docType}`}>{t(`type.${hit.docType}`)}</span>
                  <span
                    className="palette-name"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(highlightHtml(hit.name, hit.terms)),
                    }}
                  />
                  {hit.docType !== 'plugin' && <span className="palette-plugin">{hit.plugin}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="palette-hint">{t('palette.hint')}</p>
      </div>
    </div>
  );
}
