import { cn } from '@/lib/utils';

type Language = 'ts' | 'json';

const TS_KEYWORDS = new Set([
  'const',
  'let',
  'var',
  'await',
  'async',
  'return',
  'import',
  'from',
  'export',
  'function',
  'if',
  'else',
  'new',
]);

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlight(code: string, lang: Language): string {
  const safe = escapeHtml(code);
  if (lang === 'json') {
    return safe
      .replace(/("(?:\\.|[^"\\])*")(\s*:)/g, '<span class="tok-key">$1</span>$2')
      .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="tok-str">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="tok-num">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  }
  // ts (very lightweight)
  let out = safe.replace(/("(?:\\.|[^"\\])*")/g, '<span class="tok-str">$1</span>');
  out = out.replace(/(\/\/.*$)/gm, '<span class="tok-com">$1</span>');
  out = out.replace(/\b([a-zA-Z_]\w*)\b/g, (m) =>
    TS_KEYWORDS.has(m) ? `<span class="tok-key">${m}</span>` : m,
  );
  return out;
}

export function CodeBlock({
  code,
  language = 'ts',
  className,
  caption,
}: {
  code: string;
  language?: Language;
  className?: string;
  caption?: string;
}) {
  const html = highlight(code.trim(), language);
  return (
    <figure className={cn('w-full', className)}>
      {caption ? (
        <figcaption className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
      <pre
        className="code-block whitespace-pre"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
