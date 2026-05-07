import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';

export const metadata: Metadata = { title: 'Safety · Visão geral' };

export default async function SafetyOverviewPage() {
  await requireTenantContext();
  const supabase = await createClient();

  const [{ count: events }, { count: alerts }, { count: openAlerts }, { count: subjects }] =
    await Promise.all([
      supabase
        .from('safety_events' as never)
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('safety_alerts' as never)
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('safety_alerts' as never)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabase
        .from('safety_subjects' as never)
        .select('*', { count: 'exact', head: true }),
    ]);

  const cards = [
    { label: 'Eventos ingeridos', value: events ?? 0 },
    { label: 'Sujeitos rastreados', value: subjects ?? 0 },
    { label: 'Alertas (total)', value: alerts ?? 0 },
    { label: 'Alertas abertos', value: openAlerts ?? 0 },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {c.label}
          </p>
          <p className="mt-2 text-3xl font-light">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
