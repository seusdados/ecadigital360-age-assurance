'use client';

// Client component: needs useState/useFormState for dialog open/close +
// Server Action progress feedback. Server cannot drive Radix Dialog state.

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  revokeTokenAction,
  type RevokeTokenActionState,
} from '../actions';

const initialState: RevokeTokenActionState = {};

interface RevokeTokenDialogProps {
  jti: string;
  sessionId: string;
  disabled?: boolean;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          Revogando…
        </>
      ) : (
        'Revogar token'
      )}
    </Button>
  );
}

export function RevokeTokenDialog({
  jti,
  sessionId,
  disabled,
}: RevokeTokenDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(revokeTokenAction, initialState);

  // Auto-close on success.
  useEffect(() => {
    if (state.ok) {
      setOpen(false);
    }
  }, [state.ok]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={disabled}>
          Revogar token
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revogar token desta verificação</DialogTitle>
          <DialogDescription>
            A revogação é imediata e irreversível. Aplicações que validarem este
            token a partir de agora receberão decisão negativa. Registre o
            motivo para fins de auditoria.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="jti" value={jti} />
          <input type="hidden" name="sessionId" value={sessionId} />

          <div className="space-y-1.5">
            <Label htmlFor="reason">Motivo</Label>
            <textarea
              id="reason"
              name="reason"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              aria-invalid={Boolean(state.fieldErrors?.reason)}
              aria-describedby={
                state.fieldErrors?.reason ? 'reason-error' : undefined
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              placeholder="Ex.: titular solicitou exclusão da verificação."
            />
            {state.fieldErrors?.reason ? (
              <p id="reason-error" role="alert" className="text-xs text-destructive">
                {state.fieldErrors.reason[0]}
              </p>
            ) : null}
          </div>

          {state.error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
