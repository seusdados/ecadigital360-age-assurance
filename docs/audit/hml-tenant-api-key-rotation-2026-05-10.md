# HML — Terceira rotação da TENANT_API_KEY da application `dev-app`

> **Status**: ✅ Concluído. Apenas `api_key_hash` + `api_key_prefix` + `updated_at` da application `dev-app` em HML foram modificados. Nenhum outro registro alterado. PROD intocada.
>
> Ambiente: HML apenas (`wljedzqgprkpqhuazdzv`). PROD (`tpdiccnmsnjtjwhardij`) intocada.
> Data da rotação: 2026-05-10 13:00:27 UTC.
> Autor: Claude Code com autorização explícita do operador.
> Branch: `claude/hml-tenant-api-key-rotation-2026-05-10`.

## 1. Motivação — chave anterior comprometida

A `TENANT_API_KEY` rotacionada em PR #68 (2026-05-09 20:23 UTC, hash começando `6a9edf77…`) **foi exposta novamente em log/chat** durante o ciclo de smokes. Conforme orientação do operador, a chave anterior é tratada como comprometida e rotacionada antes de qualquer novo smoke.

Este relatório registra **apenas o ato da rotação** — não inclui a raw key (que ficou exclusivamente com o operador) nem o trecho exato de log onde a exposição ocorreu (para evitar amplificar a exposição).

## 2. Modelo de segurança da rotação

Procedimento idêntico aos PRs #65 e #68:

| Etapa | Quem | Onde | O que viu / não viu |
|---|---|---|---|
| 1. Gerar raw key (`ak_test_<32 b64url>`) | Operador | terminal local | **Apenas o operador** vê a raw key |
| 2. Computar SHA-256 hex da raw | Operador | terminal local | Hash deriva da raw |
| 3. Computar prefix (`ak_test_<6 chars>…`) | Operador | terminal local | Prefix é display-safe |
| 4. Salvar raw em password manager | Operador | offline | Raw nunca trafega em rede |
| 5. Enviar `HASH` + `PREFIX` ao Claude | Operador → Claude | mensagem da sessão | Claude **nunca** vê a raw |
| 6. Executar UPDATE no DB | Claude (MCP `execute_sql`) | HML | Apenas o hash/prefix entram no DB |

A nova raw key:
- ❌ **Não** está em nenhum log, audit, commit, PR, comentário ou texto deste relatório.
- ❌ **Não** está em nenhuma resposta de Edge Function (essas só fazem hash da header recebida).
- ❌ **Não** será derivável do hash (SHA-256 é one-way).
- ✅ Está apenas no password manager / cofre do operador.

