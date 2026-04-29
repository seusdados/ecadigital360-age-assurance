'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ApplicationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('applications_error', { digest: error.digest });
  }, [error.digest]);

  return (
    <div className="space-y-4">
      <h1 className="text-md font-thin">
        Não foi possível carregar as aplicações.
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
