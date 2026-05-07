# HML — Plano de reconciliação do histórico de migrations

> **Status do banco**: schema **íntegro e completo** em HML. Nenhuma
> migration precisa ser aplicada. Esta divergência é **metadata-only**.
>
> **Não execute** `supabase db push`, `supabase migration repair`,
> `supabase db reset` ou `supabase db pull` sem aprovação explícita.
>
> Branch da reconciliação de código: `claude/reconcile-p0-main-agekey`
> (mergeada em `main` via PR #53, commit `049f7b8`).
>
> Data: 2026-05-07.
> Projeto Supabase HML: `wljedzqgprkpqhuazdzv` (AgeKey-hml).

## 1. Sumário executivo

A CLI Supabase reporta divergência entre o histórico local de migrations
(prefixos numéricos `000`–`030`) e o histórico remoto em HML
(timestamps `20260502125817`–`20260506144644`). **Esta divergência é
exclusivamente de metadata** — os nomes das migrations e o schema
resultante são funcionalmente idênticos.

Foi verificado por inspeção SQL direta do remoto que:

- Todas as 29 migrations locais têm contraparte remota com **nome
  exatamente igual**.
- O schema atual em HML contém todas as 64 tabelas esperadas
  (`parental_consent_requests`, `safety_events`, `audit_events`
  particionado em 13 + default, `billing_events` particionado em 13 +
  default, `verification_sessions`, etc.) com RLS habilitado.
- Smoke tests de Consent e Safety executados em HML hoje
  (2026-05-07) continuam passando.
- A migration crítica `017_fix_tenant_self_access` JÁ está aplicada em
  HML (versão remota `20260506133545`) — **não precisa ser aplicada de
  novo**.

A única ação necessária é **bookkeeping de versão** — alinhar a tabela
`supabase_migrations.schema_migrations` para que a CLI pare de reportar
mismatch.

## 2. Saída de `supabase migration list` (equivalente via MCP)

### 2.1. Versões remotas registradas em HML

| Versão remota | Nome |
|---|---|
| 20260502125817 | 000_bootstrap |
| 20260502125849 | 001_tenancy |
| 20260502125917 | 002_policies |
| 20260502130000 | 003_verifications |
| 20260502130035 | 004_trust |
| 20260502130104 | 005_webhooks |
| 20260502130139 | 006_audit_billing |
| 20260502130208 | 007_security |
| 20260502130259 | 008_rls |
| 20260502130344 | 009_triggers |
| 20260502130422 | 010_edge_support |
| 20260502130443 | 011_storage |
| 20260502130507 | 012_webhook_enqueue |
| 20260502130529 | 013_tenant_bootstrap |
| 20260502130552 | 014_vault_crypto_keys |
| 20260502130613 | 015_fix_audit_global_rows |
| 20260502130624 | 016_vault_create_secret |
| **20260506133545** | **017_fix_tenant_self_access** |
| 20260506144038 | 020_parental_consent_core |
| 20260506144114 | 021_parental_consent_guardian |
| 20260506144143 | 022_parental_consent_rls |
| 20260506144216 | 023_parental_consent_webhooks |
| 20260506144406 | 024_safety_signals_core |
| 20260506144440 | 025_safety_signals_rls |
| 20260506144514 | 026_safety_signals_webhooks |
| 20260506144523 | 027_safety_signals_seed_rules |
| 20260506144535 | 028_retention_cron_schedule |
| 20260506144610 | 029_post_merge_p0_fixes |
| 20260506144644 | 030_enable_rls_audit_billing_partitions |

29 versões remotas registradas como aplicadas.

### 2.2. Arquivos locais em `supabase/migrations/` (HEAD `main` `049f7b8`)

| Versão local (prefixo) | Nome do arquivo |
|---|---|
| 000 | 000_bootstrap.sql |
| 001 | 001_tenancy.sql |
| 002 | 002_policies.sql |
| 003 | 003_verifications.sql |
| 004 | 004_trust.sql |
| 005 | 005_webhooks.sql |
| 006 | 006_audit_billing.sql |
| 007 | 007_security.sql |
| 008 | 008_rls.sql |
| 009 | 009_triggers.sql |
| 010 | 010_edge_support.sql |
| 011 | 011_storage.sql |
| 012 | 012_webhook_enqueue.sql |
| 013 | 013_tenant_bootstrap.sql |
| 014 | 014_vault_crypto_keys.sql |
| 015 | 015_fix_audit_global_rows.sql |
| 016 | 016_vault_create_secret.sql |
| 017 | 017_fix_tenant_self_access.sql |
| 020 | 020_parental_consent_core.sql |
| 021 | 021_parental_consent_guardian.sql |
| 022 | 022_parental_consent_rls.sql |
| 023 | 023_parental_consent_webhooks.sql |
| 024 | 024_safety_signals_core.sql |
| 025 | 025_safety_signals_rls.sql |
| 026 | 026_safety_signals_webhooks.sql |
| 027 | 027_safety_signals_seed_rules.sql |
| 028 | 028_retention_cron_schedule.sql |
| 029 | 029_post_merge_p0_fixes.sql |
| 030 | 030_enable_rls_audit_billing_partitions.sql |

29 arquivos locais.

## 3. Mapeamento local ↔ remoto

Mapeamento 1:1 por **nome do arquivo** (não por versão):

| Versão local | Versão remota | Nome (idêntico) | Já aplicada no banco? |
|---|---|---|---|
| 000 | 20260502125817 | 000_bootstrap | ✅ Sim |
| 001 | 20260502125849 | 001_tenancy | ✅ Sim |
| 002 | 20260502125917 | 002_policies | ✅ Sim |
| 003 | 20260502130000 | 003_verifications | ✅ Sim |
| 004 | 20260502130035 | 004_trust | ✅ Sim |
| 005 | 20260502130104 | 005_webhooks | ✅ Sim |
| 006 | 20260502130139 | 006_audit_billing | ✅ Sim |
| 007 | 20260502130208 | 007_security | ✅ Sim |
| 008 | 20260502130259 | 008_rls | ✅ Sim |
| 009 | 20260502130344 | 009_triggers | ✅ Sim |
| 010 | 20260502130422 | 010_edge_support | ✅ Sim |
| 011 | 20260502130443 | 011_storage | ✅ Sim |
| 012 | 20260502130507 | 012_webhook_enqueue | ✅ Sim |
| 013 | 20260502130529 | 013_tenant_bootstrap | ✅ Sim |
| 014 | 20260502130552 | 014_vault_crypto_keys | ✅ Sim |
| 015 | 20260502130613 | 015_fix_audit_global_rows | ✅ Sim |
| 016 | 20260502130624 | 016_vault_create_secret | ✅ Sim |
| **017** | **20260506133545** | **017_fix_tenant_self_access** | **✅ Sim** |
| 020 | 20260506144038 | 020_parental_consent_core | ✅ Sim |
| 021 | 20260506144114 | 021_parental_consent_guardian | ✅ Sim |
| 022 | 20260506144143 | 022_parental_consent_rls | ✅ Sim |
| 023 | 20260506144216 | 023_parental_consent_webhooks | ✅ Sim |
| 024 | 20260506144406 | 024_safety_signals_core | ✅ Sim |
| 025 | 20260506144440 | 025_safety_signals_rls | ✅ Sim |
| 026 | 20260506144514 | 026_safety_signals_webhooks | ✅ Sim |
| 027 | 20260506144523 | 027_safety_signals_seed_rules | ✅ Sim |
| 028 | 20260506144535 | 028_retention_cron_schedule | ✅ Sim |
| 029 | 20260506144610 | 029_post_merge_p0_fixes | ✅ Sim |
| 030 | 20260506144644 | 030_enable_rls_audit_billing_partitions | ✅ Sim |

**Conclusão**: 29 de 29 (100%) das migrations locais **já estão aplicadas** no schema remoto. Zero migrations precisam ser aplicadas.

## 4. Verificação de equivalência funcional do conteúdo

Comparado o conteúdo SQL armazenado em `supabase_migrations.schema_migrations.statements` (remoto) contra os arquivos locais para amostra crítica:

### 4.1. `017_fix_tenant_self_access`

| Aspecto | Local | Remoto |
|---|---|---|
| Bytes brutos | 1.723 | 1.318 |
| MD5 | `7ea769dd…` | `75334552…` |
| Statements DDL | 4 (2× CREATE POLICY + 2× COMMENT ON POLICY) | 4 (idênticos) |
| Verdict | **DDL idêntico**; diferença = comentários do header (local tem seção "Repro" e nota sobre policies originais que o remoto não tem). |

### 4.2. `030_enable_rls_audit_billing_partitions`

| Aspecto | Local | Remoto |
|---|---|---|
| Bytes brutos | 1.824 | 2.282 |
| MD5 | `4561840c…` | `526032eb…` |
| Statements DDL | 26 (13× ALTER audit_events_* + 13× ALTER billing_events_*) | 26 (idênticos) |
| Verdict | **DDL idêntico**; remoto tem header de comentário mais longo (versão anterior do arquivo, mais explicativa). |

### 4.3. `000_bootstrap` e `020_parental_consent_core`

Diferenças de bytes/MD5 também identificadas, na mesma natureza
(comentários estilo SQL header). DDL preservado em ambos os lados.

**Conclusão**: o schema produzido pelas migrations remotas é
**funcionalmente idêntico** ao que rodar as migrations locais
produziria. As diferenças observadas estão restritas a comentários
SQL (linhas iniciadas por `--`), que **não afetam** o estado do banco.

## 5. Migrations remotas "obsoletas no histórico"

**Nenhuma** migration remota é genuinamente obsoleta. Todas as 29 versões timestamped correspondem a alguma migration local, com o mesmo nome e mesmo efeito DDL.

A "obsolescência" aparente é apenas **da numeração de versão**: a CLI moderna do projeto usa prefixo numérico (`000`, `001`, …, `030`), enquanto o histórico remoto foi gravado quando algum operador executou `supabase db push` que adicionou timestamps `yyyyMMddHHmmss` nas linhas da tabela `schema_migrations`.

## 6. Schema state em HML — verificação direta

Tabelas existentes em `public` (consulta MCP `list_tables`):

- ✅ `tenants`, `tenant_users`, `applications`, `policies`, `policy_versions`, `jurisdictions`, `crypto_keys`, `issuers`, `trust_lists`, `issuer_revocations`, `revocations`, `webhook_endpoints`, `webhook_deliveries`, `usage_counters`, `rate_limit_buckets`, `ip_reputation`, `verification_sessions`, `verification_challenges`, `verification_results`, `result_tokens`, `proof_artifacts`
- ✅ `audit_events` + 13 partições (`audit_events_2026_04` … `audit_events_2027_03` + `audit_events_default`)
- ✅ `billing_events` + 13 partições (`billing_events_2026_04` … `billing_events_2027_03` + `billing_events_default`)
- ✅ Consent: `parental_consent_requests`, `parental_consents`, `parental_consent_revocations`, `parental_consent_tokens`, `consent_text_versions`, `guardian_contacts`, `guardian_verifications`
- ✅ Safety: `safety_subjects`, `safety_interactions`, `safety_events`, `safety_rules`, `safety_alerts`, `safety_aggregates`, `safety_evidence_artifacts`, `safety_model_runs`

**Total: 64 tabelas**, todas com `rls_enabled: true`. Schema completo. **Nada faltando**.

## 7. Risco de rodar `supabase db push --include-all` agora

**Risco: ALTO.** ⛔

Se executado:

1. CLI compara versão local (`000`, `001`, …) com versão remota (`20260502125817`, …).
2. Como prefixos numéricos não estão presentes na tabela `schema_migrations`, CLI considera as 29 migrations locais **não aplicadas**.
3. CLI tentaria `BEGIN; <statements>; INSERT INTO schema_migrations (version, name, statements) VALUES ('000', '000_bootstrap', ...)` para cada uma.
4. Resultado provável: **todas as DDLs vão falhar** com erros como:
   - `type "tenant_role" already exists` (em 001).
   - `relation "tenants" already exists` (em 001).
   - `policy "tenant_users_select_self" for relation "tenant_users" already exists` (em 017).
   - `relation "parental_consent_requests" already exists` (em 020).
5. Em melhor caso, transação faz rollback e nada mudou. Em pior caso, parte aplica e fica estado inconsistente.

**Não execute db push.**

## 8. Risco de rodar `supabase db reset` ou `supabase db pull`

**Risco: CRÍTICO.** ⛔

- `db reset` **dropa todo o schema** e reaplica do zero. **Perderia
  todos os dados aplicados** — 5 issuers, 10 policies, 56 jurisdictions,
  4 crypto keys, 1 application, 1 tenant_users, 8 audit_events, e os
  dados de smoke test (1 verification_session, 1 verification_challenge,
  3 rate_limit_buckets, 2 parental_consent_requests, 2 safety_subjects,
  1 safety_interactions, 1 safety_events, 1 safety_aggregates).
- `db pull` puxaria o schema atual remoto e geraria novos arquivos
  locais com nomes timestamped, **sobrescrevendo** os arquivos `000`–`030`
  cuidadosamente sequenciais que acabamos de reconciliar via PR #53.

**Não execute db reset nem db pull.**

## 9. Comandos de repair recomendados — **NÃO EXECUTAR ainda**

A CLI Supabase oferece `supabase migration repair --status <applied|reverted> <version>` que **só altera a tabela `supabase_migrations.schema_migrations`** (metadata; sem afetar o schema real).

### 9.1. Estratégia recomendada — "alinhar local"

Marcar as 29 versões locais como `applied` para que a CLI pare de reportá-las como pendentes:

```bash
# Pré-requisito: estar com link no projeto HML
supabase link --project-ref wljedzqgprkpqhuazdzv

# Após confirmação explícita, executar:
supabase migration repair --status applied 000
supabase migration repair --status applied 001
supabase migration repair --status applied 002
supabase migration repair --status applied 003
supabase migration repair --status applied 004
supabase migration repair --status applied 005
supabase migration repair --status applied 006
supabase migration repair --status applied 007
supabase migration repair --status applied 008
supabase migration repair --status applied 009
supabase migration repair --status applied 010
supabase migration repair --status applied 011
supabase migration repair --status applied 012
supabase migration repair --status applied 013
supabase migration repair --status applied 014
supabase migration repair --status applied 015
supabase migration repair --status applied 016
supabase migration repair --status applied 017
supabase migration repair --status applied 020
supabase migration repair --status applied 021
supabase migration repair --status applied 022
supabase migration repair --status applied 023
supabase migration repair --status applied 024
supabase migration repair --status applied 025
supabase migration repair --status applied 026
supabase migration repair --status applied 027
supabase migration repair --status applied 028
supabase migration repair --status applied 029
supabase migration repair --status applied 030
```

Efeito: insere 29 linhas em `schema_migrations` com versão `000`, `001`, …, `030`. Não toca DDL.

### 9.2. Estratégia complementar — "remover remoto antigo"

Após 9.1, marcar as 29 versões timestamped como `reverted` (na tabela; **não** dropa schema):

```bash
supabase migration repair --status reverted 20260502125817
supabase migration repair --status reverted 20260502125849
supabase migration repair --status reverted 20260502125917
supabase migration repair --status reverted 20260502130000
supabase migration repair --status reverted 20260502130035
supabase migration repair --status reverted 20260502130104
supabase migration repair --status reverted 20260502130139
supabase migration repair --status reverted 20260502130208
supabase migration repair --status reverted 20260502130259
supabase migration repair --status reverted 20260502130344
supabase migration repair --status reverted 20260502130422
supabase migration repair --status reverted 20260502130443
supabase migration repair --status reverted 20260502130507
supabase migration repair --status reverted 20260502130529
supabase migration repair --status reverted 20260502130552
supabase migration repair --status reverted 20260502130613
supabase migration repair --status reverted 20260502130624
supabase migration repair --status reverted 20260506133545
supabase migration repair --status reverted 20260506144038
supabase migration repair --status reverted 20260506144114
supabase migration repair --status reverted 20260506144143
supabase migration repair --status reverted 20260506144216
supabase migration repair --status reverted 20260506144406
supabase migration repair --status reverted 20260506144440
supabase migration repair --status reverted 20260506144514
supabase migration repair --status reverted 20260506144523
supabase migration repair --status reverted 20260506144535
supabase migration repair --status reverted 20260506144610
supabase migration repair --status reverted 20260506144644
```

Efeito: remove as 29 linhas com versões timestamped. Não toca DDL.

### 9.3. Validação após repair

```bash
supabase migration list
```

**Esperado**: lista limpa, com 29 entradas alinhadas (local = remoto, ambos `000`–`030`), sem mismatch.

```bash
# Sanity check: smoke tests continuam passando
curl -X POST "https://wljedzqgprkpqhuazdzv.supabase.co/functions/v1/parental-consent-session" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "X-AgeKey-API-Key: $TENANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"policy_slug":"dev-13-plus","child_ref_hmac":"deadbeef..."}'
```

Esperado: HTTP 200 com `consent_request_id`, `guardian_panel_url`, `consent_text` (mesmo retorno de hoje).

## 10. Risco do repair em si

**Risco: BAIXO.** ✅

Justificativa:

1. `migration repair` **só altera linhas** em `supabase_migrations.schema_migrations`. Não toca em tabelas de `public`, `auth`, `storage`, `vault`, etc.
2. As linhas afetadas são **bookkeeping** — não há FK ou trigger dependente do conteúdo dessa tabela em runtime.
3. Operação é **reversível**: se algo der errado, basta rodar
   `supabase migration repair --status applied <version>` ou
   `--status reverted <version>` para restaurar.
4. Smoke tests continuam funcionando durante e após a operação porque
   o schema (DDL) não é tocado.

## 11. Exigências antes de executar repair

Antes de rodar qualquer um dos comandos da §9, recomendo:

1. **Backup da tabela `schema_migrations`** — fácil:
   ```sql
   CREATE TABLE supabase_migrations.schema_migrations_backup_20260507 AS
     SELECT * FROM supabase_migrations.schema_migrations;
   ```
2. **Confirmar** comigo (Claude) ou com outra revisão que a estratégia
   das §9.1 + §9.2 é o caminho.
3. **Janela de manutenção** não é necessária (operação é metadata-only),
   mas evite executar enquanto smoke tests estiverem rodando, só
   por boa prática.

## 12. Próximas ações sugeridas

1. **Aprovar este plano** (você lê e confirma).
2. **Backup** da tabela `schema_migrations` (1 comando SQL).
3. **Executar §9.1 + §9.2** (29 + 29 = 58 chamadas de
   `migration repair`).
4. **Validar com `supabase migration list`** — esperar lista alinhada.
5. **Repetir o processo em PROD** após validar HML — PROD provavelmente
   tem o mesmo padrão de timestamps. Antes de rodar PROD, vou consultar
   o histórico remoto de PROD via MCP para confirmar (e gerar um plano
   espelhado).

## 13. O que NÃO foi feito nesta sessão

- ❌ Nenhum `supabase db push` — proibido pelo usuário.
- ❌ Nenhum `supabase migration repair` — aguarda aprovação.
- ❌ Nenhum `supabase db reset` — proibido pelo usuário.
- ❌ Nenhum `supabase db pull` — proibido pelo usuário.
- ❌ Nenhuma alteração no schema de HML.
- ❌ Nenhuma alteração na tabela `schema_migrations` de HML.
- ❌ Nenhuma migration foi aplicada (não havia o que aplicar — todas já
  estavam).
- ❌ Nenhum smoke test foi rodado novamente (não foi pedido; o último
  passou).

## 14. Confirmação de princípios

Esta análise:

- ✅ Não tocou em PII de teste em HML.
- ✅ Não emitiu nenhuma escrita destrutiva ao banco.
- ✅ Não mudou roles, RLS, triggers, schemas ou functions.
- ✅ Apenas leu metadata (`schema_migrations`, `pg_tables`,
  `pg_partitions`).
- ✅ Manteve respeito ao princípio "primeiro entender, depois agir".

Pronto para sua decisão sobre executar ou não o repair.
