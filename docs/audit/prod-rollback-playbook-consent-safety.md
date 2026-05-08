# PROD — Rollback playbook (Consent / Safety / Retention)

> Documento companheiro de
> `docs/audit/prod-consent-safety-release-options.md` e
> `docs/audit/prod-release-go-no-go-checklist.md`.
> **Caminho primário de rollback: restore do snapshot Supabase
> pré-aplicação.** Os SQLs abaixo são caminhos secundários, para
> incidentes parciais quando snapshot não é viável (ex.: muitas horas
> após aplicação, com dados novos legítimos que não devem ser
> perdidos).
> Data: 2026-05-07.
> Projeto-alvo: PROD `tpdiccnmsnjtjwhardij`.
> **Nada é executado por este documento.**

## 0. Princípios de rollback

1. **Snapshot first.** Toda aplicação é precedida por snapshot ≤ 30
   min. Se rollback for necessário em ≤ 24 h e não há volume de dados
   novos legítimos, **restaurar snapshot é o caminho preferido**.
2. **SQL rollback é caminho secundário.** Idempotente, escrito para
   funcionar mesmo após reaplicação parcial.
3. **Migrations 020–030 são não-destrutivas em aplicação.** Rollback,
   por outro lado, **é destrutivo** (drop de tabelas/triggers/funções
   recém criadas). Usar com cautela.
4. **Triggers append-only não devem ser revertidos sem motivo.** Se
   houver dados em `parental_consents`, `parental_consent_revocations`,
   `safety_events` ou `safety_evidence_artifacts` com `legal_hold`,
   **não dropar** essas tabelas sem autorização legal/produto.
5. **Nunca**: `truncate` em produção, `drop schema cascade`, ou
   `db reset`.

## 1. Snapshot restoration (caminho primário, qualquer opção)

### 1.1. Pré-condições

- Snapshot Supabase capturado antes da aplicação. ID conhecido.
- Janela autorizada (idealmente, mesma janela de aplicação).
- Decisão de rollback registrada por humano com timestamp UTC.

### 1.2. Procedimento (Supabase Dashboard, planejado)

```text
1. Acessar https://supabase.com/dashboard/project/tpdiccnmsnjtjwhardij/database/backups
2. Selecionar snapshot pré-aplicação (timestamp ≤ início da janela).
3. Clicar "Restore".
4. Confirmar projeto-alvo: tpdiccnmsnjtjwhardij.
5. Aguardar conclusão (5-30 min, dependendo do tamanho).
```

### 1.3. Pós-restore

- Verificar `select max(version) from supabase_migrations.
  schema_migrations;` — esperado: a versão antes da janela (ex: 017
  se rollback de C; 023 se rollback de D; 027 se rollback de E).
- Verificar contagem de tabelas-chave (ver §6).
- Smoke tests funcionais (mesmos do §3.7 / §5.7 / §6.7 / §7.7 do
  release-options doc).
- Avisar stakeholders.
- **Importante**: dados gravados entre snapshot e rollback são
  perdidos. Documentar no execution report.

### 1.4. Quando snapshot restore **não** é apropriado

- Aplicação foi há > 24 h **e** dados legítimos novos foram
  gravados que devem ser preservados (ex: tenant piloto começou a
  usar Consent/Safety entre snapshot e rollback).
- Apenas uma migration específica precisa ser revertida e o resto
  permanece válido.
- Snapshot está corrompido ou indisponível.

Nesses casos: usar rollback SQL específico, §§2–5 abaixo.

---

## 2. Rollback SQL — Fase 2 (Consent: 020–023)

> Inverte as 4 migrations Consent. Após executar, `schema_migrations`
> volta para 017 como cabeça.

### 2.1. Ordem (inversa à aplicação)

```
023_parental_consent_webhooks  →  drop triggers + functions
022_parental_consent_rls        →  drop policies + triggers + functions
021_parental_consent_guardian   →  drop functions Vault + 2 tabelas
020_parental_consent_core       →  drop 5 tabelas + enums
```

