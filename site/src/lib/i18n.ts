import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'uk';

const en = {
  'app.title': 'DevDigest AI Marketplace',
  'app.tagline': 'Skills, agents, and workflows for Claude Code',
  'header.search': 'Search',
  'header.themeToggle': 'Toggle color theme',
  'nav.whatsNew': "What's new",
  'nav.gettingStarted': 'Getting started',
  'lang.switch': 'Українська',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'footer.source': 'Source on GitHub',
  'home.heroTitle': 'Find your next Claude Code plugin',
  'home.heroSubtitle':
    'Search plugins, skills, and agents from the DevDigest team harness — then copy a single install command.',
  'home.searchPlaceholder': 'Search plugins, skills, agents…',
  'home.popularKeywords': 'Popular keywords',
  'home.counter.plugins': 'Plugins',
  'home.counter.skills': 'Skills',
  'home.counter.agents': 'Agents',
  'home.whatsNew': "What's new",
  'home.viewAll': 'View all',
  'home.browseByType': 'Browse by type',
  'home.browse.plugins': 'All plugins',
  'home.browse.skills': 'All skills',
  'home.browse.agents': 'All agents',
  'home.plugins': 'Plugins',
  'search.title': 'Search',
  'search.filter.all': 'All',
  'search.filter.plugin': 'Plugins',
  'search.filter.skill': 'Skills',
  'search.filter.agent': 'Agents',
  'search.results': '{n} results',
  'search.noResults': 'Nothing found. Try another query.',
  'search.inPlugin': 'in {plugin}',
  'type.plugin': 'plugin',
  'type.skill': 'skill',
  'type.agent': 'agent',
  'plugin.version': 'Version',
  'plugin.category': 'Category',
  'plugin.compatibility': 'Compatibility',
  'plugin.author': 'Author',
  'plugin.updated': 'Updated',
  'plugin.install': 'Install',
  'plugin.viewOnGitHub': 'View on GitHub',
  'plugin.dependencies': 'Dependencies',
  'plugin.composition': 'Composition',
  'plugin.skills': 'Skills',
  'plugin.agents': 'Agents',
  'plugin.readme': 'README',
  'plugin.notFound': 'Plugin not found.',
  'artifact.fromPlugin': 'From plugin',
  'artifact.invocation': 'Invocation',
  'artifact.agentNote': 'Spawn via the Agent tool as {id}',
  'artifact.tools': 'Tools',
  'artifact.model': 'Model',
  'artifact.install': 'Install the parent plugin',
  'artifact.documentation': 'Documentation',
  'artifact.notFound': 'Artifact not found.',
  'whatsNew.title': "What's new",
  'whatsNew.empty': 'No releases yet.',
  'gettingStarted.title': 'Getting started',
  'gettingStarted.intro':
    'Everything installs through the Claude Code CLI — this site is only the catalog.',
  'gettingStarted.addTitle': '1. Add the marketplace',
  'gettingStarted.installTitle': '2. Install a plugin',
  'gettingStarted.installNote': 'Replace <plugin> with any plugin name from the catalog.',
  'gettingStarted.updateTitle': '3. Get updates',
  'gettingStarted.learnMore': 'Learn more',
  'gettingStarted.contributing': 'Contributing guide',
  'gettingStarted.guidelines': 'Plugin guidelines',
  'common.copy': 'Copy',
  'common.copied': 'Copied!',
  'common.loading': 'Loading…',
  'common.error': 'Failed to load data. Try reloading the page.',
  'common.backHome': 'Back to home',
  'palette.placeholder': 'Search the catalog…',
  'palette.noResults': 'No matches',
  'palette.hint': '↑ ↓ navigate · Enter open · Esc close',
} as const;

export type I18nKey = keyof typeof en;

