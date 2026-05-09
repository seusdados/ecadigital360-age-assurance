# HML — Fix do `guardian_contacts_store` para usar `vault.create_secret()`

> **Status**: ✅ Migration `031_fix_guardian_contacts_store.sql` criada em branch `claude/fix-guardian-contacts-store-vault-create-secret`. **Não aplicada em HML ou PROD.** Aguarda CI verde + autorização explícita do operador.
>
> Branch: `claude/fix-guardian-contacts-store-vault-create-secret`
> Migration: `supabase/migrations/031_fix_guardian_contacts_store.sql`

## 1. Contexto

Após PR #66 (DecisionEnvelope offset), PR #65 e PR #68 (rotações TENANT_API_KEY) e PR #67 (smoke contracts), o operador re-rodou `consent-smoke.sh` em HML. As primeiras 3 etapas passaram (`parental-consent-session`, `parental-consent-session-get`, `parental-consent-text-get`). A 4ª etapa falhou com:

```
endpoint:   parental-consent-guardian-start
status:     500 InternalError
message:    "Vault store failed"
cause:      "permission denied for function _crypto_aead_det_noncegen"
trace_id:   d2209ead-8086-43e7-a5d5-866373e76e83
```

## 2. Causa raiz (read-only diagnostics em HML)

### 2.1. Cadeia exata

```
Edge Function parental-consent-guardian-start
  → supabase-js (service_role key) → client.rpc('guardian_contacts_store', ...)
    → public.guardian_contacts_store(uuid, text)   [SECURITY DEFINER, owner=postgres]
      [role efetiva muda para postgres]
      → INSERT INTO vault.secrets (...)
        [vault.secrets tem cifragem por coluna pgsodium]
        → vault._crypto_aead_det_noncegen()
          [proacl: supabase_admin=X/supabase_admin]
          [postgres NÃO tem EXECUTE]
          → ERRO 42501 permission denied
```

### 2.2. Evidência via `pg_proc` / `has_function_privilege`

| Item | Resultado |
|---|---|
| `public.guardian_contacts_store(uuid, text)` owner / security | `postgres` / SECURITY DEFINER |
| `vault._crypto_aead_det_noncegen()` owner / proacl | `supabase_admin` / `supabase_admin=X/supabase_admin` |
| `has_function_privilege('postgres', 'vault._crypto_aead_det_noncegen()', 'EXECUTE')` | **false** |
| `has_function_privilege('supabase_admin', 'vault._crypto_aead_det_noncegen()', 'EXECUTE')` | true |
| `vault.create_secret(text, text, text, uuid)` proacl | `supabase_admin=X/supabase_admin \| postgres=X*/supabase_admin \| service_role=X/supabase_admin` |
| `has_function_privilege('service_role', 'vault.create_secret(text, text, text, uuid)', 'EXECUTE')` | **true** |

### 2.3. Onde o código está hoje

- `supabase/functions/parental-consent-guardian-start/index.ts:163-169` chama `client.rpc('guardian_contacts_store', { p_consent_request_id, p_contact_value })`.
- `supabase/migrations/021_parental_consent_guardian.sql:114-148` define `guardian_contacts_store` com `INSERT INTO vault.secrets (...)` — esse é o caminho que falha.

## 3. Por que GRANT em `_crypto_aead_det_noncegen()` foi rejeitado

A Opção α — `GRANT EXECUTE ON FUNCTION vault._crypto_aead_det_noncegen() TO postgres` — foi formalmente rejeitada pelo operador. Razões objetivas:

1. **Pode não ser suficiente**: vault.secrets aciona uma cadeia de funções pgsodium internas. Destravar uma pode revelar a próxima negação (whack-a-mole).
2. **Toca objeto gerenciado pelo Supabase**: `vault.*` e `pgsodium` internals são propriedade de `supabase_admin` por design; a documentação Supabase recomenda **não** conceder permissões diretas nelas.
3. **Risco de reset em platform upgrade**: ALTER de privilégios em objetos do `supabase_admin` historicamente é reaplicado em upgrades (drift forçado).
4. **Não vira migration limpa**: `GRANT` em `vault.*` viraria drift documentado no repositório, sem garantia de aplicabilidade futura.
5. **Já há padrão validado para o caso correto**: migration `016_vault_create_secret.sql` resolveu o **mesmo** problema em `crypto_keys_store_private` substituindo `INSERT INTO vault.secrets` por `vault.create_secret(...)`. Essa migration está em produção sem incidente.

## 4. Por que `vault.create_secret()` é a correção correta

- API documentada e suportada pelo Supabase para gravação em `vault.secrets`.
- `SECURITY DEFINER` owned by `supabase_admin`, com grants pgsodium internos já configurados.
- Não exige conceder privilégios diretos em objetos de `vault` ou `pgsodium`.
- Mesmo input/output do RPC original — caller não muda.
- Padrão idêntico ao já validado em `016_vault_create_secret.sql` para `crypto_keys_store_private`.
- Sobrevive a platform upgrades sem drift.

