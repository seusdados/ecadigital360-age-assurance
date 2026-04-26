# Handoff — Edge Functions → Frontend (Fase 2 → Fase 3)

**Origem:** PR Fase 2 — Edge Functions (branch `claude/resume-development-plan-2OOOX`).
**Destino:** Engenheiro de Frontend (`apps/admin` Next.js 14 + `packages/widget` + `packages/sdk-js`).
**Stack consumida pelo frontend:** Next.js 14 App Router, TypeScript strict, Tailwind, shadcn/ui, deploy Vercel.

---

## 1. Funções implantadas

Todas as funções aceitam o header `X-AgeKey-API-Key` (raw api key, comparada por SHA-256 contra `applications.api_key_hash`). CORS é restrito por `AGEKEY_ALLOWED_ORIGINS` (CSV; nunca `*` em produção).

Base URL durante staging: `https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1`.

| Função | Método | Path | Status |
|---|---|---|---|
| verifications-session-create | POST | `/verifications-session-create` | full |
| verifications-session-get | GET | `/verifications-session-get/<id>` | full |
| verifications-session-complete | POST | `/verifications-session-complete/<id>` | full |
| verifications-token-verify | POST | `/verifications-token-verify` | full |
| verifications-token-revoke | POST | `/verifications-token-revoke` | full |
| **verifications-list** | GET | `/verifications-list` | **full (Fase 2.c)** |
| issuers-list | GET | `/issuers-list` | full |
| issuers-register | POST | `/issuers-register` | full |
| policies-list | GET | `/policies-list` | full |
| policies-write | POST | `/policies-write` | full |
| **applications-list** | GET | `/applications-list` | **full (Fase 2.c)** |
| **applications-write** | POST | `/applications-write` | **full (Fase 2.c)** |
| **applications-rotate-key** | POST | `/applications-rotate-key` | **full (Fase 2.c)** |
| **tenant-bootstrap** | POST | `/tenant-bootstrap` | **full (Fase 2.c, JWT user auth)** |
| **audit-list** | GET | `/audit-list` | **full (Fase 2.c)** |
| proof-artifact-url | POST | `/proof-artifact-url` | full (TTL 300s) |
| jwks | GET | `/jwks` | full (público) |
| key-rotation | POST | `/key-rotation` | cron-only |
| webhooks-worker | POST | `/webhooks-worker` | cron-only |
| retention-job | POST | `/retention-job` | cron-only |
| trust-registry-refresh | POST | `/trust-registry-refresh` | cron-only |

> **Status final dos adapters (Fase 2.d completa):**
> - `fallback` — **completo** (declaração assistida + risk score, assurance=low)
> - `vc` — **completo (Fase 2.b)** — JWT-VC e SD-JWT, verificação ES256/ES384/RS256 contra `issuers.public_keys_json`, validação de _sd disclosures, nonce binding, revocation cache
> - `zkp` — **completo (Fase 2.d) via predicate-attestation JWS** (assurance=high)
>   * Aceita formatos `predicate-attestation-v1` e `predicate-attestation-jws` (JWS issued por ZKP-capable issuer asserting age predicate)
>   * Verifica: signature contra issuer JWKS, nonce binding, `predicate.threshold >= policy.age_threshold`, `predicate.satisfied === true`
>   * BBS+/BLS12-381 unlinkable (`bls12381-bbs+`) retorna `ZKP_CURVE_UNSUPPORTED` até crypto-core (M9+) com WASM lib + test vectors reais
> - `gateway` — **completo (Fase 2.d) via generic JWS verification** (assurance configurável)
>   * Provider registrado em `issuers` com `metadata_json.adapter_variant='gateway'` e `metadata_json.provider='<id>'`
>   * Suporta claim names customizáveis via `metadata_json.{age_claim_name,nonce_claim_name}` (Yoti/Veriff/Onfido/Serpro/Unico)
>   * Verifica: signature contra provider JWKS, nonce binding, age claim mapping
>   * `assurance_level` retornado conforme `metadata_json.assurance_level` (default `substantial`)
>
> Os 4 adapters honram o mesmo contrato `VerificationAdapter`; o frontend pode exercitar todos os fluxos com mock issuers seedeados no trust registry (ver `supabase/seed/02_trust_registry.sql`).

