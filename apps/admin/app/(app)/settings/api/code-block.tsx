'use client';

// Client Component justification: clipboard write + transient "copied"
// state are inherently client-side concerns.

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  label?: string;
  className?: string;
}

export function CodeBlock({ code, label, className }: CodeBlockProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy() {
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(code);
      } else {
        throw new Error('Clipboard API indisponível.');
      }
      setCopied(true);
      setError(null);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Não foi possível copiar — selecione o texto manualmente.');
    }
  }

  const buttonLabel = label ? `Copiar ${label}` : 'Copiar';

  return (
    <div
      className={cn(
        'relative rounded-md border border-border bg-background',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label ?? 'Trecho'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          aria-label={buttonLabel}
        >
          {copied ? (
            <>
              <Check aria-hidden="true" />
              <span>Copiado</span>
            </>
          ) : (
            <>
              <Copy aria-hidden="true" />
              <span>Copiar</span>
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto px-3 py-3 font-mono text-xs leading-relaxed">
        {code}
      </pre>
      {error ? (
        <p role="alert" className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