### 2.2. SQL rollback de 023 (webhooks)

```sql
-- Drop triggers fan-out criados em 023
DROP TRIGGER IF EXISTS trg_parental_consents_fanout ON parental_consents;
DROP TRIGGER IF EXISTS trg_parental_consent_revocations_fanout
  ON parental_consent_revocations;

-- Drop functions de 023
DROP FUNCTION IF EXISTS fan_out_parental_consent_webhooks();
DROP FUNCTION IF EXISTS fan_out_parental_consent_revoke_webhooks();
DROP FUNCTION IF EXISTS build_parental_consent_event_payload(uuid, text);

-- Remover registro
DELETE FROM supabase_migrations.schema_migrations
WHERE name = '023_parental_consent_webhooks';
```

> **Atenção**: 029 também recria `build_parental_consent_event_payload`
> com `payload_hash` real. Se rollback de 023 for feito **após** 029
> aplicada, dropar a função aqui apaga a versão "boa". Nesse caso,
> **rollback de 029 PRIMEIRO**.

### 2.3. SQL rollback de 022 (RLS)

```sql
-- Drop triggers append-only
DROP TRIGGER IF EXISTS trg_parental_consents_no_mutation ON parental_consents;
DROP TRIGGER IF EXISTS trg_parental_consent_revocations_no_mutation
  ON parental_consent_revocations;
DROP FUNCTION IF EXISTS parental_consents_no_mutation();
DROP FUNCTION IF EXISTS parental_consent_revocations_no_mutation();

-- Drop policies (em todas as 7 tabelas)
DROP POLICY IF EXISTS ctv_select   ON consent_text_versions;
DROP POLICY IF EXISTS ctv_insert   ON consent_text_versions;
DROP POLICY IF EXISTS ctv_update   ON consent_text_versions;

DROP POLICY IF EXISTS pcr_select   ON parental_consent_requests;
DROP POLICY IF EXISTS pcr_insert   ON parental_consent_requests;
DROP POLICY IF EXISTS pcr_update   ON parental_consent_requests;

DROP POLICY IF EXISTS gc_select    ON guardian_contacts;
DROP POLICY IF EXISTS gc_insert    ON guardian_contacts;
DROP POLICY IF EXISTS gc_update    ON guardian_contacts;
DROP POLICY IF EXISTS gc_delete    ON guardian_contacts;

DROP POLICY IF EXISTS gv_select    ON guardian_verifications;
DROP POLICY IF EXISTS gv_insert    ON guardian_verifications;
DROP POLICY IF EXISTS gv_update    ON guardian_verifications;

DROP POLICY IF EXISTS pc_select    ON parental_consents;
DROP POLICY IF EXISTS pc_insert    ON parental_consents;
DROP POLICY IF EXISTS pc_update    ON parental_consents;
DROP POLICY IF EXISTS pc_delete    ON parental_consents;

DROP POLICY IF EXISTS pct_select   ON parental_consent_tokens;
DROP POLICY IF EXISTS pct_insert   ON parental_consent_tokens;
DROP POLICY IF EXISTS pct_update   ON parental_consent_tokens;

DROP POLICY IF EXISTS pcrev_select ON parental_consent_revocations;
DROP POLICY IF EXISTS pcrev_insert ON parental_consent_revocations;
DROP POLICY IF EXISTS pcrev_update ON parental_consent_revocations;
DROP POLICY IF EXISTS pcrev_delete ON parental_consent_revocations;

-- Disable RLS antes de dropar tabelas no 020/021
ALTER TABLE consent_text_versions          DISABLE ROW LEVEL SECURITY;
ALTER TABLE parental_consent_requests      DISABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_contacts              DISABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_verifications         DISABLE ROW LEVEL SECURITY;
ALTER TABLE parental_consents              DISABLE ROW LEVEL SECURITY;
ALTER TABLE parental_consent_tokens        DISABLE ROW LEVEL SECURITY;
ALTER TABLE parental_consent_revocations   DISABLE ROW LEVEL SECURITY;

-- Remover registro
DELETE FROM supabase_migrations.schema_migrations
WHERE name = '022_parental_consent_rls';
```

