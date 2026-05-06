'use client';

// Client Component justification: drives URL search params via useRouter
// for instant filter feedback without a full server round-trip, and
// triggers the CSV download via a same-origin POST whose Response is a
// streamed text/csv body.

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ACTOR_TYPES = ['', 'user', 'api_key', 'system', 'cron'] as const;
type ActorOption = (typeof ACTOR_TYPES)[number];

const PAGE_SIZES = ['50', '100', '500'] as const;

interface FilterBarProps {
  defaults: {
    action: string;
    resource_type: string;
    resource_id: string;
    actor_type: string;
    actor_id: string;
    from_date: string;
    to_date: string;
    page_size: string;
  };
  knownResourceTypes: readonly string[];
}

export function FilterBar({ defaults, knownResourceTypes }: FilterBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function readForm(form: HTMLFormElement): Record<string, string> {
    const fd = new FormData(form);
    const get = (k: string) => String(fd.get(k) ?? '').trim();
    return {
      action: get('action'),
      resource_type: get('resource_type'),
      resource_id: get('resource_id'),
      actor_type: get('actor_type'),
      actor_id: get('actor_id'),
      from_date: get('from_date'),
      to_date: get('to_date'),
      page_size: get('page_size'),
    };
  }

  function buildSearchString(values: Record<string, string>): string {
    const next = new URLSearchParams();
    for (const [key, val] of Object.entries(values)) {
      if (val) next.set(key, val);
    }
    return next.toString();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    const search = buildSearchString(values);
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

  // CSV download via fetch → Blob → anchor click. We avoid `<form action={...}>`
  // because Next 14 server actions returning a Response are still flagged
  // experimental for download semantics in the App Router; a typed Route
  // Handler at /audit/export-csv is far more predictable for browsers.
  async function handleExport(event: FormEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const values = readForm(form);
    setExportError(null);
    setExporting(true);
    try {
      const search = buildSearchString(values);
      const res = await fetch(
        `/audit/export-csv${search ? `?${search}` : ''}`,
        { method: 'GET', cache: 'no-store' },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(
          detail || `Falha ao exportar CSV (HTTP ${res.status}).`,
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dispo = res.headers.get('content-disposition') ?? '';
      const match = /filename="?([^";]+)"?/i.exec(dispo);
      a.download = match?.[1] ?? 'audit.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const truncated = res.headers.get('x-agekey-truncated') === 'true';
      if (truncated) {
        setExportError(
          'Export limitado a 10.000 linhas. Refine os filtros (período mais curto, recurso específico) para capturar tudo.',
        );
      }
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Falha ao exportar CSV.',
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Filtros do feed de auditoria"
    >
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
        <Label htmlFor="filter-actor-id">UUID do ator</Label>
        <Input
          id="filter-actor-id"
          name="actor_id"
          defaultValue={defaults.actor_id}
          placeholder="opcional — ex.: 4a1f…"
          autoComplete="off"
          inputMode="text"
          pattern="[0-9a-fA-F-]{0,36}"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-resource-type">Tipo de recurso</Label>
        <select
          id="filter-resource-type"
          name="resource_type"
          defaultValue={defaults.resource_type}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <option value="">Qualquer</option>
          {knownResourceTypes.map((rt) => (
            <option key={rt} value={rt}>
              {rt}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-resource-id">UUID do recurso</Label>
        <Input
          id="filter-resource-id"
          name="resource_id"
          defaultValue={defaults.resource_id}
          placeholder="opcional"
          autoComplete="off"
          pattern="[0-9a-fA-F-]{0,36}"
        />
      </div>

      <div className="space-y-1 lg:col-span-2">
        <Label htmlFor="filter-action">Ação (LIKE)</Label>
        <Input
          id="filter-action"
          name="action"
          defaultValue={defaults.action}
          placeholder="ex.: policy.update, .delete"
          autoComplete="off"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-from">De</Label>
        <Input
          id="filter-from"
          name="from_date"
          type="date"
          defaultValue={defaults.from_date}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-to">Até</Label>
        <Input
          id="filter-to"
          name="to_date"
          type="date"
          defaultValue={defaults.to_date}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-page-size">Por página</Label>
        <select
          id="filter-page-size"
          name="page_size"
          defaultValue={defaults.page_size}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {exportError ? (
        <p
          role="alert"
          className="col-span-full rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          {exportError}
        </p>
      ) : null}

      <div className="col-span-full flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={pending || exporting}
        >
          Limpar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={pending || exporting}
          aria-label="Exportar resultado em CSV (até 10.000 linhas)"
        >
          {exporting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Exportando…
            </>
          ) : (
            <>
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar CSV
            </>
          )}
        </Button>
        <Button type="submit" size="sm" disabled={pending || exporting}>
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
