import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';

export const metadata: Metadata = { title: 'Safety · Retenção' };

interface RetentionRow {
  retention_class: string;
  count: number;
}

export default async function RetentionPage() {
  await requireTenantContext();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from('safety_events' as never)
    .select('retention_class')
    .limit(10000);
  const eventCounts = new Map<string, number>();
  for (const r of (events as unknown as Array<{ retention_class: string }> | null) ?? []) {
    eventCounts.set(r.retention_class, (eventCounts.get(r.retention_class) ?? 0) + 1);
  }
  const eventRows: RetentionRow[] = Array.from(eventCounts.entries())
    .map(([retention_class, count]) => ({ retention_class, count }))
    .sort((a, b) => a.retention_class.localeCompare(b.retention_class));

  const { count: legalHoldCount } = await supabase
    .from('safety_events' as never)
    .select('*', { count: 'exact', head: true })
    .eq('legal_hold', true);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Classes canônicas de retenção aplicadas aos <code>safety_events</code>.
        Cleanup automático respeita <code>legal_hold = true</code>.
      </p>
      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium">Eventos por classe</h3>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th>Classe</th><th>Eventos</th></tr></thead>
          <tbody className="divide-y divide-border">
            {eventRows.length === 0 ? (
              <tr><td colSpan={2} className="py-3 text-center text-muted-foreground">Sem eventos.</td></tr>
            ) : (
              eventRows.map((r) => (
                <tr key={r.retention_class}>
                  <td className="py-2 font-mono text-xs">{r.retention_class}</td>
                  <td className="py-2">{r.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 p-4 text-sm">
        🔒 <strong>Legal hold ativo:</strong> {legalHoldCount ?? 0} eventos
        protegidos contra cleanup automático.
      </div>
    </div>
  );
}