### 2.4. SQL rollback de 021 (guardian)

```sql
-- Drop RPCs Vault
DROP FUNCTION IF EXISTS guardian_contacts_store(uuid, uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS guardian_contacts_load(uuid, uuid);
DROP FUNCTION IF EXISTS guardian_contacts_purge_vault(uuid);

-- Drop tabelas (atenção: pode falhar se houver dados; ver §2.7)
DROP TABLE IF EXISTS guardian_verifications;
DROP TABLE IF EXISTS guardian_contacts;

-- Remover registro
DELETE FROM supabase_migrations.schema_migrations
WHERE name = '021_parental_consent_guardian';
```

### 2.5. SQL rollback de 020 (core)

```sql
DROP TABLE IF EXISTS parental_consent_revocations;
DROP TABLE IF EXISTS parental_consent_tokens;
DROP TABLE IF EXISTS parental_consents;
DROP TABLE IF EXISTS parental_consent_requests;
DROP TABLE IF EXISTS consent_text_versions;

-- Drop enums criados em 020 (verificar nomes exatos no .sql)
-- Ex: parental_consent_status, parental_consent_decision, etc.
DROP TYPE IF EXISTS parental_consent_status;
DROP TYPE IF EXISTS parental_consent_decision;
DROP TYPE IF EXISTS parental_consent_revocation_reason;

DELETE FROM supabase_migrations.schema_migrations
WHERE name = '020_parental_consent_core';
```

### 2.6. Verificação pós-rollback

```sql
-- Esperado: 0 linhas
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN (
  'consent_text_versions','parental_consent_requests','parental_consents',
  'parental_consent_tokens','parental_consent_revocations',
  'guardian_contacts','guardian_verifications'
);

-- Esperado: schema_migrations volta a 017 como max
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version >= '020' ORDER BY version;
-- (deve retornar 0 linhas após rollback de C completo)
```

### 2.7. Atenção — dados em produção

Se já houver linhas em `parental_consents`, `parental_consent_
revocations`, `parental_consent_requests`:

- **Pause** o rollback SQL.
- Confirmar com produto/legal se há retenção obrigatória dessas
  linhas (auditoria, regulatório).
- Se sim → **rollback bloqueado**. Seguir alternativas:
  1. Manter migrations aplicadas e desabilitar feature flag.
  2. Snapshot restore (perde dados, decisão consciente).
  3. Export dessas tabelas para um schema de quarentena antes do
     drop.

---

## 3. Rollback SQL — Fase 3 (Safety: 024–027)

### 3.1. Ordem (inversa)

```
027_safety_signals_seed_rules   →  delete 5 rows seed
026_safety_signals_webhooks      →  drop triggers + functions
025_safety_signals_rls           →  drop policies + triggers + functions
024_safety_signals_core          →  drop 8 tabelas + 1 view + enums
```

### 3.2. SQL rollback de 027 (seed)

```sql
DELETE FROM safety_rules
WHERE tenant_id IS NULL
  AND rule_code IN (
    'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
    'ADULT_MINOR_HIGH_FREQUENCY_24H',
    'MEDIA_UPLOAD_TO_MINOR',
    'EVIDENCE_LEGAL_HOLD_TRIGGER',
    'MODEL_CONFIDENCE_OVERRIDE'
  );

DELETE FROM supabase_migrations.schema_migrations
WHERE name = '027_safety_signals_seed_rules';
```

### 3.3. SQL rollback de 026 (webhooks)

```sql
DROP TRIGGER IF EXISTS trg_safety_alerts_fanout ON safety_alerts;
DROP TRIGGER IF EXISTS trg_safety_alerts_status_fanout ON safety_alerts;

DROP FUNCTION IF EXISTS fan_out_safety_alert_webhooks();
DROP FUNCTION IF EXISTS fan_out_safety_alert_status_change();
DROP FUNCTION IF EXISTS build_safety_alert_event_payload(uuid, text);

DELETE FROM supabase_migrations.schema_migrations
WHERE name = '026_safety_signals_webhooks';
```

