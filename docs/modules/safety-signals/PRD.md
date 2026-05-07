# PRD — AgeKey Safety Signals (MVP / Rodada 4)

## Problema

Plataformas que hospedam interações entre adultos e menores precisam:

1. **Detectar padrões de risco** sem capturar conteúdo bruto (regulatório
   e reputacionalmente caro).
2. **Tomar ação proporcional** (warn, rate limit, soft block, exigir
   re-verificação, exigir consentimento parental, escalar para revisão
   humana) sem virar moderador autônomo.
3. **Guardar evidência mínima** auditável sem virar evidência judicial
   completa, que exige cadeia de custódia e processos próprios.

## Solução

Uma camada de **sinais de risco metadata-only**, integrada ao Core do
AgeKey, ao DecisionEnvelope canônico, ao Privacy Guard e ao Policy
Engine. Cada evento carrega:

- tipo de evento (closed catalogue),
- canal (DM, grupo, post público, etc.),
- hashes opacos por-tenant para actor / counterparty / IP / device,
- estado etário coarse (`adult`, `minor`, `unknown`),
- timestamps,
- bounded metadata (sem chaves PII e sem chaves de conteúdo bruto).

O motor de regras avalia condições sobre esses campos e produz uma
decisão (`approved`, `needs_review`, `step_up_required`, `rate_limited`,
`soft_blocked`, `hard_blocked`, `parental_consent_required`,
`blocked_by_policy`).

## Decision flow

```
ingest body ── reject(raw_content|pii) ── Zod parse ── HMAC actor/counterparty/ip/device
                  │
                  └── upsert safety_subjects + safety_events (append-only, content_processed=false)
                          │
                          ├── load aggregates (24h/7d/30d, reports_against_actor, link_attempts, media_to_minor)
                          │
                          ├── evaluate(SYSTEM_RULES + tenant_rules) → decision/severity/actions
                          │
                          ├── if alert → INSERT safety_alerts (trigger fanout webhook)
                          ├── if step_up → POST /v1/safety/step-up (Core verification_session)
                          ├── if parental_consent_required → emit safety.parental_consent_check_required
                          │
                          └── return SafetyEventIngestResponse (no PII, no content)
```

## Escopo do MVP

- ✅ POST `/v1/safety/event-ingest` rejeita conteúdo bruto e PII.
- ✅ Migration completa com 8 tabelas, RLS, CHECK constraints e triggers.
- ✅ Engine de regras com 5 system rules (`SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE`,
   `SAFETY_ADULT_MINOR_HIGH_FREQUENCY_24H`, `SAFETY_MEDIA_UPLOAD_TO_MINOR`,
   `SAFETY_EXTERNAL_LINK_TO_MINOR`, `SAFETY_MULTIPLE_REPORTS_AGAINST_ACTOR`).
- ✅ Webhook fan-out via trigger SQL `fan_out_safety_alert_webhooks`.
- ✅ Edge functions: `safety-event-ingest`, `safety-rule-evaluate`,
   `safety-alert-dispatch`, `safety-step-up`, `safety-aggregates-refresh`,
   `safety-retention-cleanup`.
- ✅ Painel administrativo mínimo no admin Next.js (`/safety`).
- ✅ SDK helper server-side com guards para `beforeSendMessage` /
   `beforeUploadMedia`.
- ✅ Tests vitest + Deno cobrindo schema rejection, engine, projections.

## Fora do escopo

- ❌ Análise transitória de conteúdo (gated por
  `AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED=false`).
- ❌ Pipeline de mídia (gated por `AGEKEY_SAFETY_MEDIA_GUARD_ENABLED=false`).
- ❌ Evidence vault enterprise (gated).
- ❌ Governança de modelo (gated).
- ❌ Legal hold (gated).
- ❌ Particionamento mensal de `safety_events` (P3).
- ❌ Aggregates per-bucket completos com upsert (MVP usa `count(*)` ad-hoc).
- ❌ Recall de webhook delivery (P3).

## Restrições não-negociáveis

1. **Content_processed sempre `false`**, no schema, no Zod, no SQL.
2. **Sem score universal** entre tenants ou aplicações.
3. **Sem PII** em qualquer coluna, claim, log, webhook ou audit_diff.
4. **RLS em todas as tabelas multi-tenant**.
5. **Service-role só server-side**.
6. **Reason codes canônicos** — extensão via `packages/shared`.

## KPIs (pós-MVP)

- Taxa de eventos rejeitados por chave proibida (sinal de cliente
  enviando coisa indevida).
- Tempo médio entre INSERT em `safety_events` e webhook entregue.
- Razão entre `step_up_required` e `step_up_completed`.
- Taxa de revisão humana por categoria.
- Falsos positivos (alertas dismissed pelo operador).
