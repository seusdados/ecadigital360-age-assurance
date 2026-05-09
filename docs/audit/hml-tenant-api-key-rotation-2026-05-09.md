# HML — Rotação da TENANT_API_KEY da application `dev-app`

> **Status**: ✅ Concluído. Apenas `api_key_hash` + `api_key_prefix` + `updated_at` da application `dev-app` em HML foram modificados. Nenhum outro registro alterado. PROD intocada.
>
> Ambiente: HML apenas (`wljedzqgprkpqhuazdzv`). PROD (`tpdiccnmsnjtjwhardij`) intocada.
> Data da rotação: 2026-05-09 12:19:05 UTC.
> Autor da operação: Claude Code (com autorização explícita do operador na sessão).
> Branch: `claude/hml-tenant-api-key-rotation-2026-05-09`.

## 1. Contexto

A raw `TENANT_API_KEY` da `dev-app` em HML, gerada em 2026-05-02 pelo bootstrap inicial, foi perdida (não saiu do retorno único do `tenant-bootstrap`). Como `applications.api_key_hash` armazena apenas o SHA-256 da raw (`supabase/functions/_shared/auth.ts`, `supabase/migrations/001_tenancy.sql:77`), **não havia recuperação possível** — somente rotação.

A função `applications-rotate-key` exige uma raw válida no header (chicken-and-egg). Por isso a rotação foi feita via SQL controlado, com a raw key gerada **fora do banco**, no terminal local do operador.

## 2. Modelo de segurança da rotação

| Etapa | Quem | Onde | O que viu / não viu |
|---|---|---|---|
| 1. Gerar raw key (`ak_test_<32 b64url>`) | Operador | terminal local | **Apenas o operador** vê a raw key |
| 2. Computar SHA-256 hex da raw | Operador | terminal local | Hash deriva da raw |
| 3. Computar prefix (`ak_test_<6 chars>…`) | Operador | terminal local | Prefix é display-safe |
| 4. Salvar raw em password manager | Operador | offline | Raw nunca trafega em rede comigo |
| 5. Enviar `HASH` + `PREFIX` ao Claude | Operador → Claude | mensagem da sessão | Claude **nunca** vê a raw |
| 6. Executar UPDATE no DB | Claude (MCP `execute_sql`) | HML | Apenas o hash/prefix entram no DB |

A raw key:
- ❌ **Não** está em nenhum log, audit, commit, PR, comentário ou texto deste relatório.
- ❌ **Não** está em nenhuma resposta de Edge Function (essas só fazem hash da header recebida).
- ❌ **Não** será derivável do hash (SHA-256 é one-way).
- ✅ Está apenas no password manager / cofre do operador.

## 3. SQL executado (texto exato)

```sql
UPDATE public.applications
SET
  api_key_hash   = '<HASH_FORNECIDO_PELO_OPERADOR>',  -- 64 hex chars (SHA-256)
  api_key_prefix = '<PREFIX_FORNECIDO_PELO_OPERADOR>',
  updated_at     = now()
WHERE id        = '019de8cd-d298-74f0-a029-f4258242baf1'
  AND tenant_id = '019de8cd-d297-7db2-8f50-3ab5724d1645'
  AND deleted_at IS NULL
RETURNING id, slug, api_key_prefix, status;
```

**Garantias de escopo aplicadas pelos filtros**:

- `WHERE id = ...` → linha única, application `dev-app`.
- `AND tenant_id = ...` → defesa adicional contra colisão de UUID.
- `AND deleted_at IS NULL` → não ressuscita registro soft-deleted.
- `RETURNING ...` → confirma execução e retorna apenas campos não sensíveis.

**Colunas escritas**: somente `api_key_hash`, `api_key_prefix`, `updated_at` (esta última pelo `now()` explícito; também tem trigger em algumas instalações, mas o explicit set garante o valor mesmo sem trigger).

**Colunas/registros NÃO tocados**:

- ❌ Outras applications: zero (validação separada `other_apps_unchanged = 0`).
- ❌ `applications.id`, `slug`, `tenant_id`, `status`, `deleted_at`, `webhook_secret_hash`, `allowed_origins`, etc. inalterados.
- ❌ Nenhuma outra tabela (zero JOIN/CTE/UPDATE secundário).
- ❌ Nenhuma migration, RLS, role, function, view, trigger, seed alterado.
- ❌ Nenhuma feature flag.

## 4. Estado pós-rotação (validado via SELECT read-only)

| Campo | Valor | Status |
|---|---|---|
| `id` | `019de8cd-d298-74f0-a029-f4258242baf1` | ✅ inalterado |
| `slug` | `dev-app` | ✅ inalterado |
| `status` | `active` | ✅ inalterado |
| `api_key_prefix` | `ak_test_jGJdoB…` | ✅ atualizado (novo prefix do formato `ak_test_*`) |
| `api_key_hash_first8` | `1624f0d2` | ✅ corresponde ao hash fornecido pelo operador |
| `tenant_id` | `019de8cd-d297-7db2-8f50-3ab5724d1645` | ✅ inalterado |
| `deleted_at` | `NULL` | ✅ ativo |
| `updated_at` | `2026-05-09 12:19:05.074935+00` | ✅ refletindo a rotação |

