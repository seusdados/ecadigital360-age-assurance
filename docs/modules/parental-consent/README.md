# AgeKey Consent — Parental Consent Module

> Status: MVP introduzido na rodada `claude/agekey-parental-consent-module`.
> Subordinado ao **AgeKey Core** e à camada canônica das Rodadas 1+2.

## 1. O que é

Módulo de **consentimento parental auditável** do AgeKey. Não cria cadastro civil de criança, adolescente ou responsável. Não realiza KYC. Não armazena documento, data de nascimento, idade exata, nome civil, CPF, RG ou passaporte.

O módulo entrega:

- referência opaca da criança (`child_ref_hmac`) gerada pelo tenant;
- contato do responsável **cifrado** em Supabase Vault (`pgsodium`);
- texto de consentimento **versionado por hash**;
- prova mínima, assinada e revogável (`parental_consent_token`);
- trilha de auditoria via `audit_events` + webhooks.

## 2. Não-objetivos

- ❌ Não pede documento do responsável.
- ❌ Não armazena cleartext de e-mail/telefone do responsável em coluna comum.
- ❌ Não armazena cleartext de OTP — apenas hash.
- ❌ Não emite token sem aprovação explícita do responsável.
- ❌ Não sobrepõe `policy.age.blocked_if_minor` (consentimento não libera recurso bloqueado por política).

## 3. Fluxo

```
┌──────────────┐           ┌────────────┐          ┌──────────────┐
│ Application  │           │   AgeKey   │          │  Responsável │
│   (tenant)   │           │   Consent  │          │              │
└──────┬───────┘           └─────┬──────┘          └──────┬───────┘
       │ POST /session            │                       │
       │ (policy_slug, resource,  │                       │
       │  purpose_codes,          │                       │
       │  data_categories,        │                       │
       │  child_ref_hmac)         │                       │
       │─────────────────────────▶│                       │
       │ ◀──────── guardian_panel_url + token             │
       │                          │                       │
       │ Entrega o link           │                       │
       │  ao responsável OOB ────────────────────────────▶│
       │                          │                       │
       │                          │  GET /session/:id     │
       │                          │  ?token=...           │
       │                          │ ◀─────────────────────│
       │                          │ ────── texto + meta ─▶│
       │                          │                       │
       │                          │ POST /guardian/start  │
       │                          │ (channel + value)     │
       │                          │ ◀─────────────────────│
       │                          │ ─── OTP entregue ────▶│
       │                          │                       │
       │                          │ POST /confirm         │
       │                          │ (otp + decision)      │
       │                          │ ◀─────────────────────│
       │                          │                       │
       │ ◀── webhook              │                       │
       │ parental_consent.        │                       │
       │   approved/denied        │                       │
       │                          │                       │
       │ POST /token/verify       │                       │
       │─────────────────────────▶│                       │
       │ ◀──── decision envelope  │                       │
```

## 4. Endpoints

| Endpoint | Auth | Função |
|---|---|---|
| `POST /v1/parental-consent/session` | `X-AgeKey-API-Key` | Cria solicitação. Retorna `guardian_panel_url`. |
| `POST /v1/parental-consent/:id/guardian/start` | `guardian_panel_token` | Cifra contato em Vault, envia OTP. |
| `POST /v1/parental-consent/:id/confirm` | `guardian_panel_token` | Verifica OTP + decisão. Emite token se aprovado. |
| `GET /v1/parental-consent/session/:id` | API key OU `guardian_panel_token` | Visão pública sem PII. |
| `GET /v1/parental-consent/:id/text` | `guardian_panel_token` | Texto integral do `consent_text_version` (uso exclusivo do painel parental, `text/plain`, `Cache-Control: no-store`). |
| `POST /v1/parental-consent/:id/revoke` | API key OU `guardian_panel_token` | Append-only revoke + webhook. |
| `POST /v1/parental-consent/token/verify` | público | Validação online ES256 + revogação. |

Todos os endpoints aceitam o header `X-AgeKey-Webhook-Timestamp` e o conjunto canônico de cabeçalhos definido em `docs/specs/agekey-webhook-contract.md`.

## 5. Tabelas

Todas com RLS habilitada (migration `022_parental_consent_rls.sql`).