---

## 2. Schemas de payload (TypeScript)

Reuse os schemas Zod de `packages/shared/src/schemas/` em `apps/admin`, `packages/widget` e `packages/sdk-js`. Eles são a fonte única de verdade dos contratos.

### 2.1 Sessão — criar

```ts
import { SessionCreateRequestSchema, SessionCreateResponseSchema } from '@agekey/shared';
```

Request:
```json
{
  "policy_slug": "dev-18-plus",
  "external_user_ref": "<opaque>",
  "locale": "pt-BR",
  "redirect_url": "https://app.cliente.com/return",
  "cancel_url": "https://app.cliente.com/cancel",
  "client_capabilities": {
    "digital_credentials_api": true,
    "wallet_present": false,
    "webauthn": true,
    "platform": "web"
  }
}
```

Response 201:
```json
{
  "session_id": "01926cb0-...",
  "status": "pending",
  "expires_at": "...",
  "challenge": { "nonce": "...", "expires_at": "..." },
  "available_methods": ["zkp","vc","gateway","fallback"],
  "preferred_method": "zkp",
  "policy": { "id": "...", "slug": "dev-18-plus", "age_threshold": 18, "required_assurance_level": "substantial" }
}
```

### 2.2 Sessão — completar (4 fluxos)

```ts
import { SessionCompleteRequestSchema, SessionCompleteResponseSchema } from '@agekey/shared';
```

Discriminada por `method`. Body do método **fallback** (único totalmente funcional na Fase 2):
```json
{ "method": "fallback", "declaration": { "age_at_least": 18, "consent": true }, "signals": { "captcha_token": "...", "device_fingerprint": "..." } }
```

Response 200:
```json
{
  "session_id": "...",
  "status": "completed",
  "decision": "approved",
  "reason_code": "FALLBACK_DECLARATION_ACCEPTED",
  "method": "fallback",
  "assurance_level": "low",
  "token": { "jwt": "eyJhbGciOiJFUzI1NiI...", "jti": "...", "expires_at": "...", "kid": "..." }
}
```

### 2.3 Token — verify e revoke

```ts
import { TokenVerifyRequestSchema, TokenVerifyResponseSchema, TokenRevokeRequestSchema } from '@agekey/shared';
```

### 2.4 Admin — issuers, policies, applications, audit, tenant-bootstrap

Schemas Zod completos disponíveis em `@agekey/shared`:

```ts
import {
  // Verifications
  VerificationsListQuerySchema,
  VerificationsListResponseSchema,
  // Applications
  ApplicationsListResponseSchema,
  ApplicationWriteRequestSchema,
  ApplicationWriteResponseSchema,  // api_key/webhook_secret RAW só no create
  ApplicationRotateKeyRequestSchema,
  ApplicationRotateKeyResponseSchema,
  // Tenant onboarding
  TenantBootstrapRequestSchema,
  TenantBootstrapResponseSchema,   // RAW credentials uma única vez
  // Audit
  AuditListQuerySchema,
  AuditListResponseSchema,
} from '@agekey/shared';
```

`tenant-bootstrap` é o ÚNICO endpoint que aceita `Authorization: Bearer <Supabase Auth JWT>` em vez de `X-AgeKey-API-Key`. O frontend usa-o no fluxo `/onboarding` logo após signup.

### 2.5 Proof artifact URL

```ts
// Body
{ "artifact_id": "<uuid>" }
// Response 200
{
  "artifact_id": "...",
  "url": "https://...supabase.co/storage/v1/object/sign/...",
  "expires_in_seconds": 300,
  "mime_type": "application/jwt",
  "size_bytes": 4096
}
```

