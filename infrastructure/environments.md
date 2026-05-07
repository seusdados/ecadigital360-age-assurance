# Ambientes - AgeKey

## Local

Uso: desenvolvimento.

Recursos:

- Supabase local;
- Next.js local;
- seed dev;
- chaves mock/dev.

## Staging

Uso: demonstrações e validação.

Domínio: `staging.agekey.com.br`.

Recursos:

- Supabase projeto staging;
- Vercel preview/prod staging;
- API keys de teste;
- providers sandbox.

## Production

Uso: clientes reais.

Domínio:

- `app.agekey.com.br`
- `api.agekey.com.br`
- `verify.agekey.com.br`
- `docs.agekey.com.br`

Regras:

- Supabase production separado;
- secrets próprios;
- sem seed dev;
- logs e retention configurados;
- pentest antes de GA.
