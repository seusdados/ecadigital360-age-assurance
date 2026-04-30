import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { agekey, AgeKeyApiError } from '@/lib/agekey/client';
import {
  getPolicyById,
  getPolicyVersions,
} from '@/lib/agekey/policies-server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { Button } from '@/components/ui/button';
import { cn, formatDateTime } from '@/lib/utils';
import { PolicyForm } from '../policy-form';
import type {
  AssuranceLevel,
  JurisdictionCode,
  PolicyFormInput,
  PolicyMethod,
} from '@/lib/validations/policies';

interface PolicyDetailPageProps {
  params: { id: string };
}

export async function generateMetadata({
  params,
}: PolicyDetailPageProps): Promise<Metadata> {
  const policy = await getPolicyById(params.id).catch(() => null);
  return {
    title: policy ? `Política · ${policy.name}` : 'Política',
  };
}

export default async function PolicyDetailPage({
  params,
}: PolicyDetailPageProps) {
  await requireTenantContext();

  const policy = await getPolicyById(params.id);
  if (!policy) notFound();

  let templates: Awaited<ReturnType<typeof agekey.policies.list>>['items'] =
    [];
  try {
    const r = await agekey.policies.list({ include_templates: true });
    templates = r.items.filter((p) => p.is_template);
  } catch (err) {
    // Non-fatal: detail page can still render without templates list.
    if (!(err instanceof AgeKeyApiError)) throw err;
  }

  const versions = await getPolicyVersions(policy.id);

  // policy.description é populado por /policies-list (campo description
  // adicionado ao SELECT no fix de Fase 2.b). Sem isso, edits de qualquer
  // outro campo apagavam silenciosamente a description existente — Codex P2.
  const policyAny = policy as typeof policy & { description?: string | null };
  const initial: Partial<PolicyFormInput> & { id: string } = {
    id: policy.id,
    slug: policy.slug,
    name: policy.name,
    description: policyAny.description ?? undefined,
    age_threshold: policy.age_threshold,
    jurisdiction_code: isJurisdiction(policy.jurisdiction_code)
      ? policy.jurisdiction_code
      : undefined,
    method_priority_json: filterMethods(policy.method_priority_json),
    required_assurance_level: isAssurance(policy.required_assurance_level)
      ? policy.required_assurance_level
      : 'substantial',
    token_ttl_seconds: policy.token_ttl_seconds,
  };

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/policies">
            <ArrowLeft aria-hidden="true" /> Voltar
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-md font-thin">{policy.name}</h1>
            <code className="font-mono text-xs text-muted-foreground">
              {policy.slug}
            </code>
            <StatusPill status={policy.status} />
            {policy.is_template ? (
              <span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-primary">
                Template
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Política #{policy.id.slice(0, 8)} · versão{' '}
            <span className="font-mono">v{policy.current_version}</span>
          </p>
        </div>

        {policy.is_template ? null : (
          <PolicyForm
            mode="edit"
            initial={initial}
            templates={templates.map((t) => ({
              id: t.id,
              name: t.name,
              slug: t.slug,
            }))}
          />
        )}
      </header>

      <section
        aria-labelledby="policy-fields-heading"
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <h2 id="policy-fields-heading" className="sr-only">
          Campos
        </h2>
        <Field label="Idade mínima" value={`${policy.age_threshold}+`} />
        <Field
          label="Faixa etária"
          value={
            policy.age_band_min !== null && policy.age_band_max !== null
              ? `${policy.age_band_min}–${policy.age_band_max}`
              : '—'
          }
        />
        <Field
          label="Jurisdição"
          value={policy.jurisdiction_code ?? '—'}
        />
        <Field
          label="Nível de assurance"
          value={
            policy.required_assurance_level === 'high'
              ? 'Alto'
              : policy.required_assurance_level === 'substantial'
                ? 'Substancial'
                : 'Baixo'
          }
        />
        <Field
          label="TTL do token"
          value={`${policy.token_ttl_seconds} s (${formatHours(policy.token_ttl_seconds)})`}
        />
        <Field
          label="Prioridade de métodos"
          value={
            policy.method_priority_json.length > 0
              ? policy.method_priority_json.join(' › ')
              : '—'
          }
        />
      </section>

      <section
        aria-labelledby="policy-versions-heading"
        className="space-y-3"
      >
        <h2
          id="policy-versions-heading"
          className="text-sm uppercase tracking-widest text-muted-foreground"
        >
          Histórico de versões
        </h2>
        {versions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-8 text-center text-sm text-muted-foreground">
            Sem histórico disponível.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-accent/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-normal">Versão</th>
                  <th className="px-3 py-2 font-normal">Quando</th>
                  <th className="px-3 py-2 font-normal">Autor</th>
                  <th className="px-3 py-2 font-normal">Diff</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr
                    key={v.version}
                    className="border-t border-border align-top"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      v{v.version}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDateTime(v.created_at)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {v.created_by ? v.created_by.slice(0, 8) : 'sistema'}
                    </td>
                    <td className="px-3 py-2">
                      <pre className="max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-tight">
                        {JSON.stringify(v.diff_json, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'rounded bg-accent px-2 py-0.5 text-[11px] uppercase tracking-wide',
      )}
    >
      {status}
    </span>
  );
}

function formatHours(seconds: number): string {
  if (seconds <= 0) return '—';
  const hours = seconds / 3600;
  if (hours >= 1) {
    return `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h`;
  }
  return `${(seconds / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min`;
}

function isJurisdiction(code: string | null): code is JurisdictionCode {
  return code === 'BR' || code === 'EU';
}

function isAssurance(level: string): level is AssuranceLevel {
  return level === 'low' || level === 'substantial' || level === 'high';
}

function filterMethods(input: readonly string[]): PolicyMethod[] {
  const allowed: PolicyMethod[] = ['zkp', 'vc', 'gateway', 'fallback'];
  const out: PolicyMethod[] = [];
  for (const m of input) {
    if ((allowed as string[]).includes(m)) {
      out.push(m as PolicyMethod);
    }
  }
  return out;
}
