# HML — Aplicação da migration `031_fix_guardian_contacts_store`

> **Status**: ✅ Aplicada com sucesso em HML em 2026-05-09 22:29:48 UTC. Validada via `pg_proc` + `has_function_privilege` + `list_migrations`. PROD intocada.
>
> Project ref: `wljedzqgprkpqhuazdzv` (HML).
> Commit `main` na hora da aplicação: `79f7179f12b2aa7ce2371236d9d9ef4c3741489b`.
> Migration: `supabase/migrations/031_fix_guardian_contacts_store.sql`.
> Versão registrada em `supabase_migrations.schema_migrations`: `20260509222948` (nome: `031_fix_guardian_contacts_store`).
> Método de aplicação: `mcp__apply_migration` (registra entrada em `schema_migrations`).

## 1. Contexto

PR #70 mergeado em main (`79f7179f`) introduziu a migration 031 corrigindo o caminho de armazenamento de contato do responsável em `public.guardian_contacts_store`. Esta operação aplica essa migration **somente em HML**, sob autorização explícita do operador.

## 2. SQL aplicado

Mesmo conteúdo de `supabase/migrations/031_fix_guardian_contacts_store.sql`:

```sql
CREATE OR REPLACE FUNCTION public.guardian_contacts_store(
  p_consent_request_id uuid,
  p_contact_value      text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id  uuid;
  v_contact_id uuid;
BEGIN
  v_secret_id := vault.create_secret(
    new_secret      => p_contact_value,
    new_name        => 'parental_consent.' || p_consent_request_id::text,
    new_description => 'AgeKey parental consent guardian contact (encrypted at rest).'
  );

  UPDATE guardian_contacts
     SET vault_secret_id = v_secret_id,
         updated_at      = now()
   WHERE consent_request_id = p_consent_request_id
   RETURNING id INTO v_contact_id;

  RETURN v_secret_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guardian_contacts_store(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.guardian_contacts_store(uuid, text) TO service_role;

COMMENT ON FUNCTION public.guardian_contacts_store(uuid, text) IS
  'Stores guardian contact in Supabase Vault using vault.create_secret(), avoiding direct INSERT into vault.secrets and pgsodium internal permission errors. See 031_fix_guardian_contacts_store.';
```

## 3. Motivo da aplicação

Bug de produção em HML detectado pelo operador no `consent-smoke.sh`:

```
endpoint:  parental-consent-guardian-start
status:    500 InternalError
message:   "Vault store failed"
cause:     "permission denied for function _crypto_aead_det_noncegen"
trace_id:  d2209ead-8086-43e7-a5d5-866373e76e83
```

