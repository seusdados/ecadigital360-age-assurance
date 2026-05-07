# API — AgeKey Parental Consent

> Schemas canônicos: `packages/shared/src/consent/consent-api.ts`.

Todos os endpoints respondem com:
- `Content-Type: application/json; charset=utf-8`
- Cabeçalhos CORS canônicos do AgeKey.
- Erros no formato `ErrorBody` (igual aos endpoints de verificação).

Todos os corpos públicos carregam `pii_included: false` e `content_included: false`
como auto-atestado. O privacy guard canônico bloqueia chaves PII na hora de
serializar — mas o auto-atestado deixa claro pro receptor o nível de
minimização.

---

## POST /v1/parental-consent/session

Cria uma sessão de consentimento.

### Request

```json
{
  "application_id": "018f7b8c-2222-7777-9999-2b31319d6ea2",
  "external_user_ref": "opaque-ref-1234abcd",
  "resource": "platform_use",
  "scope": "feature:onboarding",
  "purpose_codes": ["platform_use", "data_processing_minimum"],
  "data_categories": ["profile_minimum"],
  "risk_tier": "low",
  "policy_slug": "parental-consent-default",
  "webhook_correlation_id": "client-corr-123",
  "return_url": "https://rp.example.com/callback",
  "locale": "pt-BR",
  "verification_session_id": null
}
```

### Response 200

```json
{
  "session_id": "018f...",
  "consent_request_id": "018f...",
  "decision": "pending",
  "status": "pending_guardian",
  "reason_code": "CONSENT_NOT_GIVEN",
  "resource": "platform_use",
  "redirect_url": "https://agekey.com.br/parental-consent/018f...",
  "expires_at": "2026-05-08T11:00:00.000Z",
  "pii_included": false,
  "content_included": false
}
```

### Erros possíveis

- `400 INVALID_REQUEST` — body fora do schema.
- `400 EXTERNAL_USER_REF_PII_DETECTED` — `external_user_ref` se parece com email/CPF/etc.
- `403 FORBIDDEN` — `application_id` não bate com a API key.
- `403 FORBIDDEN` — módulo desativado por feature flag.
- `429 RATE_LIMIT_EXCEEDED`.

---

## POST /v1/parental-consent/:id/guardian/start

Inicia a verificação do canal do responsável.

### Request

```json
{
  "contact": "guardian@example.com",
  "contact_type": "email",
  "preferred_method": "otp_email"
}
```

O backend hashifica o contato (HMAC por-tenant) imediatamente. O contato
**não é guardado em texto plano** e **não aparece em nenhuma resposta**.

### Response 200

```json
{
  "consent_request_id": "018f...",
  "decision": "pending",
  "status": "pending_verification",
  "reason_code": "CONSENT_GUARDIAN_NOT_VERIFIED",
  "method": "otp_email",
  "verification_status": "sent",
  "expires_at": "2026-05-07T11:10:00.000Z",
  "pii_included": false,
  "content_included": false
}
```

> O OTP em si **nunca** aparece na resposta. A relying party orienta o
> responsável a checar o canal informado.

---

## POST /v1/parental-consent/:id/confirm

Confirma o OTP, registra o aceite, persiste o consentimento e (quando a
decisão é `approved`) emite o token JWS.

### Request

```json
{
  "otp": "123456",
  "consent_text_version_id": "018f...",
  "accepted": true,
  "declaration": {
    "guardian_responsibility_confirmed": true,
    "understands_scope": true,
    "understands_revocation": true
  }
}
```

### Response 200 (approved)

```json
{
  "consent_request_id": "018f...",
  "decision": "approved",
  "status": "approved",
  "reason_code": "CONSENT_GRANTED",
  "consent_token_id": "018f...",
  "parental_consent_id": "018f...",
  "verification_session_id": null,
  "token": {
    "jwt": "eyJhbGc...",
    "jti": "018f...",
    "issued_at": "2026-05-07T11:00:00.000Z",
    "expires_at": "2026-05-14T11:00:00.000Z",
    "kid": "k1",
    "token_type": "agekey_jws"
  },
  "method": "otp_email",
  "assurance_level": "low",
  "expires_at": "2026-05-14T11:00:00.000Z",
  "pii_included": false,
  "content_included": false
}
```

### Response 200 (denied / needs_review / blocked_by_policy / pending)

`token` é `null`. `decision` carrega o estado e `reason_code` é o motivo
canônico (`CONSENT_OTP_INVALID`, `CONSENT_OTP_EXPIRED`,
`CONSENT_GUARDIAN_NOT_VERIFIED`, `CONSENT_NEEDS_REVIEW`,
`CONSENT_BLOCKED_BY_POLICY`, `CONSENT_DENIED`, `CONSENT_NOT_GIVEN`).

---

