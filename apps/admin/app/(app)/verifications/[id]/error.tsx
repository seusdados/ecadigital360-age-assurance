'use client';

// Client component: Next.js error boundaries must be client to support reset.

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function VerificationDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('verification_detail_error', { digest: error.digest });
  }, [error.digest]);

  return (
    <div role="alert" className="space-y-4">
      <h1 className="text-md font-thin">
        Não foi possível carregar esta verificação.
      </h1>
      <p className="text-sm text-muted-foreground">
        Tente novamente em alguns instantes ou volte para a listagem.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          Ref: {error.digest}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={reset} variant="outline" size="sm">
          Tentar novamente
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/verifications">Voltar</Link>
        </Button>
      </div>
    </div>
  );
}
