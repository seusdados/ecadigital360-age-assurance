import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';

export const metadata: Metadata = { title: 'Safety · Regra' };

interface RuleRow {
  id: string;
  rule_code: string;
  enabled: boolean;
  severity: string;
  actions: string[];
  config_json: Record<string, unknown>;
  tenant_id: string | null;
  created_at: string;
}

export default async function RuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTenantContext();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('safety_rules' as never)
    .select('id, rule_code, enabled, severity, actions, config_json, tenant_id, created_at')
    .eq('id', id)
    .maybeSingle();
  const rule = data as unknown as RuleRow | null;
  if (!rule) notFound();

  return (
    <div className="space-y-4">
      <Link href="/safety/rules" className="text-sm text-primary hover:underline">
        ← Voltar
      </Link>
      <div className="rounded-lg border border-border p-5 space-y-3">
        <h2 className="text-lg font-medium font-mono">{rule.rule_code}</h2>
        <Field label="Escopo">{rule.tenant_id ? `tenant ${rule.tenant_id}` : 'global'}</Field>
        <Field label="Habilitada">{rule.enabled ? '✅ sim' : '❌ não'}</Field>
        <Field label="Severidade">{rule.severity}</Field>
        <Field label="Ações">{rule.actions.join(', ')}</Field>
        <Field label="Config">
          <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
{JSON.stringify(rule.config_json, null, 2)}
          </pre>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
