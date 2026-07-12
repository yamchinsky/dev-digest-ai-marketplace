import { useI18n } from '../lib/i18n';
import { useIndex } from '../lib/data';
import { CopyButton } from '../components/CopyButton';

export function GettingStartedPage() {
  const { t } = useI18n();
  const { data: index, error } = useIndex();

  if (error) return <p className="status">{t('common.error')}</p>;
  if (!index) return <p className="status">{t('common.loading')}</p>;

  const { marketplace } = index;
  const installCommand = `claude plugin install <plugin>@${marketplace.name}`;
  const updateCommand = `claude plugin marketplace update ${marketplace.name}`;

  return (
    <div className="page getting-started-page">
      <h1>{t('gettingStarted.title')}</h1>
      <p className="lead">{t('gettingStarted.intro')}</p>

      <section>
        <h2>{t('gettingStarted.addTitle')}</h2>
        <div className="command-row">
          <code>{marketplace.addCommand}</code>
          <CopyButton text={marketplace.addCommand} />
        </div>
      </section>

      <section>
        <h2>{t('gettingStarted.installTitle')}</h2>
        <div className="command-row">
          <code>{installCommand}</code>
          <CopyButton text={installCommand} />
        </div>
        <p className="note">{t('gettingStarted.installNote')}</p>
      </section>

      <section>
        <h2>{t('gettingStarted.updateTitle')}</h2>
        <div className="command-row">
          <code>{updateCommand}</code>
          <CopyButton text={updateCommand} />
        </div>
      </section>

      <section>
        <h2>{t('gettingStarted.learnMore')}</h2>
        <ul className="link-list">
          <li>
            <a
              href={`${marketplace.repoUrl}/blob/main/CONTRIBUTING.md`}
              target="_blank"
              rel="noreferrer"
            >
              {t('gettingStarted.contributing')}
            </a>
          </li>
          <li>
            <a
              href={`${marketplace.repoUrl}/blob/main/docs/PLUGIN-GUIDELINES.md`}
              target="_blank"
              rel="noreferrer"
            >
              {t('gettingStarted.guidelines')}
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
