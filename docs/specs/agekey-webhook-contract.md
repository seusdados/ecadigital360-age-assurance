# AgeKey — Webhook Contract (canônico)

> Status: contrato canônico da Rodada 1.
> Implementação: `packages/shared/src/webhooks/`.

## 1. Eventos canônicos (`AgeKeyWebhookEvent`)

```
verification.session_created
verification.approved
verification.denied
verification.expired
verification.revoked

parental_consent.session_created
parental_consent.guardian_invited
parental_consent.guardian_verified
parental_consent.approved
parental_consent.denied
parental_consent.expired
parental_consent.revoked
parental_consent.needs_review

safety.event_ingested
safety.alert_created
safety.alert_updated
safety.step_up_required
safety.parental_consent_check_required
```

## 2. Payload mínimo

```ts
type AgeKeyWebhookPayload = {
  event_id: string;
  event_type: AgeKeyWebhookEvent;
  created_at: string;          // ISO-8601 UTC
  tenant_id: string;
  application_id: string;
  decision?: AgeKeyDecisionEnvelope;
  session_id?: string;
  consent_token_id?: string;
  safety_alert_id?: string;
  policy_id?: string;
  policy_version?: string;
  resource?: string;
  reason_codes?: string[];
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
  content_included: false;
  pii_included: false;
  payload_hash: string;        // SHA-256 hex do rawBody
};
```

## 3. Headers canônicos

```
X-AgeKey-Webhook-Timestamp   — segundos epoch UTC, como string
X-AgeKey-Webhook-Nonce       — UUID v4 ou string aleatória de 16+ bytes
X-AgeKey-Webhook-Signature   — sha256=<hex lowercase>
X-AgeKey-Idempotency-Key     — chave única por entrega (recomendado)
X-AgeKey-Event-Type          — espelho do event_type
X-AgeKey-Event-Id            — espelho do event_id
```

## 4. Algoritmo de assinatura

```
input = `${timestamp}.${nonce}.${rawBody}`
signature = HMAC_SHA256(secret, input)
header X-AgeKey-Webhook-Signature = "sha256=" + hex(signature)
```

Comparação **em tempo constante** no receiver. Implementação:
`signWebhookPayload`, `verifyWebhookSignature`, `payloadHash` em `packages/shared/src/webhooks/webhook-signer.ts`.

## 5. Replay protection

- Janela aceita do `Timestamp`: **5 minutos** (`WEBHOOK_TIMESTAMP_WINDOW_SECONDS = 300`). Fora disso, rejeitar com `WEBHOOK_TIMESTAMP_OUT_OF_WINDOW`.
- `Nonce` deve ser registrado por `tenant_id + application_id` por uma janela mínima de 10 minutos. Repetição → `WEBHOOK_REPLAY_DETECTED`.

## 6. Retry e backoff

- Tentativas: até 8.
- Backoff exponencial com jitter: 1m, 5m, 15m, 1h, 6h, 24h, 48h, 72h.
- Após esgotar, mover para partição `webhook_deliveries_dead_letter`.
- Cada falha gera `audit_event`.

## 7. Idempotência

- O receiver deve usar `X-AgeKey-Idempotency-Key` para deduplicar entregas.
- Em ausência de header, usar `event_id` como chave de idempotência.

## 8. Privacidade

- `payload` passa pelo Privacy Guard com perfil `webhook` antes da assinatura.
- `content_included` e `pii_included` são literais `false`.
- Nenhum campo pode conter PII, conteúdo bruto, mensagem, mídia, idade exata, data de nascimento, documento, biometria, e-mail, telefone, IP bruto, GPS preciso, nome civil ou identificador civil.

## 9. Compatibilidade

- Verify/Core já tem `webhook_endpoints` + `webhook_deliveries`. O contrato canônico **estende**, não substitui — eventos `verification.*` continuam compatíveis.
- Consent e Safety Signals usam o **mesmo signer** e a **mesma tabela de deliveries** com particionamento por `status`.
- Cabeçalhos `X-AgeKey-*` são padronizados — clientes só aprendem uma família.
