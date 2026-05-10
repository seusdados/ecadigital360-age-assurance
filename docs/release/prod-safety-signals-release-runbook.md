# PROD Safety Signals — Release Runbook

**Branch:** `claude/safety-signals-operational-hardening`
**Base SHA:** `0cd4d8e`
**Data:** 2026-05-10
**Status:** **DOCUMENTAÇÃO. NÃO EXECUTAR.** Este runbook descreve o procedimento operacional para uma futura janela executiva de Safety em PROD. Não é autorização e não substitui a decisão executiva.

---

## 1. Pré-requisitos absolutos

- [ ] Consent MVP **já está em PROD** e operando (smoke verde).
- [ ] Decisão executiva documentada e assinada (Eng + Produto + Legal + Ops).
- [ ] Janela de manutenção **dedicada a Safety**, não compartilhada com Consent.
- [ ] Backup PROD verificado (Supabase PITR ativo, último backup < 24h).
- [ ] Itens B1–B13 do `prod-safety-signals-release-decision-memo.md` resolvidos.
- [ ] Pré-flight readiness Safety PROD assinado.
- [ ] Rollback playbook (`prod-safety-signals-rollback-runbook.md`) revisado pelo executor.
- [ ] On-call notificado e disponível pela duração da janela + 48h.
- [ ] Comunicação para tenants enviada (se aplicável).

## 2. Pessoal

| Papel | Responsabilidade na janela |
| --- | --- |
| Release Manager | Conduz a sequência, declara GO/NO-GO em cada gate |
| Engenheiro de Plataforma | Aplica migrations, deploya Edge Functions |
| Operador de Banco | Verifica saúde do banco em cada gate, executa rollback se preciso |
| Engenheiro de Smoke | Roda `safety-smoke.sh` contra PROD |
| Compliance/Legal | Confirma textos, retention classes, proportionality |
| On-call | Monitora dashboards e alertas durante 48h |

## 3. Janela executiva — sequência

> **A cada gate, se não houver GO unânime, abortar e ir para `prod-safety-signals-rollback-runbook.md`.**

### Gate 0 — T-30min (preparação)

- [ ] Confirmar SHA da `main` que vai a PROD.
- [ ] Confirmar lista de migrations a aplicar (esperado: `024_safety_signals_core.sql`, `025_safety_signals_rls.sql`, `026_safety_signals_webhooks.sql`, `027_safety_signals_seed_rules.sql`, e a futura `030_safety_cron_schedule.sql` se aprovada).
- [ ] Confirmar que `AGEKEY_SAFETY_SIGNALS_ENABLED=false` está hoje em PROD (default seguro).
- [ ] Snapshot manual do banco:
  ```sql
  SELECT now() AS pre_safety_release_snapshot;
  ```
- [ ] Capturar contagens baseline:
  ```sql
  SELECT COUNT(*) FROM verification_sessions;        -- Core
  SELECT COUNT(*) FROM parental_consent_requests;    -- Consent
  -- safety_* não devem existir ainda
  ```

### Gate 1 — T-0 (aplicação de migrations)

- [ ] Validar que todas as migrations Safety estão presentes na `main` que vai a PROD.
- [ ] Aplicar migrations Safety em PROD via mecanismo aprovado (Supabase CLI com aprovação dupla, ou pgmigrate). **Esta sessão não documenta o mecanismo específico — depende da política operacional do time.**
- [ ] Validar idempotência:
  ```sql
  SELECT * FROM supabase_migrations.schema_migrations
   WHERE version IN ('024','025','026','027');
  ```
- [ ] Validar tabelas:
  ```sql
  SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name LIKE 'safety_%'
   ORDER BY table_name;
  -- Esperado: safety_aggregates, safety_alerts, safety_evidence_artifacts,
  -- safety_events, safety_interactions, safety_rules, safety_subjects,
  -- safety_webhook_deliveries (view)
  ```
