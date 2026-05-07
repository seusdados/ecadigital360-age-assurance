# AgeKey Safety Signals — MVP metadata-only

> Status: introduzido na rodada `claude/agekey-safety-signals` (R4).
> Subordinado ao **AgeKey Core** + integrado ao **AgeKey Consent**.

## 1. Princípio

Safety Signals é uma camada de **sinais de risco proporcionais e auditáveis** sobre interações dentro da aplicação cliente. Não interceta tráfego, não captura TLS, não monitora dispositivo, não usa LLM externo para conteúdo de menor, não cria reconhecimento facial nem emotion recognition, não emite score universal cross-tenant, não declara crime comprovado.

V1 é estritamente **metadata-only**: nenhuma coluna armazena `message`, `raw_text`, `image`, `video`, `audio` — Privacy Guard com perfil `safety_event_v1` rejeita o ingest.

Regras geram apenas `reason_code`, `severity`, `risk_category` e `actions` proporcionais (log, soft_block, request_step_up, request_parental_consent_check, hard_block, escalate_to_human_review, rate_limit_actor).

## 2. Tabelas

| Tabela | Função | Imutável |
|---|---|---|
| `safety_subjects` | Sujeito por referência opaca + estado etário derivado. | Não |
| `safety_interactions` | Par actor/counterparty, relationship derivada. | Não |
| `safety_events` | Evento metadata-only ingerido. **Append-only**, exceto retention cleanup. |
| `safety_rules` | Configuração por tenant (override do default global). | Não |
| `safety_alerts` | Alerta gerado pelo rule engine. | Não (status evolui) |
| `safety_aggregates` | Contadores por sujeito (window 24h/7d/30d/12m). Sobrevivem aos eventos. | Não |
| `safety_evidence_artifacts` | Hash + path opcional. **Conteúdo bruto proibido em V1.** Legal hold blindado. | Não |
| `safety_model_runs` | Governança de classificadores (input só como hash). | Não |
| `safety_webhook_deliveries` | View sobre `webhook_deliveries` filtrando `event_type LIKE 'safety.%'`. | View |

Reusa do Core: `webhook_deliveries`, `webhooks-worker`, `audit_events`, `crypto_keys`, `verification_sessions` (step-up).
Reusa do Consent: `parental_consent_requests` quando regra exige consent check.

## 3. Endpoints

| Endpoint | Auth | Função |
|---|---|---|
| `POST /v1/safety/event` | `X-AgeKey-API-Key` | Ingest principal — cria evento, atualiza aggregates, avalia regras. |
| `POST /v1/safety/rule-evaluate` | `X-AgeKey-API-Key` | Read-only pre-flight (decision sem persistir). |
| `POST /v1/safety/alert/:id/dispatch` | `X-AgeKey-API-Key` | Admin: ack/escalate/resolve/dismiss. |
| `POST /v1/safety/step-up` | `X-AgeKey-API-Key` | Cria `verification_session` no Core + linka ao alerta. |
| `POST /v1/safety/aggregates-refresh` | Bearer `CRON_SECRET` | Cron: recalcula aggregates. |
| `POST /v1/safety/retention-cleanup` | Bearer `CRON_SECRET` | Cron: apaga eventos expirados respeitando legal_hold. |

## 4. Regras sistêmicas (V1)

1. **`UNKNOWN_TO_MINOR_PRIVATE_MESSAGE`** — desconhecido → menor em DM. Severity high. Action: request_step_up + soft_block + notify_safety_team.
2. **`ADULT_MINOR_HIGH_FREQUENCY_24H`** — ≥20 mensagens adulto→menor em 24h. Severity high. Action: notify_safety_team + escalate_to_human_review + rate_limit_actor.
3. **`MEDIA_UPLOAD_TO_MINOR`** — upload de mídia para menor. Severity medium. Action: log_only + request_parental_consent_check.
4. **`EXTERNAL_LINK_TO_MINOR`** — link externo para menor. Severity medium. Action: log_only + soft_block.
5. **`MULTIPLE_REPORTS_AGAINST_ACTOR`** — ≥3 reports contra ator em 7d. Severity critical. Action: notify_safety_team + escalate_to_human_review + rate_limit_actor.

Detalhe e configuração em `docs/modules/safety-signals/rules.md`.

## 5. Privacy Guard

Todo ingest atravessa `assertPayloadSafe(body, 'safety_event_v1')` antes da validação Zod. Bloqueia em profundidade:

```
message, raw_text, message_body, image, video, audio (e _data),
birthdate, date_of_birth, dob, age, exact_age,
name, full_name, civil_name, cpf, rg, passport, document,
email, phone, selfie, face, biometric,
address, ip, gps, latitude, longitude
```

Permitidos: `policy_age_threshold`, `age_threshold`, `age_over_*`, `actor_age_band`, `counterparty_age_band`, `subject_age_state`, `age_band_min`, `age_band_max`.

## 6. Webhooks

Eventos:
- `safety.alert_created`
- `safety.alert_updated`
- `safety.step_up_required`
- `safety.parental_consent_check_required`

Trigger SQL `fan_out_safety_alert_webhooks` enfileira em `webhook_deliveries`. Worker entrega como qualquer outro evento (`webhooks-worker` é agnóstico).

Payload minimizado, com `decision` embarcando o Decision Envelope canônico.

## 7. Step-up + Consent integration

- Quando uma regra triggers `request_step_up`, o ingest cria automaticamente um `verification_session` no Core via `_shared/safety/step-up.ts` e linka em `safety_alerts.step_up_session_id`.
- Quando triggers `request_parental_consent_check` E `AGEKEY_PARENTAL_CONSENT_ENABLED=true`, cria um `parental_consent_request` via `_shared/safety/consent-check.ts` e linka em `safety_alerts.parental_consent_request_id`.

Tenants recebem webhook correspondente e podem encaminhar o usuário ao fluxo apropriado.

## 8. Retention

Default `event_90d` para `safety_events`. Cron `safety-retention-cleanup` apaga em batches respeitando:

- `legal_hold = true` → **nunca apaga** (audit event `RETENTION_LEGAL_HOLD_ACTIVE`).
- Trigger `safety_events_no_mutation` exige GUC `agekey.retention_cleanup = 'on'` para autorizar DELETE.

## 9. Não-objetivos

- ❌ Não interceptar tráfego, não capturar TLS.
- ❌ Não monitorar dispositivo fora da aplicação cliente.
- ❌ Não usar LLM externo para conteúdo de menor.
- ❌ Não criar reconhecimento facial / emotion recognition.
- ❌ Não emitir score universal cross-tenant.
- ❌ Não declarar crime comprovado.
- ❌ V1 não armazena conteúdo bruto.

## 10. Feature flag

`AGEKEY_SAFETY_SIGNALS_ENABLED=false` por padrão. Ativar em produção exige planejamento de retenção, integração de webhook, treinamento da equipe de operações.