**Sanity check global**:

- `total_active_apps` em HML = **1** (somente `dev-app`).
- `other_apps_unchanged` = **0** (não havia outras; UPDATE não alcançou ninguém além do alvo).

## 5. Comparativo BEFORE/AFTER

| Campo | BEFORE (2026-05-02 → 2026-05-09) | AFTER (2026-05-09 12:19 UTC) |
|---|---|---|
| `api_key_prefix` | `ak_dev_sk_test_` (formato bootstrap custom) | `ak_test_jGJdoB…` (formato `credentials.ts`) |
| `api_key_hash_first8` | `5bc6ad13` | `1624f0d2` |
| `status` | `active` | `active` |
| `slug` | `dev-app` | `dev-app` |

A chave antiga (cujo hash começava com `5bc6ad13`) está **invalidada**: qualquer request com a raw key antiga (que ninguém tem) agora retornaria 401 em `authenticateApiKey`.

## 6. Confirmações de não-ação

- ❌ **PROD intocada.** Zero chamadas MCP contra `tpdiccnmsnjtjwhardij`. Único projeto acessado: HML (`wljedzqgprkpqhuazdzv`).
- ❌ Nenhum `supabase db push`.
- ❌ Nenhum `supabase migration repair`.
- ❌ Nenhum `supabase db reset`.
- ❌ Nenhum `supabase db pull`.
- ❌ Nenhuma alteração de schema (DDL).
- ❌ Nenhuma alteração de migrations (nenhum arquivo `supabase/migrations/*.sql` modificado).
- ❌ Nenhuma alteração de RLS policies, GRANTs, roles.
- ❌ Nenhuma alteração de feature flags ou env vars do projeto.
- ❌ Nenhuma alteração em outra application (zero linhas afetadas fora do alvo).
- ❌ Nenhum deploy de Edge Function executado.
- ❌ Nenhum disparo do workflow `Deploy HML Edge Functions`.
- ✅ Apenas escrita: 1 UPDATE atômico em 3 colunas (`api_key_hash`, `api_key_prefix`, `updated_at`) de 1 linha em `public.applications`.
- ✅ Apenas leituras subsequentes para verificação (SELECT read-only).
- ✅ Raw key gerada e custodiada **exclusivamente** pelo operador, em local offline (password manager).

## 7. Próximos passos para o operador

Com a nova `TENANT_API_KEY` na sua posse:

```bash
# Configurar variáveis para os smokes (tudo no terminal local; nunca commitar)
export BASE_URL=https://wljedzqgprkpqhuazdzv.functions.supabase.co
export TENANT_API_KEY=<a raw key que você guardou no password manager>
export APPLICATION_SLUG=dev-app
export POLICY_SLUG=dev-13-plus
export CHILD_REF_HMAC=$(printf 'smoke-child-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
export DEV_CONTACT_VALUE="smoke+test@example.com"

# Smoke 1 — sanity de auth (deve retornar HTTP 200, não 401)
curl -i -H "X-AgeKey-API-Key: $TENANT_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"application_slug":"dev-app","policy_slug":"dev-13-plus","child_ref_hmac":"'"$CHILD_REF_HMAC"'","resource":"feature/social-feed"}' \
     "$BASE_URL/parental-consent-session"

# Smokes completos (já em main)
bash scripts/smoke/consent-smoke.sh
bash scripts/smoke/safety-smoke.sh
bash scripts/smoke/core-smoke.sh
```

Após rodar:

- Se sanity retornar 200: ✅ chave nova válida; mitigação `verify_jwt: false` (PR #63) confirmada end-to-end.
- Se 401 com `Invalid api_key`: a raw key não corresponde ao hash gravado — verificar geração local (procedimento §3 da resposta anterior).
- Se 401 com mensagem do Supabase platform: regressão `verify_jwt`; reportar imediatamente.

## 8. Recuperação em caso de perda futura

Se a nova raw key também for perdida:

1. **Não** re-aplicar este SQL com hash diferente sem autorização: cada UPDATE invalida a chave anterior.
2. Repetir o procedimento §3 (gerar nova raw, hash, prefix, autorizar UPDATE).
3. Alternativamente, via UI/painel admin: chamar `applications-rotate-key` com a chave atual ainda válida (preservando o histórico de auditoria do hash).

## 9. Hashes de auditoria

| Item | Valor (truncado) | Significado |
|---|---|---|
| Hash novo (first 8) | `1624f0d2` | SHA-256 da nova raw key — gravado em DB |
| Prefix novo | `ak_test_jGJdoB…` | Display em painel; primeiros 14 chars + `…` |
| `updated_at` | `2026-05-09 12:19:05.074935+00` | Timestamp do UPDATE |
| HML project ref | `wljedzqgprkpqhuazdzv` | Único alvo |
| PROD project ref | `tpdiccnmsnjtjwhardij` | **Não tocado** |
| `application_id` | `019de8cd-d298-74f0-a029-f4258242baf1` | Único alvo |
| `tenant_id` | `019de8cd-d297-7db2-8f50-3ab5724d1645` | Tenant `dev` |