- [ ] Validar RLS:
  ```sql
  SELECT schemaname, tablename, rowsecurity FROM pg_tables
   WHERE schemaname = 'public' AND tablename LIKE 'safety_%';
  -- Todas devem ter rowsecurity = true (exceto a view).
  ```
- [ ] Validar seed:
  ```sql
  SELECT rule_code, enabled, severity FROM safety_rules WHERE tenant_id IS NULL;
  -- Esperado: 5 linhas (UNKNOWN_TO_MINOR_PRIVATE_MESSAGE, ADULT_MINOR_HIGH_FREQUENCY_24H,
  -- MEDIA_UPLOAD_TO_MINOR, EXTERNAL_LINK_TO_MINOR, MULTIPLE_REPORTS_AGAINST_ACTOR)
  ```

**GO/NO-GO** — se qualquer item acima falhar, ir para rollback.

### Gate 2 — T+10min (deploy de Edge Functions)

> Pré-requisito: existe um workflow PROD aprovado e auditado. **Esta sessão não cria esse workflow.** O workflow `deploy-hml-edge-functions.yml` é hardcoded HML; PROD precisa de workflow espelho **com proteção dupla**.

- [ ] Deployar 7 Edge Functions Safety:
  - `safety-event-ingest`
  - `safety-rule-evaluate`
  - `safety-rules-write`
  - `safety-alert-dispatch`
  - `safety-step-up`
  - `safety-aggregates-refresh`
  - `safety-retention-cleanup`
- [ ] **NÃO habilitar a feature flag ainda.**
- [ ] Validar deploy:
  ```bash
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -X POST "${BASE_URL}/safety-event-ingest" \
    -H "Content-Type: application/json" --data '{}'
  # Esperado: 401 ou 403 (rejeita por falta de credencial), não 404.
  ```

**GO/NO-GO** — se as functions não respondem ou se 404, abortar e investigar.

### Gate 3 — T+20min (configuração de secrets e cron)

- [ ] Confirmar `SAFETY_CRON_SECRET` em Supabase Edge Functions secrets PROD (gerado novo, não reuso de HML).
- [ ] Validar `cron_secret()` é lido pelas Edge Functions cron.
- [ ] Aplicar `030_safety_cron_schedule.sql` (se aprovada e revisada).
- [ ] Validar schedule:
  ```sql
  SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'agekey-safety-%';
  ```
- [ ] **NÃO disparar manualmente ainda.**

### Gate 4 — T+30min (habilitação da feature flag)

- [ ] Eng + Legal confirmam GO.
- [ ] Setar `AGEKEY_SAFETY_SIGNALS_ENABLED=true` em PROD via Supabase secrets.
- [ ] Setar `AGEKEY_PARENTAL_CONSENT_ENABLED=true` (se ainda não estava) — Safety integra com Consent.
- [ ] Validar via /safety/settings que UI reflete o novo estado (mas page é texto fixo — confirmar via env do tenant admin).
- [ ] Validar via Edge Function que flag está lida:
  ```bash
  # Sem credencial → resposta deve mencionar "module disabled" se flag=false,
  # ou erro de auth se flag=true (queremos auth).
  curl -sS -X POST "${BASE_URL}/safety-event-ingest" -H "Content-Type: application/json" --data '{}' | head -c 500
  ```

### Gate 5 — T+40min (smoke positivo)

- [ ] Rodar `scripts/smoke/safety-smoke.sh` contra PROD com:
  - `BASE_URL=<PROD>`
  - `TENANT_API_KEY=<key de tenant de teste em PROD>` (não tenant real)
  - `ACTOR_REF_HMAC=<HMAC opaco>`
  - **NÃO setar `SAFETY_ALERT_ID`** (vamos gerar via ingest)
  - **NÃO setar `SAFETY_CRON_SECRET`** (cron será disparado pelo schedule, não manualmente)
- [ ] Resultado esperado:
  - POS-1, POS-2, POS-3: PASS (HTTP 2xx, envelope minimizado).
  - POS-4, POS-5: SKIP (sem alert id).
  - POS-6, POS-7: SKIP (sem cron secret).
  - NEG-*: PASS (todos retornam 400).
  - Exit 0.
