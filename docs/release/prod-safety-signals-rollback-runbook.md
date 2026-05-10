# PROD Safety Signals — Rollback Runbook

**Branch:** `claude/safety-signals-operational-hardening`
**Base SHA:** `0cd4d8e`
**Data:** 2026-05-10
**Status:** **DOCUMENTAÇÃO. NÃO EXECUTAR.** Rollback hipotético para uma futura janela executiva. Nada nesta sessão modifica PROD.

---

## 1. Princípio do rollback Safety

Safety Signals foi desenhado com **reversibilidade barata**:

- A feature flag `AGEKEY_SAFETY_SIGNALS_ENABLED=false` desliga o módulo **instantaneamente**, sem precisar reverter migrations.
- As migrations 024–027 são **aditivas** (criam tabelas, enums, triggers, view, seed). Reverter é possível mas não é obrigatório para parar o vazamento.
- Edge Functions Safety podem ser desplugadas removendo a função do projeto Supabase ou setando a flag.
- `safety_events` é metadata-only — não há conteúdo bruto a remediar em caso de incidente de privacidade. Mas se houver suspeita de PII em `metadata_jsonb`, o registro é apagável (legal hold separado).

**Ordem de preferência:**

1. **Parar o sangue** — desligar a feature flag.
2. **Quarentenar** — opcionalmente, marcar `legal_hold = true` em events suspeitos para impedir cleanup automático.
3. **Investigar** — logs, audit_events, dashboards.
4. **Remediar** — apagar registros específicos via SQL controlado, ou aplicar legal_hold em massa.
5. **Reverter migrations** — apenas se absolutamente necessário e em janela separada.

## 2. Triggers que iniciam o rollback

Iniciar rollback **imediatamente** se:

- T1: Privacy guard rejeita request **válido** → false positive impedindo tenant.
- T2: `safety_events.metadata_jsonb` contém valor parecido com email/telefone/CPF (suspeita de PII vazada).
- T3: `total_legal_hold_skipped` cai inesperadamente (suspeita de legal hold sendo pulado pelo cleanup).
- T4: UI Safety crasha em tenant em produção e bloqueia outras funcionalidades.
- T5: Latência p99 de `safety-event-ingest` > 2s sustentado por > 5min.
- T6: Erro 5xx > 1% do tráfego Safety por > 5min.
- T7: Detecção de override de regra com `severity=critical + actions=['log_only']` (violação do invariant).
- T8: Migration falha mid-stream em PROD.
- T9: Decisão executiva de Eng/Compliance.

## 3. Procedimentos de rollback por nível

### Nível A — Soft rollback (1–5 min) — para T1, T4, T5, T6, T9

**Objetivo:** parar o módulo sem tocar dados nem schema.

```bash
# Setar feature flag em Supabase Edge Functions secrets (PROD).
# IMPORTANTE: comando exato depende do mecanismo aprovado de gestão de secrets.
# Esta sessão NÃO executa o comando.
#
# Pseudo-código:
supabase --project-ref <PROD_REF> secrets set AGEKEY_SAFETY_SIGNALS_ENABLED=false
```

**Efeito:**
- `safety-event-ingest` passa a retornar 403 `Safety Signals module disabled.`
- `safety-rule-evaluate` idem.
- `safety-step-up` idem.
- `safety-rules-write` idem.
- `safety-alert-dispatch` idem.
- `safety-aggregates-refresh` retorna `{"ok":true,"skipped":true,"reason":"safety_disabled"}`.
- `safety-retention-cleanup` retorna mesmo skip.

**Tempo de propagação:** segundos a 1 min (cold start de novas instâncias da Edge Function).

**Validação:**
```bash
curl -sS -X POST "${BASE_URL}/safety-event-ingest" \
  -H "X-AgeKey-API-Key: <key>" -H "Content-Type: application/json" --data '{}'
# Esperado: 403 com "Safety Signals module disabled."
```

### Nível B — Quarentena de evidência (5–15 min) — para T2, T3

**Objetivo:** impedir que o cleanup apague evidências enquanto investigação anda.

```sql
-- Aplicar legal_hold a eventos suspeitos antes do próximo cleanup.
-- Filtro depende da investigação. Exemplo: events com metadata contendo
-- pattern de email.

UPDATE safety_events
   SET legal_hold = true
 WHERE tenant_id = '<tenant suspeito>'
   AND occurred_at > '<timestamp>'::timestamptz
   AND metadata_jsonb::text ~ '[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}';
```

**IMPORTANTE:** validar com Eng de Banco antes; queries assim podem ter custo grande.

Em paralelo, capturar amostra para análise:

```sql
SELECT id, tenant_id, event_type, occurred_at,
       jsonb_pretty(metadata_jsonb) AS metadata_snapshot
  FROM safety_events
 WHERE id IN (...)
 LIMIT 100;
```

### Nível C — Stop cron (5 min) — para T3 e T8

**Objetivo:** impedir cron de Safety enquanto investigação roda.

```sql
-- Pausar agendamentos Safety.
UPDATE cron.job SET active = false
 WHERE jobname IN ('agekey-safety-retention-cleanup', 'agekey-safety-aggregates-refresh');
```

