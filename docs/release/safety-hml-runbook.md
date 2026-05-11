# Safety Signals — HML Operational Runbook

> **Escopo:** HML apenas. PROD está **fora de escopo** deste runbook.
> Cobre o AgeKey Safety Signals v1 (metadata-only).
> Companheiro de `safety-hml-readiness-checklist.md` e `safety-hml-smoke-test-pack.md`.

## 1. Princípios operacionais

1. **Safety v1 = metadata-only.** Nenhum conteúdo bruto, nenhuma PII no Safety. Privacy Guard `safety_event_v1` rejeita em profundidade no ingest.
2. **Sem LLM externo** sobre conteúdo de menor.
3. **Sem interceptação** de tráfego, TLS, dispositivo.
4. **Sem reconhecimento facial / emotion recognition.**
5. **Sem score universal cross-tenant** — aggregates por `(tenant_id, application_id, subject_id)`.
6. **Sem afirmação de crime comprovado** — outputs falam em "risco proporcional" e `decision: needs_review|step_up_required|...`.
7. **Append-only** — eventos só são apagados pelo cron `safety-retention-cleanup` respeitando `legal_hold`.

## 2. Endpoints (HML)

| Endpoint | Auth | Cron? |
|---|---|---|
| `POST /safety-event-ingest` | `X-AgeKey-API-Key` | não |
| `POST /safety-rule-evaluate` | `X-AgeKey-API-Key` | não |
| `POST /safety-rules-write` | `X-AgeKey-API-Key` | não |
| `POST /safety-alert-dispatch/:id` | `X-AgeKey-API-Key` (admin) | não |
| `POST /safety-step-up` | `X-AgeKey-API-Key` | não |
| `POST /safety-aggregates-refresh` | `Authorization: Bearer <CRON_SECRET>` | sim |
| `POST /safety-retention-cleanup` | `Authorization: Bearer <CRON_SECRET>` | sim (destrutivo) |

### Convenções de secrets para este runbook

- `<CRON_SECRET>` = `SAFETY_CRON_SECRET` HML. **Nunca** colar valor real neste arquivo. **Nunca** reusar segredo de PROD em HML.
- `<TENANT_API_KEY>` = API key HML do tenant em uso. Tratar como segredo.
- `<SAFETY_ALERT_ID>` = UUID de `safety_alerts.id`. Necessário para qualquer rota `safety-alert-dispatch/:id` ou `safety-step-up` que dependa de alerta existente.

> Operadores: confirme que segredos HML estão no cofre do operador (não em pasted text, não em chat). Se o operador não tem `<CRON_SECRET>` HML em mãos, **não** executar `safety-retention-cleanup`.

## 3. Feature flags (HML)

| Flag | Valor HML | Observação |
|---|---|---|
| `AGEKEY_SAFETY_SIGNALS_ENABLED` | `true` em HML | Mantém `false` em PROD. |
| `AGEKEY_SAFETY_DEFAULT_EVENT_RETENTION_CLASS` | `event_90d` (default seguro) | |
| `AGEKEY_SAFETY_RETENTION_CLEANUP_BATCH_SIZE` | `500` | Aumentar somente após observação em HML. |
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | conforme escopo Consent HML | Coordenar com o módulo Consent. |

Esta sessão **não** altera flags remotas em PROD.

## 4. Procedimentos operacionais HML

### 4.1 Verificar saúde do módulo

1. `GET <HML_FUNCTIONS_URL>/safety-event-ingest` deve responder 405 (method not allowed) sem leak de stack trace.
2. Smoke positivo: `POST` com payload legítimo metadata-only (ver `safety-hml-smoke-test-pack.md` Caso 2).
3. Smoke negativo: `POST` com `message: "..."` no metadata → esperar 400 + `PRIVACY_CONTENT_NOT_ALLOWED_IN_V1`.
4. Verificar `audit_events` (últimas 24h):
   ```sql
   select action, count(*) from audit_events
   where action like 'safety.%'
     and created_at > now() - interval '24 hours'
   group by action
   order by count(*) desc;
   ```

### 4.2 Disparar `safety-aggregates-refresh` (cron)

Operador autorizado executa em HML:

```bash
curl -sS -X POST "<HML_FUNCTIONS_URL>/safety-aggregates-refresh" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

**Esperado:** HTTP 200 com lista de janelas/contagens.
**Frequência:** o cron já está agendado em HML; execução manual só para troubleshooting.

### 4.3 Disparar `safety-retention-cleanup` (DESTRUTIVO)

> **Atenção:** apaga eventos de `safety_events` cuja `retention_class` indicou expiração.
> Só executar manualmente após autorização explícita.
> NÃO RODAR EM PROD nesta janela.

```bash
curl -sS -X POST "<HML_FUNCTIONS_URL>/safety-retention-cleanup" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

**Pré-condições:**
- Backup recente do HML (ou ciência explícita de que dados HML são descartáveis).
- Massa de teste preparada (eventos com `created_at` antigos suficientes para entrar na janela).
- Comunicar o operador antes.

**Pós-checagem:**
- `audit_events` com `action='safety.retention_cleanup'` deve mostrar `per_class` populado.
- Linhas com `legal_hold=true` permaneceram (auditar `safety.retention_cleanup.legal_hold_skip` por tenant).
- GUC: `select current_setting('agekey.retention_cleanup', true);` deve retornar `off` ou string vazia.

### 4.4 Operar um alerta (HML)