### 3.4. SQL rollback de 025 (RLS)

```sql
-- Triggers append-only e legal_hold
DROP TRIGGER IF EXISTS trg_safety_events_no_mutation ON safety_events;
DROP TRIGGER IF EXISTS trg_sea_legal_hold ON safety_evidence_artifacts;
DROP FUNCTION IF EXISTS safety_events_no_mutation();
DROP FUNCTION IF EXISTS safety_evidence_no_legal_hold_mutation();

-- Policies (uma por tabela; cobrir as 8 + view se houver)
DROP POLICY IF EXISTS ssub_select   ON safety_subjects;
DROP POLICY IF EXISTS ssub_insert   ON safety_subjects;
DROP POLICY IF EXISTS ssub_update   ON safety_subjects;
DROP POLICY IF EXISTS ssub_delete   ON safety_subjects;

DROP POLICY IF EXISTS sint_select   ON safety_interactions;
DROP POLICY IF EXISTS sint_insert   ON safety_interactions;
DROP POLICY IF EXISTS sint_update   ON safety_interactions;

DROP POLICY IF EXISTS sevt_select   ON safety_events;
DROP POLICY IF EXISTS sevt_insert   ON safety_events;
DROP POLICY IF EXISTS sevt_update   ON safety_events;
DROP POLICY IF EXISTS sevt_delete   ON safety_events;

DROP POLICY IF EXISTS srul_select   ON safety_rules;
DROP POLICY IF EXISTS srul_insert   ON safety_rules;
DROP POLICY IF EXISTS srul_update   ON safety_rules;

DROP POLICY IF EXISTS sale_select   ON safety_alerts;
DROP POLICY IF EXISTS sale_insert   ON safety_alerts;
DROP POLICY IF EXISTS sale_update   ON safety_alerts;

DROP POLICY IF EXISTS sagg_select   ON safety_aggregates;
DROP POLICY IF EXISTS sagg_insert   ON safety_aggregates;
DROP POLICY IF EXISTS sagg_update   ON safety_aggregates;

DROP POLICY IF EXISTS sea_select    ON safety_evidence_artifacts;
DROP POLICY IF EXISTS sea_insert    ON safety_evidence_artifacts;
DROP POLICY IF EXISTS sea_update    ON safety_evidence_artifacts;
DROP POLICY IF EXISTS sea_delete    ON safety_evidence_artifacts;

DROP POLICY IF EXISTS smr_select    ON safety_model_runs;
DROP POLICY IF EXISTS smr_insert    ON safety_model_runs;

-- Disable RLS antes de drop em 024
ALTER TABLE safety_subjects             DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_interactions         DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_events               DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_rules                DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_alerts               DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_aggregates           DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_evidence_artifacts   DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_model_runs           DISABLE ROW LEVEL SECURITY;

DELETE FROM supabase_migrations.schema_migrations
WHERE name = '025_safety_signals_rls';
```

### 3.5. SQL rollback de 024 (core)

```sql
DROP VIEW IF EXISTS safety_webhook_deliveries;

DROP TABLE IF EXISTS safety_model_runs;
DROP TABLE IF EXISTS safety_evidence_artifacts;
DROP TABLE IF EXISTS safety_aggregates;
DROP TABLE IF EXISTS safety_alerts;
DROP TABLE IF EXISTS safety_rules;
DROP TABLE IF EXISTS safety_events;
DROP TABLE IF EXISTS safety_interactions;
DROP TABLE IF EXISTS safety_subjects;

-- Enums (verificar nomes exatos em 024)
DROP TYPE IF EXISTS safety_event_type;
DROP TYPE IF EXISTS safety_alert_status;
DROP TYPE IF EXISTS safety_severity;
DROP TYPE IF EXISTS safety_relationship;
DROP TYPE IF EXISTS safety_age_state;

DELETE FROM supabase_migrations.schema_migrations
WHERE name = '024_safety_signals_core';
```

