# Execution Runbook — PROD Consent MVP Release (Operacional)

> ⛔ **NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL.**
> Este runbook contém comandos preparados, mas **nenhum** deles deve ser executado até a janela autorizada por produto/legal/tech-lead conforme `docs/release/prod-consent-mvp-executive-go-no-go-pack.md` §13.
>
> Project ref PROD: `tpdiccnmsnjtjwhardij`.
> Project ref HML: `wljedzqgprkpqhuazdzv` — **NÃO usar comandos apontados para HML por engano**.
> Escopo: somente Consent MVP. Safety **fora** desta janela.

---

## Premissas

1. `main` em commit auditável (≥ `9e85b64`).
2. PROD em Phase 1 (000-017), sem migrations 020-031, sem funções `parental-consent-*` ou `safety-*`.
3. Provider OTP real configurado **antes** da janela.
4. Backup recente PROD confirmado.
5. Operador, DBA on-call e aprovador legal/produto on-call durante a janela.
6. Workflow GHA PROD criado em PR separado **antes** OU plano CLI documentado.
7. RIPD assinado pelo DPO.

---

## Fase 0 — Pré-flight (T-30min até T-0)

### 0.1. Confirmar `main` auditável

```bash
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
git fetch origin
git checkout main
git pull origin main
git rev-parse HEAD     # ≥ 9e85b64
pnpm test              # esperado 359/359 ou superior
pnpm typecheck         # packages + admin verdes
pnpm -r lint           # clean
```

### 0.2. Confirmar backup PROD

- Dashboard Supabase → Project `tpdiccnmsnjtjwhardij` → Database → Backups.
- Snapshot < 24h.
- Registrar `backup_id` e `created_at` no log da janela.

⛔ **NÃO prosseguir sem backup confirmado.**

### 0.3. Confirmar env vars PROD (Dashboard read-only nesta fase)

| Variável | Valor esperado |
|---|---|
| `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` | provider real (não `noop`) |
| Secrets do provider | configurados |
| `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` | URL pública real |
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | OFF (ou ausente) |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | **NÃO setada** |
| `AGEKEY_SAFETY_ENABLED` | NÃO setada |
| `SAFETY_CRON_SECRET` | NÃO setada |

### 0.4. Confirmar feature flags

Mesma tabela acima — verificação visual.

### 0.5. Inspeção MCP read-only (estado atual PROD)

```python
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
mcp__list_migrations(project_id="tpdiccnmsnjtjwhardij")
# Esperado: 18 entradas, 000-017

mcp__list_edge_functions(project_id="tpdiccnmsnjtjwhardij")
# Esperado: 19 Core, todas verify_jwt: false; 0 parental-consent-*; 0 safety-*

mcp__execute_sql(project_id="tpdiccnmsnjtjwhardij", query="""
SELECT count(*) FROM information_schema.tables
WHERE table_schema='public'
  AND (table_name LIKE 'parental_consent%' OR table_name LIKE 'safety_%');
""")
# Esperado: 0
```

### 0.6. Confirmar que Safety NÃO entrará

Confirmação verbal entre operador + aprovador legal/produto antes de seguir.

### 0.7. Critério de avanço para Fase 1

- ✅ `main` auditável + suite verde.
- ✅ Backup PROD confirmado, `backup_id` registrado.
- ✅ Env vars + flags conforme tabela §0.3.
- ✅ Estado PROD via MCP confere.
- ✅ Aprovador on-call confirmou Safety fora.

---

## Fase 1 — Aplicar migrations Consent (T-0 até T+15min)

### 1.1. Aplicar migrations — **EXATAMENTE estas, nesta ordem**

⛔ **NÃO EXECUTAR sem cumprir Fase 0.**

