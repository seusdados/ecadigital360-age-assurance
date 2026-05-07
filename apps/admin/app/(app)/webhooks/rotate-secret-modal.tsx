'use client';

import { AlertTriangle, KeyRound, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { rotateSecretAction } from './actions';
import { SecretField } from './webhook-form';

interface RotateSecretModalProps {
  webhookId: string;
  webhookName: string;
}

export function RotateSecretModal({
  webhookId,
  webhookName,
}: RotateSecretModalProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealSecret, setRevealSecret] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = () => {
    if (isPending) return;
    setOpen(false);
    window.setTimeout(() => {
      setRevealSecret(null);
      setError(null);
    }, 200);
  };

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await rotateSecretAction(webhookId);
      if (result.ok) {
        setRevealSecret(result.raw_secret);
        return;
      }
      setError(result.error ?? 'Falha ao rotacionar secret.');
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
      >
        <KeyRound aria-hidden="true" />
        Rotacionar secret
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (isPending) return;
          if (revealSecret && next === false) return;
          if (!next) close();
          else setOpen(true);
        }}
      >
        <DialogContent
          className="max-w-md"
          hideCloseButton={Boolean(revealSecret)}
          onInteractOutside={(event) => {
            if (isPending || revealSecret) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (isPending || revealSecret) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (revealSecret) event.preventDefault();
          }}
        >
          {revealSecret ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Novo secret gerado
                </DialogTitle>
                <DialogDescription className="text-foreground/90">
                  Esta é a única vez que você vai ver esse secret. Atualize seu
                  backend para validar futuras assinaturas. O secret anterior
                  já foi invalidado para novos eventos.
                </DialogDescription>
              </DialogHeader>
              <SecretField label="Novo webhook secret" value={revealSecret} />
              <DialogFooter>
                <Button onClick={close}>Já guardei</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Rotacionar secret de {webhookName}?
                </DialogTitle>
                <DialogDescription className="text-foreground/90">
                  O secret atual será{' '}
                  <strong className="font-semibold">INVALIDADO</strong> para
                  novos eventos imediatamente. Entregas em fila com a
                  assinatura antiga continuam normalmente.
                </DialogDescription>
              </DialogHeader>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  {error}
                </p>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirm}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden="true" />
                      Rotacionando…
                    </>
                  ) : (
                    'Confirmar rotação'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