### 3.6. Atenção — legal_hold

`safety_events.legal_hold = true` ou `safety_evidence_artifacts.
legal_hold = true` indicam **retention obrigatória por motivo legal**.
Antes de qualquer DROP TABLE:

```sql
SELECT count(*) FROM safety_events WHERE legal_hold = true;
SELECT count(*) FROM safety_evidence_artifacts WHERE legal_hold = true;
```

Se > 0:

- **PARAR rollback SQL.**
- Escalar para legal/produto.
- Considerar export para schema de quarentena antes do drop.

### 3.7. Verificação pós-rollback

```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'safety_%';
-- Esperado: 0

SELECT version FROM supabase_migrations.schema_migrations
WHERE version >= '024' ORDER BY version;
-- Esperado: 0 linhas após rollback completo de D
```

---

## 4. Rollback SQL — Fase 4: 030 (RLS partições)

### 4.1. SQL rollback de 030

```sql
-- Disable RLS em todas as partições audit_events_*
ALTER TABLE public.audit_events_2026_04 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_2026_05 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_2026_06 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_2026_07 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_2026_08 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_2026_09 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_2026_10 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_2026_11 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_2026_12 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_2027_01 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_2027_02 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_2027_03 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_default DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_events_2026_04 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events_2026_05 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events_2026_06 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events_2026_07 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events_2026_08 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events_2026_09 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events_2026_10 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events_2026_11 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events_2026_12 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events_2027_01 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events_2027_02 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events_2027_03 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events_default DISABLE ROW LEVEL SECURITY;

DELETE FROM supabase_migrations.schema_migrations
WHERE name = '030_enable_rls_audit_billing_partitions';
```

> **Cuidado**: desabilitar RLS em partições de auditoria/billing
> **abre vetor de leitura cross-tenant**. Geralmente, rollback de
> 030 NÃO é desejável. Considerar manter 030 mesmo em rollback de
> Consent/Safety — RLS habilitada é estado seguro.

---

## 5. Rollback SQL — Fase 4: 028 + 029 (cron + post-merge fixes)

### 5.1. SQL rollback de 028 (cron)

```sql
SELECT cron.unschedule('agekey-retention-job');

-- Limpar GUCs (opcional)
ALTER DATABASE postgres RESET agekey.retention_job_url;
ALTER DATABASE postgres RESET agekey.cron_secret;

DELETE FROM supabase_migrations.schema_migrations
WHERE name = '028_retention_cron_schedule';
```

### 5.2. SQL rollback de 029 (post-merge fixes)

```sql
DROP FUNCTION IF EXISTS set_current_tenant(uuid);
DROP FUNCTION IF EXISTS safety_recompute_messages_24h();

-- IMPORTANTE: 029 substituiu build_parental_consent_event_payload
-- com versão final (payload_hash real). Dropar aqui deixa Consent
-- webhooks SEM função.
--
-- Se você está rolando de volta 029 mas mantendo 023, RECRIE com
-- a versão de 023 (placeholder 'pending') antes de DROP, ou prefira
-- snapshot restore.
DROP FUNCTION IF EXISTS build_parental_consent_event_payload(uuid, text);

DELETE FROM supabase_migrations.schema_migrations
WHERE name = '029_post_merge_p0_fixes';
```

### 5.3. Verificação pós-rollback Fase 4

```sql
SELECT count(*) FROM cron.job WHERE jobname = 'agekey-retention-job';
-- Esperado: 0

SELECT proname FROM pg_proc
WHERE proname IN ('set_current_tenant',
                  'safety_recompute_messages_24h');
-- Esperado: 0 linhas

SELECT version FROM supabase_migrations.schema_migrations
WHERE version IN ('028','029','030') ORDER BY version;
-- Esperado: 0 linhas após rollback completo de E
```

---

## 6. Validações universais pós-rollback

Independente de qual opção foi revertida, validar:

### 6.1. Migrations alinhadas

```sql
SELECT version, name FROM supabase_migrations.schema_migrations
ORDER BY version;
-- Esperado: alinhado com expectativa de fase em que paramos.
```