```python
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="020_parental_consent_core",
  query=<SQL exato de supabase/migrations/020_parental_consent_core.sql>)

mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="021_parental_consent_guardian",
  query=<SQL exato de supabase/migrations/021_parental_consent_guardian.sql>)

mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="022_parental_consent_rls",
  query=<SQL exato de supabase/migrations/022_parental_consent_rls.sql>)

mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="023_parental_consent_webhooks",
  query=<SQL exato de supabase/migrations/023_parental_consent_webhooks.sql>)

mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="031_fix_guardian_contacts_store",
  query=<SQL exato de supabase/migrations/031_fix_guardian_contacts_store.sql>)

# Opcional defensiva (recomendado):
mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="030_enable_rls_audit_billing_partitions",
  query=<SQL exato de supabase/migrations/030_enable_rls_audit_billing_partitions.sql>)
```

⛔ **NÃO aplicar**: 024-027 (Safety), 028 (cron), 029 (cross-cutting com Safety).

### 1.2. Validação pós-migrations (read-only)

```sql
-- 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE name LIKE '020%' OR name LIKE '021%' OR name LIKE '022%'
   OR name LIKE '023%' OR name LIKE '030%' OR name LIKE '031%'
ORDER BY version;
-- Esperado: 5 ou 6 entradas (com/sem 030)

SELECT count(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name IN (
  'parental_consent_requests','parental_consents','parental_consent_revocations',
  'parental_consent_tokens','consent_text_versions','guardian_contacts',
  'guardian_verifications'
);
-- Esperado: 7

SELECT count(*) FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relrowsecurity=true
AND c.relname LIKE 'parental_consent%';
-- Esperado: 4

SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='guardian_contacts_store';
-- Esperado: body contém "vault.create_secret(", NÃO "INSERT INTO vault.secrets"

SELECT count(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'safety_%';
-- Esperado: 0 (Safety NÃO aplicado)
```

### 1.3. Critério de avanço para Fase 2

- ✅ 5 migrations Consent + (opcional) 030 aplicadas.
- ✅ 7 tabelas Consent criadas.
- ✅ RLS ativo em 4 tabelas Consent principais.
- ✅ `guardian_contacts_store` usa `vault.create_secret()`.
- ✅ Safety ausente.

---

## Fase 2 — Deploy 7 Edge Functions Consent (T+15min até T+30min)

### 2.1. Comandos de deploy

⚠ **NÃO usar workflow `Deploy HML Edge Functions`** — hardcoded para HML.

**Caminho A — Workflow GHA PROD (recomendado, criado em PR separado antes da janela)**:

```yaml
# .github/workflows/deploy-prod-edge-functions.yml (criado em PR separado)
# Disparar via GitHub Actions UI com input:
#   confirm_prod_deploy = DEPLOY_PROD_EDGE_FUNCTIONS_CONSENT
```

**Caminho B — CLI manual pelo operador**:

```bash
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
export SUPABASE_PROJECT_REF=tpdiccnmsnjtjwhardij  # PROD — confirmar duas vezes!
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
  echo "==> Deploying $fn to PROD..."
  supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt
done
```

⛔ **Garantias absolutas**:
- `--no-verify-jwt` em **todos** os 7 deploys.
- **Nenhum** deploy de função `safety-*`.
- **Nenhum** deploy de função Core (já em PROD desde Phase 1).

### 2.2. Validação pós-deploy

```python
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
mcp__list_edge_functions(project_id="tpdiccnmsnjtjwhardij")
# Esperado:
#   - 7 novas funções parental-consent-*
#   - cada uma verify_jwt: false
#   - version >= 1
#   - 19 Core inalteradas
#   - 0 safety-*
```

### 2.3. Critério de avanço para Fase 3

- ✅ 7 funções Consent ativas, `verify_jwt: false`, `version=1` cada.
- ✅ Core inalterado.
- ✅ Safety ausente.

---

## Fase 3 — Feature flags (T+30min até T+35min)

### 3.1. Smoke pré-ativação (esperar 503)

