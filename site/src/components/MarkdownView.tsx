import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

/** Renders markdown: marked → DOMPurify.sanitize → dangerouslySetInnerHTML. */
export function MarkdownView({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(markdown, { async: false, gfm: true });
    return DOMPurify.sanitize(raw);
  }, [markdown]);

  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
