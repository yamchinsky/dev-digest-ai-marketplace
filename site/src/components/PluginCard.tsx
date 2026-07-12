import { useI18n } from '../lib/i18n';
import type { Plugin } from '../lib/data';

export function PluginCard({ plugin }: { plugin: Plugin }) {
  const { t } = useI18n();

  return (
    <a className="plugin-card" href={`#/plugin/${plugin.name}`}>
      <div className="plugin-card-head">
        <h3>{plugin.name}</h3>
        <span className="plugin-version">v{plugin.version}</span>
      </div>
      <p className="plugin-card-description">{plugin.description}</p>
      <div className="plugin-card-meta">
        {plugin.category && <span className="chip chip-static">{plugin.category}</span>}
        <span>
          {plugin.counts.skills} {t('home.counter.skills')}
        </span>
        <span>
          {plugin.counts.agents} {t('home.counter.agents')}
        </span>
      </div>
    </a>
  );
}
