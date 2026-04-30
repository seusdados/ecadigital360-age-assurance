# Supabase Hardening - AgeKey

## Banco

- RLS habilitado em tabelas de negócio.
- Escrita direta bloqueada em tabelas transacionais.
- Service role apenas em Edge Functions.
- Separar staging/production.
- Verificar grants após migrations.

## Storage

- Bucket `proof-artifacts` privado.
- Signed URLs com TTL curto.
- Não permitir listagem pública.
- Content-type validation.
- Tamanho máximo por artefato.

## Edge Functions

- Pin de dependências.
- CORS restrito.
- Rate limit.
- Logs com trace_id.
- Sem PII em logs.
- CRON_SECRET para jobs.

## Auth

- Redirect URLs restritas.
- MFA para admins quando disponível.
- Roles por tenant.
- Onboarding seguro.

## Vault/Keys

- private keys no Vault.
- key rotation.
- JWKS público.
- revogação planejada.
