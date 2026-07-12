import { useI18n } from '../lib/i18n';
import { useBody, useIndex, type Artifact } from '../lib/data';
import { CopyButton } from '../components/CopyButton';
import { MarkdownView } from '../components/MarkdownView';

function ArtifactLinkList({ artifacts }: { artifacts: Artifact[] }) {
  return (
    <ul className="artifact-list">
      {artifacts.map((artifact) => (
        <li key={artifact.id}>
          <a href={`#/artifact/${artifact.id}`}>{artifact.name}</a>
          <p>{artifact.description}</p>
        </li>
      ))}
    </ul>
  );
}

export function PluginPage({ name }: { name: string }) {
  const { t } = useI18n();
  const { data: index, error } = useIndex();
  const plugin = index?.plugins.find((candidate) => candidate.name === name);
  const readme = useBody(plugin?.readmePath);

  if (error) return <p className="status">{t('common.error')}</p>;
  if (!index) return <p className="status">{t('common.loading')}</p>;
  if (!plugin) {
    return (
      <div className="page">
        <p className="status">{t('plugin.notFound')}</p>
        <a href="#/">{t('common.backHome')}</a>
      </div>
    );
  }

  const skills = plugin.artifacts.filter((artifact) => artifact.type === 'skill');
  const agents = plugin.artifacts.filter((artifact) => artifact.type === 'agent');
  const githubUrl = `${index.marketplace.repoUrl}/tree/main/plugins/${plugin.name}`;

  return (
    <div className="page plugin-page">
      <header className="page-head">
        <h1>{plugin.name}</h1>
        <span className="badge badge-plugin">{t('type.plugin')}</span>
      </header>
      <p className="lead">{plugin.description}</p>

      <dl className="meta-grid">
        <div>
          <dt>{t('plugin.version')}</dt>
          <dd>{plugin.version}</dd>
        </div>
        {plugin.category && (
          <div>
            <dt>{t('plugin.category')}</dt>
            <dd>{plugin.category}</dd>
          </div>
        )}
        {plugin.compatibility && (
          <div>
            <dt>{t('plugin.compatibility')}</dt>
            <dd>{plugin.compatibility}</dd>
          </div>
        )}
        <div>
          <dt>{t('plugin.author')}</dt>
          <dd>{plugin.author}</dd>
        </div>
        {plugin.updatedAt && (
          <div>
            <dt>{t('plugin.updated')}</dt>
            <dd>{plugin.updatedAt}</dd>
          </div>
        )}
      </dl>

      <section>
        <h2>{t('plugin.install')}</h2>
        <div className="command-row">
          <code>{plugin.installCommand}</code>
          <CopyButton text={plugin.installCommand} />
        </div>
        <a className="external-link" href={githubUrl} target="_blank" rel="noreferrer">
          {t('plugin.viewOnGitHub')}
        </a>
      </section>

      {plugin.dependencies.length > 0 && (
        <section>
          <h2>{t('plugin.dependencies')}</h2>
          <ul className="dependency-list">
            {plugin.dependencies.map((dependency) => (
              <li key={dependency.name}>
                <a href={`#/plugin/${dependency.name}`}>{dependency.name}</a>{' '}
                <code>{dependency.version}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(skills.length > 0 || agents.length > 0) && (
        <section>
          <h2>{t('plugin.composition')}</h2>
          {skills.length > 0 && (
            <>
              <h3>{t('plugin.skills')}</h3>
              <ArtifactLinkList artifacts={skills} />
            </>
          )}
          {agents.length > 0 && (
            <>
              <h3>{t('plugin.agents')}</h3>
              <ArtifactLinkList artifacts={agents} />
            </>
          )}
        </section>
      )}

      <section>
        <h2>{t('plugin.readme')}</h2>
        {readme.error && <p className="status">{t('common.error')}</p>}
        {readme.loading && <p className="status">{t('common.loading')}</p>}
        {readme.data !== undefined && <MarkdownView markdown={readme.data} />}
      </section>
    </div>
  );
}
