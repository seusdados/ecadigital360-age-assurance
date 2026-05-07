# Modelo de dados — AgeKey Parental Consent

> Migration: `supabase/migrations/018_parental_consent.sql`.

## Tabelas

| Tabela | Append-only? | RLS |
|---|---|---|
| `parental_consent_requests` | não (transitions controlled) | tenant scoped |
| `guardian_contacts` | não | tenant + admin |
| `guardian_verifications` | não | tenant + admin |
| `consent_text_versions` | não | tenant scoped |
| `parental_consents` | UPDATE limitado a status; DELETE bloqueado | tenant scoped |
| `parental_consent_tokens` | revogação por UPDATE | tenant scoped |
| `parental_consent_revocations` | **APPEND-ONLY** (trigger) | tenant + auditor |

## Colunas proibidas (em todas as tabelas)

`birthdate`, `date_of_birth`, `dob`, `birth_date`, `birthday`,
`data_nascimento`, `nascimento`, `idade`, `age`, `exact_age`, `document`,
`cpf`, `rg`, `passport`, `passport_number`, `id_number`, `civil_id`,
`social_security`, `ssn`, `name`, `full_name`, `nome`, `nome_completo`,
`first_name`, `last_name`, `email`, `phone`, `mobile`, `telefone`,
`address`, `endereco`, `street`, `postcode`, `zipcode`, `selfie`, `face`,
`face_image`, `biometric`, `biometrics`, `raw_id`.

A função SQL `consent_jsonb_has_no_forbidden_keys(payload jsonb)` aplica
essa lista a todos os campos `*_json` (CHECK constraint).

## Esquema resumido

### parental_consent_requests
- `id`, `tenant_id`, `application_id`, `policy_id`, `policy_version`,
  `verification_session_id`
- `external_user_ref`, `subject_ref_hmac` (HMAC SHA-256 hex)
- `resource`, `scope`, `purpose_codes[]`, `data_categories[]`, `risk_tier`
- `status` (enum `consent_request_status`), `decision`, `reason_code`
- `return_url`, `webhook_correlation_id`, `locale`
- `client_context_json` (CHECK contra PII)
- `client_ip`, `user_agent`
- `requested_at`, `expires_at`, `created_at`, `updated_at`

### guardian_contacts
- `id`, `tenant_id`, `consent_request_id`
- `guardian_ref_hmac`, `contact_type`, `contact_hash`, `contact_ciphertext`,
  `contact_ciphertext_kid`
- `verification_status`, `last_otp_sent_at`, `verified_at`
- timestamps

### guardian_verifications
- `id`, `tenant_id`, `consent_request_id`, `guardian_contact_id`
- `method`, `assurance_level`, `provider_id`, `attestation_hash`
- `decision`, `reason_code`
- `otp_digest` (HMAC do OTP), `otp_attempts`, `otp_expires_at`
- `evidence_json` (CHECK contra PII)
- `verified_at`, `expires_at`, timestamps

### consent_text_versions
- `id`, `tenant_id`, `policy_id`, `version`, `language`
- `title`, `body_markdown`, `body_hash` (SHA-256 hex)
- `data_categories[]`, `purpose_codes[]`
- `effective_from`, `effective_until`, `status`
- `created_by` (auth.users), timestamps
- UNIQUE `(tenant_id, policy_id, version, language)`

### parental_consents
- `id`, `tenant_id`, `consent_request_id`, `verification_session_id`,
  `guardian_verification_id`, `consent_text_version_id`, `application_id`,
  `policy_id`, `policy_version`
- `subject_ref_hmac`, `guardian_ref_hmac`
- `resource`, `scope`, `purpose_codes[]`, `data_categories[]`, `risk_tier`
- `method`, `assurance_level`, `status`
- `consent_text_hash`, `proof_hash`
- `issued_at`, `expires_at`, `revoked_at`, `revocation_reason`,
  `superseded_by`
- timestamps; DELETE bloqueado por trigger

### parental_consent_tokens
- `jti` (PK uuid v7), `tenant_id`, `parental_consent_id`,
  `result_token_id`
- `token_type` (`agekey_jws` ✅ / `sd_jwt_vc` reservado /
  `presentation` reservado), `token_hash`, `audience`, `kid`
- `issued_at`, `expires_at`, `revoked_at`, `status`

### parental_consent_revocations (APPEND-ONLY)
- `id`, `tenant_id`, `parental_consent_id`, `consent_token_id`
- `actor_type`, `actor_ref_hmac`, `reason_code`, `reason_text`
- `effective_at`, `webhook_dispatched_at`, `created_at`
- UPDATE/DELETE bloqueados por trigger

## Padrões cross-tabelas

### HMAC discipline

Todos os `*_ref_hmac` usam **chave por-tenant** com purpose binding:

```
HMAC(K_tenant, "subject_ref:" || external_user_ref)
HMAC(K_tenant, "guardian_ref:" || contact)
HMAC(K_tenant, "contact:"     || contact)
HMAC(K_tenant, "actor_ref:"   || actor_ref)
```

A chave é carregada da Vault (`crypto_keys_load_private` style RPC) ou,
em ambientes que ainda não a provisionaram, derivada de
`AGEKEY_CONSENT_HMAC_PEPPER + tenant_id` (fallback documentado).

### Hashes determinísticos

- `consent_text_hash = SHA-256(body_markdown)` — referenciado no token.
- `proof_hash = SHA-256(subject||guardian||resource||consent_text_hash||iat)`.
- `payload_hash = SHA-256(canonical-json(envelope))` — anchor opaco do
  recibo.

### Triggers

| Trigger | Tabela | Ação |
|---|---|---|
| `trg_pcr_updated_at` | `parental_consent_requests` | bumpa `updated_at` |
| `trg_gc_updated_at` | `guardian_contacts` | idem |
| `trg_gv_updated_at` | `guardian_verifications` | idem |
| `trg_ctv_updated_at` | `consent_text_versions` | idem |
| `trg_pc_updated_at` | `parental_consents` | idem |
| `trg_pc_no_delete` | `parental_consents` | bloqueia DELETE |
| `trg_pcrev_no_update`, `trg_pcrev_no_delete` | `parental_consent_revocations` | imutável |
| `trg_audit_parental_consents` | `parental_consents` | escreve `audit_events` |
| `trg_audit_parental_consent_revocations` | `parental_consent_revocations` | escreve `audit_events` |
| `trg_parental_consents_fanout` | `parental_consents` | enfileira `webhook_deliveries` |

## Retention

| Categoria | Classe canônica | Janela |
|---|---|---|
| `parental_consent_requests` (resolvido) | `regulatory` | 5 anos |
| `parental_consents` | `regulatory` | 5 anos |
| `parental_consent_revocations` | `regulatory` | 5 anos |
| `consent_text_versions` | `regulatory` | 5 anos |
| `guardian_contacts` (ciphertext) | `standard_audit` | 90d→365 |
| `guardian_verifications` (OTP digest) | `ephemeral` | 24h após verified |
| `audit_events` (consent.*) | `standard_audit` | 90d→365 |

A enforcement do retention vai ser plugada no `retention-job` em uma
rodada seguinte (a infraestrutura de classes em
`packages/shared/src/retention/retention-classes.ts` já reconhece as
categorias `consent_*`).