Para retomar:
```sql
UPDATE cron.job SET active = true
 WHERE jobname IN ('agekey-safety-retention-cleanup', 'agekey-safety-aggregates-refresh');
```

### Nível D — Hard rollback de migrations (60+ min) — apenas para T7, T8, ou contaminação grave de schema

**Objetivo:** remover tabelas Safety de PROD.

> **Janela própria.** Não fazer no calor da incidente. Estabilizar com Nível A primeiro, investigar, decidir.

Sequência **destrutiva** (apaga dados; só aplicar com aprovação executiva):

```sql
-- Reverso da 027_safety_signals_seed_rules.sql:
DELETE FROM safety_rules WHERE tenant_id IS NULL;

-- Reverso da 026_safety_signals_webhooks.sql:
DROP TRIGGER IF EXISTS fan_out_safety_alert_webhooks ON safety_alerts;
DROP TRIGGER IF EXISTS fan_out_safety_alert_status_change ON safety_alerts;
-- (verificar nomes exatos das funções para drop)

-- Reverso da 025_safety_signals_rls.sql:
-- Desabilitar RLS antes do drop.
ALTER TABLE safety_evidence_artifacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_alerts            DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_events            DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_interactions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_aggregates        DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_subjects          DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_rules             DISABLE ROW LEVEL SECURITY;

-- Reverso da 024_safety_signals_core.sql:
DROP VIEW  IF EXISTS safety_webhook_deliveries;
DROP TABLE IF EXISTS safety_evidence_artifacts CASCADE;
DROP TABLE IF EXISTS safety_alerts             CASCADE;
DROP TABLE IF EXISTS safety_events             CASCADE;
DROP TABLE IF EXISTS safety_interactions       CASCADE;
DROP TABLE IF EXISTS safety_aggregates         CASCADE;
DROP TABLE IF EXISTS safety_rules              CASCADE;
DROP TABLE IF EXISTS safety_subjects           CASCADE;
-- DROP TYPE dos enums Safety (verificar nomes na migration 024).

-- Marcar migrations como revertidas no schema_migrations.
DELETE FROM supabase_migrations.schema_migrations WHERE version IN ('024','025','026','027');
```

**ATENÇÃO:** se houver `030_safety_cron_schedule.sql` aplicada, reverter primeiro:
```sql
SELECT cron.unschedule('agekey-safety-retention-cleanup');
SELECT cron.unschedule('agekey-safety-aggregates-refresh');
DELETE FROM supabase_migrations.schema_migrations WHERE version = '030';
```

### Nível E — Restore via PITR — apenas para corrupção generalizada

Se Nível B/C/D não bastam (corrupção massiva), invocar Supabase Point-In-Time Recovery para um snapshot **anterior** ao Gate 1 do runbook. Esta operação:

- É lenta (minutos a horas).
- Reverte **tudo** do banco, incluindo dados de Core e Consent.
- Requer aprovação executiva separada.
- **Não é parte do procedimento Safety**; é fallback de catástrofe.

## 4. Validação pós-rollback

Após qualquer nível:

- [ ] Smoke negativo Safety contra PROD: deve devolver 403 (Soft) ou 404 (Hard).
- [ ] UI `/safety` no admin de tenant: deve mostrar 0 events / 0 alerts (Soft) ou erro de tabela ausente (Hard).
- [ ] `audit_events` recente:
  ```sql
  SELECT action, created_at FROM audit_events
   WHERE created_at > now() - interval '1 hour'
   ORDER BY created_at DESC;
  ```
- [ ] Comunicação aos tenants (se Soft → "Safety temporariamente desabilitado para manutenção"; se Hard → coordenar com Produto).

## 5. Pós-mortem

- [ ] Documentar trigger e tempo até resolução.
- [ ] Capturar screenshots do dashboard.
- [ ] Salvar logs do Supabase Edge Functions (≥ 30 dias).
- [ ] Anotar mudanças necessárias para prevenir recorrência (entradas para `prod-safety-signals-release-decision-memo.md`).
- [ ] Auditar `audit_events` da janela.
- [ ] Atualizar `safety-signals-next-session-final-report.md` com o evento.

## 6. Comandos proibidos durante rollback

- ❌ `db reset`, `db pull`, `db push` em PROD.
- ❌ Force-push para `main`.
- ❌ Skip hooks (`--no-verify`).
- ❌ Editar feature flag PROD diretamente no Studio sem registro no checklist.
- ❌ Compartilhar `SAFETY_CRON_SECRET` em chat ou ticket.
- ❌ Fazer rollback de migrations sem aprovação executiva (apenas Soft é autorizado em emergência).

## 7. Quem aprova cada nível

| Nível | Quem aprova |
| --- | --- |
| A — Soft (flag) | Eng on-call (instantâneo); informar Release Manager em ≤ 5min |
| B — Quarentena | Eng on-call + Eng Lead |
| C — Stop cron | Eng on-call + Ops |
| D — Hard rollback | Release Manager + Eng Lead + Compliance + Ops (4 sign-offs) |
| E — PITR | CEO/CTO + Release Manager + Ops (decisão de catástrofe) |

## 8. Esta sessão

Confirmação final: **nenhum comando deste runbook foi executado nesta sessão.** Documento é informativo.
