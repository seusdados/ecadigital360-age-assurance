# @agekey/integration-tests

Cross-tenant RLS isolation tests for AgeKey. **Skip-friendly** quando variáveis de ambiente não definidas — `pnpm test` no monorepo continua passando 5/5.

## Quando esses tests rodam

Apenas quando TODAS as variáveis abaixo estão setadas:

- `SUPABASE_TEST_URL` (ou `SUPABASE_URL`)
- `SUPABASE_TEST_SERVICE_ROLE_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`)
- `AGEKEY_TEST_TENANT_A_ID`
- `AGEKEY_TEST_TENANT_B_ID`

Se faltar qualquer uma, os tests SKIP silenciosamente.

## Como rodar

### Local (Supabase CLI)

```bash
supabase start
supabase db reset

# Criar 2 tenants de teste:
psql "$SUPABASE_DB_URL" -c "
  INSERT INTO tenants (id, slug, name, status) VALUES
    ('00000000-0000-0000-0000-000000000a01', 'test-a', 'Test A', 'active'),
    ('00000000-0000-0000-0000-000000000a02', 'test-b', 'Test B', 'active');
"

export SUPABASE_TEST_URL=http://127.0.0.1:54321
export SUPABASE_TEST_SERVICE_ROLE_KEY=$(supabase status -o json | jq -r .service_role_key)
export AGEKEY_TEST_TENANT_A_ID=00000000-0000-0000-0000-000000000a01
export AGEKEY_TEST_TENANT_B_ID=00000000-0000-0000-0000-000000000a02

pnpm --filter @agekey/integration-tests test
```

### Staging

Configure variáveis com URL e keys de staging. **NÃO incluir credenciais no repo.**

## Pré-requisito SQL

Os tests dependem de uma RPC `set_current_tenant(tid uuid)` que executa `SET LOCAL app.current_tenant_id = tid`. Adicionar em rodada de hardening (R8.1):

```sql
CREATE OR REPLACE FUNCTION set_current_tenant(tid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tid::text, true);
END;
$$;
GRANT EXECUTE ON FUNCTION set_current_tenant(uuid) TO service_role;
```

Quando a RPC não existe, os tests SKIP individualmente (não falham).

## Suítes

| Arquivo | Cobertura |
|---|---|
| `core-cross-tenant.test.ts` | `verification_sessions`, `result_tokens`, `applications` |
| `consent-cross-tenant.test.ts` | `parental_consent_requests`, `guardian_contacts`, `parental_consents` |
| `safety-cross-tenant.test.ts` | `safety_events`, `safety_alerts`, `safety_subjects`, `safety_aggregates` |

## Não-objetivos

- Esses tests NÃO substituem testes de unidade (continuam em `packages/shared/__tests__/`).
- NÃO incluem testes de Edge Functions completas (cobertura de adapter, etc.) — vão em rodada futura.
- NÃO usam dados PII (refs HMAC opacos só).
- NÃO poluem staging — sempre teardown ao final (TODO).
