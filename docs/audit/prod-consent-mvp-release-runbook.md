# Runbook técnico — Release PROD do AgeKey Consent MVP

> **Status**: Runbook preparatório. Nenhuma fase aqui foi executada. Aguarda autorização explícita antes do início.
>
> Project ref PROD: `tpdiccnmsnjtjwhardij` — alvo único.
> Project ref HML: `wljedzqgprkpqhuazdzv` — **NÃO usar comandos apontados para HML por engano**.
> Escopo: somente módulo Consent. Safety **fora** desta janela.
> Companheiros: `docs/audit/prod-consent-mvp-release-decision-memo.md`, `docs/audit/prod-consent-mvp-go-no-go-checklist.md`.

---

## Convenções

- 🔒 **Comandos exatos** marcados com `bash`/`sql`. **Não improvisar.**
- ⚠ **Diferenças críticas vs HML** marcadas com aviso.
- ⛔ **Operações proibidas** listadas em cada fase.

---

## Fase 0 — Pré-flight (até T-24h)

### 0.1. Confirmar `main` em commit auditável

```bash
git fetch origin
git checkout main
git pull origin main
git rev-parse HEAD     # esperado: f4ddcb91 ou descendente
pnpm test              # esperado: 359/359 (ou superior)
pnpm typecheck         # packages + admin verdes
pnpm -r lint           # clean
```

**Critério**: `main >= f4ddcb91` e suite verde.

### 0.2. Confirmar backup/snapshot Supabase PROD

- Dashboard Supabase → Project `tpdiccnmsnjtjwhardij` → Database → Backups.
- Confirmar snapshot < 24h.
- Se não houver, **disparar backup manual** e aguardar conclusão.
- Registrar `backup_id` e `created_at`.

⛔ **NÃO prosseguir sem backup recente confirmado.**

### 0.3. Confirmar variáveis de ambiente PROD

Dashboard Supabase → Project `tpdiccnmsnjtjwhardij` → Settings → Edge Functions → Environment variables.

| Variável | Estado nesta fase | Final |
|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` | provider real (`twilio`, `mailgun`, etc.) | configurada |
| Secrets do provider OTP (depende) | ex.: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | configurados |
| `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` | URL pública real do painel parental PROD | configurada |
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | **NÃO setar ainda** (será setada no fim da Fase 3) | OFF |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | **NÃO setar** | proibido em PROD |
| `AGEKEY_SAFETY_ENABLED` | **NÃO setar / OFF** | OFF |

⛔ **NÃO setar `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` em PROD.**
⛔ **NÃO setar nenhuma env var `AGEKEY_SAFETY_*` em PROD.**

### 0.4. Confirmar feature flags

| Flag | Estado |
|---|---|
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | OFF (será ON na Fase 3) |
| `AGEKEY_SAFETY_ENABLED` | OFF |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | NÃO setar |
| Flags ZKP / SD-JWT VC real / gateway real | OFF |

### 0.5. Confirmar janela de manutenção

- Comunicar tenant(s) piloto.
- Definir início/fim em UTC.
- Definir canal de comunicação (Slack, e-mail, telefone) com tenant para o caso de incidente.

### 0.6. Confirmar operador responsável

- Nome do operador.
- Acesso confirmado: GitHub, Supabase Dashboard PROD, painel admin PROD.
- Memo legal/produto assinado (`docs/audit/prod-consent-mvp-release-decision-memo.md` §13).

### 0.7. Confirmar que Safety ficará OFF

- ⛔ Não aplicar migrations 024-027 nesta janela.
- ⛔ Não deployar funções `safety-*`.
- ⛔ Não setar nenhuma env var `AGEKEY_SAFETY_*`.
- ⛔ Não configurar `SAFETY_CRON_SECRET`.

---

## Fase 1 — Aplicar migrations de Consent em PROD

### 1.1. Pré-condições

- Fase 0 completa.
- Backup confirmado.
- Conexão MCP autenticada com permissão de migration em `tpdiccnmsnjtjwhardij`.

### 1.2. Migrations a aplicar — **EXATAMENTE estas, nesta ordem**

| # | Migration | Comando |
|---|---|---|
| 1 | `020_parental_consent_core.sql` | `mcp__apply_migration` com SQL exato |
| 2 | `021_parental_consent_guardian.sql` | idem |
| 3 | `022_parental_consent_rls.sql` | idem |
| 4 | `023_parental_consent_webhooks.sql` | idem |
| 5 | `031_fix_guardian_contacts_store.sql` | idem (substitui body de `guardian_contacts_store` para usar `vault.create_secret()`) |
| 6 | `030_enable_rls_audit_billing_partitions.sql` | **opcional**, defensivo |

**Recomendação**: usar `mcp__apply_migration` para registrar em `supabase_migrations.schema_migrations` com timestamp único.

⛔ **NÃO aplicar**:
- `024_safety_signals_core` (Safety fora)
- `025_safety_signals_rls` (Safety fora)
- `026_safety_signals_webhooks` (Safety fora)
- `027_safety_signals_seed_rules` (Safety fora)
- `028_retention_cron_schedule` (defer; decisão separada)
- `029_post_merge_p0_fixes` (cross-cutting com Safety; `safety_recompute_messages_24h` falha sem 024)

### 1.3. Validação pós-migrations (read-only via MCP)

```sql
-- Confirmar 5 migrations Consent + 030 (se aplicada)
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE name LIKE '02_%' OR name LIKE '030%' OR name LIKE '031%'
ORDER BY version;
-- Esperado: 020, 021, 022, 023, [030], 031

