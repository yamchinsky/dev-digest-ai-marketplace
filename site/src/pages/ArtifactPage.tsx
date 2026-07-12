import { useI18n } from '../lib/i18n';
import { stripFrontmatter, useBody, useIndex } from '../lib/data';
import { CopyButton } from '../components/CopyButton';
import { MarkdownView } from '../components/MarkdownView';

export function ArtifactPage({
  plugin: pluginName,
  artifact: artifactName,
}: {
  plugin: string;
  artifact: string;
}) {
  const { t } = useI18n();
  const { data: index, error } = useIndex();
  const plugin = index?.plugins.find((candidate) => candidate.name === pluginName);
  const artifact = plugin?.artifacts.find((candidate) => candidate.name === artifactName);
  const body = useBody(artifact?.bodyPath);

  if (error) return <p className="status">{t('common.error')}</p>;
  if (!index) return <p className="status">{t('common.loading')}</p>;
  if (!plugin || !artifact) {
    return (
      <div className="page">
        <p className="status">{t('artifact.notFound')}</p>
        <a href="#/">{t('common.backHome')}</a>
      </div>
    );
  }

  const invocation = `/${artifact.id}`;

  return (
    <div className="page artifact-page">
      <header className="page-head">
        <h1>{artifact.name}</h1>
        <span className={`badge badge-${artifact.type}`}>{t(`type.${artifact.type}`)}</span>
      </header>
      <p className="lead">{artifact.description}</p>

      <dl className="meta-grid">
        <div>
          <dt>{t('artifact.fromPlugin')}</dt>
          <dd>
            <a href={`#/plugin/${plugin.name}`}>{plugin.name}</a>
          </dd>
        </div>
        {artifact.tools && (
          <div>
            <dt>{t('artifact.tools')}</dt>
            <dd>{artifact.tools}</dd>
          </div>
        )}
        {artifact.model && (
          <div>
            <dt>{t('artifact.model')}</dt>
            <dd>{artifact.model}</dd>
          </div>
        )}
      </dl>

      <section>
        <h2>{t('artifact.invocation')}</h2>
        {artifact.type === 'skill' ? (
          <div className="command-row">
            <code>{invocation}</code>
            <CopyButton text={invocation} />
          </div>
        ) : (
          <p className="note">{t('artifact.agentNote', { id: artifact.id })}</p>
        )}
      </section>

      <section>
        <h2>{t('artifact.install')}</h2>
        <div className="command-row">
          <code>{plugin.installCommand}</code>
          <CopyButton text={plugin.installCommand} />
        </div>
      </section>

      <section>
        <h2>{t('artifact.documentation')}</h2>
        {body.error && <p className="status">{t('common.error')}</p>}
        {body.loading && <p className="status">{t('common.loading')}</p>}
        {body.data !== undefined && <MarkdownView markdown={stripFrontmatter(body.data)} />}
      </section>
    </div>
  );
}
