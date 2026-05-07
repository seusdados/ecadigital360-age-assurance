# PROD — Opções de release para Fases 2/3/4 (Consent / Safety / Retention)

> Branch: `claude/prod-readiness-consent-safety-plan`.
> PR: PR C (draft).
> Projeto-alvo: PROD `tpdiccnmsnjtjwhardij`.
> Data: 2026-05-07.
> Tipo: **planejamento somente**. Nada é executado por este documento.

## 0. Princípios

1. **Nenhum** `supabase db push`, `supabase migration repair`, `db reset` ou
   `db pull` é realizado a partir deste documento.
2. **Nenhuma** migration destrutiva. Toda DDL adicionada é `CREATE` /
   `ALTER ... ENABLE`/append-only. As migrations 020–030 já foram revisadas
   nas Rodadas R3/R4/P0 e provadas idempotentes em HML.
3. Toda execução em PROD exige autorização humana explícita por opção.
4. Toda opção pressupõe **snapshot Supabase recente (≤ 24 h)** antes de
   aplicar.
5. Toda opção pressupõe **HML 100% verde** (typecheck + tests + smoke
   tests funcionais) na **mesma SHA** que será aplicada em PROD.
6. Feature flags ficam **OFF** em PROD enquanto a tenant não tiver
   liberado o módulo no contrato. As migrations não dependem de flag
   estarem ON para serem aplicadas — flags controlam apenas o caminho de
   ingest/decision/painel.

## 1. Estado atual de PROD (linha de base)

> Fonte: `docs/audit/prod-schema-gap-diagnostic-report.md` (PR sibling) +
> `docs/audit/prod-migration-application-plan.md` +
> `docs/audit/prod-phase-1-migration-017-execution-report.md` (PR sibling)
> + `docs/audit/hml-migration-history-reconciliation-execution-report.md`.

- Migrations aplicadas em PROD: **000–016 + 017** (Fase 1 concluída
  hoje, 2026-05-07).
- Migrations **NÃO** aplicadas em PROD: 020, 021, 022, 023, 024, 025,
  026, 027, 028, 029, 030.