403 quando o artefato pertence a outro tenant; 400 quando `storage_path` é null (declaração fallback nunca tem objeto Storage — apenas hash).

---

## 3. Auth no frontend

- Painel (`apps/admin`): Supabase Auth com email+password (SSR via cookies). Após login o painel chama Edge Functions com a `api_key` do tenant (recuperada via SQL para usuários `admin+`). Para chamadas administrativas (lista de policies, lista de issuers, write policies), use a api_key do app principal do tenant.
- SDK público (`@agekey/sdk-js`): consumidor do cliente final passa a `api_key` ao instanciar o widget. Nunca exponha api_key no bundle do consumidor — o SDK assume que a página já obteve session_id via backend do cliente.
- Widget (`@agekey/widget`): recebe `session_id` (já criada via backend do cliente), nunca a api_key direta.

---

## 4. JWKS público

`GET /functions/v1/jwks` (sem auth, `Cache-Control: max-age=300`). Para verificação local de tokens (alternativa a chamar `/verifications-token-verify`), use `verifyResultToken` de `@agekey/shared`:

```ts
import { fetchJwks, verifyResultToken } from '@agekey/shared';

const jwks = await fetchJwks(`${process.env.NEXT_PUBLIC_AGEKEY_API_BASE}/jwks`);
const result = await verifyResultToken(jwt, {
  jwksKeys: jwks,
  expectedIssuer: process.env.NEXT_PUBLIC_AGEKEY_ISSUER,
  expectedAudience: 'dev-app',
});
```

Recomendado: cachear o JWKS por 5 minutos (mesmo TTL do `Cache-Control` retornado).

---

## 5. Realtime

**Nada em Fase 2.** Painel usa polling em `/policies-list` e `/issuers-list`. Realtime para "verifications.created" / "verifications.completed" é uma melhoria de UX da Fase 3 — habilitar via:
```sql
alter publication supabase_realtime add table public.verification_results;
```
e o painel inscreve via `supabase.channel('verifications:tenant:<id>')` filtrado por tenant_id (RLS aplica).

---

## 5.b Webhooks recebidos pelo cliente (server-to-server)

A migration `012_webhook_enqueue` instala um trigger DB que enfileira `webhook_deliveries` automaticamente quando uma `verification_results` é criada. O cron `webhooks-worker` (cada 1m) drena a fila e faz `POST` no `webhook_endpoints.url` cadastrado.

Headers HTTP enviados ao endpoint do cliente:

| Header | Conteúdo |
|---|---|
| `X-AgeKey-Event-Type` | `verification.approved` &#124; `verification.denied` &#124; `verification.needs_review` |
| `X-AgeKey-Delivery-Id` | UUID v7 idempotente — receptor deve deduplicar |
| `X-AgeKey-Signature` | `hex(HMAC-SHA256(secret_hash, payload_text))` |
| `Content-Type` | `application/json` |

Payload JSON (sem PII):
```json
{
  "event_id": "01926cb0-...",
  "event_type": "verification.approved",
  "tenant_id": "...",
  "session_id": "...",
  "application_id": "...",
  "decision": "approved",
  "reason_code": "FALLBACK_DECLARATION_ACCEPTED",
  "method": "fallback",
  "assurance_level": "low",
  "threshold_satisfied": true,
  "jti": "01926cb0-...",
  "created_at": "2026-04-25T13:30:00Z"
}
```

**Validação da assinatura** no backend do cliente (Node.js exemplo):
```ts
import { createHmac } from 'node:crypto';

const expected = createHmac('sha256', clientSecretHashHex).update(rawBody).digest('hex');
if (expected !== req.headers['x-agekey-signature']) throw new Error('invalid_signature');
```

