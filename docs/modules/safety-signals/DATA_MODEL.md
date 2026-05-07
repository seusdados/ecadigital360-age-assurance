# Modelo de dados — AgeKey Safety Signals

> Migration: `supabase/migrations/019_safety_signals.sql`.

## Tabelas

| Tabela | Append-only? | RLS | Notas |
|---|---|---|---|
| `safety_subjects` | não | tenant scoped | UPSERT-only via service_role |
| `safety_interactions` | não | tenant scoped | mutável só via service_role |
| `safety_events` | **sim** (trigger) | tenant + operator | `content_processed/stored` travados em `false` por CHECK |
| `safety_rules` | não | tenant + admin | tenant pode override por `rule_key` |
| `safety_alerts` | não | tenant scoped | UPDATE allowed pelo operador |
| `safety_aggregates` | não | tenant scoped | upsert por `(subject, bucket, category, window_start)` |
| `safety_evidence_artifacts` | **sim** | tenant + auditor | guarda apenas `artifact_hash` |
| `safety_model_runs` | não | tenant + auditor | reservado (governance flag off) |

## Colunas proibidas (todas as tabelas)

Mesmo conjunto canônico do privacy-guard, **mais** chaves de conteúdo
bruto:

```
message, raw_text, text, body, content,
image, image_data, video, video_data, audio, audio_data,
attachment, attachment_data, transcript, caption,
+ todas as PII keys (birthdate, cpf, email, phone, etc.)
+ latitude, longitude, gps, lat, lng, lon
```

A função SQL `safety_jsonb_has_no_forbidden_keys()` aplica essa lista a
`safety_events.metadata`, `safety_events.rule_eval`,
`safety_subjects.metadata`, `safety_alerts.metadata`,
`safety_rules.condition_json`, `safety_rules.action_json`,
`safety_model_runs.metadata`, `safety_interactions.metadata`.

## Esquema resumido

### safety_subjects
- `id`, `tenant_id`, `application_id`, `subject_ref_hmac`
- `current_age_state` (enum), `current_assurance_level`,
  `last_agekey_token_jti`, `last_verification_result_id`
- `risk_score` (0–1, **por-tenant**, nunca global), `risk_state`
- `first_seen_at`, `last_seen_at`, `metadata`, timestamps
- UNIQUE `(tenant_id, application_id, subject_ref_hmac)`

### safety_interactions
- `id`, `tenant_id`, `application_id`, `interaction_ref`
- `channel_type`, `relationship_type` (derivado, nunca cliente-supplied)
- `actor_subject_id`, `counterparty_subject_id`
- `actor_age_state`, `counterparty_age_state`
- `started_at`, `ended_at`, `duration_ms`, `status`, `metadata`

### safety_events (APPEND-ONLY)
- `id`, `tenant_id`, `application_id`, `event_type`
- `occurred_at`, `received_at`
- `interaction_id`, `interaction_ref`
- `actor_subject_id`, `counterparty_subject_id`
- `actor_ref_hmac`, `counterparty_ref_hmac` (formato hex 64-char)
- `actor_age_state`, `counterparty_age_state`, `relationship_type`,
  `channel_type`
- `ip_ref_hmac`, `ip_prefix_truncated`, `device_ref_hmac`,
  `user_agent_hash`
- `duration_ms`
- `content_processed BOOLEAN NOT NULL DEFAULT false CHECK (content_processed = false)` 🔒
- `content_stored BOOLEAN NOT NULL DEFAULT false CHECK (content_stored = false)` 🔒
- `artifact_hash`, `artifact_type`
- `risk_categories[]`, `reason_codes[]`, `model_score`, `rule_eval`
- `retention_class`, `retention_until`
- `raw_event_hash`, `client_event_id`, `metadata`, `created_at`

### safety_rules
- `id`, `tenant_id` (NULL = system), `application_id`, `rule_key`,
  `name`, `description`, `jurisdiction`, `version`
- `risk_category`, `severity`
- `condition_json` (CHECK), `action_json` (CHECK)
- `enabled`, `is_system_rule`, `created_by`, timestamps
- UNIQUE `(tenant_id, rule_key, version)`

### safety_alerts
- `id`, `tenant_id`, `application_id`, `alert_ref`
- `status`, `severity`, `risk_category`
- `actor_subject_id`, `counterparty_subject_id`, `interaction_id`
- `reason_codes[]`, `event_ids[]`, `evidence_artifact_ids[]`, `score`
- `action_taken`, `human_review_required`, `assigned_to`
- `opened_at`, `acknowledged_at`, `resolved_at`, `closed_at`
- `retention_class`, `retention_until`, `metadata`, timestamps

### safety_aggregates
- `id`, `tenant_id`, `application_id`, `subject_id`
- `bucket` ('24h', '7d', '30d', '6m', '12m')
- `category`, `count_value`, `window_start`, `window_end`, `computed_at`
- UNIQUE `(tenant_id, subject_id, bucket, category, window_start)`

### safety_evidence_artifacts (APPEND-ONLY)
- `id`, `tenant_id`, `alert_id`, `event_id`
- `artifact_hash`, `artifact_type`, `storage_ref`
- `created_at`

### safety_model_runs (reservado)
- `id`, `tenant_id`, `model_name`, `model_version`
- `invoked_at`, `duration_ms`, `inputs_hash`, `outputs_hash`
- `passed`, `reason`, `metadata`

## Padrões cross-tabelas

- **HMAC discipline** (mesmo helper do Consent):
  `HMAC(K_tenant, "subject_ref:" || ref)`,
  `HMAC(K_tenant, "actor_ref:"   || ip|device)`.
- **Hashes determinísticos**:
  - `artifact_hash` — SHA-256 hex computado client-side.
  - `payload_hash` — SHA-256 do envelope canônico.
  - `raw_event_hash` — SHA-256 do payload original (não armazenado).
- **Triggers**:
  - `trg_safety_events_no_update/no_delete` — append-only.
  - `trg_safety_evidence_no_update/no_delete` — append-only.
  - `trg_audit_safety_events` — escreve `audit_events`.
  - `trg_audit_safety_alerts` — escreve `audit_events`.
  - `trg_safety_alerts_fanout` — enfileira `webhook_deliveries`.

## Retention

| Categoria | Classe canônica | Janela |
|---|---|---|
| `safety_events` | `standard_audit` | 90d→365 (per-tenant) |
| `safety_alerts` | `standard_audit` | 90d→365 |
| `safety_aggregates` | `short_lived` | 30d |
| `safety_evidence_artifacts` | `regulatory` | 5 anos |
| `safety_subjects` | `standard_audit` | 90d→365 |
| `audit_events` (safety.*) | `standard_audit` | 90d→365 |

A enforcement automática é P3. Hoje `safety-retention-cleanup` é
dry-run-by-default (gated por `AGEKEY_SAFETY_RETENTION_DRY_RUN=true`)
e não deleta nada — operadores acompanham via log até a rodada de
particionamento mensal.
