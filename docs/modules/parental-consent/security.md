# Segurança — AgeKey Parental Consent

## Modelo de ameaças

| Ameaça | Mitigação |
|---|---|
| Vazamento de PII em token | Privacy guard canônico + schema strict + lista de claims proibidas |
| Reuso de token cross-tenant | Chave HMAC por-tenant + `tenant_id` no token + RLS |
| Reuso de OTP | OTP digest + `otp_attempts` + `otp_expires_at` + uso único na confirmação |
| Enumeration de consent_request_id | Endpoints retornam 404 sem revelar existência; rate limit por API key |
| Replay de webhook | `X-AgeKey-Delivery-Id` + assinatura HMAC + `payload_hash` no body |
| SQL injection no painel | Supabase SSR client com types; queries parametrizadas |
| RLS bypass | service_role só server-side; políticas restritivas em todas as tabelas |
| Phishing usando o domínio | Página pública minimal, sem coleta de PII; CSP + HSTS herdados |

## HMAC discipline

A chave HMAC é **por-tenant** e nunca derivada do `tenant_id` sozinho.
Quatro purposes são bound no input:

```
HMAC(K_tenant, "subject_ref:" || external_user_ref)
HMAC(K_tenant, "guardian_ref:" || contact)
HMAC(K_tenant, "contact:"     || contact)
HMAC(K_tenant, "actor_ref:"   || actor_ref)
```

Isso impede que um atacante que obtenha um `subject_ref_hmac` consiga
reverter para o `external_user_ref` ou trocar pelo `guardian_ref_hmac`
do mesmo valor.

### Fallback de bootstrap

Quando a Vault ainda não tem a chave por-tenant provisionada, a função
`consent_hmac_key_load(tenant_id)` (RPC) retorna `null` e o helper
`_shared/consent-hmac.ts` deriva uma chave determinística:

```
K_tenant_fallback = SHA-256(AGEKEY_CONSENT_HMAC_PEPPER || "|" || tenant_id)
```

Esta é uma medida ponte — produção deve provisionar chaves dedicadas. O
log de bootstrap registra quando o fallback é usado para o time de
infra-segurança consertar.

## OTP

- 6 dígitos numéricos.
- Vida 10 minutos.
- Nunca persistido em texto. Apenas o digest
  `SHA-256(guardian_ref_hmac || otp)` em `guardian_verifications.otp_digest`.
- Nunca aparece em log, em resposta ou em e-mail copiado para o backend.
- Tentativas erradas incrementam `otp_attempts` e atualizam `decision`
  para `denied` com `CONSENT_OTP_INVALID`. (Bloqueio progressivo
  baseado em `otp_attempts >= N` é candidato a rodada futura.)

## Privacy guard em três camadas

1. **Schema strict** em `packages/shared/src/consent/consent-api.ts` —
   `.strict()` rejeita qualquer chave extra antes de qualquer DB call.
2. **Privacy guard canônico** (`assertPublicPayloadHasNoPii`) — corre na
   borda de saída de toda função.
3. **CHECK constraints SQL** — `consent_jsonb_has_no_forbidden_keys()` em
   `client_context_json` e `evidence_json`.

## RLS

- **Reads**: tenant_users só leem dados do próprio tenant.
- **Writes**: 100% via service-role (edge functions). RLS recusa qualquer
  INSERT direto via PostgREST com chave anônima.
- **Auditor** acessa `parental_consent_revocations` via `has_role('auditor')`.
- **Admin** acessa `guardian_contacts` via `has_role('admin')` (linhas com
  ciphertext sensível).

## Feature flags

Defaults conservadores — todos os flags abaixo começam **desligados** em
produção. Ativar somente após teste em staging.

| Flag | Default | Quando ativar |
|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | `false` | tenant pediu o módulo |
| `AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED` | `false` | provedor de OTP homologado |
| `AGEKEY_CONSENT_PANEL_ENABLED` | `false` | painel admin liberado para o tenant |
| `AGEKEY_CONSENT_SD_JWT_VC_ENABLED` | `false` | **NUNCA** ligar em prod sem o perfil completo |
| `AGEKEY_CONSENT_GATEWAY_PROVIDERS_ENABLED` | `false` | **NUNCA** ligar em prod sem DPA |
| `AGEKEY_CONSENT_STRICT_PRIVACY_GUARD` | `true` | manter em `true` |

Nenhum flag de Consent afeta o Core; o Core continua emitindo
`age_verify` independentemente da Consent estar ligado.

## Segredos

| Segredo | Onde fica | Quem usa |
|---|---|---|
| `K_tenant` (HMAC) | Vault (`vault.secrets`) | edge functions `parental-consent-*` |
| `AGEKEY_CONSENT_HMAC_PEPPER` | env var server-side | fallback de bootstrap |
| Signing key ES256 | `crypto_keys` + Vault | `signJwsClaims` para o token |
| Webhook secret | `webhook_endpoints.secret_hash` (e raw no cliente) | trigger SQL `fan_out_parental_consent_webhooks` |

## Operações destrutivas controladas

- `DELETE` em `parental_consents` é bloqueado por trigger.
- `UPDATE`/`DELETE` em `parental_consent_revocations` são bloqueados.
- `parental_consent_requests` aceita UPDATEs apenas via service-role
  (RLS `WITH CHECK (false)` para clients).
- Migration destrutiva (drop column) requer fluxo de aprovação documentado
  em `infrastructure/environments.md`.
