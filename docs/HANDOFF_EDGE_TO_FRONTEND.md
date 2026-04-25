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
| issuers-list | GET | `/issuers-list` | full |
| issuers-register | POST | `/issuers-register` | full |
| policies-list | GET | `/policies-list` | full |
| policies-write | POST | `/policies-write` | full |
| proof-artifact-url | POST | `/proof-artifact-url` | full (TTL 300s) |
| jwks | GET | `/jwks` | full (público) |
| key-rotation | POST | `/key-rotation` | cron-only |
| webhooks-worker | POST | `/webhooks-worker` | cron-only |
| retention-job | POST | `/retention-job` | cron-only |
| trust-registry-refresh | POST | `/trust-registry-refresh` | cron-only |

> **Adapters em modo stub (Fase 2.b):** ZKP, VC e Gateway aceitam o contrato e devolvem `decision=denied` com reason codes específicos. Fallback é **completo**. O frontend pode exercitar o fluxo end-to-end via fallback enquanto os adapters criptográficos são implementados.

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

### 2.4 Admin — issuers e policies

Esquemas inline nos READMEs de `supabase/functions/issuers-*` e `supabase/functions/policies-*`. Vou consolidar zod schemas em `@agekey/shared` na próxima fatia (issue tracking).

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
  -d '{"policy_slug":"br-18-plus","client_capabilities":{"platform":"web"}}'

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

- Verificação criptográfica real para ZKP/Gateway (stubs ativos). VC tem implementação JWS funcional para `format='w3c_vc'` em Fase 2.b.
- Integração com providers reais no gateway adapter.
- Encryption real das private keys em `crypto_keys` (placeholder hex; vault pendente).
- Realtime channels (Fase 3).

Esses itens estão registrados como TODO Fase 2.b nos arquivos correspondentes e podem ser entregues sem bloquear a Fase 3 — o frontend pode evoluir em paralelo usando o adapter fallback como exercício de fluxo completo.

---

_Generated by Claude Code — sessão `session_01XXen142qsNtS84CRo6X5Ge` (continuação)_

**Próximo passo:** Copie este documento (e a lista de schemas em `packages/shared/src/schemas/`) ao iniciar o Project "Seusdados Etapa 3 - Engenheiro de Frontend".