-- Confirmar tabelas Consent criadas
SELECT count(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name IN (
  'parental_consent_requests','parental_consents','parental_consent_revocations',
  'parental_consent_tokens','consent_text_versions','guardian_contacts',
  'guardian_verifications'
);
-- Esperado: 7

-- Confirmar RLS habilitado em tabelas Consent
SELECT count(*) FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relrowsecurity=true
AND c.relname LIKE 'parental_consent%';
-- Esperado: 4

-- Confirmar function guardian_contacts_store usa vault.create_secret
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='guardian_contacts_store';
-- Esperado: body contém "vault.create_secret(", NÃO "INSERT INTO vault.secrets"

-- Confirmar Safety NÃO criada
SELECT count(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'safety_%';
-- Esperado: 0
```

### 1.4. Critério de avanço para Fase 2

- ✅ 5 migrations Consent aplicadas (+ 030 opcional).
- ✅ 7 tabelas Consent criadas.
- ✅ RLS ativo nas 4 tabelas principais Consent.
- ✅ `guardian_contacts_store` usa `vault.create_secret()`.
- ✅ Safety NÃO presente.

Se algum critério vermelho, **pausar e escalar**.

---

## Fase 2 — Deploy Edge Functions de Consent em PROD

### 2.1. Pré-condições

- Fase 1 completa.
- Provider OTP configurado (Fase 0.3).

### 2.2. Funções a deployar — **EXATAMENTE estas 7**

| Edge Function |
|---|
| `parental-consent-session` |
| `parental-consent-guardian-start` |
| `parental-consent-confirm` |
| `parental-consent-session-get` |
| `parental-consent-text-get` |
| `parental-consent-token-verify` |
| `parental-consent-revoke` |

### 2.3. Comandos de deploy

⚠ **NÃO usar o workflow GHA `Deploy HML Edge Functions`** — ele tem `SUPABASE_PROJECT_REF=wljedzqgprkpqhuazdzv` (HML) hardcoded.

**Caminho recomendado**: criar workflow específico para PROD em PR separado **antes** desta janela (`.github/workflows/deploy-prod-edge-functions.yml`), com:
- `SUPABASE_PROJECT_REF=tpdiccnmsnjtjwhardij` hardcoded.
- Confirmação manual `DEPLOY_PROD_EDGE_FUNCTIONS_CONSENT`.
- Apenas as 7 funções Consent (sem Safety).
- `--no-verify-jwt` em todas.

**Caminho alternativo** (CLI local pelo operador):

```bash
export SUPABASE_PROJECT_REF=tpdiccnmsnjtjwhardij  # PROD — confirmar duas vezes!
export SUPABASE_ACCESS_TOKEN=<token de PROD; nunca commitar>

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
- `--no-verify-jwt` em **todos** os 7 deploys (Consent usa `X-AgeKey-API-Key`, não JWT Supabase).
- **Nenhum** deploy de função `safety-*`.
- **Nenhum** deploy de função Core (estas já estão em PROD desde Phase 1).

### 2.4. Validação pós-deploy (via MCP)

```python
mcp__list_edge_functions(project_id="tpdiccnmsnjtjwhardij")
```

Confirmar:
- 7 novas funções Consent presentes (`parental-consent-*`).
- Cada uma com `verify_jwt: false` ✅
- Cada uma com `version >= 1` (primeiro deploy em PROD).
- `updated_at` recente.
- 19 Core inalteradas.
- 0 funções `safety-*`.

---

## Fase 3 — Feature flags

### 3.1. Smoke pré-ativação (com flag OFF)

```bash
# Esperado: HTTP 503 com reason_code SYSTEM_INVALID_REQUEST
curl -i -H "X-AgeKey-API-Key: <key piloto PROD>" \
     -H "Content-Type: application/json" \
     -d '{"application_slug":"<slug>","policy_slug":"<slug>","child_ref_hmac":"<hash>","resource":"smoke"}' \
     "https://tpdiccnmsnjtjwhardij.functions.supabase.co/parental-consent-session"
```

Confirma que módulo está plumbed mas defensivamente desativado.

### 3.2. Habilitar feature flag Consent

Dashboard Supabase → Settings → Edge Functions → Environment variables → Adicionar:

```
AGEKEY_PARENTAL_CONSENT_ENABLED = true
```

⚠ A env var só é lida no boot dos workers. Para forçar reciclagem rápida, fazer **deploy noop** de uma das 7 funções (ex.: `parental-consent-session`) — Supabase recicla os workers no próximo invocation.

### 3.3. Flags que **devem permanecer** OFF/ausentes em PROD

| Flag | Estado | Razão |
|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | NÃO setar | Retornaria OTP em cleartext — proibido em PROD |
| `AGEKEY_SAFETY_ENABLED` | NÃO setar / OFF | Safety fora desta janela |
| Flag SD-JWT VC real (futuro) | OFF | Adapter `vc` continua stub canônico |
| Flag gateway real (futuro) | OFF | Sem gateways novos |
| ZKP real (futuro) | OFF | Adapter `zkp` continua stub canônico |
| `SAFETY_CRON_SECRET` | NÃO setar | Sem Safety, sem cron Safety |

### 3.4. Critério de avanço para Fase 4

- ✅ Smoke pré-ativação retornou 503 com reason_code esperado.
- ✅ Flag `AGEKEY_PARENTAL_CONSENT_ENABLED=true` setada.
- ✅ Provider OTP real configurado.
- ✅ Workers reciclados (deploy noop ou tempo).
- ✅ Flags proibidas confirmadas como OFF/ausentes.

---

## Fase 4 — Smoke tests PROD (pós-ativação)

### 4.1. Pré-condições

- Fase 3 completa.
- Tenant API key piloto disponível para o operador.
- Operador tem acesso a um contato real (e-mail/SMS) para receber OTP.

### 4.2. Smoke completo

⚠ **Diferenças críticas PROD vs HML**:
- `dev_otp` **não vai aparecer** na resposta (DEV_RETURN_OTP off).
- O OTP é enviado **realmente** via provider para o `DEV_CONTACT_VALUE`.
- O contato deve ser do operador, não fictício.
- Após confirmar com OTP, **revogar imediatamente** o token (Step 7).

```bash
export BASE_URL=https://tpdiccnmsnjtjwhardij.functions.supabase.co
export TENANT_API_KEY=<chave piloto PROD — nunca commit>
export APPLICATION_SLUG=<slug do tenant piloto>
export POLICY_SLUG=<policy de PROD>
export CHILD_REF_HMAC=$(printf 'smoke-prod-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
export DEV_CONTACT_VALUE="<contato real do operador>"
export CONTACT_CHANNEL="email"  # ou "sms" conforme provider

bash scripts/smoke/consent-smoke.sh
```

### 4.3. Steps esperados

| # | Endpoint | Esperado em PROD |
|---|---|---|
| 1 | `parental-consent-session` | HTTP 200, consent_request_id, guardian_panel_token |
| 2 | `session-get/<id>?token=…` | HTTP 200, status=awaiting_guardian |
| 3 | `text-get/<id>?token=…` | HTTP 200, text_body + text_hash |
| 4 | `guardian-start/<id>` | HTTP 200, guardian_verification_id, contact_masked, **dev_otp = null** |
| (manual) | Operador pega o OTP recebido por email/SMS | aguardar provider real |
| 5 | `confirm/<id>` (com OTP real) | HTTP 200, parental_consent_id, token.jwt |
| 6 | `token-verify` (positivo) | HTTP 200, valid=true, revoked=false |
| 7 | `revoke/<parental_consent_id>` | HTTP 200, revoked_at |
| 8 | `token-verify` (pós-revoke) | HTTP 200, valid=false, revoked=true, reason_code=TOKEN_REVOKED |

### 4.4. Checagens manuais obrigatórias

- ❌ Nenhuma resposta contém email/telefone/CPF/RG/birthdate em **claro**.
- ✅ `contact_masked` retornado em guardian-start (ex.: `o***@operadora.com`).
- ❌ JWT decodificado **não** contém birthdate/email/child_ref em claro.
- ✅ `decision_envelope.content_included = false`, `pii_included = false`.
- ✅ Em `audit_events_<partição_atual>`: registros novos por cada operação.
- ✅ Logs Edge Function: zero stack trace inesperado.

### 4.5. Cleanup pós-smoke

- ⚠ Revogar manualmente qualquer token ainda ativo se step 7 falhou.
- Considerar **não** apagar a row de `parental_consent_requests` criada (auditoria); deixar expirar.

### 4.6. Rollback se falhar

- Se algum step retornar 5xx ou comportamento inesperado: **acionar Fase 5.1** (rollback rápido via flag) imediatamente.
- Coletar logs antes do rollback (URL, status, body, trace_id).
- Investigar fora da janela.

### 4.7. Critério de avanço para Fase 5

- ✅ 8/8 steps passaram.
- ✅ Privacidade preservada.
- ✅ Audit/logs OK.

---

## Fase 5 — Pós-release

### 5.1. Monitoramento intenso (T+0 a T+72h)

**Edge Functions logs** (Dashboard Supabase PROD):

- Filtrar por `parental-consent-*`.
- Esperado: maioria HTTP 200; HTTP 503 só se clientes não-piloto chamarem (e a app cliente não tiver flag de feature client-side).
- 4xx aceitáveis: 401 (chave inválida), 400 (payload inválido), 403 (token expirado).
- **5xx é vermelho** — investigar imediatamente.

**Database logs**:

- Latência média de queries em `parental_consent_*`. Spike anormal sugere índice ausente ou rate limit estourado.

**Audit events**:

- `audit_events_<partição_atual>` cresce com volume esperado de tráfego piloto.

**Webhooks**:

- `webhooks-worker` execution_time e success rate.

### 5.2. Janela de observação

- **T+0 a T+1h**: operador no console, monitora logs em tempo real.
- **T+1h a T+24h**: checagem horária.
- **T+24h a T+72h**: checagem 2x/dia.
- **T+72h+**: ritmo normal.

### 5.3. Incident rollback

#### 5.3.1. Rollback **rápido** (recomendado)

```
Dashboard Supabase PROD → Settings → Edge Functions → Environment variables
→ Editar AGEKEY_PARENTAL_CONSENT_ENABLED para "false" (ou deletar)
→ Salvar
```

- Workers reciclam em ~30s.
- 7 funções Consent voltam a responder `503 ServiceUnavailableError`.
- Tráfego de Consent é interrompido sem perda.
- Tempo: < 2 minutos.

#### 5.3.2. Rollback de função específica

- Dashboard Supabase → Edge Functions → "Restore" versão anterior.

#### 5.3.3. ⛔ Rollback de migrations — **não automático**

- Reverter exige `DROP TABLE` cascata → perde dados.
- Sob aprovação produto/legal + DBA on-call.

### 5.4. Comunicação de rollback

- Notificar tenant(s) piloto.
- Atualizar status page.
- Postmortem dentro de 48h.

### 5.5. Relatório final

Criar `docs/audit/prod-consent-mvp-release-execution-report.md` (após a janela) contendo:

- Data/hora UTC da janela.
- Commit `main` no momento.
- Migrations aplicadas (versions registradas).
- Edge Functions deployadas (slugs + versions).
- Resultado dos 8 steps de smoke.
- Métricas T+72h.
- Incidentes (se houver).
- Decisão sobre próximas janelas (Safety, retention cron 028, etc.).

---

## Anexo A — Lista negativa absoluta

⛔ **NUNCA** executar nesta janela:

- `supabase db push` (usar `mcp__apply_migration`)
- `supabase migration repair`
- `supabase db reset`
- `supabase db pull`
- Aplicar migrations Safety (024-027)
- Aplicar migration 029 sem cherry-pick (referencia tabelas Safety)
- Setar `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` em PROD
- Usar provider OTP `noop` em PROD
- Disparar workflow `Deploy HML Edge Functions` (hardcoded para HML)
- Tocar em qualquer função `safety-*` ou `core` (Core já está em produção e estável)
- Habilitar SD-JWT VC real, gateway real ou ZKP real

## Anexo B — Variáveis críticas a confirmar antes do deploy

| Var | Origem | Uso |
|---|---|---|
| `tpdiccnmsnjtjwhardij` | Project ref PROD | hardcoded em todos os comandos PROD |
| `wljedzqgprkpqhuazdzv` | Project ref HML | **NÃO usar nesta janela** |
| `f4ddcb91` ou descendente | commit `main` | base de deploy |
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | flag | OFF até Fase 3.2 |
| `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` | provider real (não `noop`) | exige configuração antes |

## Anexo C — Contatos / responsabilidades

| Papel | Pessoa | Quando aciona |
|---|---|---|
| Operador da janela | (nome) | Executa Fases 1-4 |
| Aprovador legal/produto | (nome) | Memo §13 + go/no-go |
| Plantão DBA | (nome) | Se Fase 5.3.3 (rollback de migration) |
| Comunicação tenant | (nome) | Antes/durante/após |