- [ ] Se POS-1 criou um alert (porque a regra disparou), capturar o `alert_id` da resposta para Gate 6.

### Gate 6 — T+55min (smoke admin com alert real)

- [ ] Re-rodar smoke com `SAFETY_ALERT_ID=<uuid capturado>`.
- [ ] POS-4 e POS-5 devem PASS.

### Gate 7 — T+70min (validação UI)

- [ ] Acessar `/safety` no admin de tenant de teste.
- [ ] Validar:
  - 4 KPIs aparecem com counts > 0 (events ≥ 1, alerts ≥ 1).
  - `/safety/events` lista o evento criado.
  - `/safety/alerts` lista o alert.
  - `/safety/alerts/[id]` mostra subject HMAC encurtado, severity, reason_codes.
  - `/safety/rules` lista 5 regras globais + 1 override (criado pelo POS-3).
  - `/safety/retention` mostra event_90d com count > 0.
- [ ] Confirmar visualmente que **nenhum** dado pessoal aparece — apenas HMACs e códigos.

### Gate 8 — T+90min (esperar próximo cron schedule)

> Esta é a primeira vez que o cron Safety roda em PROD. Acompanhar.

- [ ] Aguardar próximo `safety-aggregates-refresh` (configurado no schedule).
- [ ] Validar via `audit_events`:
  ```sql
  SELECT action, created_at FROM audit_events
   WHERE action LIKE 'safety.%' ORDER BY created_at DESC LIMIT 20;
  ```
- [ ] Validar via logs do Supabase Edge Functions que o cron executou OK.

### Gate 9 — T+24h e T+48h (vigília operacional)

- [ ] Validar que `safety-retention-cleanup` rodou (uma vez/dia esperado).
- [ ] Validar que `total_legal_hold_skipped` em PROD é coerente com expectativa.
- [ ] Validar que NÃO houve `safety_event_blocked_by_privacy_guard` em PROD (se houver, o tenant está mandando dado errado — engajar).
- [ ] Validar latência das functions (esperado p99 < 500ms para ingest).
- [ ] Validar contagens de events/alerts crescendo conforme tráfego do tenant.

## 4. Critérios para declarar SUCESSO da release

- [ ] Smoke positivo + admin + cron passou.
- [ ] UI navega sem expor PII.
- [ ] `audit_events` recebe registros de cron e admin.
- [ ] Nenhum incidente em 48h.
- [ ] Latência dentro de SLO.
- [ ] Comunicação aos tenants (se aplicável) confirmando disponibilidade.

## 5. Critérios para abortar e ir para rollback

- Migration falha em PROD.
- Edge Function não responde 2xx em smoke positivo.
- Privacy Guard rejeita requisição válida (false positive).
- UI Safety quebra (crash em tenant existente).
- Aumento anômalo de erros 5xx.
- Detecção de PII vazando para `safety_events.metadata_jsonb`.
- Detecção de contagem inesperada em `total_legal_hold_skipped`.
- Detecção de cleanup apagando linha com `legal_hold = true`.

Em qualquer um dos casos: ir para `prod-safety-signals-rollback-runbook.md` imediatamente.

## 6. Comandos proibidos durante a janela

- ❌ `db reset`, `db pull`, `db push` em PROD.
- ❌ `migration repair` sem aprovação prévia.
- ❌ `--no-verify` em git push.
- ❌ Force-push para `main`.
- ❌ Editar feature flag PROD diretamente no Studio (deve passar por checklist).
- ❌ Compartilhar `SAFETY_CRON_SECRET` em chat ou ticket.

## 7. Pós-release — limpeza e arquivamento

- [ ] Documentar SHA exato deployado em PROD em `docs/release/`.
- [ ] Atualizar `docs/audit/safety-signals-next-session-final-report.md` com timestamp da release.
- [ ] Arquivar este runbook no diretório de releases passados.
- [ ] Disparar uma rodada de revisão dos itens B1–B13 que não estavam cobertos.