```bash
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
curl -i -H "X-AgeKey-API-Key: <key piloto PROD>" \
     -H "Content-Type: application/json" \
     -d '{"application_slug":"<slug>","policy_slug":"<slug>","child_ref_hmac":"<hash>","resource":"smoke","purpose_codes":["account_creation"],"data_categories":["nickname"],"locale":"pt-BR"}' \
     "https://tpdiccnmsnjtjwhardij.functions.supabase.co/parental-consent-session"
```

Esperado: **HTTP 503** com `reason_code: SYSTEM_INVALID_REQUEST` (módulo plumbed mas defensivamente desligado).

### 3.2. Habilitar feature flag

```
🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
Dashboard Supabase PROD → Settings → Edge Functions → Environment variables
→ Adicionar AGEKEY_PARENTAL_CONSENT_ENABLED = true
→ Salvar
```

⚠ **Reciclar workers**: env var só é lida no boot. Para forçar reciclagem rápida, fazer deploy noop de uma função:

```bash
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
supabase functions deploy parental-consent-session \
  --project-ref tpdiccnmsnjtjwhardij --no-verify-jwt
```

### 3.3. Flags que **devem permanecer** OFF/ausentes

- `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` (proibido em PROD)
- `AGEKEY_SAFETY_ENABLED`
- `SAFETY_CRON_SECRET`
- Flag SD-JWT VC real (futuro)
- Flag gateway real (futuro)
- ZKP real (futuro)

### 3.4. Critério de avanço para Fase 4

- ✅ Smoke pré-ativação retornou 503 esperado.
- ✅ Flag `AGEKEY_PARENTAL_CONSENT_ENABLED=true`.
- ✅ Workers reciclados.
- ✅ Flags proibidas confirmadas como OFF.

---

## Fase 4 — Smoke tests pós-ativação (T+35min até T+90min)

### 4.1. Pré-condições

- Operador tem TENANT_API_KEY piloto PROD.
- Operador tem acesso a contato real (email/SMS) para receber OTP.

### 4.2. Smoke completo (8 passos)

⚠ **PROD vs HML — diferenças críticas**:
- `dev_otp` **não vai aparecer** (DEV_RETURN_OTP off).
- OTP é entregue **realmente** via provider para `DEV_CONTACT_VALUE`.
- O contato deve ser do operador.
- Após confirmar, **revogar imediatamente** o token (Step 7).

```bash
# 🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL
export BASE_URL=https://tpdiccnmsnjtjwhardij.functions.supabase.co
export TENANT_API_KEY=<chave piloto PROD; nunca commitar>
export APPLICATION_SLUG=<slug definido>
export POLICY_SLUG=<policy de PROD>
export CHILD_REF_HMAC=$(printf 'smoke-prod-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
export DEV_CONTACT_VALUE="<contato real do operador>"
export CONTACT_CHANNEL="email"  # ou "sms"

bash scripts/smoke/consent-smoke.sh
```

Esperado por step: ver `docs/release/prod-consent-mvp-smoke-test-pack.md` §3.

### 4.3. Checagens manuais obrigatórias

- ❌ Zero PII em qualquer resposta pública (email/telefone/CPF/RG/birthdate em claro).
- ✅ `contact_masked` aplicado.
- ✅ JWT minimizado (sem birthdate/email/child_ref em claro).
- ✅ `decision_envelope.content_included = false`, `pii_included = false`.
- ✅ `audit_events_<partição_atual>` cresceu.
- ✅ Logs Edge Function sem stack trace.

### 4.4. Cleanup pós-smoke

- Revogar manualmente token ainda ativo (se Step 7 falhou).
- Não apagar `parental_consent_requests` criada (auditoria).

### 4.5. Critério de avanço para Fase 5

- ✅ 8/8 steps passaram.
- ✅ Privacidade preservada.
- ✅ Audit OK.

⛔ Se algum step 5xx: pular para Fase 6 (Critérios de abort).

---

