# Safety Signals — HML Readiness Checklist

> **Escopo:** HML apenas. PROD está **fora de escopo**.
> Não promover esta checklist para PROD sem nova decisão de go/no-go documentada.
>
> Esta lista cobre o AgeKey Safety Signals v1 (MVP metadata-only).
> Itens críticos (**C**) bloqueiam validação HML.

## 0. Identificação

- Release ID HML: `<preencher>`
- HEAD SHA: `<preencher>`
- Branch: `claude/agekey-safety-signals-4jws1` (ou rebranch incremental)
- Janela HML: `<data/hora>` (não promover para PROD nesta janela)
- Responsável técnico: `<nome>`
- DPO/Compliance ciente: `<sim/não, com data>`

## 1. Invariantes não-negociáveis **C**

- [ ] V1 é **metadata-only** — nenhum endpoint armazena `message`, `raw_text`, `image`, `video`, `audio`, `selfie`, `face`, `biometric`, `birthdate`, `dob`, `cpf`, `rg`, `passport`, `email`, `phone`, `ip`, `gps`, `latitude`, `longitude`.
- [ ] Privacy Guard `safety_event_v1` rejeita os campos acima ANTES da validação Zod (`safety-event-ingest`).
- [ ] Privacy Guard `public_api_response` valida toda resposta pública dos 5 endpoints públicos do Safety.
- [ ] Nenhum import de provedor LLM (`@anthropic-ai/sdk`, `openai`, etc.) em `supabase/functions/safety-*` ou `_shared/safety/*`.
- [ ] Nenhuma captura de tráfego, TLS interception ou monitoramento de dispositivo.
- [ ] Nenhum cálculo cruza `tenant_id` em aggregates ou alerts.
- [ ] Nenhum reconhecimento facial ou emotion recognition no rule engine.

## 2. Edge Functions Safety **C**

Verificar em HML (não em PROD):

- [ ] `safety-event-ingest` 200 com payload metadata-only legítimo.
- [ ] `safety-event-ingest` 400 + `reason_code: PRIVACY_CONTENT_NOT_ALLOWED_IN_V1` com payload contendo `message`/`image`/PII.
- [ ] `safety-rule-evaluate` retorna decision read-only sem persistir (`alert_id` null).
- [ ] `safety-rules-write` cria override per-tenant; tenta editar regra global retorna 403.
- [ ] `safety-alert-dispatch` aceita ações válidas (`acknowledge|escalate|resolve|dismiss`) e emite audit row.
- [ ] `safety-step-up` cria `verification_session` no Core e linka o alerta.
- [ ] `safety-aggregates-refresh` 200 com `Authorization: Bearer ${CRON_SECRET_HML}` (não usar segredo de PROD).
- [ ] `safety-retention-cleanup` 200 em HML; respeita `legal_hold = true`; GUC `agekey.retention_cleanup` reseta para `off` no `finally`.

## 3. Regras V1 **C**

- [ ] `UNKNOWN_TO_MINOR_PRIVATE_MESSAGE` dispara com relationship `unknown_to_minor` + DM.
- [ ] `ADULT_MINOR_HIGH_FREQUENCY_24H` dispara após ≥20 mensagens adulto→menor em 24h.
- [ ] `MEDIA_UPLOAD_TO_MINOR` dispara em upload de mídia para counterparty menor (com `has_media: true`).
- [ ] `EXTERNAL_LINK_TO_MINOR` dispara com `has_external_link: true` em mensagem a menor.
- [ ] `MULTIPLE_REPORTS_AGAINST_ACTOR` dispara em ≥3 reports contra ator em 7d.
- [ ] Invariante severity↔action validado: regras `high`/`critical` sempre contêm `escalate_to_human_review` ou `notify_safety_team` (defesa em profundidade no override per-tenant).

## 4. Audit trail **C**

Espera-se row em `audit_events` para cada uma das ações abaixo após exercício em HML:

- [ ] `safety.alert_created` após ingest disparar regra.
- [ ] `safety.step_up_linked` quando `step_up_required` resolveu policy do tenant.
- [ ] `safety.step_up_skipped_no_policy` quando tenant não tem policy ativa (fallback resiliente).
- [ ] `safety.parental_consent_check_linked` quando `request_parental_consent_check` resolveu policy/CTV.
- [ ] `safety.parental_consent_skipped_no_policy` quando policy/CTV ausente.
- [ ] `safety.alert_acknowledged | safety.alert_escalated | safety.alert_resolved | safety.alert_dismissed` para cada admin action em `safety-alert-dispatch`.
- [ ] `safety.rule.created | updated | deleted` para cada operação em `safety-rules-write`.
- [ ] `safety.retention_cleanup.legal_hold_skip` quando há rows com `legal_hold = true` na janela.
- [ ] Nenhum audit row contém PII ou conteúdo bruto (verificar por amostragem `select diff_json from audit_events where action like 'safety.%' limit 50`).