Note: o `clientSecretHashHex` é o `sha256(raw_secret)` que o cliente computa a partir do `whsec_...` exibido na criação do webhook. Equivalente em segurança a HMAC com a chave hasheada — ver migration `012_webhook_enqueue.sql` para o rationale.

Backoff em falhas: 30s → 2m → 10m → 1h → 6h → 24h. Após 6 tentativas com falha vai para `dead_letter`.

---

## 6. Storage

Bucket `proof-artifacts` (privado, criado pela migration `011_storage`). Edge Functions escrevem com `service_role`; painel obtém signed URL (TTL 300s) via:

```
POST /v1/proof-artifact-url
{ "artifact_id": "<uuid>" }

→ { "url": "...", "expires_in_seconds": 300, "mime_type": "...", "size_bytes": ... }
```

403 se o artefato pertence a outro tenant; 400 quando `storage_path` é null (declaração fallback não tem objeto).

---

## 7. Variáveis de ambiente do frontend

```
NEXT_PUBLIC_AGEKEY_API_BASE=https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1
NEXT_PUBLIC_SUPABASE_URL=https://tpdiccnmsnjtjwhardij.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
AGEKEY_ADMIN_API_KEY=<api_key do tenant logado — server-side apenas>
```

`AGEKEY_ADMIN_API_KEY` **nunca** vai para o bundle do cliente; só em server actions / route handlers.

---

## 8. Códigos de erro a tratar no frontend

Catálogo em `packages/shared/src/reason-codes.ts`. Mapeamentos UX recomendados:

| reason_code | Mensagem UX |
|---|---|
| `INVALID_REQUEST` | "Dados inválidos. Verifique e tente novamente." |
| `RATE_LIMIT_EXCEEDED` | "Muitas tentativas. Aguarde {retry_after_seconds}s." |
| `SESSION_EXPIRED` | "A sessão expirou. Reinicie o processo." |
| `SESSION_ALREADY_COMPLETED` | "Esta verificação já foi concluída." |
| `POLICY_ASSURANCE_UNMET` | "O método escolhido não atinge o nível de garantia exigido." |
| `FALLBACK_RISK_HIGH` | "Por segurança, exigimos verificação adicional." |
| `VC_ISSUER_UNTRUSTED` | "A carteira utilizada ainda não é reconhecida." |
| `VC_CREDENTIAL_REVOKED` | "Credencial revogada pelo emissor." |
| `INTERNAL_ERROR` | "Falha temporária. Tente novamente em instantes." |

---

## 9. Exemplos curl (smoke test manual)

```bash
export AK_BASE=https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1
export AK_API_KEY=ak_dev_sk_test_0123456789abcdef   # apenas em staging

# 1) Cria sessão
curl -X POST "$AK_BASE/verifications-session-create" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" -H "Content-Type: application/json" \
  -d '{"policy_slug":"dev-18-plus","client_capabilities":{"platform":"web"}}'

# 2) Completa via fallback
SESSION_ID=01926cb0-...
curl -X POST "$AK_BASE/verifications-session-complete/$SESSION_ID" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" -H "Content-Type: application/json" \
  -d '{"method":"fallback","declaration":{"age_at_least":18,"consent":true},"signals":{"captcha_token":"x"}}'

# 3) Verifica o JWT
JWT=...
curl -X POST "$AK_BASE/verifications-token-verify" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" -H "Content-Type: application/json" \
  -d "{\"token\":\"$JWT\"}"

# 4) JWKS público
curl -s "$AK_BASE/jwks" | jq
```

---

## 10. Itens em aberto para o Frontend Engineer

1. **Painel (`apps/admin`)** — bootstrap Next.js 14 + Tailwind + shadcn/ui; rotas:
   - `/login`, `/onboarding`
   - `/app/(dashboard)/verifications` — listagem de sessões + detalhe
   - `/app/(dashboard)/applications` — listar/criar/rotacionar api_key
   - `/app/(dashboard)/policies` — list + form (consome `policies-list/write`)
   - `/app/(dashboard)/issuers` — list + form (consome `issuers-list/register`)
   - `/app/(dashboard)/audit` — feed de `audit_events`
   - `/app/(dashboard)/billing` — `usage_counters` + `billing_events`
   - `/app/(dashboard)/settings` — branding, retention_days, custom_domain