## GET /v1/parental-consent/session/:session_id

Lê o status mínimo (sem expor contato, sem expor texto, sem expor OTP).

### Response 200

```json
{
  "consent_request_id": "018f...",
  "application_id": "018f...",
  "resource": "platform_use",
  "decision": "pending",
  "status": "pending_verification",
  "reason_code": "CONSENT_GUARDIAN_NOT_VERIFIED",
  "parental_consent_id": null,
  "parental_consent_status": null,
  "consent_token_id": null,
  "expires_at": "2026-05-08T11:00:00.000Z",
  "requested_at": "2026-05-07T11:00:00.000Z",
  "pii_included": false,
  "content_included": false
}
```

---

## POST /v1/parental-consent/:consent_token_id/revoke

Revoga o consentimento. Auth: `X-AgeKey-API-Key` (a relying party requer
um endpoint server-to-server; `actor_type='guardian'` é aceito quando o
painel do responsável (futuro) ou um SSO autenticado dispara a chamada).

### Request

```json
{
  "actor_type": "guardian",
  "reason_code": "CONSENT_REVOKED",
  "reason_text": "Responsável solicitou revogação via painel."
}
```

`reason_text` passa pelo privacy guard.

### Response 200

```json
{
  "parental_consent_id": "018f...",
  "consent_token_id": "018f...",
  "status": "revoked",
  "reason_code": "CONSENT_REVOKED",
  "revoked_at": "2026-05-09T08:00:00.000Z",
  "pii_included": false,
  "content_included": false
}
```

---

## POST /v1/parental-consent/token/verify

Endpoint **público** (sem API key) — equivalente ao `verifications/token/verify`.

### Request

```json
{
  "token": "eyJhbGc...",
  "expected_audience": "rp-app",
  "expected_resource": "platform_use"
}
```

### Response 200

```json
{
  "valid": true,
  "revoked": false,
  "reason_code": "CONSENT_GRANTED",
  "parental_consent_id": "018f...",
  "resource": "platform_use",
  "claims": {
    "decision": "approved",
    "decision_domain": "parental_consent",
    "resource": "platform_use",
    "scope": null,
    "purpose_codes": ["platform_use"],
    "data_categories": ["profile_minimum"],
    "method": "otp_email",
    "assurance_level": "low",
    "risk_tier": "low",
    "consent_token_id": "018f...",
    "parental_consent_id": "018f...",
    "tenant_id": "018f...",
    "application_id": "018f...",
    "iat": 1700000000,
    "exp": 1700604800
  },
  "pii_included": false,
  "content_included": false
}
```

Se `expected_audience` ou `expected_resource` não bate → `valid=false`,
`reason_code=CONSENT_RESOURCE_NOT_AUTHORIZED`.
Se token expirou → `reason_code=CONSENT_EXPIRED`.
Se o jti foi revogado → `valid=false`, `revoked=true`.

---

## Token

### Header

```json
{ "alg": "ES256", "typ": "agekey-parental-consent+jwt", "kid": "k1" }
```

### Payload

```json
{
  "iss": "https://agekey.com.br",
  "aud": "rp-app",
  "sub": "<external_user_ref opcional>",
  "jti": "018f...",
  "typ": "agekey-parental-consent+jwt",
  "iat": 1700000000,
  "nbf": 1700000000,
  "exp": 1700604800,
  "agekey": {
    "decision": "approved",
    "decision_domain": "parental_consent",
    "reason_code": "CONSENT_GRANTED",
    "consent_request_id": "...",
    "consent_token_id": "...",
    "parental_consent_id": "...",
    "resource": "platform_use",
    "scope": null,
    "purpose_codes": ["platform_use"],
    "data_categories": ["profile_minimum"],
    "risk_tier": "low",
    "guardian_verified": true,
    "method": "otp_email",
    "assurance_level": "low",
    "policy": null,
    "policy_version": null,
    "tenant_id": "...",
    "application_id": "..."
  }
}
```

### Claims proibidas (rejeitadas pelo privacy guard)

`name`, `full_name`, `civil_name`, `cpf`, `rg`, `passport`, `document`,
`document_number`, `birthdate`, `date_of_birth`, `dob`, `exact_age`,
`address`, `email`, `phone`, `guardian_email`, `guardian_phone`, `selfie`,
`face`, `biometric`, `raw_id`, `civil_id`.

---

## Webhooks

Eventos `parental_consent.*` (live):

- `parental_consent.session_created`
- `parental_consent.guardian_invited`
- `parental_consent.guardian_verified`
- `parental_consent.approved`
- `parental_consent.denied`
- `parental_consent.needs_review`
- `parental_consent.expired`
- `parental_consent.revoked`

Schema: `WebhookParentalConsentEventSchema` em
`packages/shared/src/webhooks/webhook-types.ts`.
