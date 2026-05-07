import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { formatDateTime, shortId } from '@/lib/utils';

export const metadata: Metadata = { title: 'Safety · Interações' };

interface InteractionRow {
  id: string;
  relationship: string;
  events_count: number;
  reports_count: number;
  last_seen_at: string;
  actor_subject_id: string;
  counterparty_subject_id: string | null;
}

export default async function InteractionsPage() {
  await requireTenantContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from('safety_interactions' as never)
    .select('id, relationship, events_count, reports_count, last_seen_at, actor_subject_id, counterparty_subject_id')
    .order('last_seen_at', { ascending: false })
    .limit(100);
  const items = (data as unknown as InteractionRow[] | null) ?? [];

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2">Relação</th>
            <th className="px-3 py-2">Ator</th>
            <th className="px-3 py-2">Contraparte</th>
            <th className="px-3 py-2">Eventos</th>
            <th className="px-3 py-2">Reports</th>
            <th className="px-3 py-2">Última atividade</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Sem interações.</td></tr>
          ) : (
            items.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2"><code>{i.relationship}</code></td>
                <td className="px-3 py-2 font-mono text-xs">{shortId(i.actor_subject_id)}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {i.counterparty_subject_id ? shortId(i.counterparty_subject_id) : '—'}
                </td>
                <td className="px-3 py-2">{i.events_count}</td>
                <td className="px-3 py-2">{i.reports_count}</td>
                <td className="px-3 py-2">{formatDateTime(i.last_seen_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
