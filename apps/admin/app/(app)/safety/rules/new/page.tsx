import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Safety · Nova regra' };

export default function NewRulePage() {
  return (
    <div className="space-y-4 rounded-lg border border-border p-5">
      <h2 className="text-lg font-medium">Criar override de regra</h2>
      <p className="text-sm text-muted-foreground">
        Edição via UI será adicionada em rodada futura. Para este MVP, override
        per-tenant é feito via SQL ou via Edge Function dedicada (a implementar).
      </p>
      <pre className="rounded-md bg-muted p-3 text-xs">
{`INSERT INTO safety_rules (tenant_id, rule_code, enabled, severity, actions, config_json)
VALUES (
  '<seu_tenant_id>',
  'ADULT_MINOR_HIGH_FREQUENCY_24H',
  true,
  'critical',
  ARRAY['notify_safety_team', 'escalate_to_human_review', 'rate_limit_actor'],
  jsonb_build_object('threshold_messages', 10, 'window_hours', 24)
)
ON CONFLICT (tenant_id, rule_code) DO UPDATE
SET severity = EXCLUDED.severity,
    actions = EXCLUDED.actions,
    config_json = EXCLUDED.config_json;`}
      </pre>
      <p className="text-xs text-muted-foreground">
        Documentação completa em{' '}
        <code>docs/modules/safety-signals/rules.md</code>.
      </p>
    </div>
  );
}