const uk: Record<I18nKey, string> = {
  'app.title': 'DevDigest AI Marketplace',
  'app.tagline': 'Скіли, агенти та воркфлоу для Claude Code',
  'header.search': 'Пошук',
  'header.themeToggle': 'Перемкнути тему',
  'nav.whatsNew': 'Що нового',
  'nav.gettingStarted': 'Як почати',
  'lang.switch': 'English',
  'theme.light': 'Світла',
  'theme.dark': 'Темна',
  'footer.source': 'Код на GitHub',
  'home.heroTitle': 'Знайдіть свій наступний плагін для Claude Code',
  'home.heroSubtitle':
    'Шукайте плагіни, скіли й агентів з командного харнесу DevDigest — і копіюйте одну команду встановлення.',
  'home.searchPlaceholder': 'Шукати плагіни, скіли, агентів…',
  'home.popularKeywords': 'Популярні ключові слова',
  'home.counter.plugins': 'Плагіни',
  'home.counter.skills': 'Скіли',
  'home.counter.agents': 'Агенти',
  'home.whatsNew': 'Що нового',
  'home.viewAll': 'Переглянути всі',
  'home.browseByType': 'Перегляд за типом',
  'home.browse.plugins': 'Усі плагіни',
  'home.browse.skills': 'Усі скіли',
  'home.browse.agents': 'Усі агенти',
  'home.plugins': 'Плагіни',
  'search.title': 'Пошук',
  'search.filter.all': 'Усі',
  'search.filter.plugin': 'Плагіни',
  'search.filter.skill': 'Скіли',
  'search.filter.agent': 'Агенти',
  'search.results': 'Результатів: {n}',
  'search.noResults': 'Нічого не знайдено. Спробуйте інший запит.',
  'search.inPlugin': 'у {plugin}',
  'type.plugin': 'плагін',
  'type.skill': 'скіл',
  'type.agent': 'агент',
  'plugin.version': 'Версія',
  'plugin.category': 'Категорія',
  'plugin.compatibility': 'Сумісність',
  'plugin.author': 'Автор',
  'plugin.updated': 'Оновлено',
  'plugin.install': 'Встановлення',
  'plugin.viewOnGitHub': 'Переглянути на GitHub',
  'plugin.dependencies': 'Залежності',
  'plugin.composition': 'Склад',
  'plugin.skills': 'Скіли',
  'plugin.agents': 'Агенти',
  'plugin.readme': 'README',
  'plugin.notFound': 'Плагін не знайдено.',
  'artifact.fromPlugin': 'З плагіна',
  'artifact.invocation': 'Виклик',
  'artifact.agentNote': 'Запускається через інструмент Agent як {id}',
  'artifact.tools': 'Інструменти',
  'artifact.model': 'Модель',
  'artifact.install': 'Встановити батьківський плагін',
  'artifact.documentation': 'Документація',
  'artifact.notFound': 'Артефакт не знайдено.',
  'whatsNew.title': 'Що нового',
  'whatsNew.empty': 'Релізів поки немає.',
  'gettingStarted.title': 'Як почати',
  'gettingStarted.intro':
    'Усе встановлюється через Claude Code CLI — цей сайт лише каталог.',
  'gettingStarted.addTitle': '1. Додайте маркетплейс',
  'gettingStarted.installTitle': '2. Встановіть плагін',
  'gettingStarted.installNote': 'Замініть <plugin> на назву плагіна з каталогу.',
  'gettingStarted.updateTitle': '3. Отримуйте оновлення',
  'gettingStarted.learnMore': 'Дізнатися більше',
  'gettingStarted.contributing': 'Гайд для контриб’юторів',
  'gettingStarted.guidelines': 'Вимоги до плагінів',
  'common.copy': 'Копіювати',
  'common.copied': 'Скопійовано!',
  'common.loading': 'Завантаження…',
  'common.error': 'Не вдалося завантажити дані. Спробуйте оновити сторінку.',
  'common.backHome': 'На головну',
  'palette.placeholder': 'Пошук у каталозі…',
  'palette.noResults': 'Немає збігів',
  'palette.hint': '↑ ↓ навігація · Enter відкрити · Esc закрити',
};

const dictionaries: Record<Lang, Record<I18nKey, string>> = { en, uk };

const STORAGE_KEY = 'ddm-lang';

function readStoredLang(): Lang {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'en' || value === 'uk') return value;
  } catch {
    // localStorage unavailable — fall through to the default.
  }
  return 'en';
}

let currentLang: Lang = readStoredLang();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Persisting the language is best-effort.
  }
  listeners.forEach((listener) => listener());
}

/** Looks up a UI string in the active dictionary, with `{var}` interpolation. */
export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  let text = dictionaries[currentLang][key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function useI18n(): { lang: Lang; setLang: (lang: Lang) => void; t: typeof t } {
  const lang = useSyncExternalStore(subscribe, getLang);
  void lang; // subscribing is what forces re-render on language change
  return { lang, setLang, t };
}
