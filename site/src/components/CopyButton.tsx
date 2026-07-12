import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';

export function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (permissions / insecure context) — do nothing.
    }
  };

  return (
    <button type="button" className="copy-button" onClick={copy}>
      {copied ? t('common.copied') : t('common.copy')}
    </button>
  );
}