- HML (`wljedzqgprkpqhuazdzv`): linha do tempo completa 000–017 + 020–030
  com `schema_migrations` reconciliado para versões sequenciais
  (PR #54).
- Todas as feature flags em PROD devem estar **OFF** (default canônico
  em `packages/shared/src/feature-flags/feature-flags.ts:42-47`).

## 2. Resumo das 5 opções

| Opção | Escopo | Migrations | Recomendação default |
|---|---|---|---|
| A | Manter PROD como está (Fase 1 concluída, sem Consent/Safety/Retention) | nenhuma | **Aplicável até** que haja tenant contratualmente liberado para Consent ou Safety |
| B | Aplicar **somente Fase 4** (028 cron + 029 RPCs P0 + 030 RLS partições) | 028, 029, 030 | **Não aplicável isoladamente** — 028 referencia tabelas Safety; 029 referencia `safety_recompute_messages_24h`. Ver §5 |
| C | Aplicar **Fase 2 — Consent** (020–023) | 020, 021, 022, 023 | Aplicável após HML verde + tenant piloto contratualmente liberado |
| D | Aplicar **Fase 3 — Safety Signals** (024–027) | 024, 025, 026, 027 | **Pré-requisito**: Opção C aplicada antes (Safety usa `parental_consent_requests`) |
| E | Aplicar **Fase 4 — Retention/Post-merge/Hardening** (028–030) | 028, 029, 030 | **Pré-requisito**: Opções C **e** D aplicadas antes |

> Sequência canônica recomendada: **A → C → D → E**. Pular ordem é
> tecnicamente possível para C isoladamente, mas D e E têm dependências
> rígidas explicitadas em §5.

---

## 3. Opção A — Manter PROD como está

### 3.1. Escopo

Nenhuma migration aplicada além das 000–017 já existentes. Edge Functions
de Consent (`parental-consent-*`) e Safety (`safety-*`) **continuam
deployadas** mas **falham com erro explícito** quando chamadas, já que
falta schema. Isso é aceitável **se e somente se** as flags
`AGEKEY_PARENTAL_CONSENT_ENABLED` e `AGEKEY_SAFETY_SIGNALS_ENABLED`
estiverem OFF — nesse caso o fluxo nem sequer chama o banco.

### 3.2. Impacto

- Funcionalmente: PROD opera apenas Core (verificação canônica,
  Decision Envelope, webhooks `verification.*`, admin sessions).
- Visível para clientes: nenhum endpoint Consent ou Safety responde com
  sucesso. Tentativa de chamar `POST /v1/parental-consent/session`
  retorna `503` ou `400` `SYSTEM_INVALID_REQUEST` (curto-circuito por
  feature flag).
- Auditoria: continua funcional via partições `audit_events_*` (RLS
  habilitado pelo Core; ver §15.4 em §7 abaixo).

### 3.3. Risco

- **Risco de drift HML × PROD**: HML tem 020–030 aplicadas, PROD não.
  Um deploy de Edge Function que assuma colunas de Consent/Safety vai
  falhar em PROD com `relation "parental_consent_requests" does not
  exist`. Mitigação: **toda Edge Function deve respeitar feature flag
  e short-circuit antes de tocar no banco.** Já implementado em
  `parental-consent-session/index.ts:52` e
  `safety-event-ingest/index.ts:72`.
- **Risco regulatório**: nenhum, pois nada novo é exposto.
- **Risco operacional**: zero — é status quo.

### 3.4. Rollback

Não aplicável. É o estado base.

### 3.5. Dependências

Nenhuma.

### 3.6. Feature flags

Em Vercel (apps/admin) e Supabase Edge Function secrets:

```
AGEKEY_PARENTAL_CONSENT_ENABLED=false
AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED=false
AGEKEY_SAFETY_SIGNALS_ENABLED=false
AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED=false
AGEKEY_SAFETY_MEDIA_GUARD_ENABLED=false
AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED=false
AGEKEY_CREDENTIAL_MODE_ENABLED=false
AGEKEY_SD_JWT_VC_ENABLED=false
AGEKEY_PROOF_MODE_ENABLED=false
AGEKEY_ZKP_BBS_ENABLED=false
```

### 3.7. Smoke tests (PROD, antes de assumir Opção A como definitiva)

1. `supabase migration list --linked` (após `supabase link
   --project-ref tpdiccnmsnjtjwhardij`) — esperado: 18 linhas
   (000–017), nenhuma com status pendente local-only ou remote-only.
2. Curl health no Core:
   ```bash
   curl -i "https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1/health" \
     -H "Authorization: Bearer $ANON_KEY"
   ```
   Esperado: `200 OK` + `{"status":"ok"}`.
3. Curl em endpoint Consent (curto-circuito):
   ```bash
   curl -i -X POST "https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1/parental-consent-session" \
     -H "Authorization: Bearer $ANON_KEY" \
     -H "X-AgeKey-API-Key: $TENANT_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"policy_slug":"dev-13-plus","child_ref_hmac":"deadbeef..."}'
   ```
   Esperado: `503` ou `400` com `code: SYSTEM_INVALID_REQUEST` (flag
   off).

### 3.8. Comandos

Nenhum em PROD. Pode-se rodar:

```bash
pnpm typecheck
pnpm test
```

para garantir que código local não regrediu.

### 3.9. Janela recomendada

Não exige janela.

### 3.10. Critérios de go/no-go

- ✅ Go enquanto não houver tenant contratualmente em onboarding
  Consent/Safety.
- ❌ No-go (mover para Opção C) quando o time comercial sinalizar
  primeiro tenant piloto Consent.

---

## 4. Opção B — Aplicar somente Fase 4 (028 + 029 + 030)

### 4.1. Escopo

- `028_retention_cron_schedule.sql` — agenda `agekey-retention-job` via
  `pg_cron` (3h UTC diário).
- `029_post_merge_p0_fixes.sql` — RPCs `set_current_tenant(uuid)`,
  `safety_recompute_messages_24h()`, recriação de
  `build_parental_consent_event_payload`.
- `030_enable_rls_audit_billing_partitions.sql` — `ALTER TABLE ...
  ENABLE ROW LEVEL SECURITY` em 26 partições de `audit_events` e
  `billing_events`.

### 4.2. Impacto

- 028: cria entrada em `cron.job` (se `pg_cron` + `pg_net` habilitados).
  Sem schema target referenciado, o cron **falha 1× por dia** em PROD,
  porque os endpoints retention referenciam tabelas Consent/Safety.
- 029: cria `safety_recompute_messages_24h()` que **falha em runtime
  com `relation "safety_events" does not exist`**, porque Safety
  (Opção D) não foi aplicada.
- 030: tenta `ALTER TABLE` em partições que existem desde 006 — ok,
  mas valor de `ENABLE RLS` em partição vazia/legacy é cosmético e
  pode confundir RLS testing matrix se aplicado fora de ordem.

### 4.3. Risco

- **CRÍTICO — não recomendado isoladamente.** 028 e 029 dependem
  funcionalmente das tabelas de 024–027. Aplicar B sem D causa:
  - `ERROR 42P01: relation "safety_events" does not exist` em
    `safety_recompute_messages_24h()`;
  - cron falhando silenciosamente todos os dias.
- **Risco regulatório**: nenhum direto.
- **Risco operacional**: alto — adiciona ruído de logs e mascara
  problemas reais.

### 4.4. Rollback

Ver `docs/audit/prod-rollback-playbook-consent-safety.md` §5 (drop de
028/029/030 SQL + remoção de `cron.job`). Caminho primário:
**restore do snapshot pré-aplicação**.

### 4.5. Dependências

- Migrations 020–023 aplicadas (para 029 recriar
  `build_parental_consent_event_payload`).
- Migrations 024–027 aplicadas (para 029 ter `safety_events` e o cron
  028 fazer sentido).

### 4.6. Feature flags

Iguais à Opção A. Fase 4 não muda flags de produto.

> **Nota**: a aplicação de 028 exige configurar duas GUCs no banco:
> - `agekey.retention_job_url` — URL do edge function `retention-job`.
> - `agekey.cron_secret` — bearer reusado pelo cron.
>
> A migration 028 referencia `current_setting('agekey.cron_secret',
> true)` (segundo argumento `true` = `missing_ok`). Sem essas GUCs, o
> POST do cron irá falhar com header vazio. Configurar antes ou
> aceitar 1 ciclo de erro silencioso.

### 4.7. Smoke tests

- `select * from cron.job where jobname = 'agekey-retention-job';` —
  esperado: 1 linha.
- `select set_current_tenant('00000000-0000-0000-0000-000000000000');`
  — esperado: `void`, sem erro.
- `select safety_recompute_messages_24h();` — **esperado: erro se D
  não foi aplicada.** Sinal claro de que B isolado é inválido.

### 4.8. Comandos

> **NÃO EXECUTAR. Apenas planejar.**

```bash
# (a) Snapshot Supabase pré-aplicação
# (via dashboard Supabase ou CLI conforme runbook)

# (b) Aplicar — só após Opção D verde
supabase link --project-ref tpdiccnmsnjtjwhardij
supabase db push --include-all
# (push reaplicaria 020-027 também — verificar que são idempotentes)
```

> Como `db push` aplica todas as pendentes, **não há comando
> "aplicar somente 028-030"** via CLI. Aplicação seletiva exige SQL
> direto via `mcp__7a0f7dd2-..__apply_migration` por arquivo. Esse
> caminho é o documentado em §13 deste documento.

### 4.9. Janela recomendada

Janela de baixa atividade (3h–5h UTC), **se e somente se** dependências
satisfeitas.

### 4.10. Critérios de go/no-go

- ❌ **No-go isolado.** Sempre combinar com C+D (preferir Opção E).
- ✅ Go quando faz parte de C+D+E como pacote.

---

## 5. Opção C — Aplicar Fase 2 (Consent) — migrations 020–023

### 5.1. Escopo

| Migration | Conteúdo |
|---|---|
| `020_parental_consent_core.sql` | enums + 5 tabelas: `consent_text_versions`, `parental_consent_requests`, `parental_consents`, `parental_consent_tokens`, `parental_consent_revocations`. Indexes correspondentes. |
| `021_parental_consent_guardian.sql` | `guardian_contacts`, `guardian_verifications` + 3 RPCs Vault (`guardian_contacts_store`, `_load`, `_purge_vault`). |
| `022_parental_consent_rls.sql` | `ENABLE ROW LEVEL SECURITY` + policies + 2 triggers append-only (`parental_consents_no_mutation`, `parental_consent_revocations_no_mutation`). |
| `023_parental_consent_webhooks.sql` | Funções + triggers `fan_out_parental_consent_webhooks` e `fan_out_parental_consent_revoke_webhooks`. **Não toca** `fan_out_verification_webhooks` do Core. |

Total: **7 tabelas novas**, 3 RPCs Vault, 4 triggers (2 append-only + 2
fan-out), ~20 indexes.

### 5.2. Impacto

- Schema cresce: +7 tabelas. RLS habilitado em todas pelas 022.
- `Database` types do admin não inclui essas tabelas até regenerar via
  `supabase gen types typescript`. Pages admin usam `as never` cast por
  ora (referência:
  `docs/audit/parental-consent-implementation-report.md` §7.3).
- Edge Functions `parental-consent-*` passam a operar contra schema
  real. **Continuam OFF por feature flag** até `AGEKEY_
  PARENTAL_CONSENT_ENABLED=true`.
- Webhooks `parental_consent.*` passam a ser fan-outados via
  `webhook_deliveries` reusando `webhooks-worker` do Core.

### 5.3. Risco

- **Baixo.** Migrations não destrutivas, sem `ALTER` em tabelas Core.
- Trigger SQL `fan_out_parental_consent_webhooks` cria um **novo**
  trigger; não substitui o do Core.
- Risco regulatório: nenhum direto se flag OFF. Quando flag ON, o
  fluxo precisa do tenant ter contratado o módulo Consent.
- Risco de PII: `guardian_contacts` armazena cleartext de
  email/telefone **somente em Vault** (acessado via RPCs); coluna
  comum guarda apenas HMAC + masked.
- Risco de idempotência: se aplicar 020 falhar no meio (ex: timeout),
  precisa rollback completo (drop das tabelas criadas). 020 não usa
  `IF NOT EXISTS` em `CREATE TABLE` — confirmar antes.

### 5.4. Rollback

Ver `docs/audit/prod-rollback-playbook-consent-safety.md` §1 (drop das
7 tabelas + 4 triggers + 3 RPCs Vault + delete de
`schema_migrations` rows 020/021/022/023). **Caminho primário: snapshot
restore.**

### 5.5. Dependências

- Fase 1 aplicada (000–017) — ✅ já em PROD.
- `crypto_keys` ES256 com chave ativa (criada em 014) — ✅.
- `webhook_deliveries` + `webhook_endpoints` (criados em 005) — ✅.
- Vault habilitado em PROD (`extensions.vault`) — verificar via
  `select * from pg_extension where extname='supabase_vault';` antes
  de aplicar 021.

### 5.6. Feature flags

Em Vercel (apps/admin) e Supabase Edge Function secrets, **tudo
permanece OFF imediatamente após aplicação**. Apenas dias depois,
após smoke tests verdes em PROD, considerar:

```
AGEKEY_PARENTAL_CONSENT_ENABLED=false   # mantém OFF até tenant piloto
AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED=false
```

Detalhe completo em
`docs/audit/prod-feature-flags-readiness.md`.

### 5.7. Smoke tests pós-aplicação (PROD)

- `select count(*) from consent_text_versions;` — 0 OK.
- `select count(*) from parental_consent_requests;` — 0 OK.
- `select relrowsecurity from pg_class where relname in (
   'consent_text_versions','parental_consent_requests',
   'parental_consents','parental_consent_tokens',
   'parental_consent_revocations','guardian_contacts',
   'guardian_verifications');` — esperado: 7 linhas todas `true`.
- `select tgname from pg_trigger where tgname like '%parental_consent%';`
  — esperado: 4+ triggers (incluindo append-only e fan-out).
- Curl `parental-consent-session` com flag OFF — esperado: `503`
  curto-circuito, não toca banco. Confirma que ativação é
  exclusivamente por flag.
- HML correspondente já verde no mesmo SHA (autorização de release).

### 5.8. Comandos (planejados, **não executar**)

Caminho recomendado: aplicação migration-by-migration via
`mcp__7a0f7dd2-...__apply_migration`, com inspeção entre cada uma.

```text
1. apply_migration name='020_parental_consent_core' query='<conteúdo de 020 .sql>'
   → verificar 5 tabelas criadas; rodar smoke 1.
2. apply_migration name='021_parental_consent_guardian' query='<...>'
   → verificar Vault RPCs criadas (`select proname from pg_proc where
   proname like 'guardian_contacts_%';` → 3 linhas).
3. apply_migration name='022_parental_consent_rls' query='<...>'
   → verificar `relrowsecurity=true` em 7 tabelas.
4. apply_migration name='023_parental_consent_webhooks' query='<...>'
   → verificar 2 triggers fan-out criados.
```

Após cada um, pular para o próximo apenas se schema/RLS/triggers
verificáveis. Falha em qualquer ponto → STOP + restore snapshot.

### 5.9. Janela recomendada

Janela 03:00–05:00 UTC, baixa atividade. Duração estimada: 5–10
minutos para todas as 4 migrations + verificações.

### 5.10. Critérios de go/no-go

- ✅ HML verde em mesma SHA (typecheck 5/5, vitest 155/155 mínimo,
  smoke functional consent end-to-end).
- ✅ Snapshot Supabase ≤ 24 h.
- ✅ Vault habilitado em PROD.
- ✅ Flags `AGEKEY_PARENTAL_CONSENT_ENABLED=false` em Vercel +
  Edge Function secrets antes de aplicar.
- ✅ Stakeholders avisados (mensagem com janela e plano de rollback).
- ✅ Diagnóstico §1 confirma 000–017 aplicadas.
- ❌ No-go se PR de migrations 020–023 não passou em todos os checks
  da CI atual.
- ❌ No-go se Supabase Vault não estiver habilitado.

---

## 6. Opção D — Aplicar Fase 3 (Safety Signals) — migrations 024–027

### 6.1. Escopo

| Migration | Conteúdo |
|---|---|
| `024_safety_signals_core.sql` | enums + 8 tabelas: `safety_subjects`, `safety_interactions`, `safety_events`, `safety_rules`, `safety_alerts`, `safety_aggregates`, `safety_evidence_artifacts`, `safety_model_runs`. View `safety_webhook_deliveries`. |
| `025_safety_signals_rls.sql` | RLS + policies em 8 tabelas + triggers append-only (`safety_events_no_mutation`, `safety_evidence_no_legal_hold_mutation`). |
| `026_safety_signals_webhooks.sql` | Funções + triggers `fan_out_safety_alert_webhooks` (INSERT) + `fan_out_safety_alert_status_change` (UPDATE). |
| `027_safety_signals_seed_rules.sql` | INSERT de 5 regras globais (tenant_id NULL): UNKNOWN_TO_MINOR_PRIVATE_MESSAGE, ADULT_MINOR_HIGH_FREQUENCY_24H, MEDIA_UPLOAD_TO_MINOR, EVIDENCE_LEGAL_HOLD_TRIGGER, MODEL_CONFIDENCE_OVERRIDE. |

Total: **8 tabelas**, 1 view, 4 triggers, 5 rows seed.

### 6.2. Impacto

- Schema cresce: +8 tabelas + 1 view. RLS habilitado em todas.
- `safety_rules` tem 5 rows globais (tenant_id NULL) — visíveis a
  todos os tenants via policy de leitura.
- Edge Functions `safety-*` passam a operar; continuam OFF por flag.
- Webhooks `safety.*` passam a ser fan-outados.

### 6.3. Risco

- **Baixo a médio.** As tabelas Safety têm FKs para
  `parental_consent_requests` (em consent check via
  `safety/consent-check.ts`), portanto **C deve estar aplicada antes**.
  Sem 020–023, a migration 024 cria tabelas com FK declarada, mas em
  runtime a edge function `safety-event-ingest` falhará ao tentar
  registrar consent check.
- Risco regulatório: nenhum direto enquanto flag OFF.
- Risco de privacy: privacy guard `safety_event_v1` (em packages
  shared) já bloqueia conteúdo bruto; migrations não armazenam
  conteúdo (somente metadata + hashes).

### 6.4. Rollback

Ver `docs/audit/prod-rollback-playbook-consent-safety.md` §2.

### 6.5. Dependências

- Opção C aplicada (FKs para `parental_consent_requests`,
  `verification_sessions`).
- Mesmas pré-condições: snapshot, HML verde, flag OFF.

### 6.6. Feature flags

```
AGEKEY_SAFETY_SIGNALS_ENABLED=false           # mantém OFF
AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED=false  # nunca ativar (não há classifier no MVP)
AGEKEY_SAFETY_MEDIA_GUARD_ENABLED=false       # MVP não implementa
AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED=false    # MVP usa storage path; vault virá depois
```

### 6.7. Smoke tests

- `select count(*) from safety_rules where tenant_id is null;` —
  esperado: 5 (seed).
- `select relrowsecurity from pg_class where relname like 'safety_%';`
  — esperado: 8 linhas todas `true`.
- `select tgname from pg_trigger where tgname like '%safety_%';` —
  esperado: 4 triggers.
- Curl `safety-event-ingest` com flag OFF — esperado: `503`
  curto-circuito.

### 6.8. Comandos (planejados)

```text
1. apply_migration name='024_safety_signals_core' query='<...>'
2. apply_migration name='025_safety_signals_rls' query='<...>'
3. apply_migration name='026_safety_signals_webhooks' query='<...>'
4. apply_migration name='027_safety_signals_seed_rules' query='<...>'
```

Verificações entre cada um, conforme §6.7.

### 6.9. Janela recomendada

03:00–05:00 UTC. Duração: 5–10 minutos.

### 6.10. Critérios de go/no-go

- ✅ Opção C concluída e estável (≥ 24 h em PROD sem incidente).
- ✅ HML com 024–027 verde no mesmo SHA.
- ✅ Snapshot ≤ 24 h.
- ✅ Flags Safety OFF em Vercel + Edge secrets.
- ❌ No-go se C não está estável.
- ❌ No-go se PR de 024–027 não passou todos os checks.

---

## 7. Opção E — Aplicar Fase 4 (Retention/Post-merge/Hardening) — migrations 028–030

### 7.1. Escopo

| Migration | Conteúdo |
|---|---|
| `028_retention_cron_schedule.sql` | `cron.schedule('agekey-retention-job', '0 3 * * *', ...)` via `pg_cron` + `pg_net`. |
| `029_post_merge_p0_fixes.sql` | RPCs `set_current_tenant(uuid)`, `safety_recompute_messages_24h()`, recriação de `build_parental_consent_event_payload` com `payload_hash` real. |
| `030_enable_rls_audit_billing_partitions.sql` | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` em 26 partições de `audit_events_*` e `billing_events_*`. |

### 7.2. Impacto

- 028: cria 1 row em `cron.job`. Job dispara HTTP POST diariamente.
- 029: redefine 3 funções SQL. `build_parental_consent_event_payload`
  era criada em 023 com `payload_hash: 'pending'` (placeholder); 029
  substitui pela versão final com hash SHA-256 calculado.
- 030: RLS já podia estar habilitado nas partições (pelo Core);
  migration garante que está em todas as 12+12+2 partições.

### 7.3. Risco

- **Baixo a médio**, **se C+D já aplicadas**.
- 028: depende de extensions `pg_cron` e `pg_net`. Verificar via
  `select extname from pg_extension where extname in ('pg_cron',
  'pg_net');`. Sem isso, migration 028 logga `RAISE NOTICE` e segue —
  cron não é criado.
- 028: depende de `agekey.retention_job_url` e `agekey.cron_secret`
  serem configurados como GUCs no Postgres antes de o cron rodar pela
  primeira vez. Sem isso, o POST sai com headers vazios.
- 029: substitui função de webhook payload — em janela de manutenção,
  nenhuma escrita em `parental_consents` deve ocorrer simultaneamente
  (idealmente).
- 030: idempotente (`ENABLE ROW LEVEL SECURITY` é seguro de re-aplicar).

### 7.4. Rollback

Ver `docs/audit/prod-rollback-playbook-consent-safety.md` §3, §4, §5.

### 7.5. Dependências

- Opções C e D aplicadas.
- Extensions `pg_cron` e `pg_net` habilitadas (Supabase
  pre-instaladas; verificar).
- GUCs `agekey.retention_job_url` e `agekey.cron_secret`
  configuradas no Postgres (`ALTER DATABASE postgres SET
  agekey.retention_job_url = '...';`).
- Edge Function `retention-job` deployada e respondendo a Bearer.

### 7.6. Feature flags

Iguais. Fase 4 é infra; não muda flags de produto.

### 7.7. Smoke tests

- `select * from cron.job where jobname='agekey-retention-job';` —
  esperado: 1 linha com `schedule='0 3 * * *'`.
- `select proname from pg_proc where proname in
  ('set_current_tenant','safety_recompute_messages_24h',
  'build_parental_consent_event_payload');` — esperado: 3 linhas.
- `select relrowsecurity from pg_class where relname like
  'audit_events_%' or relname like 'billing_events_%';` — esperado:
  todas com `true`.
- Aguardar 1 ciclo cron (próxima 03:00 UTC) e verificar
  `cron.job_run_details` por sucesso (200 da edge function).

### 7.8. Comandos (planejados)

```text
1. apply_migration name='028_retention_cron_schedule' query='<...>'
2. apply_migration name='029_post_merge_p0_fixes' query='<...>'
3. apply_migration name='030_enable_rls_audit_billing_partitions' query='<...>'
```

E pré-requisito (operacional, **não migration**):

```sql
-- Configurar GUCs (executar como superuser via SQL Editor):
ALTER DATABASE postgres SET agekey.retention_job_url = 'https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1/retention-job';
ALTER DATABASE postgres SET agekey.cron_secret = '<obter de Supabase secrets>';
```

> Alternativa: usar `vault.secrets` + `vault.decrypted_secrets`.
> Fora de escopo desta opção; fica como hardening posterior.

### 7.9. Janela recomendada

03:00–05:00 UTC, mesma janela que C/D quando aplicadas em sequência.

### 7.10. Critérios de go/no-go

- ✅ Opções C e D concluídas e estáveis.
- ✅ Extensions `pg_cron` e `pg_net` habilitadas.
- ✅ Edge Function `retention-job` deployada.
- ✅ GUCs configuradas.
- ✅ HML com 028–030 verde no mesmo SHA + cron rodando ≥ 24 h em HML
  sem erro.
- ❌ No-go se cron HML está em erro recorrente.
- ❌ No-go se `retention-job` edge function ainda não é capaz de
  apagar legal_hold (deve preservar — verificar via test em HML).

---

## 8. Sequência canônica recomendada (timeline ideal)

```
Dia D-7: HML 100% verde em SHA X. PR C aprovado e em main.
Dia D-3: snapshot PROD. Verificar Vault, pg_cron, pg_net.
Dia D-2: Confirmar flags OFF em Vercel + Edge secrets PROD.
Dia D-1: Stakeholders avisados. Janela 03:00-05:00 UTC confirmada.

Dia D, 03:00 UTC:
  1. Snapshot PROD (final).
  2. apply_migration 020.
  3. apply_migration 021.
  4. apply_migration 022.
  5. apply_migration 023.
  6. Smoke tests Consent (§5.7).

  Se OK ≥ 30 min de observação:
  7. apply_migration 024.
  8. apply_migration 025.
  9. apply_migration 026.
 10. apply_migration 027.
 11. Smoke tests Safety (§6.7).

  Se OK ≥ 30 min:
 12. Configurar GUCs (§7.8).
 13. apply_migration 028.
 14. apply_migration 029.
 15. apply_migration 030.
 16. Smoke tests Fase 4 (§7.7).

Dia D+1, 03:00 UTC: verificar cron execution log.
Dia D+7: regenerar `Database` types do admin e remover `as never`
casts.
```

> **Variante conservadora**: separar em 3 janelas (D, D+3, D+7),
> uma para cada Opção C, D, E. Adiciona inércia mas limita raio de
> impacto por janela.

## 9. Resumo de risco × benefício

| Opção | Benefício imediato | Risco intrínseco | Recomendação |
|---|---|---|---|
| A | Estabilidade | Drift HML × PROD acumula | Default até primeiro tenant piloto |
| B | Nenhum sem D | Alto se isolado | **Não isolada** |
| C | Habilita Consent module (após flag ON) | Baixo | Aplicar em janela própria |
| D | Habilita Safety module | Baixo a médio | Aplicar após C estável |
| E | Habilita retention cron + hardening RLS | Baixo a médio | Aplicar após C+D estáveis |

## 10. Pendências documentadas

1. Resolver `agekey.retention_job_url` e `agekey.cron_secret` via
   `vault.secrets` em vez de GUC pura — **rodada futura**.
2. Migrar trigger 023 `payload_hash: 'pending'` para hash real — **já
   coberto por 029**.
3. Regenerar `Database` types do admin para cobrir Consent + Safety
   — **rodada operacional após D**.
4. Implementar UI de override de `safety_rules` per-tenant — **R9
   futura**.
5. Provider OTP real (Twilio/SendGrid/Auth) para Consent — **R5
   futura**.

## 11. Anexos cruzados

- `docs/audit/prod-release-go-no-go-checklist.md` — checklist por
  opção.
- `docs/audit/prod-feature-flags-readiness.md` — env vars detalhadas.
- `docs/audit/prod-rollback-playbook-consent-safety.md` — SQL de
  rollback por migration + snapshot restore.
- `docs/audit/hml-migration-history-reconciliation-execution-report.md`
  — referência de como HML foi reconciliada (replicar abordagem para
  PROD se necessário em rodada própria).
- `docs/audit/parental-consent-implementation-report.md` — escopo
  funcional Consent.
- `docs/audit/agekey-safety-signals-implementation-report.md` —
  escopo funcional Safety.
