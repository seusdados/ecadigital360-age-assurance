'use client';

// Client component: Next.js requires error boundaries to be client-side
// so they can re-render on `reset()`.

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function VerificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('verifications_error', { digest: error.digest });
  }, [error.digest]);

  return (
    <div role="alert" className="space-y-4">
      <h1 className="text-md font-thin">
        Não foi possível carregar as verificações.
      </h1>
      <p className="text-sm text-muted-foreground">
        Tente novamente em alguns instantes. Se o problema persistir, abra um
        chamado citando o código de referência abaixo.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          Ref: {error.digest}
        </p>
      ) : null}
      <Button onClick={reset} variant="outline" size="sm">
        Tentar novamente
      </Button>
    </div>
  );
}
