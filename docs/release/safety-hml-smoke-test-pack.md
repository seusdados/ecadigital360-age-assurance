# Safety Signals — HML Smoke Test Pack

> **Escopo:** HML apenas. Não rodar contra PROD.
> Todos os exemplos usam **placeholders** — substituir pelos secrets HML do operador no momento de execução. **Nunca** comitar valores reais neste arquivo.

## 0. Pré-requisitos

- Ambiente HML do AgeKey provisionado.
- `AGEKEY_SAFETY_SIGNALS_ENABLED=true` no projeto HML.
- Um tenant HML com:
  - Policy ativa e `policy_versions.version = policies.current_version` válido.
  - (Para Consent check) `consent_text_versions.is_active = true` correspondente.
- API key HML do tenant (`<TENANT_API_KEY>` placeholder — **nunca** colocar valor real).
- Cron secret HML (`<CRON_SECRET>` placeholder).
- Edge function URL base: `<HML_FUNCTIONS_URL>` (ex.: `https://<project>.functions.supabase.co`).

> Convenção de placeholders neste documento:
> - `<HML_FUNCTIONS_URL>` — base URL das edge functions HML
> - `<TENANT_API_KEY>` — API key do tenant HML (não colar real)
> - `<CRON_SECRET>` — cron secret HML (não colar real)
> - `<ACTOR_HMAC>` / `<MINOR_HMAC>` / `<COUNTERPARTY_HMAC>` — `subject_ref_hmac` HMAC opacos (não usar dados de pessoa real)
> - `<SAFETY_ALERT_ID>` — UUID retornado por um caso anterior

---

## Caso 1 — Privacy guard bloqueia conteúdo bruto

**Objetivo:** garantir que `safety-event-ingest` rejeita qualquer campo de conteúdo / PII antes de Zod.

```bash
curl -sS -X POST "<HML_FUNCTIONS_URL>/safety-event-ingest" \
  -H "Content-Type: application/json" \
  -H "X-AgeKey-API-Key: <TENANT_API_KEY>" \
  -d '{
    "event_type": "message_sent",
    "actor_subject_ref_hmac": "<ACTOR_HMAC>",
    "counterparty_subject_ref_hmac": "<MINOR_HMAC>",
    "actor_age_state": "adult",
    "counterparty_age_state": "minor",
    "metadata": { "message": "isto é conteúdo bruto e deve ser rejeitado" }
  }'
```

**Esperado:** HTTP 400 + body com `reason_code: PRIVACY_CONTENT_NOT_ALLOWED_IN_V1`.
**Log esperado:** `safety_event_blocked_by_privacy_guard`.

---

## Caso 2 — Ingest legítimo metadata-only

```bash
curl -sS -X POST "<HML_FUNCTIONS_URL>/safety-event-ingest" \
  -H "Content-Type: application/json" \
  -H "X-AgeKey-API-Key: <TENANT_API_KEY>" \
  -d '{
    "event_type": "message_sent",
    "actor_subject_ref_hmac": "<ACTOR_HMAC>",
    "counterparty_subject_ref_hmac": "<COUNTERPARTY_HMAC>",
    "actor_age_state": "adult",
    "counterparty_age_state": "adult",
    "metadata": { "channel": "dm" }
  }'
```

**Esperado:** HTTP 200, `decision` em `no_risk_signal` ou `logged`, `content_included=false`, `pii_included=false`.

---

## Caso 3 — Regra `UNKNOWN_TO_MINOR_PRIVATE_MESSAGE` dispara

```bash
curl -sS -X POST "<HML_FUNCTIONS_URL>/safety-event-ingest" \
  -H "Content-Type: application/json" \
  -H "X-AgeKey-API-Key: <TENANT_API_KEY>" \
  -d '{
    "event_type": "message_sent",
    "actor_subject_ref_hmac": "<ACTOR_HMAC>",
    "counterparty_subject_ref_hmac": "<MINOR_HMAC>",
    "actor_age_state": "unknown",
    "counterparty_age_state": "minor",
    "metadata": { "channel": "dm" }
  }'
```

**Esperado:** HTTP 200, `alert_id` não-nulo, `severity: high`, `decision` inclui `step_up_required` ou `needs_review` conforme override de tenant.

**Verificação adicional:** linha em `audit_events` com `action='safety.alert_created'` e `resource_id` = `alert_id` retornado.

---

## Caso 4 — Resiliência policy lookup

Pré-condição: usar um tenant HML **sem** policy ativa.

Repetir Caso 3 contra esse tenant.

**Esperado:**
- HTTP 200 (ingest não quebra).
- `alert_id` presente, `step_up_session_id: null`.
- Linha em `audit_events`:
  - `action='safety.step_up_skipped_no_policy'`
  - `diff_json` contém `reason_code: SAFETY_STEP_UP_NO_ACTIVE_POLICY`
  - Nenhum campo de PII em `diff_json`.

---

## Caso 5 — Admin acknowledge alerta

Pré-condição: ter `<SAFETY_ALERT_ID>` de um caso anterior.

```bash
curl -sS -X POST "<HML_FUNCTIONS_URL>/safety-alert-dispatch/<SAFETY_ALERT_ID>" \
  -H "Content-Type: application/json" \
  -H "X-AgeKey-API-Key: <TENANT_API_KEY>" \
  -d '{ "action": "acknowledge" }'
```