## 5. Step-up + Consent integration

- [ ] `safety_alerts.step_up_session_id` linkado quando regra exige step-up E tenant tem policy ativa.
- [ ] `safety_alerts.parental_consent_request_id` linkado quando regra exige consent check, `AGEKEY_PARENTAL_CONSENT_ENABLED=true` e tenant tem policy/CTV ativa.
- [ ] Webhooks `safety.step_up_required` e `safety.parental_consent_check_required` entregues por `webhooks-worker` em HML (verificar `webhook_deliveries`).

## 6. Retention + Legal Hold **C**

- [ ] Cron `safety-retention-cleanup` em HML deleta apenas eventos com `legal_hold = false` E `created_at` fora da janela da `retention_class`.
- [ ] `legal_hold = true` **nunca** apaga (auditar via `RETENTION_LEGAL_HOLD_ACTIVE`).
- [ ] Trigger `safety_events_no_mutation` continua bloqueando DELETE quando GUC `agekey.retention_cleanup` não está `on`.
- [ ] GUC sempre reseta para `off` no `finally` (testar com batch que provoca erro forçado).

## 7. Admin UI (apps/admin/safety) — HML

- [ ] Layout exibe **badge do tenant** ativo (não exibe `tenant_id` UUID por completo).
- [ ] `safety/alerts`:
  - [ ] Filtros server-side: status, severity, rule_code, since.
  - [ ] Paginação offset (anterior/próximo).
  - [ ] `page_size` clampado em `MAX_PAGE_SIZE=200`.
  - [ ] Empty state explícito.
- [ ] `safety/alerts/[id]` mostra subject_ref_hmac (HMAC opaco) e nunca PII.
- [ ] `safety/rules`, `safety/subjects`, `safety/evidence`, `safety/retention` operam sob RLS do tenant.
- [ ] Nenhuma tela renderiza `message`, `raw_text`, `image`, `video`, `audio` ou PII.

## 8. Feature flags HML

- [ ] `AGEKEY_SAFETY_SIGNALS_ENABLED=true` em HML (só HML).
- [ ] `AGEKEY_SAFETY_DEFAULT_EVENT_RETENTION_CLASS` configurado (default seguro `event_90d`).
- [ ] `AGEKEY_SAFETY_RETENTION_CLEANUP_BATCH_SIZE` configurado.
- [ ] `AGEKEY_PARENTAL_CONSENT_ENABLED` alinhado com escopo Consent.
- [ ] **PROD**: flags continuam `false`. Confirmar que esta sessão **não** alterou flags remotas em PROD.

## 9. Cross-tenant isolation

- [ ] Cenário com dois tenants HML A e B: alerts/events/aggregates de A nunca visíveis para B (testar via API key de B contra alert de A → 403/404).
- [ ] `safety-rules-write` rejeita edição de regra cujo `tenant_id` ≠ principal.

## 10. Privacy & compliance

- [ ] Logs HML revisados (`get_logs`) — sem PII detectada.
- [ ] Privacy Guard ≥ 100 vetores no perfil `safety_event_v1` verde.
- [ ] DPO ciente do conjunto de webhooks emitidos.
- [ ] RIPD/PbD record do Safety registrado (referência: `docs/modules/safety-signals/README.md`).

## 11. Operacional

- [ ] Runbook HML do Safety (`safety-hml-runbook.md`) revisado.
- [ ] Smoke pack HML (`safety-hml-smoke-test-pack.md`) executado e arquivado.
- [ ] Critérios de rollback em HML definidos (desabilitar `AGEKEY_SAFETY_SIGNALS_ENABLED` derruba o módulo).

## 12. Fora de escopo nesta janela

- ❌ Não aplicar migrations.
- ❌ Não executar `db push`, `db reset`, `db pull`, `db repair`.
- ❌ Não promover para PROD.
- ❌ Não usar `SAFETY_CRON_SECRET` real em smoke público.
- ❌ Não armazenar ou processar conteúdo bruto.
- ❌ Não habilitar análise por LLM externo sobre conteúdo de menor.

## Encerramento

- [ ] Relatório de readiness assinado (técnico + DPO).
- [ ] Decisão registrada: **HML green** / **HML conditional** / **HML red**.
- [ ] Pendências para próxima rodada anotadas.