Pré-condição: ter `<SAFETY_ALERT_ID>` válido (criado por ingest que disparou regra).

```bash
# Acknowledge
curl -sS -X POST "<HML_FUNCTIONS_URL>/safety-alert-dispatch/<SAFETY_ALERT_ID>" \
  -H "Content-Type: application/json" \
  -H "X-AgeKey-API-Key: <TENANT_API_KEY>" \
  -d '{ "action": "acknowledge" }'
```

Valores válidos para `action`: `acknowledge | escalate | resolve | dismiss`.
Cada um produz a sua audit action correspondente:
`safety.alert_acknowledged | safety.alert_escalated | safety.alert_resolved | safety.alert_dismissed`.

### 4.5 Forçar step-up explícito

Pré-condição: ter `<SAFETY_ALERT_ID>` válido e tenant com policy ativa.

```bash
curl -sS -X POST "<HML_FUNCTIONS_URL>/safety-step-up" \
  -H "Content-Type: application/json" \
  -H "X-AgeKey-API-Key: <TENANT_API_KEY>" \
  -d '{ "alert_id": "<SAFETY_ALERT_ID>" }'
```

**Esperado:** cria `verification_session` no Core e linka `safety_alerts.step_up_session_id`.
**Se tenant não tem policy ativa**, ver §5.2.

## 5. Cenários de erro e diagnóstico

### 5.1 Ingest 400 + `PRIVACY_CONTENT_NOT_ALLOWED_IN_V1`

**Causa esperada:** payload trouxe `message`, `image`, `email`, `birthdate`, etc.
**Ação:** revisar SDK / cliente — campos de PII e conteúdo bruto **nunca** podem chegar ao Safety. Privacy Guard funcionando como projetado.

### 5.2 Alert criado com `step_up_session_id: null`

**Causa esperada:** tenant não tem policy ativa (ou versão correspondente). Ingest manteve o evento e o alert, mas registrou `safety.step_up_skipped_no_policy` em `audit_events`.

**Ação operacional:**
1. Auditar `audit_events` filtrando `action='safety.step_up_skipped_no_policy'`.
2. Verificar `policies` do tenant e versão ativa.
3. Quando policy/versão for criada (fluxo Core/Consent), próximos ingests funcionarão normalmente.

Análogo para `safety.parental_consent_skipped_no_policy` (falta `policy_versions` ou `consent_text_versions.is_active`).

### 5.3 GUC `agekey.retention_cleanup` ficou `on`

**Causa rara:** crash externo à `try/finally` do cron.
**Ação:** abrir sessão psql em HML e:
```sql
alter database <hml_db> reset agekey.retention_cleanup;
```
(ou setar para `off` na próxima execução do cron). Reportar incidente no log de ops HML.

### 5.4 Webhook `safety.alert_created` não entregue

**Diagnóstico:** ver `webhook_deliveries` filtrando por `event_type LIKE 'safety.%'` e o `tenant_id`. Worker `webhooks-worker` é agnóstico — falhas de entrega são retentadas conforme o módulo Webhooks.

## 6. Audit trail — referência

Ações Safety auditadas em HML:

| Ação | Origem | Resource |
|---|---|---|
| `safety.rule.created` / `updated` / `deleted` | `safety-rules-write` | `safety_rule` |
| `safety.alert_created` | `safety-event-ingest` | `safety_alert` |
| `safety.step_up_linked` | `safety-event-ingest` | `safety_alert` |
| `safety.step_up_skipped_no_policy` | `safety-event-ingest` | `safety_event` |
| `safety.parental_consent_check_linked` | `safety-event-ingest` | `safety_alert` |
| `safety.parental_consent_skipped_no_policy` | `safety-event-ingest` | `safety_event` |
| `safety.alert_acknowledged` / `_escalated` / `_resolved` / `_dismissed` | `safety-alert-dispatch` | `safety_alert` |
| `safety.retention_cleanup` | `safety-retention-cleanup` | (job-level) |
| `safety.retention_cleanup.legal_hold_skip` | `safety-retention-cleanup` | (tenant-level) |

`diff_json` é restringido a:
`application_id, alert_id, event_id, rule_code, reason_codes, severity, risk_category, step_up_session_id, parental_consent_request_id, payload_hash, note, reason_code`.

**Nunca:** PII, conteúdo bruto, IP, geolocalização.

## 7. Rollback HML

Para desabilitar o módulo Safety em HML:

1. Setar `AGEKEY_SAFETY_SIGNALS_ENABLED=false` no projeto HML.
2. Aguardar próxima invocação das edge functions (flag é lida a cada call).
3. Endpoints retornam 403 `Safety Signals module disabled` enquanto a flag estiver `false`.

Rollback **não** apaga dados existentes em `safety_*`. Mantém audit trail e aggregates.

## 8. Limites desta sessão

Esta sessão de hardening operacional **NÃO**:

- ❌ Toca em PROD (nenhuma chamada, nenhum deploy).
- ❌ Aplica migrations.
- ❌ Roda `db push`, `db reset`, `db pull`, `db repair`.
- ❌ Altera feature flags remotas.
- ❌ Usa secrets reais de PROD ou HML em arquivos versionados.
- ❌ Processa conteúdo bruto.
- ❌ Cria vigilância, interceptação, reconhecimento facial, emotion recognition ou score cross-tenant.

Qualquer execução que viole o acima exige nova decisão go/no-go e nova sessão dedicada.
