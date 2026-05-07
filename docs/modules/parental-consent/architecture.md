# Arquitetura — AgeKey Parental Consent

## Como o módulo se conecta ao Core canônico

```
┌──────────────────────────────────────────────────────────────┐
│                        Relying Party                         │
└────────────────┬─────────────────────────────┬───────────────┘
                 │                             │
                 │  POST /v1/parental-consent/ │
                 │       session               │  POST /token/verify
                 │                             │
   ┌─────────────▼─────────────┐   ┌───────────▼───────────┐
   │   parental-consent-       │   │  parental-consent-    │
   │   session-create          │   │  token-verify         │
   └───────┬───────────────────┘   └──────────┬────────────┘
           │                                  │
           │   reuses (no duplication):       │
           │     - assertPublicPayloadHasNoPii (privacy guard canônico)
           │     - DecisionEnvelope discipline (envelope_version + audit projection)
           │     - signJwsClaims (jws.ts) for the consent token
           │     - WebhookSigner / WebhookEventPayloadSchema (canonical)
           │     - retention classes (consent_receipt = regulatory)
           │
   ┌───────▼───────────────────┐
   │ ConsentDecisionEnvelope   │  pure builder + schema + privacy guard
   │ (packages/shared/src/     │
   │  consent/)                │
   └───────┬───────────────────┘
           │
           │   projections used by edge functions:
           │     - envelopeToConsentTokenClaims  → signed JWT
           │     - consentEnvelopeAuditDiff      → audit_events.diff_json
           │     - consentEnvelopeWebhookPayload → webhook_deliveries
           │     - consentEnvelopeLogFields      → log.info
           │
   ┌───────▼───────────────────┐
   │ Postgres tables           │   RLS, check constraints, audit triggers
   │ (018_parental_consent.sql)│
   └───────────────────────────┘
```

## Por que um envelope peer (e não um envelope único)

O DecisionEnvelope canônico é **shape-específico do domínio age-verify**:
ele carrega `age_threshold`, `method` (zkp/vc/gateway/fallback) e
`threshold_satisfied` — campos que fazem sentido apenas para a verificação
etária. Empilhar campos de consentimento no mesmo envelope quebraria a
invariante "todo campo do envelope tem que valer para todos os domínios".

Por isso o módulo cria **`ConsentDecisionEnvelope`** como peer, mantendo:

- `envelope_version` (mesma disciplina de versionamento aditivo);
- `assertPublicPayloadHasNoPii` (mesmo privacy guard canônico);
- `decision_domain` literal `parental_consent` (distingue de `age_verify`);
- mesmo padrão de projeção (`envelopeTo* → claims/diff/log/webhook`);
- mesma chave de assinatura (`crypto_keys`), via `signJwsClaims` genérico
  adicionado a `jws.ts`.

Os dois domínios podem co-existir na mesma sessão de verificação:
`verification_session_id` é o ponto de junção (a coluna existe em
`parental_consent_requests` e `parental_consents` e referencia
`verification_sessions(id)`).

## Fluxo completo

### 1. Cria sessão (`POST /v1/parental-consent/session`)

1. Edge function autentica via `X-AgeKey-API-Key`.
2. Valida o body com `ConsentSessionCreateRequestSchema`.
3. Roda `detectPiiInRef` no `external_user_ref` (defesa de borda — mesma
   detecção usada em `verifications-session-create`).
4. Computa `subject_ref_hmac` via `consentHmacHex` (chave por-tenant).
5. INSERT em `parental_consent_requests` com `status='pending_guardian'`.
6. Resposta projetada com `assertPublicPayloadHasNoPii` + `pii_included=false`.

### 2. Inicia canal do responsável (`POST /:id/guardian/start`)

1. Hash do contato com HMAC por-tenant + propósito `contact`.
2. Upsert `guardian_contacts` (uma linha ativa por hash).
3. Gera OTP de 6 dígitos, persiste APENAS o digest
   `SHA-256(guardian_ref_hmac || otp)`.
4. INSERT em `guardian_verifications` com `status='sent'`,
   `decision='pending'`.
5. Resposta nunca echoa o contato. Inclui `expires_at` do OTP.

### 3. Confirma (`POST /:id/confirm`)

1. Carrega o último `guardian_verifications` da request.
2. Recomputa o digest com o OTP recebido. Se incorreto → reason
   `CONSENT_OTP_INVALID`. Se expirado → `CONSENT_OTP_EXPIRED`.
3. Carrega a versão de texto e valida `status='published'` + tenant.
4. Computa `consent_text_hash` e `proof_hash`.
5. Chama `buildConsentEnvelopeFromRows` que invoca a engine pura
   `evaluateConsent` + `buildConsentDecisionEnvelope`.
6. Se aprovado:
   - INSERT `parental_consents` (status='active');
   - assina JWS com `signJwsClaims` (typ = `agekey-parental-consent+jwt`);
   - INSERT `parental_consent_tokens`;
   - `audit_events` com `consentEnvelopeAuditDiff`;
   - trigger SQL `trg_parental_consents_fanout` enfileira o webhook
     `parental_consent.approved`.

### 4. Consulta status (`GET /v1/parental-consent/session/:id`)

Leitura mínima. Não revela contato, não revela conteúdo do texto, apenas o
status, a decisão, o reason code e (se houver) o `parental_consent_id` e o
`consent_token_id`.

### 5. Revoga (`POST /v1/parental-consent/:consent_token_id/revoke`)

1. Atualiza `parental_consent_tokens.status = 'revoked'`.
2. Atualiza `parental_consents.status = 'revoked'` (idempotente).
3. INSERT em `parental_consent_revocations` (APPEND-ONLY).
4. Trigger SQL `trg_parental_consents_fanout` enfileira o webhook
   `parental_consent.revoked`.

### 6. Verifica token (`POST /v1/parental-consent/token/verify`)

Endpoint público (sem API key). Usa `verifyJws` genérico contra a JWKS
pública, valida `aud`, `resource`, expiração, e consulta
`parental_consent_tokens.status` para detectar revogação.

## Decisões de design

- **Por que dois identificadores opacos (subject e guardian)?** O sujeito
  (menor) e o responsável têm ciclos de vida diferentes — o mesmo
  responsável pode autorizar diferentes menores; o mesmo menor pode ter
  diferentes responsáveis (guarda compartilhada). HMACs separados evitam
  colisão e permitem queries `por menor` ou `por responsável` sem expor
  PII.
- **Por que OTP digest e não OTP em vault?** O OTP vive 10 minutos, é
  descartável e não tem reuso. Persistir o digest é equivalente em
  segurança a guardar em vault temporário, com latência muito menor.
- **Por que `purpose_codes` e `data_categories` enumerados?** Listas
  abertas viram capacho para PII livre. O catálogo fechado obriga a
  evolução por migration revisada.
- **Por que `payload_hash` no webhook?** Permite que o receptor verifique
  se o payload foi mutado (algum proxy reformatou JSON, p.ex.) — é a
  âncora canônica do recibo.

## Pontos de extensão futura (declarados, não implementados)

- **SD-JWT VC** — `parental_consent_tokens.token_type='sd_jwt_vc'` está
  reservado, gated por `AGEKEY_CONSENT_SD_JWT_VC_ENABLED`. Detalhes em
  [`sd-jwt-vc-profile.md`](./sd-jwt-vc-profile.md).
- **Gateway de OTP** — `AGEKEY_CONSENT_GATEWAY_PROVIDERS_ENABLED` controla
  o uso de provedores externos para envio do código.
- **Painel do responsável (`/parental`)** — listagem dos consentimentos
  ativos por sessão autenticada do responsável.
