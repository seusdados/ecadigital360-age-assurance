import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Safety · Configurações' };

const FLAGS = [
  { key: 'AGEKEY_SAFETY_SIGNALS_ENABLED', desc: 'Mestre — default false', tone: 'critical' },
  { key: 'AGEKEY_SAFETY_DEFAULT_EVENT_RETENTION_CLASS', desc: 'Classe de retenção default para safety_events. Default event_90d.', tone: 'normal' },
  { key: 'AGEKEY_SAFETY_RETENTION_CLEANUP_BATCH_SIZE', desc: 'Lote de DELETE por execução. Default 500.', tone: 'normal' },
  { key: 'AGEKEY_PARENTAL_CONSENT_ENABLED', desc: 'Necessário para regras com action request_parental_consent_check.', tone: 'normal' },
];

export default function SafetySettingsPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Variáveis de ambiente que controlam o módulo Safety. A edição dessas
        flags é feita na infra (Supabase Edge Functions secrets), não no admin.
      </p>
      <div className="rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Variável</th>
              <th className="px-3 py-2">Descrição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {FLAGS.map((f) => (
              <tr key={f.key}>
                <td className="px-3 py-2 font-mono text-xs">{f.key}</td>
                <td className="px-3 py-2 text-xs">{f.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
