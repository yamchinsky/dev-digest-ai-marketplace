import DOMPurify from 'dompurify';
import { useI18n } from '../lib/i18n';
import { highlightHtml, makeSnippet, type SearchHit } from '../lib/search';

function highlighted(text: string, terms: string[]): { __html: string } {
  // highlightHtml escapes first; sanitize is belt-and-braces on top.
  return { __html: DOMPurify.sanitize(highlightHtml(text, terms)) };
}

export function ResultList({ hits }: { hits: SearchHit[] }) {
  const { t } = useI18n();

  return (
    <ul className="result-list">
      {hits.map((hit) => (
        <li key={hit.id}>
          <a className="result" href={hit.link}>
            <div className="result-head">
              <span className={`badge badge-${hit.docType}`}>{t(`type.${hit.docType}`)}</span>
              <span
                className="result-name"
                dangerouslySetInnerHTML={highlighted(hit.name, hit.terms)}
              />
              {hit.docType !== 'plugin' && (
                <span className="result-plugin">{t('search.inPlugin', { plugin: hit.plugin })}</span>
              )}
            </div>
            <p
              className="result-snippet"
              dangerouslySetInnerHTML={highlighted(makeSnippet(hit), hit.terms)}
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
