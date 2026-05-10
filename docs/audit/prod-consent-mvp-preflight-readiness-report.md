# PROD — Pré-flight readiness do AgeKey Consent MVP (read-only)

> **Status**: Pré-flight **somente leitura**. Nenhuma alteração executada em PROD. Aguarda decisão executiva após este relatório.
>
> Project ref PROD: `tpdiccnmsnjtjwhardij` — somente leitura nesta rodada.
> Project ref HML: `wljedzqgprkpqhuazdzv` — não tocado nesta rodada.
> Commit `main` na auditoria: `9880cb4dcdf3d4a2da1f25dbfbc42fe7d5aa2414` (post-PR #79).
> Escopo: somente Consent MVP. Safety **fora**.

---

## 1. Estado atual de PROD (validado via MCP read-only)

### 1.1. Migrations aplicadas

| Versão | Nome | Status |
|---|---|---|
| 000 | bootstrap | ✅ |
| 001 | tenancy | ✅ |
| 002 | policies | ✅ |
| 003 | verifications | ✅ |
| 004 | trust | ✅ |
| 005 | webhooks | ✅ |
| 006 | audit_billing | ✅ |
| 007 | security | ✅ |
| 008 | rls | ✅ |
| 009 | triggers | ✅ |
| 010 | edge_support | ✅ |
| 011 | storage | ✅ |
| 012 | webhook_enqueue | ✅ |
| 013 | tenant_bootstrap | ✅ |
| 014 | vault_crypto_keys | ✅ |
| 015 | fix_audit_global_rows | ✅ |
| 016 | vault_create_secret | ✅ |
| 017 | fix_tenant_self_access | ✅ |

**Total**: 18 migrations (`000`–`017`). Phase 1 confirmada.

### 1.2. Migrations **ausentes** em PROD

| Versão | Nome | Estado em PROD | Ação prevista para Consent MVP |
|---|---|---|---|
| 020 | parental_consent_core | ❌ ausente | aplicar |
| 021 | parental_consent_guardian | ❌ ausente | aplicar |
| 022 | parental_consent_rls | ❌ ausente | aplicar |
| 023 | parental_consent_webhooks | ❌ ausente | aplicar |
| 024 | safety_signals_core | ❌ ausente | **NÃO aplicar** (Safety fora) |
| 025 | safety_signals_rls | ❌ ausente | **NÃO aplicar** (Safety fora) |
| 026 | safety_signals_webhooks | ❌ ausente | **NÃO aplicar** (Safety fora) |
| 027 | safety_signals_seed_rules | ❌ ausente | **NÃO aplicar** (Safety fora) |
| 028 | retention_cron_schedule | ❌ ausente | **defer** (decisão separada) |
| 029 | post_merge_p0_fixes | ❌ ausente | **NÃO aplicar** (refs Safety; falha sem 024) |
| 030 | enable_rls_audit_billing_partitions | ❌ ausente | **opcional** (defensivo, recomendado) |
| 031 | fix_guardian_contacts_store | ❌ ausente | aplicar (corrige bug pgsodium do 021) |

### 1.3. Tabelas Consent + Safety em PROD

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND (table_name LIKE 'parental_consent%'
       OR table_name LIKE 'guardian_%'
       OR table_name LIKE 'consent_text_%'
       OR table_name LIKE 'safety_%');
-- Resultado: 0 rows
```

✅ **Confirmado**: nenhuma tabela `parental_consent_*`, `guardian_*`, `consent_text_*` ou `safety_*` existe em PROD.

### 1.4. Edge Functions em PROD

| Categoria | Quantidade | Estado | `verify_jwt` |
|---|---|---|---|
| **Core** | 19 (`verifications-*`, `applications-*`, `policies-*`, `issuers-*`, `audit-list`, `proof-artifact-url`, `jwks`, `key-rotation`, `webhooks-worker`, `retention-job`, `trust-registry-refresh`, `tenant-bootstrap`) | ACTIVE | `false` em **todas** as 19 ✅ |
| Consent | 0 (`parental-consent-*`) | — | — |
| Safety | 0 (`safety-*`) | — | — |
| **Total PROD** | **19** | — | **19/19 = `false`** ✅ |

Versões: maioria v2, `verifications-session-get` em v3 (re-deploy específico, justificativa fora do escopo desta análise).

### 1.5. Dados de tenancy em PROD (read-only)

| Tabela | Estado |
|---|---|
| `tenants` (active) | **1** — slug `dev`, name `AgeKey Dev`, id `019dd966-820a-75d9-b09e-0620ffb4aaa1`, criado 2026-04-29 |
| `applications` (active) | **1** — slug `dev-app`, status `active`, tenant_id acima, api_key_prefix `ak_dev_sk_test_` (formato bootstrap original; **a chave raw provavelmente está perdida**, similar ao caso HML pré-rotação) |
| `policies` (active) | **10** total: 7 templates globais (`is_template=true`, `tenant_id IS NULL`) + 3 per-tenant (`is_template=false`) |
| `tenant_users` | a confirmar (não inspecionado nesta rodada) |

**Observação crítica**: o único tenant em PROD é o **AgeKey Dev** — tenant interno de desenvolvimento, **não** um cliente piloto comercial. Para a janela Consent MVP em PROD, é recomendável:

- **Opção A**: usar o tenant `dev` existente em PROD para validação técnica em ambiente real (controlado), sem pretender clientes externos.
- **Opção B**: criar tenant + application piloto de cliente real antes da janela (via `tenant-bootstrap` + `applications-write`).

Decisão executiva pendente.

### 1.6. Convenção `verify_jwt` em PROD

✅ 19/19 Core com `verify_jwt: false`. Padrão consistente com HML e com convenção AgeKey (auth via `X-AgeKey-API-Key`, não JWT Supabase). Para Consent, manter o padrão: deploy com `--no-verify-jwt`.

---

## 2. Estado de `main` confirmado

| Item | Estado |
|---|---|
| Commit HEAD | `9880cb4dcdf3d4a2da1f25dbfbc42fe7d5aa2414` ✅ (≥ 9880cb4d) |
| Árvore | limpa (PR #79 mergeado) |
| Documentos PR #79 presentes em `docs/audit/` | ✅ 4 arquivos: `prod-consent-mvp-release-decision-memo.md`, `prod-consent-mvp-release-runbook.md`, `prod-consent-mvp-go-no-go-checklist.md`, `agekey-release-status-board.md` |
| Documentos PR #77 em `docs/release/` | ✅ presentes (versão paralela) |
| Estado HML referenciado | ✅ `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` (8/8 smoke) |
| Estado PROD referenciado | ✅ `docs/audit/prod-phase-1-migration-017-execution-report.md` |

---

## 3. Pré-requisitos para Consent — verificação

### 3.1. Pré-requisitos atendidos ✅

| # | Pré-requisito | Estado |
|---|---|---|
| P1 | PROD tem Phase 1 completa (000-017) | ✅ |
| P2 | Tenant ativo em PROD (`AgeKey Dev`) | ✅ tecnicamente; ⏸ revisão executiva sobre uso de tenant interno vs criar piloto externo |
| P3 | Application ativa em PROD (`dev-app`) | ✅ tecnicamente; mesma ressalva |
| P4 | Policies criadas (10 ativas; 7 globais + 3 dev) | ✅ |
| P5 | 19 Edge Functions Core deployadas, `verify_jwt: false` | ✅ |
| P6 | Convenção `--no-verify-jwt` confirmada como padrão PROD | ✅ |
| P7 | Migrations ausentes (020-031) — caminho limpo para aplicar | ✅ |
| P8 | Tabelas Consent/Safety ausentes — sem conflito de schema | ✅ |
| P9 | `main` em commit auditável | ✅ |
| P10 | Suíte verde em `main` (`pnpm test` 359/359) | ✅ |
| P11 | Documentação de release pronta (memo + runbook + checklist + status board) | ✅ |
| P12 | Validação HML ponta-a-ponta (8/8 smoke) | ✅ |
| P13 | Migration 031 disponível (corrige bug pgsodium) | ✅ |

### 3.2. Pré-requisitos pendentes ⏸

| # | Pré-requisito | Bloqueia janela? |
|---|---|---|
| **B1** | **Provider OTP real configurado em PROD** (Twilio/Mailgun/SES/etc.; **proibido `noop`**) | ⛔ **Crítico** |
| **B2** | **Decisão executiva escrita**: usar tenant `dev` interno OU criar tenant piloto cliente | ⛔ Crítico |
| B3 | Se B2 = criar piloto: emissão de `tenant` + `application` PROD via `tenant-bootstrap` (com raw API key custodiada exclusivamente pelo operador) | Crítico se B2 = piloto |
| B4 | Mecanismo para criar `consent_text_versions` ativa: SQL controlado pós-migration 020-023 (admin) ou rota futura no painel admin | Crítico |
| B5 | RIPD do AgeKey Consent v1 formalmente aceito | Crítico |
| B6 | Memo executivo (`docs/audit/prod-consent-mvp-release-decision-memo.md`) assinado por produto + legal/DPO + tech lead | Crítico |
| B7 | Janela de manutenção definida (UTC, início/fim) | Crítico |
| B8 | Operador responsável nomeado para a janela | Crítico |
| B9 | Plantão DBA on-call (caso rollback de migration) | Crítico |
| B10 | Backup/snapshot Supabase PROD confirmado < 24h antes da janela | Crítico |
| B11 | Workflow GHA dedicado a PROD criado (recomendado) ou plano CLI documentado | Crítico — workflow HML tem `wljedzqgprkpqhuazdzv` hardcoded |
| B12 | `SUPABASE_ACCESS_TOKEN` PROD configurado (se workflow) | Condicional |
| B13 | Comunicação com tenant piloto (se externo) | Condicional |
| B14 | Variáveis env adicionais a confirmar:<br>- `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` (URL pública real do painel parental PROD)<br>- secrets do provider OTP escolhido | Crítico |
| B15 | Confirmar que `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` está **ausente** em PROD (proibido) | Confirmar antes da Fase 3 |
| B16 | Confirmar que `AGEKEY_SAFETY_ENABLED` está **ausente / OFF** em PROD | Confirmar |
| B17 | Confirmar que `AGEKEY_PARENTAL_CONSENT_ENABLED` está **OFF** antes do deploy (será ON ao final da Fase 3) | Confirmar |

### 3.3. Pré-requisitos relacionados a flags futuras (não tocar nesta rodada)

| Flag / capacidade | Estado em PROD | Ação |
|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | ausente (assumido; não confirmei via Dashboard read) | manter ausente |
| SD-JWT VC real | OFF (adapter `vc` é honest stub) | manter OFF |
| Gateway real (Gov.br/Serpro/etc.) | OFF (adapter `gateway` é honest stub) | manter OFF |
| ZKP real | OFF (adapter `zkp` é honest stub) | manter OFF |
| Safety (`AGEKEY_SAFETY_ENABLED`) | ausente | manter ausente |

---

## 4. Comandos que **seriam** executados futuramente — não executados

### 4.1. Migrations (na ordem)

```python
# REVISÃO ONLY — não chamar
mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="020_parental_consent_core",
  query=<SQL exato de supabase/migrations/020_parental_consent_core.sql>)

mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="021_parental_consent_guardian",
  query=<SQL exato>)

mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="022_parental_consent_rls",
  query=<SQL exato>)

mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="023_parental_consent_webhooks",
  query=<SQL exato>)

mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="031_fix_guardian_contacts_store",
  query=<SQL exato>)

# Opcional defensiva:
mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="030_enable_rls_audit_billing_partitions",
  query=<SQL exato>)
```

### 4.2. Deploy 7 Edge Functions Consent

```bash
# REVISÃO ONLY — operador rodará na janela
export SUPABASE_PROJECT_REF=tpdiccnmsnjtjwhardij  # PROD — confirmar duas vezes
export SUPABASE_ACCESS_TOKEN=<token PROD; nunca commitar>

for fn in \
  parental-consent-session \
  parental-consent-guardian-start \
  parental-consent-confirm \
  parental-consent-session-get \
  parental-consent-text-get \
  parental-consent-token-verify \
  parental-consent-revoke
do
  supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt
done
```

### 4.3. Habilitar feature flag

```
Dashboard Supabase PROD → Settings → Edge Functions → Environment variables
→ Adicionar AGEKEY_PARENTAL_CONSENT_ENABLED = true
→ Salvar
→ deploy noop em uma das funções para reciclar workers
```

### 4.4. Smoke pós-ativação

```bash
# REVISÃO ONLY — operador rodará na janela
export BASE_URL=https://tpdiccnmsnjtjwhardij.functions.supabase.co
export TENANT_API_KEY=<chave piloto PROD>
export APPLICATION_SLUG=<slug definido>
export POLICY_SLUG=<slug policy>
export CHILD_REF_HMAC=$(printf 'smoke-prod-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
export DEV_CONTACT_VALUE="<contato real do operador>"

bash scripts/smoke/consent-smoke.sh
```

---

## 5. Risks / Go-No-Go consolidado

### 5.1. Necessidade de backup/snapshot

⛔ **Obrigatório**: snapshot Supabase PROD < 24h antes da janela. Operador confirma via Dashboard → Database → Backups e registra `backup_id`.

### 5.2. Janela recomendada

- **Duração estimada**: 2h (Fase 0 pré-flight 30 min + Fase 1 migrations 15 min + Fase 2 deploy 15 min + Fase 3 flag 5 min + Fase 4 smoke 30 min + buffer 30 min).
- **Horário recomendado**: madrugada UTC para minimizar tráfego potencial de tenants futuros.
- **Plantão**: operador + DBA on-call + aprovador legal/produto disponíveis.

### 5.3. Rollback

| Tipo | Ação | Tempo |
|---|---|---|
| Rápido (recomendado) | Set `AGEKEY_PARENTAL_CONSENT_ENABLED=false` no Dashboard | < 2 min |
| Função específica | "Restore" versão anterior no Dashboard Edge Functions | minutos |
| Migrations | **Não automático** — análise produto/legal + DBA on-call | horas/dias |

### 5.4. Smoke tests mínimos

8 passos do `consent-smoke.sh` validados em HML, adaptados para PROD com `dev_otp = null` esperado e OTP real entregue ao operador via provider.

### 5.5. Impacto comercial

- **Direto**: zero clientes externos com Consent ativo hoje. Janela não afeta tráfego comercial existente em PROD.
- **Indireto**: comunicação com tenant piloto (se externo) deve avisar sobre janela.

### 5.6. Dependências externas

| Dependência | Estado |
|---|---|
| Provider OTP (Twilio/Mailgun/etc.) | ⏸ a contratar/configurar |
| RIPD aprovado pelo DPO | ⏸ pendente |
| Contrato com tenant piloto (se externo) | ⏸ pendente |

### 5.7. Pontos de bloqueio identificados

1. ⛔ Provider OTP real **não configurado** em PROD.
2. ⛔ Decisão executiva sobre tenant (interno `dev` vs piloto externo) **pendente**.
3. ⛔ Memo legal/produto **não assinado**.
4. ⛔ RIPD Consent v1 **não formalizado**.
5. ⛔ Janela e operador **não definidos**.
6. ⛔ Backup PROD **não confirmado**.
7. ⛔ Workflow PROD GHA **não criado** (se preferir caminho auditável).

---

## 6. Decisão recomendada

### 6.1. Avaliação técnica

✅ **TECNICAMENTE READY**. PROD em estado limpo, sem conflitos para receber 020-023 + 031 + (opcional) 030, e 7 Edge Functions Consent. `verify_jwt: false` é convenção já estabelecida em PROD. Migration 031 corrige bug pgsodium conhecido.

### 6.2. Avaliação de governança

⏸ **PENDENTE 7 ITENS** (§5.7) antes de abrir janela:

1. Provider OTP real.
2. Decisão tenant (interno vs piloto externo).
3. Memo assinado.
4. RIPD aceito.
5. Janela definida.
6. Backup confirmado.
7. Workflow PROD ou plano CLI definido.

### 6.3. Recomendação final

**GO WITH CONDITIONS** (ou seja, **NO-GO** para abrir janela agora; **GO** assim que os 7 itens estiverem cumpridos).

### 6.4. Ordem sugerida para sair do gate

1. **Decisão executiva** (memo §13) → desbloqueia escopo.
2. **Provider OTP escolhido + contratado** → desbloqueia smoke pós-ativação.
3. **RIPD assinado pelo DPO** → desbloqueia legalmente.
4. **Decisão sobre tenant**: interno `dev` para validação técnica de release, ou criar piloto externo. Recomendo: **interno `dev` primeiro** (smoke técnico sem cliente externo), depois criar piloto externo em janela posterior, sem dependência de cliente para o release técnico inicial.
5. **Workflow PROD GHA criado** (PR separado) com `tpdiccnmsnjtjwhardij` hardcoded e confirmação `DEPLOY_PROD_EDGE_FUNCTIONS_CONSENT`.
6. **Janela definida + operador nomeado + DBA on-call**.
7. **Backup confirmado** no início da janela.
8. **Executar Fase 0-5** do runbook (`docs/audit/prod-consent-mvp-release-runbook.md`).

---

## 7. Lista objetiva do que falta antes de executar

### 7.1. Bloqueadores (inadiáveis)

- [ ] **B1**: Provider OTP real configurado em PROD (Twilio/Mailgun/SES/etc.). Secrets do provider configurados.
- [ ] **B2**: Decisão sobre tenant (interno `dev` vs piloto externo) escrita.
- [ ] **B5**: RIPD AgeKey Consent v1 assinado pelo DPO.
- [ ] **B6**: Memo `docs/audit/prod-consent-mvp-release-decision-memo.md` assinado por produto + legal + tech lead.
- [ ] **B7**: Janela UTC definida.
- [ ] **B8**: Operador responsável nomeado.
- [ ] **B9**: Plantão DBA on-call.
- [ ] **B10**: Backup PROD < 24h confirmado no momento da janela.
- [ ] **B11**: Workflow GHA PROD criado (recomendado) ou plano CLI documentado e validado.
- [ ] **B14**: `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` PROD definida.

### 7.2. Confirmações de "ausência" em PROD (no momento da janela)

- [ ] **B15**: `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` ausente.
- [ ] **B16**: `AGEKEY_SAFETY_ENABLED` ausente / OFF.
- [ ] **B17**: `AGEKEY_PARENTAL_CONSENT_ENABLED` OFF (será ON na Fase 3).

### 7.3. Condicional (se B2 = piloto externo)

- [ ] **B3**: Tenant piloto criado em PROD via `tenant-bootstrap` (raw API key custodiada exclusivamente pelo operador).
- [ ] **B13**: Comunicação contratual com tenant piloto.

### 7.4. Operacional pré-janela

- [ ] **B4**: Plano de seed de `consent_text_versions` documentado (SQL controlado admin pós-migration 020 ou rota futura).
- [ ] **B12**: `SUPABASE_ACCESS_TOKEN` PROD em GH Secrets (se workflow).

---

## 8. Confirmações de não-ação (esta rodada)

- ❌ **PROD intocada.** Apenas leituras MCP (list_migrations, list_edge_functions, execute_sql SELECT) contra `tpdiccnmsnjtjwhardij`.
- ❌ Nenhum `db push`, `migration repair`, `db reset`, `db pull`.
- ❌ Nenhuma migration aplicada.
- ❌ Nenhum SQL escrito.
- ❌ Nenhum deploy.
- ❌ Nenhuma alteração de feature flags.
- ❌ Nenhuma alteração de schema, RLS, dados ou secrets.
- ❌ Consent **não habilitado** em PROD.
- ❌ Safety **não habilitado** em PROD.
- ❌ DEV_RETURN_OTP **não habilitado** em PROD.
- ❌ HML **não tocado** nesta rodada (apenas leitura comparativa documental).
- ❌ Nenhuma raw TENANT_API_KEY solicitada ou registrada.
- ❌ Nenhuma migration nova criada.
- ❌ Nenhum código runtime alterado.
- ❌ Nenhuma nova funcionalidade.
- ✅ Apenas: este relatório de pré-flight.

---

## 9. Hashes / referências

| Item | Valor |
|---|---|
| Commit `main` na auditoria | `9880cb4dcdf3d4a2da1f25dbfbc42fe7d5aa2414` |
| HML project ref | `wljedzqgprkpqhuazdzv` (não tocado) |
| PROD project ref | `tpdiccnmsnjtjwhardij` (somente leitura) |
| Migrations PROD aplicadas | 18 (`000`–`017`) |
| Edge Functions PROD | 19 Core, todas `verify_jwt: false`, v2-v3 |
| Tenant PROD ativo | 1 (`dev` / `AgeKey Dev`) |
| Application PROD ativa | 1 (`dev-app`) |
| Policies PROD ativas | 10 (7 templates globais + 3 dev) |
| Tabelas Consent/Safety em PROD | 0 |

---

## 10. Próximo passo

Aguardando sua **decisão executiva** após este relatório:

- **Se decisão = abrir janela**: cumprir os 10 itens da §7.1 + condicionais aplicáveis, depois executar Fase 0-5 do runbook (`docs/audit/prod-consent-mvp-release-runbook.md`).
- **Se decisão = postergar**: nenhuma ação adicional desta sessão.
- **Se decisão = ajustar escopo** (ex.: adicionar Safety, ou adicionar 028, ou outro tenant piloto): nova rodada de readiness antes de qualquer ação.

Standby aguardando.