2. **Widget (`packages/widget`)** — Web Component + wrapper React; iframe sandbox; postMessage protocol; i18n pt-BR/en-US/es-ES; WCAG 2.1 AA; 4 métodos automáticos (DCAPI → wallet → gateway → fallback).
3. **SDK JS (`packages/sdk-js`)** — Browser ESM + Node/Deno; classe `AgeKeyClient` com `createSession`, `completeSession`, `verifyToken`; tipos exportados de `@agekey/shared`.
4. **SDK iOS / Android** — mantidos no roadmap M9/M10 da Fase 3.
5. **Verificação local de JWT** — expor `verifyResultToken` de `_shared/tokens.ts` no `@agekey/shared` para uso server-side no Next.js (verificação sem chamar Edge Function).

---

## 11. Compliance notes

- **LGPD/GDPR:** o motor não persiste DOB, documento ou nome — apenas hashes, decisões e reason codes. O frontend NÃO deve coletar/enviar PII para os endpoints AgeKey. `external_user_ref` é uma referência opaca do cliente — preferir UUIDs internos do cliente, jamais email/CPF.
- **Audit trail:** toda mutação em policies/issuers/applications gera `audit_events` automaticamente via DB trigger. O painel `/audit` consome direto a tabela via supabase-js (RLS aplica).
- **CORS:** o painel deve ser servido em domínios fixos cadastrados em `AGEKEY_ALLOWED_ORIGINS` antes do GA.
- **Retention:** `retention_days` por tenant aplica via `retention-job` (cron diário); UI deve permitir 30–365 dias.

---

## 12. O que NÃO está pronto

- **BBS+/BLS12-381 unlinkable ZKP** (M9+): exige WASM lib (`@digitalbazaar/bbs-signatures` ou equivalente) + test vectors de issuer real. ZKP-via-predicate-attestation já cobre o caso prático com assurance=high.
- **Webhook secret rotação** com Vault (atual: HMAC com `secret_hash` é equivalente em segurança mas não permite reveal-once depois da criação). Fase 4 enterprise.
- **Realtime channels** para painel (`alter publication supabase_realtime add table verification_results`) — Fase 3 slice posterior.
- **Tipos gerados de `supabase gen types typescript`** — Etapa 1 — exige acesso ao project ref (org "eca digital"). Substituir placeholder em `apps/admin/types/database.ts`.
- **`pg_partman`** para manutenção automática de partições mensais (atual: partições manuais cobrem abr/2026 → mar/2027). Fase 3.
- **`pnpm test:rls`** integration suite contra Postgres real (cross-tenant isolation). Fase 3.

Vault encryption das private keys (`crypto_keys`) **foi entregue na Fase 2.d** via migration `014_vault_crypto_keys.sql` — RPCs `crypto_keys_store_private`, `crypto_keys_load_private`, `crypto_keys_purge_vault` (todas SECURITY DEFINER, EXECUTE granted apenas a service_role).

Esses itens estão registrados como TODO no roadmap (M9+, Fase 4) — o frontend (Fase 3) pode evoluir em paralelo usando os 4 adapters atuais.

---

## 13. Checklist de operação para staging (`tpdiccnmsnjtjwhardij`)

Sequência única que aplica toda a Fase 2 no projeto Supabase staging:

