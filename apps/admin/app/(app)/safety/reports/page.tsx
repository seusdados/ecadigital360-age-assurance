import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';

export const metadata: Metadata = { title: 'Safety · Relatórios' };

export default async function ReportsPage() {
  await requireTenantContext();
  const supabase = await createClient();

  const { data: bySev } = await supabase
    .from('safety_alerts' as never)
    .select('severity')
    .limit(10000);
  const sevCounts = new Map<string, number>();
  for (const r of (bySev as unknown as Array<{ severity: string }> | null) ?? []) {
    sevCounts.set(r.severity, (sevCounts.get(r.severity) ?? 0) + 1);
  }

  const { data: byRule } = await supabase
    .from('safety_alerts' as never)
    .select('rule_code')
    .limit(10000);
  const ruleCounts = new Map<string, number>();
  for (const r of (byRule as unknown as Array<{ rule_code: string }> | null) ?? []) {
    ruleCounts.set(r.rule_code, (ruleCounts.get(r.rule_code) ?? 0) + 1);
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium">Alertas por severidade</h3>
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-border">
            {Array.from(sevCounts.entries()).map(([k, v]) => (
              <tr key={k}><td className="py-2">{k}</td><td className="py-2">{v}</td></tr>
            ))}
            {sevCounts.size === 0 && <tr><td colSpan={2} className="py-3 text-center text-muted-foreground">—</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium">Alertas por regra</h3>
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-border">
            {Array.from(ruleCounts.entries()).map(([k, v]) => (
              <tr key={k}><td className="py-2 font-mono text-xs">{k}</td><td className="py-2">{v}</td></tr>
            ))}
            {ruleCounts.size === 0 && <tr><td colSpan={2} className="py-3 text-center text-muted-foreground">—</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
