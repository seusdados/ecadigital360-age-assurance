import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { shortId } from '@/lib/utils';

export const metadata: Metadata = { title: 'Safety · Regras' };

interface RuleRow {
  id: string;
  rule_code: string;
  enabled: boolean;
  severity: string;
  actions: string[];
  tenant_id: string | null;
}

export default async function RulesPage() {
  await requireTenantContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from('safety_rules' as never)
    .select('id, rule_code, enabled, severity, actions, tenant_id')
    .order('rule_code', { ascending: true });
  const items = (data as unknown as RuleRow[] | null) ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Regras com <code>tenant_id = null</code> são defaults globais. Override
        per-tenant cria nova linha. <Link href="/safety/rules/new" className="text-primary hover:underline">Criar override</Link>
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Escopo</th>
              <th className="px-3 py-2">Habilitada</th>
              <th className="px-3 py-2">Severidade</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/safety/rules/${r.id}`} className="text-primary hover:underline">
                    {r.rule_code}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.tenant_id ? `tenant ${shortId(r.tenant_id)}` : 'global'}
                </td>
                <td className="px-3 py-2">{r.enabled ? '✅' : '❌'}</td>
                <td className="px-3 py-2">{r.severity}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.actions.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
