import { useState, type FormEvent } from 'react';
import { useI18n } from '../lib/i18n';
import { navigate, searchHref } from '../lib/router';
import type { TypeFilter } from '../lib/search';

interface SearchBoxProps {
  initialQuery?: string;
  type?: TypeFilter;
  autoFocus?: boolean;
}

export function SearchBox({ initialQuery = '', type = 'all', autoFocus = false }: SearchBoxProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState(initialQuery);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    navigate(searchHref(query, type));
  };

  return (
    <form className="search-box" onSubmit={submit} role="search">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('home.searchPlaceholder')}
        aria-label={t('header.search')}
        autoFocus={autoFocus}
      />
      <button type="submit">{t('header.search')}</button>
    </form>
  );
}