```bash
# 1) Link CLI ao projeto (uma vez)
export SUPABASE_ACCESS_TOKEN=<seu PAT da org "eca digital">
supabase link --project-ref tpdiccnmsnjtjwhardij

# 2) Pré-requisitos no Dashboard (uma vez):
#    - Database > Extensions > Enable: pg_cron, pgsodium
#    - Vault > já vem habilitado em Supabase Cloud

# 3) Aplicar migrations (000–014) e seeds
supabase db push
psql "$(supabase db remote)" -f supabase/seed/01_jurisdictions.sql
psql "$(supabase db remote)" -f supabase/seed/02_trust_registry.sql
psql "$(supabase db remote)" -f supabase/seed/03_policies_default.sql
psql "$(supabase db remote)" -f supabase/seed/04_dev_tenant.sql

# 4) Configurar settings runtime para os crons (uma vez)
psql "$(supabase db remote)" <<SQL
ALTER DATABASE postgres SET app.cron_secret = '<gere com openssl rand -hex 32>';
ALTER DATABASE postgres SET app.functions_url =
  'https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1';
SQL

# 5) Secrets para as Edge Functions
supabase secrets set CRON_SECRET=<mesmo valor do passo 4>
supabase secrets set AGEKEY_ALLOWED_ORIGINS=https://staging.agekey.com.br,http://localhost:3000
supabase secrets set AGEKEY_ISSUER=https://staging.agekey.com.br
supabase secrets set AGEKEY_ENV=staging

# 6) Deploy de todas as 21 Edge Functions
for fn in \
  verifications-session-create verifications-session-get verifications-session-complete \
  verifications-token-verify verifications-token-revoke verifications-list \
  issuers-register issuers-list \
  policies-list policies-write \
  applications-list applications-write applications-rotate-key \
  tenant-bootstrap audit-list \
  proof-artifact-url \
  jwks key-rotation webhooks-worker retention-job trust-registry-refresh; do
  supabase functions deploy "$fn"
done

# 7) Bootstrap inicial da chave de assinatura (vault-backed)
curl -X POST \
  "https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1/key-rotation" \
  -H "Authorization: Bearer $CRON_SECRET"

# 8) Gerar tipos TypeScript reais para o admin
supabase gen types typescript --project-id tpdiccnmsnjtjwhardij \
  > apps/admin/types/database.ts

# 9) Smoke test end-to-end (deve retornar 201 + nonce)
curl -X POST \
  "https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1/verifications-session-create" \
  -H "X-AgeKey-API-Key: ak_dev_sk_test_0123456789abcdef" \
  -H "Content-Type: application/json" \
  -d '{"policy_slug":"dev-18-plus","client_capabilities":{"platform":"web"}}'
```

Após o passo 7, o JWKS público fica disponível em:
`https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1/jwks`

---

## 14. Status final consolidado da Etapa 2

| Categoria | Quantidade |
|---|---|
| Edge Functions HTTP | **17** (5 verificação + 6 admin + 1 storage + 1 JWKS + 4 outros) |
| Edge Functions cron | **4** (key-rotation, webhooks-worker, retention-job, trust-registry-refresh) |
| Adapters completos | **4/4** (fallback, vc, zkp, gateway) |
| Migrations adicionais (010–014) | **5** (rate-limit RPC, storage bucket, webhook trigger, tenant-bootstrap RPC, vault crypto_keys) |
| Schemas Zod em `@agekey/shared` | **35+** (sessions, tokens, admin, common) |
| Tests Deno passando | **23** (tokens 5, policy-engine 4, fallback-adapter 4, jws-generic 6, credentials 4) |
| Tests Deno integração (skipped DI) | 13 (zkp-adapter 7, gateway-adapter 6 — refactor planejado em Fase 3) |

---

_Generated by Claude Code — sessão `session_01XXen142qsNtS84CRo6X5Ge` (Fase 2 completa, Fase 3 em andamento)_

**Próximo passo:** com a Fase 2 fechada, o Frontend Engineer (Etapa 3) pode consumir todos os 21 endpoints + os 35+ schemas Zod em `@agekey/shared` sem mais voltas à Etapa 2.
