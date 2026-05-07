# Taxonomia — AgeKey Safety Signals

> Catálogos fechados. Mantidos em sincronia entre TS (Zod), SQL (enums) e
> docs.

## `safety_event_type` (22 valores)

```
interaction_started, interaction_ended,
message_send_attempt, message_sent, message_blocked,
media_upload_attempt, media_upload_blocked,
external_link_attempt, external_link_blocked,
friend_request_attempt, friend_request_accepted, friend_request_blocked,
group_invite_attempt, group_invite_accepted, group_invite_blocked,
report_submitted, user_blocked, user_muted,
step_up_required, step_up_completed, step_up_failed,
moderation_action_received
```

## `safety_risk_category` (19 valores)

```
adult_minor_contact, unknown_minor_contact,
high_frequency_contact, off_platform_migration, media_exchange_risk,
cyberbullying_signal, harassment_signal, threat_signal,
grooming_pattern_signal, social_engineering_signal,
financial_exploitation_signal, credential_theft_signal,
group_pressure_signal, new_account_contact_risk,
device_or_ip_anomaly, policy_bypass_attempt, repeat_reported_actor,
unsafe_link_signal, unknown
```

**MVP prioriza** as cinco abaixo (cobertas pelas system rules):

- `unknown_minor_contact` — DM de desconhecido para menor.
- `high_frequency_contact` — alto volume adulto→menor em 24h.
- `media_exchange_risk` — tentativa de upload de mídia adulto→menor.
- `off_platform_migration` — link externo para menor.
- `repeat_reported_actor` — 3+ denúncias contra o mesmo ator em 7d.

## `safety_channel_type` (10 valores)

```
direct_message, group_chat, public_post, comment_thread,
voice_call, video_call, live_stream, media_upload, external_link,
unknown
```

## `safety_relationship_type` (7 valores)

Sempre **derivado server-side** a partir de `actor_age_state` ×
`counterparty_age_state`:

```
unknown_to_unknown, minor_to_minor, adult_to_adult,
adult_to_minor, minor_to_adult, unknown_to_minor, minor_to_unknown
```

## `safety_age_state` (6 valores)

```
unknown, minor, minor_under_13, minor_13_to_17, adult, adult_18_plus
```

**Importante**: estado **coarse**, nunca a idade exata. Mapeia para
o `age_band` canônico do Core.

## `safety_decision` (9 valores)

```
approved, needs_review, step_up_required, rate_limited,
soft_blocked, hard_blocked, blocked_by_policy,
parental_consent_required, error
```

## `safety_alert_status` (5 valores)

```
open, acknowledged, resolved, closed, dismissed
```

## `safety_severity` (4 valores)

```
low, medium, high, critical
```

## Reason codes promovidos a LIVE (Round 4)

```
SAFETY_OK
SAFETY_RISK_FLAGGED
SAFETY_NEEDS_REVIEW
SAFETY_STEP_UP_REQUIRED
SAFETY_PARENTAL_CONSENT_REQUIRED
SAFETY_RATE_LIMITED
SAFETY_SOFT_BLOCKED
SAFETY_HARD_BLOCKED
SAFETY_BLOCKED_BY_POLICY
SAFETY_RAW_CONTENT_REJECTED
SAFETY_PII_DETECTED
SAFETY_UNKNOWN_EVENT_TYPE
SAFETY_PRIVACY_BUDGET_EXCEEDED
SAFETY_DEVICE_BLOCKED
```

## DSL de regras

Operadores aceitos: `all`, `any`, `eq`, `neq`, `in`, `gte`, `lte`, `gt`,
`lt`, `exists`.

Campos permitidos (allowlist):

```
event_type, channel_type, relationship_type,
actor_age_state, counterparty_age_state,
severity, risk_category,
aggregate_24h_count, aggregate_7d_count, aggregate_30d_count,
aggregate_actor_reports_7d, aggregate_link_attempts_24h,
aggregate_media_to_minor_24h,
consent_status, verification_assurance_level
```

Campos **proibidos** (rejeitados pela própria estrutura do `RuleField`
enum):

```
raw_text, message, image, video, audio, conteúdo bruto, PII,
documento, data de nascimento, idade exata
```

## Verbos de ação

```
allow, rate_limit, soft_block, hard_block,
create_alert, queue_for_human_review, notify_tenant_webhook,
require_step_up_age_assurance, require_parental_consent_check, warn_user
```
