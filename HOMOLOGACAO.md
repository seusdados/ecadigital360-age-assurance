# Branch `homologacao` — painel admin operacional na nuvem

Esta branch é **fixa**. Não é mesclada em `main`; existe só para o Vercel manter um Preview estável apontando para o backend de homologação (`wljedzqgprkpqhuazdzv`).

## URL operacional

```
https://ecadigital360-age-assurance-git-homologacao-seusdados.vercel.app
```

Para ir direto ao painel:

```
https://ecadigital360-age-assurance-git-homologacao-seusdados.vercel.app/dashboard
```

## Acesso (estado atual)

- **Usuário inicial**: `marcelo@seusdados.com` (cadastrado em `auth.users` com Auto Confirm).
- **Tenant**: `AgeKey Dev` (slug `dev`) — é o tenant criado pelo seed estrutural `04_dev_tenant.sql`.
- **Papel**: `owner` (papel mais alto dentro do tenant; permite tudo).

Para criar mais usuários:

1. Adicionar via Supabase Dashboard → Authentication → Users → "Add user" → "Create new user" (marcar **Auto Confirm**).
2. Vincular ao tenant via SQL:
   ```sql
   INSERT INTO tenant_users (tenant_id, user_id, role)
   SELECT
     (SELECT id FROM tenants WHERE slug = 'dev'),
     (SELECT id FROM auth.users WHERE email = 'EMAIL_DO_USUARIO'),
     'owner'  -- ou 'admin' / 'operator' / 'auditor' / 'billing'
   ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;
   ```

## Histórico de fixes aplicados durante o bring-up

Eventos resolvidos durante a primeira subida em produção da nuvem (maio 2026):

1. **PR #31** — Mapeamento dos projetos Supabase prod (`tpdiccnmsnjtjwhardij`) e homologação (`wljedzqgprkpqhuazdzv`); script `setup-staging.sh` corrigido para apontar para hml.
2. **PR #32** — `import_map.json` para o empacotador remoto do Supabase resolver imports `bare` (`zod`, `@agekey/*`).
3. **PR #33** — Remove flag `--import-map` deprecada do CLI Supabase; passa a confiar só no `deno.json`.
4. **PR #34** — Migration `017_fix_tenant_self_access.sql`: adiciona policies RLS de auto-leitura em `tenant_users` e `tenants`. Sem isso, o painel entra em loop em `/onboarding` mesmo com vínculo válido.
5. **Configuração no Vercel**:
   - Domínio `ecadigital360-age-assurance-git-homologacao-seusdados.vercel.app` adicionado explicitamente em **Settings → Domains** ligado à branch `homologacao` (sem isso, todos os subdomínios `.vercel.app` retornavam `403 host_not_allowed`).
   - 5 variáveis `NEXT_PUBLIC_*` criadas no escopo Preview (lista canônica em `infrastructure/secrets.md`).
6. **Deploy de Edge Functions** — 21 funções deployadas para `wljedzqgprkpqhuazdzv` via `supabase/scripts/setup-staging.sh`. Primeira chave de assinatura criada (`ak_20260504_13`).

## Manutenção

- **Sincronizar com `main`**: rode `git checkout homologacao && git merge --ff-only main && git push` periodicamente para receber as últimas mudanças.
- **Não fazer commits direto**: toda mudança entra via `main` (PR + merge); esta branch só consome.
- **Apagar quando produção estiver pronta**: quando o deploy do backend `tpdiccnmsnjtjwhardij` estiver completo e o domínio definitivo (`app.agekey.com.br` ou similar) estiver configurado, esta branch pode ser removida.

## Variáveis de ambiente no Vercel (escopo Preview)

Conforme registrado em `infrastructure/secrets.md`:

- `NEXT_PUBLIC_SUPABASE_URL=https://wljedzqgprkpqhuazdzv.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anônima do projeto AgeKey-hml>`
- `NEXT_PUBLIC_AGEKEY_API_BASE=https://wljedzqgprkpqhuazdzv.supabase.co/functions/v1`
- `NEXT_PUBLIC_AGEKEY_ISSUER=https://staging.agekey.com.br`
- `NEXT_PUBLIC_APP_URL=https://ecadigital360-age-assurance-git-homologacao-seusdados.vercel.app`

## Smoke test rápido (linha de comando)

Para confirmar que o backend está respondendo:

```bash
# JWKS público
curl -s https://wljedzqgprkpqhuazdzv.supabase.co/functions/v1/jwks | jq '.keys | length'
# Esperado: >= 1

# Criar sessão de verificação de teste
curl -i -X POST https://wljedzqgprkpqhuazdzv.supabase.co/functions/v1/verifications-session-create \
  -H "X-AgeKey-API-Key: ak_dev_sk_test_0123456789abcdef" \
  -H "Content-Type: application/json" \
  -d '{"policy_slug":"dev-18-plus","client_capabilities":{"platform":"web"}}'
# Esperado: HTTP 201 + JSON com session_id, status="pending", challenge.nonce
```
