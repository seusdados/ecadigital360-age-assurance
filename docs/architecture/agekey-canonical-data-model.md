# AgeKey — Canonical Data Model (referência)

> Status: documento de referência da Rodada 1.
> **Não aplica migrations.** Esta rodada não cria nem altera tabelas. O documento serve para alinhar futuras migrations de Consent (rodada `claude/agekey-parental-consent-module`) e Safety (rodada `claude/agekey-safety-signals`) ao padrão canônico já estabelecido pelo Core (`docs/data-model.md`, migrations `000_*` → `016_*`).

## 1. Princípios não-negociáveis

1. **Nenhuma coluna persiste data de nascimento, idade exata, documento bruto ou identidade civil.**
2. **Toda tabela de negócio multi-tenant tem `tenant_id` + RLS habilitada.**
3. **Tabelas de evidência são append-only via trigger** — `verification_results`, `audit_events`, `billing_events`, `revocations`, `policy_versions`.
4. **Soft delete apenas em tabelas de configuração** — `tenants`, `applications`, `policies`, `issuers`, `webhook_endpoints`.
5. **Chaves primárias UUID v7** (time-ordered) via `uuid_generate_v7()`.
6. **Service-role exclusivamente server-side.**
7. **Storage com RLS** para qualquer artefato.

## 2. Tabelas core (já existentes)

Conforme `supabase/migrations/000_*` a `016_*` e `docs/data-model.md`.

| Tabela | Função | Imutável |
|---|---|---|
| `tenants`, `tenant_users`, `applications` | Tenancy + RBAC. | Não (configuração) |
| `policies`, `policy_versions`, `jurisdictions` | Política e jurisdição. | `policy_versions` sim |
| `verification_sessions`, `verification_challenges` | Sessão e nonce. | Não (estado evolui) |
| `proof_artifacts` | Hash + storage path. | Não |
| `verification_results` | Decisão final. | Sim (trigger) |
| `result_tokens` | JTIs emitidos; suporta revogação. | Quase (só revogação) |
| `issuers`, `trust_lists`, `issuer_revocations`, `revocations` | Trust registry. | `revocations` sim |
| `crypto_keys` | Chaves de assinatura ES256 (Vault). | Service_role apenas |
| `webhook_endpoints`, `webhook_deliveries` | Webhooks (LIST status). | Não |
| `audit_events`, `billing_events` | Particionadas por mês. | Sim |
| `usage_counters`, `rate_limit_buckets`, `ip_reputation` | Apoio. | Não |

## 3. Extensões Consent (a implementar fora desta rodada)

Tabelas previstas para a rodada `claude/agekey-parental-consent-module`:

| Tabela | Coluna-chave | Notas |
|---|---|---|
| `parental_consent_requests` | `id`, `tenant_id`, `application_id`, `policy_id`, `policy_version`, `resource`, `status`, `expires_at` | RLS por tenant. Sem PII. |
| `guardian_contacts` | `id`, `tenant_id`, `request_id`, `contact_type`, `contact_enc`, `contact_hmac`, `created_at` | **Cifrado** em repouso. Acesso só por backend. RLS estrita. Retenção `consent_active_until_expiration` → `consent_expired_audit_window`. |
| `guardian_verifications` | `id`, `tenant_id`, `contact_id`, `otp_hash`, `expires_at`, `attempts`, `consumed_at` | Apenas hash do OTP. TTL `otp_24h`. |
| `consent_text_versions` | `id`, `tenant_id`, `policy_id`, `policy_version`, `text_hash`, `text_storage_path`, `locale`, `created_at` | Texto imutável referenciado por hash. |
| `parental_consents` | `id`, `tenant_id`, `request_id`, `policy_id`, `policy_version`, `consent_text_version_id`, `purpose_codes[]`, `data_categories[]`, `assurance_level` (`AAL-C*`), `granted_at`, `expires_at`, `revoked_at` | Imutável (trigger). Sem PII. |
| `parental_consent_tokens` | `jti`, `tenant_id`, `consent_id`, `kid`, `issued_at`, `expires_at`, `revoked_at` | Mesmo padrão de `result_tokens`. |
| `parental_consent_revocations` | `id`, `tenant_id`, `jti`, `reason`, `revoked_at` | Append-only. |

