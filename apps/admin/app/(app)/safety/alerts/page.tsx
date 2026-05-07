import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { formatDateTime, shortId } from '@/lib/utils';

export const metadata: Metadata = { title: 'Safety · Alertas' };

interface AlertRow {
  id: string;
  status: string;
  severity: string;
  rule_code: string;
  risk_category: string;
  reason_codes: string[];
  created_at: string;
  resolved_at: string | null;
}

const SEVERITY_TONE: Record<string, string> = {
  info: 'bg-stone-100 text-stone-700',
  low: 'bg-emerald-100 text-emerald-900',
  medium: 'bg-amber-100 text-amber-900',
  high: 'bg-orange-100 text-orange-900',
  critical: 'bg-rose-100 text-rose-900',
};

const STATUS_TONE: Record<string, string> = {
  open: 'bg-rose-100 text-rose-900',
  acknowledged: 'bg-amber-100 text-amber-900',
  escalated: 'bg-orange-100 text-orange-900',
  resolved: 'bg-emerald-100 text-emerald-900',
  dismissed: 'bg-stone-100 text-stone-700',
};

export default async function AlertsPage() {
  await requireTenantContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from('safety_alerts' as never)
    .select(
      'id, status, severity, rule_code, risk_category, reason_codes, created_at, resolved_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  const items = (data as unknown as AlertRow[] | null) ?? [];

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Severidade</th>
            <th className="px-3 py-2">Regra</th>
            <th className="px-3 py-2">Categoria de risco</th>
            <th className="px-3 py-2">Reason codes</th>
            <th className="px-3 py-2">Criado em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                Nenhum alerta gerado ainda.
              </td>
            </tr>
          ) : (
            items.map((a) => (
              <tr key={a.id} className="hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link href={`/safety/alerts/${a.id}`} className="font-mono text-xs text-primary hover:underline">
                    {shortId(a.id)}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[a.status] ?? 'bg-muted'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${SEVERITY_TONE[a.severity] ?? 'bg-muted'}`}>
                    {a.severity}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{a.rule_code}</td>
                <td className="px-3 py-2 text-xs">{a.risk_category}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {a.reason_codes.join(', ')}
                </td>
                <td className="px-3 py-2">{formatDateTime(a.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
