# Secrets - AgeKey

## Regra principal

Nada sensível em frontend. Nada sensível em `NEXT_PUBLIC_*`.

## Server-only

```txt
SUPABASE_SERVICE_ROLE_KEY
AGEKEY_ADMIN_API_KEY
AGEKEY_CRON_SECRET
WEBHOOK_SIGNING_SECRET
GATEWAY_YOTI_API_KEY
GATEWAY_VERIFF_API_KEY
GATEWAY_IDWALL_API_KEY
GATEWAY_SERPRO_CLIENT_SECRET
```

## Public

```txt
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_AGEKEY_API_BASE
NEXT_PUBLIC_AGEKEY_ISSUER
```

## Proibido

- Commitar `.env`.
- Expor service role.
- Incluir private JWK no bundle.
- Logar API key raw.
- Mostrar token completo no painel sem mascarar.

## Rotação

Rotacionar:

- API key por cliente sob demanda;
- webhook secret sob demanda;
- signing keys por cron;
- service role em incidente;
- gateway secrets conforme política do provider.
