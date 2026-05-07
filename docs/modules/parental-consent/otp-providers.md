# AgeKey Consent — OTP Providers

> Status: introduzido na rodada R5.

## Providers suportados

| ID | Uso | Configuração obrigatória |
|---|---|---|
| `noop` | Dev / staging com `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` | nenhuma |
| `supabase_email` | Produção (relay HTTPS) | `AGEKEY_PARENTAL_CONSENT_OTP_RELAY_URL`, `AGEKEY_PARENTAL_CONSENT_OTP_RELAY_TOKEN`, `AGEKEY_PARENTAL_CONSENT_OTP_FROM_EMAIL` |

## Variáveis de ambiente

```
AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER=supabase_email
AGEKEY_PARENTAL_CONSENT_OTP_RELAY_URL=https://...
AGEKEY_PARENTAL_CONSENT_OTP_RELAY_TOKEN=...      # opaco, sem credenciais SMTP
AGEKEY_PARENTAL_CONSENT_OTP_FROM_EMAIL=no-reply@agekey.com.br
AGEKEY_PARENTAL_CONSENT_OTP_FROM_NAME=AgeKey     # opcional
AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=false     # NUNCA true em prod
```

## Decisão de design `supabase_email`

O AgeKey **não** usa Supabase Auth para responsáveis (responsáveis nunca viram `auth.users`). Logo, `supabase.auth.admin.inviteUserByEmail` ou `generateLink` são impróprios — criariam PII residual em GoTrue.

A abordagem escolhida é **delegar para um relay HTTPS** que o operador configura. O relay aceita `POST {from, to, subject, text}` com `Authorization: Bearer <token>`. Pode ser:

1. Outra Edge Function do mesmo projeto Supabase (recomendado em produção AgeKey).
2. Resend / Postmark / Mailgun / SES SMTP gateway.
3. Serviço próprio do operador.

Nenhuma credencial SMTP cleartext circula pelo módulo.

## Privacidade

- OTP cleartext: somente no payload HTTPS para o relay. NUNCA logado.
- E-mail/telefone cleartext: somente no payload HTTPS para o relay. NUNCA logado.
- Audit event registra apenas `provider`, `delivered`, `provider_message_id`.

## Adicionando novo provider

1. Criar `supabase/functions/_shared/parental-consent/otp-providers/<name>.ts` exportando `create<Name>Provider(cfg)` que retorna `OtpProvider`.
2. Registrar em `otp-providers/index.ts` no `selectProvider`.
3. Documentar variáveis de ambiente aqui.
4. Adicionar testes unitários.

## Limites do MVP

- Sem rate limit por contato (vem do `rate_limit_buckets` do Core).
- Sem retry/backoff próprio (cron de retry vai em rodada futura).
- Sem fallback automático entre providers.
- Apenas `email`. Provider de SMS fica para rodada futura.
