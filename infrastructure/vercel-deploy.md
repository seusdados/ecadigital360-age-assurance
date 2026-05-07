# Vercel Deploy - AgeKey

## Projetos recomendados

1. `agekey-site`
2. `agekey-admin`
3. `agekey-verify`
4. `agekey-docs`

No estágio atual, o admin pode continuar em `apps/admin`.

## Configuração

Se o Root Directory no Vercel for `apps/admin`, o output directory deve ser `.next`, não `apps/admin/.next`.

## Variáveis

Configurar variáveis por ambiente: preview, staging, production.

## Headers recomendados

- HSTS em produção.
- CSP conservadora.
- X-Frame-Options para painel.
- Frame policy específica para widget/verify se necessário.
- Referrer-Policy.
- Permissions-Policy.

## Build

```bash
pnpm install --no-frozen-lockfile
pnpm build
```

## Smoke test pós-deploy

1. Login carrega.
2. Dashboard carrega.
3. Policies listam.
4. JWKS responde.
5. Create session responde.
6. Token verify responde.