## Fase 5 — Monitoramento (T+90min até T+72h)

### 5.1. Métricas a observar

**Edge Functions logs** (Dashboard Supabase PROD):

- Filtrar por `parental-consent-*`.
- Maioria HTTP 200 ou 503 (clientes não-piloto).
- 4xx aceitáveis: 401 (chave inválida), 400 (payload), 403 (token expirado).
- **5xx é vermelho** → investigar.

**Database logs**:

- Latência média de queries `parental_consent_*`. Spike → investigar.

**Audit events**:

- `audit_events_<partição>` cresce com tráfego piloto.

**Webhooks**:

- `webhooks-worker` execution_time + success rate.

### 5.2. Janela de observação

- T+0 a T+1h: operador no console em tempo real.
- T+1h a T+24h: checagem horária.
- T+24h a T+72h: 2x/dia.
- T+72h+: ritmo normal.

### 5.3. Postmortem light (T+72h)

Criar `docs/audit/prod-consent-mvp-release-execution-report.md` com:
- Data/hora UTC, commit `main`, migrations aplicadas, funções deployadas.
- Resultado dos 8 steps de smoke.
- Métricas T+72h.
- Incidentes (se houver).

---

## Fase 6 — Critérios de abort

Acionar **rollback** (`docs/release/prod-consent-mvp-rollback-runbook.md`) se:

| Critério | Severidade | Ação |
|---|---|---|
| 5xx em `parental-consent-*` > 1% por 5min | Alta | Rollback rápido (flag OFF) |
| Algum smoke step retorna 5xx ou comportamento inesperado | Alta | Rollback rápido + coleta de logs |
| Privacy Guard falha (PII vazada em resposta) | **Crítica** | Rollback rápido **imediato** + escalação legal/DPO |
| Token revogado não é detectado online | Alta | Rollback rápido |
| Vault encryption falha (permission denied retorna) | Alta | Investigar antes de aplicar; possível rollback |
| Latência p95 `parental-consent-session` > 5s por 5min | Média | Investigar; rollback se piorar |
| Operador reporta dúvida material sobre estado | Média | Pausar; consultar DBA on-call |

---

## Anexo A — Lista negativa absoluta

⛔ **NUNCA** executar nesta janela:

- `supabase db push`
- `supabase migration repair`
- `supabase db reset`
- `supabase db pull`
- Aplicar migrations Safety (024-027)
- Aplicar migration 028 (cron) ou 029 (cross-cutting com Safety)
- Setar `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` em PROD
- Usar provider OTP `noop` em PROD
- Disparar workflow `Deploy HML Edge Functions` (hardcoded para HML)
- Tocar em qualquer função `safety-*` ou `core` (Core estável)
- Habilitar SD-JWT VC real, gateway real, ZKP real

## Anexo B — Variáveis críticas

| Var | Origem | Uso |
|---|---|---|
| `tpdiccnmsnjtjwhardij` | Project ref PROD | hardcoded em todos os comandos |
| `wljedzqgprkpqhuazdzv` | Project ref HML | **NÃO usar nesta janela** |
| `9e85b64` ou descendente | commit `main` | base de deploy |
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | flag | OFF até Fase 3.2 |
| `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` | provider real (não `noop`) | configurar antes |

## Anexo C — Contatos / responsabilidades

| Papel | Pessoa | Quando |
|---|---|---|
| Operador | (nome) | Executa Fases 1-5 |
| Aprovador legal/produto | (nome) | Memo + go/no-go + on-call |
| Plantão DBA | (nome) | Caso §6 critério crítico |
| Comunicação tenant | (nome) | Antes/durante/após |

---

## Confirmações de não-ação (este runbook como documento)

- ❌ Nada executado em PROD.
- ❌ Nenhuma migration aplicada.
- ❌ Nenhum deploy.
- ❌ Nenhuma alteração de feature flags ou secrets.
- ✅ Apenas runbook documental com comandos preparados.
