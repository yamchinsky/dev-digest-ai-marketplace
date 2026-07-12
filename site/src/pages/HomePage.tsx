import { useI18n } from '../lib/i18n';
import { useIndex, useReleases, useStats } from '../lib/data';
import { searchHref } from '../lib/router';
import { SearchBox } from '../components/SearchBox';
import { PluginCard } from '../components/PluginCard';

export function HomePage() {
  const { t } = useI18n();
  const { data: index, error } = useIndex();
  const { data: stats } = useStats();
  const { data: releases } = useReleases();

  if (error) return <p className="status">{t('common.error')}</p>;
  if (!index) return <p className="status">{t('common.loading')}</p>;

  const keywords = [...new Set(index.plugins.flatMap((plugin) => plugin.keywords))].sort();

  return (
    <div className="page home-page">
      <section className="hero">
        <h1>{t('home.heroTitle')}</h1>
        <p className="hero-subtitle">{t('home.heroSubtitle')}</p>
        <SearchBox autoFocus />
        <div className="chips" aria-label={t('home.popularKeywords')}>
          {keywords.map((keyword) => (
            <a key={keyword} className="chip" href={searchHref(keyword)}>
              {keyword}
            </a>
          ))}
        </div>
      </section>

      {stats && (
        <section className="counters">
          <a className="counter" href={searchHref('', 'plugin')}>
            <strong>{stats.totals.plugins}</strong>
            <span>{t('home.counter.plugins')}</span>
          </a>
          <a className="counter" href={searchHref('', 'skill')}>
            <strong>{stats.totals.skills}</strong>
            <span>{t('home.counter.skills')}</span>
          </a>
          <a className="counter" href={searchHref('', 'agent')}>
            <strong>{stats.totals.agents}</strong>
            <span>{t('home.counter.agents')}</span>
          </a>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>{t('home.whatsNew')}</h2>
          <a href="#/whats-new">{t('home.viewAll')}</a>
        </div>
        {releases && (
          <ul className="release-strip">
            {releases.slice(0, 5).map((release) => (
              <li key={release.tag}>
                <a href={`#/plugin/${release.plugin}`}>{release.plugin}</a>
                <span className="release-version">v{release.version}</span>
                <span className="release-date">{release.date}</span>
                {release.highlights[0] && (
                  <span className="release-highlight">{release.highlights[0]}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>{t('home.browseByType')}</h2>
        <div className="browse-links">
          <a href={searchHref('', 'plugin')}>{t('home.browse.plugins')}</a>
          <a href={searchHref('', 'skill')}>{t('home.browse.skills')}</a>
          <a href={searchHref('', 'agent')}>{t('home.browse.agents')}</a>
        </div>
      </section>

      <section>
        <h2>{t('home.plugins')}</h2>
        <div className="plugin-grid">
          {index.plugins.map((plugin) => (
            <PluginCard key={plugin.name} plugin={plugin} />
          ))}
        </div>
      </section>
    </div>
  );
}
