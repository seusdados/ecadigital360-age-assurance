# AgeKey Safety Signals — Integration Guide

## 1. Pré-requisitos

- Tenant ativo + applications configurada.
- `X-AgeKey-API-Key` server-side disponível.
- Habilitação: `AGEKEY_SAFETY_SIGNALS_ENABLED=true` na infra.
- Para parental consent integration: `AGEKEY_PARENTAL_CONSENT_ENABLED=true`.

## 2. Server-side: ingestão de eventos

Todo evento chega via `POST /v1/safety/event`. **Apenas metadata** — nunca o conteúdo.

```ts
const resp = await fetch(`${AGEKEY_API_BASE}/safety-event-ingest`, {
  method: 'POST',
  headers: {
    'X-AgeKey-API-Key': process.env.AGEKEY_API_KEY!,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    event_type: 'message_sent',
    actor_subject_ref_hmac: hmacSubject('user-internal-id'),
    counterparty_subject_ref_hmac: hmacSubject('recipient-id'),
    actor_age_state: 'adult',     // se conhecido (do Core)
    counterparty_age_state: 'minor',
    metadata: {
      channel: 'private',
      length_chars: 142,
      has_external_url: false,
    },
  }),
});

const { decision, reason_codes, alert_id, step_up_session_id } = await resp.json();
```

**Resposta:**

- `decision: 'no_risk_signal'` → siga normalmente.
- `decision: 'soft_blocked'` → exiba aviso ao usuário, talvez exija confirmação.
- `decision: 'hard_blocked'` → bloqueie a ação.
- `decision: 'step_up_required'` → redirecione ao fluxo do Core (`step_up_session_id` aponta para o `verification_session` já criado).
- `decision: 'parental_consent_required'` → o `alert_id` linka para um `parental_consent_request_id` — exiba o painel parental ao responsável.
- `decision: 'needs_review'` → assunto escalado; aguarde decisão humana.

## 3. Browser-side: stubs honestos

```ts
import { AgeKeySafetyClient } from '@agekey/sdk-js/safety';

const safety = new AgeKeySafetyClient({
  // URL do proxy do APP cliente (não AgeKey direto — API key fica server-side):
  safetyEndpointBase: '/api/agekey',
});

// ANTES de enviar mensagem (sem expor o texto):
const decision = await safety.beforeSendMessage({
  senderSubjectRefHmac: hmacSubject(currentUserId),
  senderAgeState: currentUserAgeState, // do Core
  recipientSubjectRefHmac: hmacSubject(recipientId),
  recipientAgeState: recipientAgeState,
  hasExternalLink: /^https?:\/\//.test(message),
});

if (decision.decision === 'soft_blocked') {
  showWarning('Esta mensagem requer confirmação extra.');
}
if (decision.stepUpRequired) {
  redirectToStepUp(decision);
}
if (decision.parentalConsentRequired) {
  showParentalConsentPrompt();
}
```

**Importante:** o stub `beforeSendMessage` **não recebe o texto**. Apenas metadata derivado pelo caller (recipient_id, has_external_link, etc.).

## 4. Webhook handlers

Configurar webhook endpoint para subscrever:

- `safety.alert_created`
- `safety.alert_updated`
- `safety.step_up_required`
- `safety.parental_consent_check_required`

Validar assinatura HMAC com o mesmo secret usado para `verification.*` events (mesmo `webhook_endpoints.secret_hash` do Core).

```ts
import crypto from 'node:crypto';

app.post('/webhooks/agekey', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.header('X-AgeKey-Signature');
  const expected = crypto.createHmac('sha256', SECRET_HASH).update(req.body).digest('hex');
  if (sig !== expected) return res.sendStatus(403);

  const payload = JSON.parse(req.body);
  if (payload.event_type === 'safety.step_up_required') {
    // payload.decision.step_up_required === true
    // payload.safety_alert_id, payload.application_id, ...
  }
  res.sendStatus(204);
});
```

## 5. Boas práticas

1. **Não fazer hash do conteúdo no servidor.** Hash deve ser computado no cliente (Web Crypto) e enviado em `content_hash` apenas para correlação.
2. **`subject_ref_hmac` consistente** entre eventos para o mesmo usuário — assim aggregates funcionam.
3. **`actor_age_state` vindo do Core** — sempre que possível, derive a partir da última `verification_results` do usuário.
4. **Reações ao webhook devem respeitar idempotência** — `X-AgeKey-Delivery-Id` deduplica.
5. **Reagir imediatamente a `hard_blocked`** — bloquear ação, registrar internamente, opcionalmente abrir ticket.
6. **Honrar `legal_hold`** — se o tenant marcar evidência como `legal_hold=true`, não apagar.

## 6. Limites do MVP

- Sem rule editor UI — overrides via SQL.
- Sem provider real de moderação (LLM externo) — `safety_model_runs` existe como tabela mas não é populada.
- Sem evidence vault separado.
- Sem SIEM/SOAR integration nativa — webhooks são o canal primário.
- Sem dashboard analytics avançado.
