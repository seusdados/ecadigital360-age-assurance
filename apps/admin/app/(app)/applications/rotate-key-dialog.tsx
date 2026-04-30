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
import { rotateKeyAction } from './actions';
import { SecretField } from './application-form';

interface RotateKeyDialogProps {
  applicationId: string;
  applicationName: string;
}

export function RotateKeyDialog({
  applicationId,
  applicationName,
}: RotateKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = () => {
    if (isPending) return;
    setOpen(false);
    // Defer reset so the dialog close animation can run with the data still present.
    window.setTimeout(() => {
      setRevealKey(null);
      setError(null);
    }, 200);
  };

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await rotateKeyAction(applicationId);
      if (result.ok) {
        setRevealKey(result.api_key);
        return;
      }
      setError(result.error ?? 'Falha ao rotacionar chave.');
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
        Rotacionar chave
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (isPending) return;
          // Once the secret is revealed, only "Já guardei" closes the dialog.
          if (revealKey && next === false) return;
          if (!next) close();
          else setOpen(true);
        }}
      >
        <DialogContent
          className="max-w-md"
          hideCloseButton={Boolean(revealKey)}
          onInteractOutside={(event) => {
            if (isPending || revealKey) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (isPending || revealKey) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (revealKey) event.preventDefault();
          }}
        >
          {revealKey ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Nova chave gerada
                </DialogTitle>
                <DialogDescription className="text-foreground/90">
                  Esta chave aparece{' '}
                  <strong className="font-semibold">APENAS UMA VEZ</strong>.
                  Guarde-a em local seguro AGORA. A chave anterior já foi
                  invalidada.
                </DialogDescription>
              </DialogHeader>
              <SecretField label="Nova API key" value={revealKey} />
              <DialogFooter>
                <Button onClick={close}>Já guardei</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Rotacionar chave de {applicationName}?
                </DialogTitle>
                <DialogDescription className="text-foreground/90">
                  A chave atual será{' '}
                  <strong className="font-semibold">INVALIDADA</strong>{' '}
                  imediatamente. Aplicações usando a chave antiga vão receber{' '}
                  <code className="font-mono text-xs">401 Unauthorized</code>.
                  Não há janela de overlap.
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
