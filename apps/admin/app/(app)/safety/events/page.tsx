import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { formatDateTime, shortId } from '@/lib/utils';

export const metadata: Metadata = { title: 'Safety · Eventos' };

interface EventRow {
  id: string;
  event_type: string;
  occurred_at: string;
  retention_class: string;
  legal_hold: boolean;
  payload_hash: string;
}

export default async function EventsPage() {
  await requireTenantContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from('safety_events' as never)
    .select('id, event_type, occurred_at, retention_class, legal_hold, payload_hash')
    .order('occurred_at', { ascending: false })
    .limit(100);
  const items = (data as unknown as EventRow[] | null) ?? [];

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Ocorrido em</th>
            <th className="px-3 py-2">Retenção</th>
            <th className="px-3 py-2">Legal hold</th>
            <th className="px-3 py-2">Payload hash</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                Nenhum evento ingerido.
              </td>
            </tr>
          ) : (
            items.map((e) => (
              <tr key={e.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{shortId(e.id)}</td>
                <td className="px-3 py-2"><code>{e.event_type}</code></td>
                <td className="px-3 py-2">{formatDateTime(e.occurred_at)}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.retention_class}</td>
                <td className="px-3 py-2 text-center">{e.legal_hold ? '🔒' : '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{shortId(e.payload_hash)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