A raw key **anterior** (rotacionada em PR #68, hash `6a9edf77…`) foi exposta acidentalmente. Esta rotação a invalida: qualquer request com a raw antiga agora retorna 401 em `authenticateApiKey`.

## 3. SQL executado

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

**Garantias aplicadas pelos filtros**:

- `WHERE id = ...` → linha única.
- `AND tenant_id = ...` → defesa adicional contra colisão de UUID.
- `AND deleted_at IS NULL` → não ressuscita registro soft-deleted.
- `RETURNING ...` → confirma execução e retorna apenas campos não sensíveis.

**Colunas escritas**: somente `api_key_hash`, `api_key_prefix`, `updated_at`.

**Colunas/registros NÃO tocados**:
- ❌ Outras applications: zero (validação `other_apps_unchanged = 0`).
- ❌ `applications.id`, `slug`, `tenant_id`, `status`, `deleted_at`, `webhook_secret_hash`, `allowed_origins`, etc. inalterados.
- ❌ Nenhuma outra tabela.
- ❌ Nenhuma migration, RLS, role, function, view, trigger, seed alterados.
- ❌ Nenhuma feature flag.

## 4. Estado pós-rotação (validado via SELECT read-only)

| Campo | Valor | Status |
|---|---|---|
| `id` | `019de8cd-d298-74f0-a029-f4258242baf1` | ✅ inalterado |
| `slug` | `dev-app` | ✅ inalterado |
| `status` | `active` | ✅ inalterado |
| `api_key_prefix` | `ak_test_Yjxma_…` | ✅ atualizado |
| `api_key_hash_first8` | `e37743cd` | ✅ corresponde ao hash fornecido pelo operador |
| `tenant_id` | `019de8cd-d297-7db2-8f50-3ab5724d1645` | ✅ inalterado |
| `deleted_at` | `NULL` | ✅ ativo |
| `updated_at` | `2026-05-10 13:00:27.884234+00` | ✅ refletindo a rotação |

**Sanity check global**:

- `total_active_apps` em HML = **1** (somente `dev-app`).
- `other_apps_unchanged` = **0** (não havia outras; UPDATE não alcançou ninguém além do alvo).

## 5. Cronologia consolidada das rotações da `dev-app` em HML

| # | Quando (UTC) | Origem | `api_key_prefix` | `api_key_hash_first8` | Razão |
|---|---|---|---|---|---|
| 0 | 2026-05-02 13:08 | bootstrap inicial | `ak_dev_sk_test_` | `5bc6ad13` | criação do tenant |
| 1 | 2026-05-09 12:19 | PR #65 (UPDATE SQL) | `ak_test_jGJdoB…` | `1624f0d2` | raw original perdida |
| 2 | 2026-05-09 20:23 | PR #68 (UPDATE SQL) | `ak_test_dp3nVZ…` | `6a9edf77` | raw da rotação #1 exposta |
| 3 | 2026-05-10 13:00 | esta operação (UPDATE SQL) | `ak_test_Yjxma_…` | `e37743cd` | raw da rotação #2 exposta |

Cada UPDATE invalida o hash anterior. Em qualquer momento existe **exatamente uma** raw key válida, custodiada pelo operador.

## 6. Confirmações de não-ação

- ❌ **PROD intocada.** Zero chamadas MCP contra `tpdiccnmsnjtjwhardij`. Único projeto acessado: HML (`wljedzqgprkpqhuazdzv`).
- ❌ Nenhum `supabase db push`.
- ❌ Nenhum `supabase migration repair`.
- ❌ Nenhum `supabase db reset`.
- ❌ Nenhum `supabase db pull`.
- ❌ Nenhuma alteração de schema (DDL).
- ❌ Nenhuma alteração de migrations.
- ❌ Nenhuma alteração de RLS policies, GRANTs, roles.
- ❌ Nenhuma alteração de feature flags ou env vars do projeto.
- ❌ Nenhuma alteração em outra application.
- ❌ Nenhum deploy de Edge Function executado.
- ❌ Nenhum disparo do workflow `Deploy HML Edge Functions`.
- ❌ Nenhum smoke test executado (operador rodará localmente).
- ✅ Apenas: 1 UPDATE atômico em 3 colunas de 1 linha em `public.applications` em HML.
- ✅ Apenas leituras subsequentes para verificação (SELECT read-only).
- ✅ Raw key gerada e custodiada **exclusivamente** pelo operador, em local offline.

## 7. Próximos passos do operador

Com a nova `TENANT_API_KEY` na sua posse, e:
- Bug A resolvido (env var `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` propagada via redeploy GHA hoje 12:45 UTC).
- Bug B resolvido (PR #73 com fix `activated_at` em `parental-consent-token-verify`).
- Migration 031 aplicada (vault.create_secret).
- 14/14 funções com `verify_jwt: false`.

```bash
# Local terminal apenas (nunca commit)
export BASE_URL=https://wljedzqgprkpqhuazdzv.functions.supabase.co
export TENANT_API_KEY=<a raw key que você guardou no password manager>
export APPLICATION_SLUG=dev-app
export POLICY_SLUG=dev-13-plus
export CHILD_REF_HMAC=$(printf 'smoke-child-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
export ACTOR_REF_HMAC=$(printf 'smoke-actor-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
export DEV_CONTACT_VALUE="smoke+test@example.com"

bash scripts/smoke/consent-smoke.sh
bash scripts/smoke/safety-smoke.sh
```

Esperado pós-fix end-to-end:

| Step | Endpoint | Esperado |
|---|---|---|
| 1 | `parental-consent-session` | HTTP 200 (já passava) |
| 2 | `session-get/<id>?token=…` | HTTP 200 (já passava) |
| 3 | `text-get/<id>?token=…` | HTTP 200 (já passava) |
| 4 | `guardian-start/<id>` | **HTTP 200** com `dev_otp` ✅ (Bug A destravado) |
| 5 | `confirm/<id>` | HTTP 200 com `parental_consent_id`, `token.jwt` ✅ |
| 6 | `token-verify` (positivo) | **HTTP 200** com `valid: true` ✅ (Bug B destravado) |
| 7 | `revoke/<parental_consent_id>` | HTTP 200, `revoked_at` |
| 8 | `token-verify` pós-revoke | HTTP 200 com `valid: false`, `revoked: true`, `reason_code: TOKEN_REVOKED` |

Cuidados de segurança operacional:
- Nunca cole a raw key em chat, IM, e-mail, comentário de PR, output renderizado.
- `unset TENANT_API_KEY` ao final da sessão de terminal.
- Revisar `history` do shell e remover linha que contenha a raw key, se houver.
- Considere armazenar em um arquivo `.env` com permissão `chmod 600` no diretório local não-commitado.

## 8. Hashes de auditoria

| Item | Valor (truncado) | Significado |
|---|---|---|
| Hash novo (first 8) | `e37743cd` | SHA-256 da nova raw key — gravado em DB |
| Prefix novo | `ak_test_Yjxma_…` | Display em painel; primeiros 14 chars + `…` |
| Hash invalidado pela rotação anterior (PR #68) | `6a9edf77` | exposto em log/chat — agora **invalidado** |
| `updated_at` desta rotação | `2026-05-10 13:00:27.884234+00` | Timestamp |
| HML project ref | `wljedzqgprkpqhuazdzv` | Único alvo |
| PROD project ref | `tpdiccnmsnjtjwhardij` | **Não tocado** |
| `application_id` | `019de8cd-d298-74f0-a029-f4258242baf1` | Único alvo |
| `tenant_id` | `019de8cd-d297-7db2-8f50-3ab5724d1645` | Tenant `dev` |
