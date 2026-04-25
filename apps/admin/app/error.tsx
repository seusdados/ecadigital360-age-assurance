'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side error boundaries log via Sentry; here we keep it quiet.
    // Never log raw `error.message` in production — may contain PII traces.
    console.error('app_error', { digest: error.digest });
  }, [error.digest]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-6 px-6"
    >
      <p className="text-sm uppercase tracking-widest text-muted-foreground">
        Ops
      </p>
      <h1 className="text-xl font-thin">Algo não saiu como esperado.</h1>
      <p className="text-sm text-muted-foreground">
        Já registramos o erro. Tente novamente em instantes.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/70">
          Código de referência: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-accent"
      >
        Tentar novamente
      </button>
    </main>
  );
}
