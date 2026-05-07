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

## 10. Estado atual (Rodada Core readiness alignment)

A migração foi feita em duas camadas, **sem alterar o trigger SQL** que enfileira `webhook_deliveries`:

### 10.1 Camada já alinhada (worker `webhooks-worker`)

Os headers a seguir já são enviados em cada entrega de webhook, **em paralelo** aos headers legados:

| Header legado (mantido) | Header canônico (novo) |
|---|---|
| `X-AgeKey-Event-Type` | `X-AgeKey-Event-Type` (idêntico) |
| `X-AgeKey-Delivery-Id` | `X-AgeKey-Event-Id`, `X-AgeKey-Idempotency-Key` |
| `X-AgeKey-Signature` | `X-AgeKey-Webhook-Timestamp`, `X-AgeKey-Payload-Hash` |

Receivers existentes continuam funcionando exclusivamente com `X-AgeKey-Signature`. Receivers novos podem começar a validar `X-AgeKey-Webhook-Timestamp` e `X-AgeKey-Payload-Hash`.

### 10.2 Pendência migrável (rodada futura)

O HMAC continua sendo computado no trigger `fan_out_verification_webhooks` (`supabase/migrations/012_webhook_enqueue.sql`) com o formato legado: `HMAC_SHA256(secret_hash, payload_text)`.

Para migrar para o formato canônico `HMAC_SHA256(secret, ${timestamp}.${nonce}.${rawBody})`, é necessário:

1. Adicionar `nonce` por delivery na tabela `webhook_deliveries`.
2. Reescrever o trigger SQL para gerar `nonce` aleatório + assinar com `${timestamp}.${nonce}.${payload_text}`.
3. Atualizar receivers SDK (`@agekey/sdk-js/server` `registerWebhookHandler`) para aceitar a nova forma.
4. Manter compat no worker enviando ambas as assinaturas durante uma janela de migração.

Essa migração é **destrutiva** (toca trigger SQL ativo) e fica fora do escopo da rodada Core readiness alignment.

### 10.3 Pendência migrável (payload_json do trigger)

Hoje o payload gerado pelo trigger SQL não inclui `decision_domain`, `decision_id`, `policy_id`, `policy_version`, `payload_hash`, `content_included`, `pii_included`. Para alinhar o `payload_json` ao `AgeKeyWebhookPayload` canônico:

1. Estender `build_verification_event_payload(p_result_id)` (012_webhook_enqueue.sql).
2. Garantir que o payload passa pelo Privacy Guard (perfil `webhook`) antes da inserção — pode ser feito em pre-trigger TypeScript ou via constraint SQL.
3. Atualizar o consumidor SDK (`@agekey/sdk-js/server`) para tipar o payload com a forma canônica.

Idem ponto 10.2 — destrutivo, fica fora desta rodada.
