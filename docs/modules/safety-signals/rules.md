# AgeKey Safety Signals — Regras V1

## Estrutura

Cada regra é configurada em `safety_rules`:

| Coluna | Tipo | Significado |
|---|---|---|
| `tenant_id` | uuid (nullable) | NULL = default global. Não-NULL = override per-tenant. |
| `rule_code` | enum | Código sistêmico da regra (5 valores). |
| `enabled` | boolean | Liga/desliga avaliação. |
| `severity` | enum | `info` / `low` / `medium` / `high` / `critical`. |
| `actions` | text[] | Lista de ações canônicas. |
| `config_json` | jsonb | Parâmetros específicos (thresholds, janelas). |

## Regras V1

### `UNKNOWN_TO_MINOR_PRIVATE_MESSAGE`

Quando: `event_type ∈ {message_sent, private_chat_started}` e `relationship = unknown_to_minor`.

Default global:

```json
{
  "enabled": true,
  "severity": "high",
  "actions": ["request_step_up", "soft_block", "notify_safety_team"],
  "config_json": { "min_messages": 1 }
}
```

Reason: `SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE`. Risk category: `unknown_to_minor_contact`.

### `ADULT_MINOR_HIGH_FREQUENCY_24H`

Quando: `relationship = adult_to_minor` e `aggregates.adult_to_minor_messages_24h >= threshold_messages`.

Default global:

```json
{
  "enabled": true,
  "severity": "high",
  "actions": ["notify_safety_team", "escalate_to_human_review", "rate_limit_actor"],
  "config_json": { "window_hours": 24, "threshold_messages": 20 }
}
```

Reason: `SAFETY_ADULT_MINOR_HIGH_FREQUENCY_24H`. Risk category: `high_frequency_adult_minor`.

### `MEDIA_UPLOAD_TO_MINOR`

Quando: `event_type = media_upload` e `relationship` envolve menor recipient.

Default global:

```json
{
  "enabled": true,
  "severity": "medium",
  "actions": ["log_only", "request_parental_consent_check"],
  "config_json": { "allowed_with_consent": true }
}
```

Reason: `SAFETY_MEDIA_UPLOAD_TO_MINOR`. Risk category: `media_to_minor`.

### `EXTERNAL_LINK_TO_MINOR`

Quando: `event_type = external_link_shared` + `metadata.has_external_url=true` + relationship envolve menor recipient.

Default global:

```json
{
  "enabled": true,
  "severity": "medium",
  "actions": ["log_only", "soft_block"],
  "config_json": { "soft_block_default": true }
}
```

Reason: `SAFETY_EXTERNAL_LINK_TO_MINOR`. Risk category: `external_content_to_minor`.

### `MULTIPLE_REPORTS_AGAINST_ACTOR`

Quando: `aggregates.reports_against_actor_7d >= threshold_reports`.

Default global:

```json
{
  "enabled": true,
  "severity": "critical",
  "actions": ["notify_safety_team", "escalate_to_human_review", "rate_limit_actor"],
  "config_json": { "window_days": 7, "threshold_reports": 3 }
}
```

Reason: `SAFETY_MULTIPLE_REPORTS_AGAINST_ACTOR`. Risk category: `reported_actor`.

## Override per-tenant

Para customizar via SQL:

```sql
INSERT INTO safety_rules (tenant_id, rule_code, enabled, severity, actions, config_json)
VALUES (
  '<seu_tenant_id>',
  'ADULT_MINOR_HIGH_FREQUENCY_24H',
  true,
  'critical',
  ARRAY['notify_safety_team', 'escalate_to_human_review', 'rate_limit_actor', 'hard_block']::text[],
  jsonb_build_object('threshold_messages', 10, 'window_hours', 24)
)
ON CONFLICT (tenant_id, rule_code) DO UPDATE
  SET severity = EXCLUDED.severity,
      actions = EXCLUDED.actions,
      config_json = EXCLUDED.config_json;
```

UI de edição será adicionada em rodada futura.

## Composição de decisão

O rule engine combina todas as regras triggered:

- `severity` = max das severities triggered.
- `actions` = união das ações.
- `decision`:
  - se `hard_block` em actions → `hard_blocked`
  - senão se `escalate_to_human_review` → `needs_review`
  - senão se `request_step_up` → `step_up_required`
  - senão se `request_parental_consent_check` → `parental_consent_required`
  - senão se `soft_block` → `soft_blocked`
  - senão → `logged`

Quando nenhuma regra dispara: `no_risk_signal`.

## Garantias

- Regra **não** declara crime comprovado.
- Regra **não** emite conclusão jurídica definitiva.
- Decisão de alto impacto sempre inclui `escalate_to_human_review` ou `notify_safety_team`.
- Regra **não** processa conteúdo bruto — recebe apenas `event_type`, `relationship` (derivado), `aggregates` e flags booleanos (`has_media`, `has_external_link`).