**Esperado:** HTTP 200, body `{ "id": "<SAFETY_ALERT_ID>", "status": "acknowledged" }`.
**Audit esperado:** `action='safety.alert_acknowledged'`, `resource_id=<SAFETY_ALERT_ID>`, `diff_json` sem PII.

Repetir para `escalate`, `resolve`, `dismiss` em alertas separados — cada um produz a sua action correspondente.

---

## Caso 6 — Cross-tenant isolation

Pré-condição: ter dois tenants HML A e B, cada um com sua API key HML.

1. Disparar Caso 3 com API key de A → obter `<SAFETY_ALERT_ID_A>`.
2. Tentar dispatch:

```bash
curl -sS -X POST "<HML_FUNCTIONS_URL>/safety-alert-dispatch/<SAFETY_ALERT_ID_A>" \
  -H "Content-Type: application/json" \
  -H "X-AgeKey-API-Key: <TENANT_API_KEY_B>" \
  -d '{ "action": "acknowledge" }'
```

**Esperado:** HTTP 403 (`cross-tenant access denied`) **ou** 404.
**Nenhum audit** row deve ser criado para o tenant B com `resource_id=<SAFETY_ALERT_ID_A>`.

---

## Caso 7 — `safety-rule-evaluate` é read-only

```bash
curl -sS -X POST "<HML_FUNCTIONS_URL>/safety-rule-evaluate" \
  -H "Content-Type: application/json" \
  -H "X-AgeKey-API-Key: <TENANT_API_KEY>" \
  -d '{
    "event_type": "message_sent",
    "actor_age_state": "unknown",
    "counterparty_age_state": "minor",
    "metadata": { "channel": "dm" }
  }'
```

**Esperado:** HTTP 200, `decision` calculado, `alert_id` ausente (read-only).
**Negativo:** nenhuma linha nova em `safety_events`/`safety_alerts` resultante deste call.

---

## Caso 8 — Override per-tenant (rules-write)

```bash
# Criar override desabilitando UNKNOWN_TO_MINOR_PRIVATE_MESSAGE no tenant
curl -sS -X POST "<HML_FUNCTIONS_URL>/safety-rules-write" \
  -H "Content-Type: application/json" \
  -H "X-AgeKey-API-Key: <TENANT_API_KEY>" \
  -d '{
    "rule_code": "UNKNOWN_TO_MINOR_PRIVATE_MESSAGE",
    "enabled": false,
    "severity": "high",
    "actions": ["notify_safety_team"]
  }'
```

**Esperado:** HTTP 200, audit `safety.rule.created` ou `safety.rule.updated`.
Repetir Caso 3 — agora regra está desabilitada e não deve criar alert.

Lembrete: invariante severity↔action garante que mesmo com override "ruim" (sem human review), `enforceSeverityActionIvariant` reinjeta `notify_safety_team` no agregado.

---

## Caso 9 — Retention dry test (sem autorização extra, NÃO rodar)

> **Atenção:** este caso exige `<CRON_SECRET>` HML e tem efeito **destrutivo** (DELETE).
> Não rodar em smoke público sem autorização explícita do operador.
> Documentar separadamente em `safety-hml-runbook.md` quando executar.

Comportamento esperado em HML controlado:
- `Authorization: Bearer <CRON_SECRET>` obrigatório.
- Body: `{ "dry_run": true }` quando suportado, ou rodar a função com massa de testes preparada.
- Linhas com `legal_hold = true` **nunca** apagadas.
- Audit `safety.retention_cleanup` por execução; `safety.retention_cleanup.legal_hold_skip` por tenant impactado.
- GUC `agekey.retention_cleanup` em `off` após `finally`.

---

## Caso 10 — UI alerts (filtros + paginação)

Acessar `<HML_ADMIN_URL>/safety/alerts` autenticado com user vinculado ao tenant HML.

- [ ] Filtro por status (`open`, `acknowledged`, ...) reduz a lista corretamente.
- [ ] Filtro por severity reduz a lista.
- [ ] Filtro por `rule_code` (ex.: `UNKNOWN_TO_MINOR_PRIVATE_MESSAGE`) aceita apenas formato `[A-Z][A-Z0-9_]{2,63}`.
- [ ] Filtro `since` (ISO-8601) reduz a lista a alertas posteriores.
- [ ] `page_size` clampado em `MAX_PAGE_SIZE=200`.
- [ ] Link "Próxima →" desaparece quando não há mais resultados.
- [ ] Badge de tenant aparece no header da seção Safety.
- [ ] Nenhuma linha exibe conteúdo bruto ou PII (apenas IDs opacos, rule code, reason codes, datas).

---

## Encerramento

- Captar timestamps de cada caso (HML).
- Persistir audit row counts antes/depois.
- Anexar log de erros (se houver) ao relatório.
- Marcar a checklist `safety-hml-readiness-checklist.md` correspondente.

**Lembretes:**
- ❌ Não promover essas execuções para PROD.
- ❌ Não submeter PII real em campos `subject_ref_hmac` — usar HMAC sintético.
- ❌ Não substituir placeholders deste arquivo por valores reais e comitar — manter sempre `<...>`.
