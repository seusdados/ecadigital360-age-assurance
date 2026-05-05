import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { formatDateTime, shortId } from '@/lib/utils';

export const metadata: Metadata = { title: 'Safety · Evidência' };

interface EvidenceRow {
  id: string;
  alert_id: string;
  artifact_hash: string;
  mime_type: string | null;
  size_bytes: number | null;
  legal_hold: boolean;
  retention_class: string;
  created_at: string;
}

export default async function EvidencePage() {
  await requireTenantContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from('safety_evidence_artifacts' as never)
    .select('id, alert_id, artifact_hash, mime_type, size_bytes, legal_hold, retention_class, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  const items = (data as unknown as EvidenceRow[] | null) ?? [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Conteúdo bruto NÃO é armazenado em V1. Apenas referência via hash +
        path opcional. Itens com <code>legal_hold = true</code> nunca são
        apagados pelo retention cleanup.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Alert</th>
              <th className="px-3 py-2">Hash</th>
              <th className="px-3 py-2">MIME</th>
              <th className="px-3 py-2">Tamanho</th>
              <th className="px-3 py-2">Retenção</th>
              <th className="px-3 py-2">Legal hold</th>
              <th className="px-3 py-2">Criado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Sem evidência registrada.</td></tr>
            ) : (
              items.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 font-mono text-xs">{shortId(e.id)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{shortId(e.alert_id)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{shortId(e.artifact_hash)}</td>
                  <td className="px-3 py-2">{e.mime_type ?? '—'}</td>
                  <td className="px-3 py-2">{e.size_bytes ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.retention_class}</td>
                  <td className="px-3 py-2 text-center">{e.legal_hold ? '🔒' : '—'}</td>
                  <td className="px-3 py-2">{formatDateTime(e.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