## 4. Extensões Safety Signals (a implementar fora desta rodada)

Tabelas previstas para a rodada `claude/agekey-safety-signals`:

| Tabela | Coluna-chave | Notas |
|---|---|---|
| `safety_subjects` | `id`, `tenant_id`, `application_id`, `subject_ref_hmac`, `subject_age_state`, `assurance_level` | Sujeito por referência opaca. Sem PII. |
| `safety_interactions` | `id`, `tenant_id`, `actor_subject_id`, `counterparty_subject_id`, `kind`, `created_at` | Sem conteúdo. |
| `safety_events` | `id`, `tenant_id`, `interaction_id`, `event_type`, `metadata_jsonb`, `payload_hash`, `created_at`, `retention_class` | **Metadata-only** no MVP. Privacy guard `safety_event_v1`. |
| `safety_rules` | `id`, `tenant_id`, `interaction_ruleset_id`, `code`, `version`, `severity`, `actions[]` | Configurável. Sem código livre. |
| `safety_alerts` | `id`, `tenant_id`, `subject_id`, `rule_id`, `event_ids[]`, `severity`, `status`, `actions_taken[]`, `created_at`, `resolved_at` | Retenção `alert_12m`. |
| `safety_aggregates` | `id`, `tenant_id`, `subject_id`, `aggregate_key`, `window`, `value`, `updated_at` | `aggregate_12m`. |
| `safety_evidence_artifacts` | `id`, `tenant_id`, `alert_id`, `artifact_hash`, `storage_path`, `created_at` | Hash + path. **Conteúdo bruto proibido em V1.** |
| `safety_model_runs` | `id`, `tenant_id`, `model_id`, `model_version`, `input_hash`, `output_jsonb`, `created_at` | Governança de classificadores. |
| `safety_webhook_deliveries` | espelho de `webhook_deliveries` para eventos `safety.*` (ou usar a mesma tabela com `event_type` discriminador). |

## 5. Colunas proibidas (em qualquer tabela do AgeKey)

```
birthdate, date_of_birth, dob, exact_age, cpf, rg, passport,
document_number, full_name, civil_name, selfie, face_image,
biometric_template, raw_document, identity_scan, address_full
```

Validação: testes de schema na rodada Consent/Safety devem falhar se uma migration introduzir qualquer dessas colunas.

## 6. Padrão de referência opaca

Onde for tentador armazenar um identificador civil (e-mail, telefone, IP, dispositivo, documento), usar HMAC SHA-256 do valor concatenado com `tenant_id` (sal por tenant) e armazenar **apenas o HMAC**:

```
subject_ref_hmac, guardian_ref_hmac, external_user_ref_hmac,
ip_ref_hmac, device_ref_hmac
```

Para artefatos:

```
artifact_hash, proof_hash, payload_hash
```

## 7. Padrão de RLS

1. Toda tabela multi-tenant: `ENABLE ROW LEVEL SECURITY`.
2. Política padrão: `tenant_id = current_tenant_id()`.
3. **Inserts públicos diretos proibidos.** Ingestão por Edge Function com `service_role`.
4. Usuários do tenant **só leem o tenant próprio**.
5. **Guardian nunca acessa tabela diretamente** por e-mail/telefone. Painel parental passa por backend usando token curto e escopado emitido pela Edge Function.
6. Painel admin acessa apenas visões minimizadas (`admin_minimized_view` no privacy guard).

## 8. Não-objetivos desta rodada

- Não criar migrations.
- Não criar tipos Postgres.
- Não criar tabelas Consent ou Safety.
- Não alterar `005_webhooks.sql`, `006_audit_billing.sql`, `008_rls.sql` ou qualquer migration existente.
- Apenas alinhar o esquema canônico para que as próximas rodadas (Consent, Safety) sigam o mesmo padrão.