Causa raiz documentada em `docs/audit/hml-guardian-contacts-store-vault-create-secret-fix.md` (PR #70). Resumo: `INSERT INTO vault.secrets` sob `SECURITY DEFINER owned by postgres` aciona pgsodium internals (`vault._crypto_aead_det_noncegen()`, `proacl supabase_admin=X/supabase_admin`) → `postgres` não tem EXECUTE. Fix usa `vault.create_secret()` (API canônica do Vault, SECURITY DEFINER owned by `supabase_admin`).

## 4. Validação BEFORE / AFTER

### 4.1. Body da função

**BEFORE** (capturado pré-aplicação via `pg_get_functiondef`):

```sql
INSERT INTO vault.secrets (name, description, secret)
VALUES (
  'parental_consent.' || p_consent_request_id::text,
  'AgeKey parental consent guardian contact (encrypted at rest).',
  p_contact_value
)
RETURNING id INTO v_secret_id;
```

**AFTER** (capturado pós-aplicação):

```sql
v_secret_id := vault.create_secret(
  new_secret      => p_contact_value,
  new_name        => 'parental_consent.' || p_consent_request_id::text,
  new_description => 'AgeKey parental consent guardian contact (encrypted at rest).'
);
```

✅ Body trocado. Resto da função (`UPDATE guardian_contacts`, `RETURN`) preservado.

### 4.2. Comment da função

| Estado | Comment |
|---|---|
| BEFORE | `Cifra contato do responsável em vault.secrets.` |
| AFTER | `Stores guardian contact in Supabase Vault using vault.create_secret(), avoiding direct INSERT into vault.secrets and pgsodium internal permission errors. See 031_fix_guardian_contacts_store.` |

### 4.3. Privilégios

| Verificação | Resultado |
|---|---|
| `has_function_privilege('public', 'public.guardian_contacts_store(uuid,text)', 'EXECUTE')` | **false** ✅ (PUBLIC sem execute) |
| `has_function_privilege('service_role', 'public.guardian_contacts_store(uuid,text)', 'EXECUTE')` | **true** ✅ |
| `proacl` raw (preservada de 021 + `REVOKE PUBLIC` + `GRANT service_role` re-aplicados) | `postgres=X/postgres \| anon=X/postgres \| authenticated=X/postgres \| service_role=X/postgres` |

Nota: as entradas explícitas `anon=X` e `authenticated=X` foram herdadas de migration 021 (provavelmente via default privileges Supabase). A migration 031 não as toca — manteve idempotência. O critério de validação do operador ("PUBLIC sem execute; service_role com execute") é satisfeito conforme `has_function_privilege` acima.

### 4.4. Registro em `supabase_migrations.schema_migrations`

Última entrada via `list_migrations`:

```
{"version":"20260509222948","name":"031_fix_guardian_contacts_store"}
```

✅ Registrada como migration versionada (não SQL ad-hoc).

### 4.5. Sanity check de dados (read-only)

| Métrica | Valor pós-aplicação |
|---|---|
| `applications` (active) | 1 |
| `parental_consent_requests` (tenant dev) | 5 |
| `guardian_contacts` (tenant dev) | 1 |
| `safety_rules` (tenant dev + global) | 6 |

Valores compatíveis com smoke runs anteriores (1 dev-app, 4 consent_requests prévias do smoke + 1 da última execução, 1 guardian_contact criado no smoke, 5 seed safety_rules + 1 override do smoke). **Nenhuma alteração inesperada de dados.**

## 5. Rollback (somente se a função quebrar)

```sql
-- HML only. Reaplica o body de migration 021. Re-introduz o bug —
-- usar APENAS se a versão nova produzir regressão real.
CREATE OR REPLACE FUNCTION public.guardian_contacts_store(
  p_consent_request_id uuid,
  p_contact_value      text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id  uuid;
  v_contact_id uuid;
BEGIN
  INSERT INTO vault.secrets (name, description, secret)
  VALUES (
    'parental_consent.' || p_consent_request_id::text,
    'AgeKey parental consent guardian contact (encrypted at rest).',
    p_contact_value
  )
  RETURNING id INTO v_secret_id;

  UPDATE guardian_contacts
     SET vault_secret_id = v_secret_id,
         updated_at = now()
   WHERE consent_request_id = p_consent_request_id
   RETURNING id INTO v_contact_id;

  RETURN v_secret_id;
END;
$$;
```

## 6. Confirmações de não-ação

- ❌ **PROD intocada.** Zero chamadas MCP contra `tpdiccnmsnjtjwhardij`. Único projeto acessado: HML (`wljedzqgprkpqhuazdzv`).
- ❌ Nenhum `supabase db push`.
- ❌ Nenhum `supabase migration repair`.
- ❌ Nenhum `supabase db reset`.
- ❌ Nenhum `supabase db pull`.
- ❌ Nenhuma migration aplicada além da 031.
- ❌ Nenhuma alteração em feature flags.
- ❌ Nenhuma alteração em RLS policies.
- ❌ Nenhuma alteração em dados de negócio.
- ❌ Nenhum redeploy de Edge Function.
- ❌ Nenhum disparo de workflow.
- ❌ Nenhum `GRANT EXECUTE` em `vault._crypto_aead_det_noncegen()` ou outras funções internas de `vault`/`pgsodium`.
- ❌ Nenhuma alteração em schema `vault` ou `pgsodium`.
- ❌ Nenhum smoke test executado pós-aplicação (operador rodará localmente após autorização).
- ❌ TENANT_API_KEY, guardian token, secrets ou contatos não expostos.
- ✅ Apenas: 1 `mcp__apply_migration` no projeto HML + leituras `pg_proc`/`has_function_privilege`/`list_migrations` para validação + escrita deste relatório.

## 7. Recomendação para novo smoke test de Consent

Quando você autorizar:

```bash
# Ambiente local (mesmas vars dos smokes anteriores):
export BASE_URL=https://wljedzqgprkpqhuazdzv.functions.supabase.co
export TENANT_API_KEY=<sua raw key — nunca commit>
export APPLICATION_SLUG=dev-app
export POLICY_SLUG=dev-13-plus
export CHILD_REF_HMAC=$(printf 'smoke-child-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
export DEV_CONTACT_VALUE="smoke+test@example.com"

bash scripts/smoke/consent-smoke.sh
```

Esperado pós-031:

| Etapa | Esperado |
|---|---|
| 1. `parental-consent-session` | HTTP 200 (já validado) |
| 2. `parental-consent-session-get/<id>?token=…` | HTTP 200 (já validado) |
| 3. `parental-consent-text-get/<id>?token=…` | HTTP 200 (já validado) |
| 4. `parental-consent-guardian-start/<id>` | **HTTP 200** ✅ (esperado destravar) com `consent_request_id`, `guardian_verification_id`, `contact_masked`, `dev_otp` |
| 5. `parental-consent-confirm/<id>` | HTTP 200 com `parental_consent_id`, `token.jwt` |
| 6. `parental-consent-token-verify` (positivo) | HTTP 200 com `valid=true`, `revoked=false` |
| 7. `parental-consent-revoke/<parental_consent_id>` | HTTP 200, `revoked_at` |
| 8. `parental-consent-token-verify` pós-revoke | HTTP 200, `valid=false`, `revoked=true`, `reason_code=TOKEN_REVOKED` |

**Atenção**: o operador relatou também que `parental-consent-token-verify` com token inválido retornou `InternalError` (trace_id `f12df505-e79d-47a8-9fce-c22e0ebb0471`) — bug separado, não tratado nesta migration. Será diagnóstico/PR específico em sequência.

## 8. Plano para PROD

A migration 031 ainda **não** deve ser aplicada em PROD nesta janela. Recomendação:

1. Rodar `consent-smoke.sh` em HML (passo 7 acima).
2. Confirmar 4-8 verdes.
3. Operador autoriza janela específica para PROD (`tpdiccnmsnjtjwhardij`) com mesmo procedimento (`mcp__apply_migration`, mesmo SQL).
4. Validação pós-PROD análoga à de HML.

Pré-condição PROD: o módulo Consent ainda **não** está habilitado em PROD (Phase 1 only). A migration 031 é defensiva: aplicada antes da habilitação evita que o bug volte a aparecer quando Consent ativar.

## 9. Hashes / referências

| Item | Valor |
|---|---|
| trace_id original | `d2209ead-8086-43e7-a5d5-866373e76e83` |
| Migration aplicada | `031_fix_guardian_contacts_store` |
| Versão registrada | `20260509222948` |
| Data/hora aplicação (UTC) | 2026-05-09 22:29:48 |
| Commit `main` na hora | `79f7179f12b2aa7ce2371236d9d9ef4c3741489b` |
| HML project ref | `wljedzqgprkpqhuazdzv` |
| PROD project ref | `tpdiccnmsnjtjwhardij` — **não tocado** |
| PR de origem | #70 (`fix(consent): replace INSERT INTO vault.secrets with vault.create_secret in guardian_contacts_store`) |
| Padrão de referência | `016_vault_create_secret.sql` |