### 6.2. Contagem de tabelas-chave (Core, intactas)

```sql
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN (
  'tenants','applications','policies','policy_versions','tenant_users',
  'crypto_keys','issuers','jurisdictions','verification_sessions',
  'verification_results','verification_challenges','webhook_endpoints',
  'webhook_deliveries','rate_limit_buckets','trust_lists',
  'consent_text_versions'  -- só presente se C ainda aplicada
);
```

Para cada tabela Core (000–017), `relrowsecurity = true`.

### 6.3. Smoke tests funcionais

Mesmos do release-options doc §3.7 / §5.7 / §6.7 / §7.7, ajustados
para fase corrente.

### 6.4. Advisors

```text
mcp__7a0f7dd2-...__get_advisors project_id=tpdiccnmsnjtjwhardij type=security
mcp__7a0f7dd2-...__get_advisors project_id=tpdiccnmsnjtjwhardij type=performance
```

Esperado: nenhum CRITICAL novo introduzido pelo rollback.

### 6.5. Logs

```text
mcp__7a0f7dd2-...__get_logs project_id=tpdiccnmsnjtjwhardij service=postgres
mcp__7a0f7dd2-...__get_logs project_id=tpdiccnmsnjtjwhardij service=edge-function
```

Esperado: sem erros 5xx novos das edge functions Consent/Safety
(curto-circuito por flag deve voltar a operar quando tabelas
desaparecem — porque o flag está OFF).

---

## 7. Matriz de decisão rollback

| Cenário | Caminho preferido |
|---|---|
| Aplicação ≤ 2 h, sem dados novos legítimos | **Snapshot restore** |
| Aplicação ≤ 24 h, sem dados novos legítimos | **Snapshot restore** |
| Aplicação > 24 h, sem dados novos legítimos | Snapshot restore se backups daily disponíveis; senão SQL |
| Aplicação ≤ 24 h, com dados novos em uso | SQL rollback **APENAS** se confirmado por legal/produto que dados podem ser dropados; senão **manter migrations + desligar flag** |
| Falha durante aplicação (timeout no meio de 022, etc) | SQL rollback da migration parcial + retry após investigação |
| Incidente em runtime (5xx das Edge Functions Consent/Safety) | **Primeiro: desligar flag.** Se persistir após flag OFF, snapshot restore. |
| `legal_hold = true` em dados | **Rollback SQL bloqueado.** Manter migrations + desligar flag + escalar legal. |

---

## 8. Pendências e armadilhas

- **Função `build_parental_consent_event_payload` é tocada por 023
  E 029**. Ordem importa: rollback de 029 antes de 023 (se ambas
  aplicadas) para evitar deixar trigger de 023 chamando função
  inexistente.
- **Triggers de fan-out** consultam `webhook_endpoints` e fazem
  `INSERT INTO webhook_deliveries`. Drop dessas funções não afeta
  Core, mas durante a janela de drop, eventos de Consent/Safety são
  perdidos (esperado).
- **Indexes** são dropados automaticamente com `DROP TABLE`. Não é
  preciso dropar separadamente.
- **`schema_migrations`** rollback usa `DELETE` puro. Comparar
  contagem antes/depois para sanidade.
- **`extensions.vault`** não deve ser dropada por rollback — outros
  módulos podem usá-la.
- **`pg_cron`** e **`pg_net`** não devem ser dropadas — são
  extensions do projeto Supabase.

---

## 9. Anexos cruzados

- `docs/audit/prod-consent-safety-release-options.md` — opções e
  smoke tests.
- `docs/audit/prod-release-go-no-go-checklist.md` — gates por opção.
- `docs/audit/prod-feature-flags-readiness.md` — flags + GUCs.
- `docs/audit/hml-migration-history-reconciliation-execution-report.md`
  — referência de rollback bookkeeping (caso seja necessário).
- Arquivos `supabase/migrations/020_*.sql` … `030_*.sql` — fonte da
  verdade do DDL aplicado.
