import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Safety · Integração' };

export default function IntegrationPage() {
  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm">
        Para enviar eventos Safety, configure um endpoint proxy no seu backend
        que repasse para AgeKey adicionando <code>X-AgeKey-API-Key</code>:
      </p>
      <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
{`// Server-side proxy (Express, Next route handler, etc.)
app.post('/api/agekey/safety-event-ingest', async (req, res) => {
  const resp = await fetch(\`\${AGEKEY_API_BASE}/safety-event-ingest\`, {
    method: 'POST',
    headers: {
      'X-AgeKey-API-Key': process.env.AGEKEY_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req.body),
  });
  res.status(resp.status).send(await resp.text());
});`}
      </pre>
      <p className="text-sm">
        Cliente browser (`@agekey/sdk-js/safety`):
      </p>
      <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
{`import { AgeKeySafetyClient } from '@agekey/sdk-js/safety';

const safety = new AgeKeySafetyClient({
  safetyEndpointBase: '/api/agekey',
});

// Antes de enviar uma mensagem (sem expor o conteúdo):
const decision = await safety.beforeSendMessage({
  senderSubjectRefHmac: hmacSubject('user-internal-id'),
  senderAgeState: 'unknown',  // do Core, se conhecido
  recipientSubjectRefHmac: hmacSubject('recipient-id'),
  recipientAgeState: 'minor',
  hasExternalLink: /^https?:\\/\\//.test(message),
});

if (decision.decision !== 'no_risk_signal') {
  // Trate step_up_required, soft_blocked, parental_consent_required, etc.
}`}
      </pre>
      <p className="text-sm text-muted-foreground">
        Documentação completa em <code>docs/modules/safety-signals/</code>.
      </p>
    </div>
  );
}