## 5. Migration criada (não aplicada)

`supabase/migrations/031_fix_guardian_contacts_store.sql`:

- `CREATE OR REPLACE FUNCTION public.guardian_contacts_store(uuid, text)` — mesma assinatura, mesmo retorno (`uuid`), mesmo `LANGUAGE plpgsql`, mesmo `SECURITY DEFINER`, mesmo `SET search_path = public, vault`.
- Body trocado: `INSERT INTO vault.secrets (...)` → `vault.create_secret(...)`.
- Mantém `UPDATE guardian_contacts SET vault_secret_id = v_secret_id, updated_at = now()`.
- Restaura idempotentemente `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT EXECUTE ... TO service_role`.
- `COMMENT ON FUNCTION` atualizado explicando a correção e citando a migration.

Fora do escopo:
- ❌ Nenhum `GRANT` em `vault._crypto_aead_det_noncegen()` ou qualquer função interna de `vault`/`pgsodium`.
- ❌ Nenhuma alteração em tabelas, dados, RLS, triggers, índices, ou outras funções.
- ❌ Nenhuma alteração em `vault.secrets`, `pgsodium`, ou em qualquer objeto owned by `supabase_admin`.

## 6. Rollback

```sql
-- Reaplica o body original de migration 021 (re-introduz o bug que esta
-- migration corrige; usar apenas se a nova versão produzir regressão
-- inesperada).
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

## 7. Testes / validação executados nesta branch

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | 6/6 ✅ (cached, sem mudança em TypeScript) |
| `pnpm test` | 359/359 ✅ (sem mudança em testes Vitest) |
| `pnpm -r lint` | clean (1 warning a11y pré-existente em `apps/admin`) ✅ |

Nota: a migration é puramente SQL. Não há suíte automatizada de testes para migrations isoladas no monorepo. A validação end-to-end será o re-run de `consent-smoke.sh` em HML após a aplicação.

## 8. Plano de aplicação em HML

> **Aguarda autorização expressa do operador. Sem aplicação automática.**

1. Abrir PR draft a partir desta branch (`claude/fix-guardian-contacts-store-vault-create-secret`).
2. Aguardar 4 checks CI (Typecheck packages/*, Edge Functions Deno tests, Admin Next.js, Vercel Preview Comments).
3. Operador autoriza ready + merge → main avança.
4. Operador autoriza aplicação da migration **somente em HML** (`wljedzqgprkpqhuazdzv`) via `mcp__apply_migration` (preferencial — registra em `supabase_migrations.schema_migrations`) ou `execute_sql` equivalente.
5. Validação pós-aplicação em HML:
   - `pg_proc` confirma novo body da função.
   - Smoke probe: re-rodar `parental-consent-session` (cria nova request + token), `parental-consent-guardian-start/<id>` (sem `Vault store failed`).
   - Observar resposta: `consent_request_id`, `guardian_verification_id`, `contact_masked`, `dev_otp` (HML only). `content_included=false`/`pii_included=false` no decision_envelope.
6. Após HML estável, operador decide janela para PROD em PR/operação separada.

## 9. Confirmações de não-ação

- ❌ **PROD intocada.** Zero chamadas MCP contra `tpdiccnmsnjtjwhardij`.
- ❌ Nenhum `db push`, `migration repair`, `db reset`, `db pull`.
- ❌ Nenhuma alteração de feature flags.
- ❌ Nenhuma alteração de RLS policies.
- ❌ Nenhuma alteração de dados de negócio.
- ❌ Nenhum redeploy de Edge Function.
- ❌ Nenhum disparo de workflow.
- ❌ Nenhum `GRANT EXECUTE` em `vault._crypto_aead_det_noncegen()` ou outras funções internas.
- ❌ Nenhuma alteração em schema `vault` ou `pgsodium`.
- ❌ Migration **não aplicada** ainda em HML — apenas commit no repositório.
- ❌ TENANT_API_KEY, guardian token, secrets ou contatos não expostos.
- ✅ Apenas: 1 arquivo SQL novo em `supabase/migrations/`, este relatório, e leituras `pg_proc` para diagnóstico.
- ✅ `pnpm typecheck`, `pnpm test`, `pnpm -r lint` verdes.

## 10. Hashes / referências

- **trace_id (operador X-Trace-Id) do erro original**: `d2209ead-8086-43e7-a5d5-866373e76e83`
- **Função afetada**: `public.guardian_contacts_store(uuid, text)` v22 do deploy HML
- **Migration de origem do bug**: `021_parental_consent_guardian.sql:114-148`
- **Migration de fix proposta**: `031_fix_guardian_contacts_store.sql`
- **Padrão de referência**: `016_vault_create_secret.sql` (mesma técnica para `crypto_keys_store_private`)
- **HML project ref**: `wljedzqgprkpqhuazdzv`
- **PROD project ref**: `tpdiccnmsnjtjwhardij` — **não tocado**