| Tabela | Conteúdo | Imutável |
|---|---|---|
| `consent_text_versions` | Texto exibido + `text_hash`. | Sim (RLS bloqueia UPDATE) |
| `parental_consent_requests` | Solicitação. Sem PII. | Não (status evolui) |
| `guardian_contacts` | Contato cifrado em Vault + `contact_hmac` para lookup. | Não |
| `guardian_verifications` | OTP hash + tentativas. | Não |
| `parental_consents` | Decisão final. **Append-only via trigger** (apenas `revoked_at` mutável). | Sim |
| `parental_consent_tokens` | JTI registry. Reusa `crypto_keys` do Core. | Quase (só revogação) |
| `parental_consent_revocations` | Trilha de revogação. **Append-only**. | Sim |

Nenhuma das colunas armazena PII em cleartext. Veja `docs/architecture/agekey-canonical-data-model.md` §3 e §5.

## 6. Token

`parental_consent_token` é JWT ES256 idêntico em forma ao `result_token` do Core, com:

- `agekey.decision_domain = 'parental_consent'`
- `agekey.decision = 'approved'` (apenas; tokens negativos não são emitidos)
- `agekey.purpose_codes`, `agekey.data_categories`, `agekey.consent_text_version_id`

Reusa o **mesmo `crypto_keys`** ES256 e o **mesmo JWKS** público em `/.well-known/jwks.json`. Receivers SDK podem verificar via `verifyResultToken` (já existente) e checar `decision_domain` para diferenciar de `result_token`.

## 7. Privacy Guard

Todo payload público passa pelo Privacy Guard com perfil:

- `public_token` antes de `signResultToken`;
- `public_api_response` antes de `Response.json`;
- `webhook` antes da assinatura HMAC;
- `guardian_contact_internal` quando se trata de tabela `guardian_contacts` (único perfil que tolera `guardian_email`/`guardian_phone`/`guardian_name`).

Ver `docs/specs/agekey-privacy-guard-canonical.md`.

## 8. Feature Flags

- `AGEKEY_PARENTAL_CONSENT_ENABLED` — mestre. Default `false`.
- `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` — `noop` (padrão) ou provider real (não implementado).
- `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` — quando `true`, devolve o OTP cleartext na resposta de `/guardian/start`. **Apenas dev.**
- `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` — base do painel parental.
- `AGEKEY_PARENTAL_CONSENT_PANEL_TTL_SECONDS` — default 86400.
- `AGEKEY_PARENTAL_CONSENT_TOKEN_TTL_SECONDS` — default 3600.
- `AGEKEY_PARENTAL_CONSENT_DEFAULT_EXPIRY_DAYS` — default 365.

## 9. OTP delivery (estado atual)

**Provider noop**: registra em DB e retorna OTP cleartext em dev mode.
**Provider real (SMTP/SMS)**: NÃO implementado. Configurar `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` para qualquer valor diferente de `noop` resulta em erro explícito. Para produção, implementar provider real em rodada própria.

## 10. Revogação

A revogação acontece em duas vias:

- **Tenant admin** via `X-AgeKey-API-Key` (source = `tenant_admin`).
- **Responsável** via `guardian_panel_token` (source = `guardian`).

Toda revogação:

1. Insere linha em `parental_consent_revocations` (append-only).
2. Atualiza `parental_consents.revoked_at`.
3. Atualiza `parental_consent_tokens.revoked_at`.
4. Atualiza `parental_consent_requests.status = 'revoked'`.
5. Dispara webhook `parental_consent.revoked` via `fan_out_parental_consent_revoke_webhooks`.

## 11. Retention

- `parental_consent_requests`: `session_7d` por padrão.
- `guardian_contacts`: `consent_active_until_expiration` → `consent_expired_audit_window`.
- `guardian_verifications`: `otp_24h`.
- `parental_consents`: `consent_active_until_expiration` → `consent_expired_audit_window`.
- `parental_consent_tokens`: `result_token_policy_ttl`.
- `parental_consent_revocations`: nunca apagado automaticamente (legal_hold ao critério do tenant).

Implementar retention cleanup em rodada própria — esta rodada apenas declara classes via documento.

## 12. Integração com Core

- **JWKS público** comum.
- **Privacy guard** comum (mesmo `assertPayloadSafe`).
- **Webhook signer** comum (HMAC SHA-256 do payload pelo trigger SQL).
- **`webhook_deliveries`** comum.
- **`audit_events`** comum.
- **Reason codes canônicos** (`CONSENT_*`).
- **Decision envelope** comum, com `decision_domain: 'parental_consent'`.

## 13. UI

- **Admin** (`apps/admin/app/(app)/consents/`): lista + detalhe.
- **Painel parental público** (`apps/admin/app/parental-consent/[id]/`): rota pública sem login. Carrega texto do consentimento, coleta contato, envia OTP, recebe decisão. Token na URL.
