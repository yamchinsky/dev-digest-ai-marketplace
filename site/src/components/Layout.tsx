import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { useIndex } from '../lib/data';
import { CommandPalette } from './CommandPalette';

const isMacLike =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const shortcutLabel = isMacLike ? '⌘K' : 'Ctrl K';

export function Layout({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const { data: index } = useIndex();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Cmd/Ctrl+K opens the command palette from any screen.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="layout">
      <header className="site-header">
        <a className="brand" href="#/" title={t('app.tagline')}>
          {t('app.title')}
        </a>
        <nav className="site-nav">
          <a href="#/whats-new">{t('nav.whatsNew')}</a>
          <a href="#/getting-started">{t('nav.gettingStarted')}</a>
        </nav>
        <div className="header-actions">
          <button type="button" className="shortcut-hint" onClick={() => setPaletteOpen(true)}>
            {t('header.search')} <kbd>{shortcutLabel}</kbd>
          </button>
          <button type="button" onClick={toggle} aria-label={t('header.themeToggle')}>
            {theme === 'dark' ? t('theme.light') : t('theme.dark')}
          </button>
          <button type="button" onClick={() => setLang(lang === 'en' ? 'uk' : 'en')}>
            {t('lang.switch')}
          </button>
        </div>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        {index && (
          <a href={index.marketplace.repoUrl} target="_blank" rel="noreferrer">
            {t('footer.source')}
          </a>
        )}
      </footer>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
