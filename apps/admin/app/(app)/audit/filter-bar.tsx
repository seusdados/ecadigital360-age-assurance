'use client';

// Client Component justification: drives URL search params via useRouter
// for instant filter feedback without a full server round-trip.

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ACTOR_TYPES = ['', 'user', 'api_key', 'system', 'cron'] as const;
type ActorOption = (typeof ACTOR_TYPES)[number];

interface FilterBarProps {
  defaults: {
    action: string;
    resource_type: string;
    actor_type: string;
    from: string;
    to: string;
  };
}

export function FilterBar({ defaults }: FilterBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function buildSearchString(formData: FormData): string {
    const next = new URLSearchParams();
    const action = String(formData.get('action') ?? '').trim();
    const resourceType = String(formData.get('resource_type') ?? '').trim();
    const actorType = String(formData.get('actor_type') ?? '').trim();
    const from = String(formData.get('from') ?? '').trim();
    const to = String(formData.get('to') ?? '').trim();

    if (action) next.set('action', action);
    if (resourceType) next.set('resource_type', resourceType);
    if (actorType) next.set('actor_type', actorType);
    if (from) next.set('from', new Date(from).toISOString());
    if (to) next.set('to', new Date(to).toISOString());

    return next.toString();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const search = buildSearchString(formData);
    startTransition(() => {
      router.push(`/audit${search ? `?${search}` : ''}`);
    });
  }

  function handleReset() {
    if (params.toString().length === 0) return;
    startTransition(() => {
      router.push('/audit');
    });
  }

  // datetime-local expects "YYYY-MM-DDTHH:MM" — slice off seconds + Z.
  function toLocalInput(iso: string): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      aria-label="Filtros do feed de auditoria"
    >
      <div className="space-y-1">
        <Label htmlFor="filter-action">Ação</Label>
        <Input
          id="filter-action"
          name="action"
          defaultValue={defaults.action}
          placeholder="ex.: policies.update"
          autoComplete="off"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-resource-type">Recurso</Label>
        <Input
          id="filter-resource-type"
          name="resource_type"
          defaultValue={defaults.resource_type}
          placeholder="ex.: policies"
          autoComplete="off"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-actor-type">Tipo de ator</Label>
        <select
          id="filter-actor-type"
          name="actor_type"
          defaultValue={defaults.actor_type}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          {ACTOR_TYPES.map((value: ActorOption) => (
            <option key={value || 'any'} value={value}>
              {value === '' ? 'Qualquer' : value}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-from">De</Label>
        <Input
          id="filter-from"
          name="from"
          type="datetime-local"
          defaultValue={toLocalInput(defaults.from)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-to">Até</Label>
        <Input
          id="filter-to"
          name="to"
          type="datetime-local"
          defaultValue={toLocalInput(defaults.to)}
        />
      </div>

      <div className="col-span-full flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={pending}
        >
          Limpar
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Aplicando…
            </>
          ) : (
            'Aplicar filtros'
          )}
        </Button>
      </div>
    </form>
  );
}
