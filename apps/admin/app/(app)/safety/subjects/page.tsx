import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { formatDateTime, shortId } from '@/lib/utils';

export const metadata: Metadata = { title: 'Safety · Sujeitos' };

interface SubjectRow {
  id: string;
  subject_ref_hmac: string;
  age_state: string;
  reports_count: number;
  alerts_count: number;
  last_seen_at: string;
}

export default async function SubjectsPage() {
  await requireTenantContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from('safety_subjects' as never)
    .select('id, subject_ref_hmac, age_state, reports_count, alerts_count, last_seen_at')
    .order('last_seen_at', { ascending: false })
    .limit(100);
  const items = (data as unknown as SubjectRow[] | null) ?? [];

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Ref HMAC</th>
            <th className="px-3 py-2">Estado etário</th>
            <th className="px-3 py-2">Reports</th>
            <th className="px-3 py-2">Alertas</th>
            <th className="px-3 py-2">Visto pela última vez</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Sem sujeitos.</td></tr>
          ) : (
            items.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-mono text-xs">{shortId(s.id)}</td>
                <td className="px-3 py-2 font-mono text-xs">{shortId(s.subject_ref_hmac)}</td>
                <td className="px-3 py-2"><code>{s.age_state}</code></td>
                <td className="px-3 py-2">{s.reports_count}</td>
                <td className="px-3 py-2">{s.alerts_count}</td>
                <td className="px-3 py-2">{formatDateTime(s.last_seen_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
