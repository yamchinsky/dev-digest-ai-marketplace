import { useI18n } from '../lib/i18n';
import { useReleases } from '../lib/data';

export function WhatsNewPage() {
  const { t } = useI18n();
  const { data: releases, error } = useReleases();

  if (error) return <p className="status">{t('common.error')}</p>;
  if (!releases) return <p className="status">{t('common.loading')}</p>;

  return (
    <div className="page whats-new-page">
      <h1>{t('whatsNew.title')}</h1>
      {releases.length === 0 ? (
        <p className="status">{t('whatsNew.empty')}</p>
      ) : (
        <ul className="release-list">
          {releases.map((release) => (
            <li key={release.tag} className="release-card">
              <div className="release-head">
                <a href={`#/plugin/${release.plugin}`}>{release.plugin}</a>
                <span className="release-version">v{release.version}</span>
                <span className="release-date">{release.date}</span>
              </div>
              <ul className="release-highlights">
                {release.highlights.map((highlight, i) => (
                  <li key={i}>{highlight}</li>
                ))}
              </ul>
              <code className="release-tag">{release.tag}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
