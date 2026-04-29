# @agekey/sdk-js

SDK oficial em JavaScript/TypeScript para o **AgeKey** — plataforma de _age assurance_ com adapters ZKP, Verifiable Credentials, gateway de provedores e fallback assistido.

> **Versão:** 0.0.1
> **Runtimes suportados:** Browsers modernos, Node.js >= 18, Deno, Bun, Cloudflare Workers, Vercel Edge.
> **Dependências de runtime:** apenas `@agekey/shared` e `zod`. Sem `axios`, sem `node-fetch`.

---

## Instalação

```bash
pnpm add @agekey/sdk-js
# ou
npm install @agekey/sdk-js
# ou
yarn add @agekey/sdk-js
```

O pacote expõe duas entradas:

| Entrada | Uso |
|---|---|
| `@agekey/sdk-js` | **Browser** — `AgeKeyClient` para conduzir o fluxo no front-end. |
| `@agekey/sdk-js/server` | **Server** — `AgeKeyServer` para criar sessões, verificar tokens e validar webhooks. |

---

## Modelo de segurança

A API key da AgeKey (`ak_*`) é um **segredo do tenant** e **não pode** entrar no bundle do navegador.

Por isso o fluxo é dividido em duas etapas:

1. **Backend do app integrador** chama `AgeKeyServer.createSession(...)` (passa `X-AgeKey-API-Key`) e devolve a `SessionCreateResponse` para o navegador.
2. **Front-end** instancia `AgeKeyClient` (sem `apiKey`), chama `client.start({ session })` e usa o `SessionHandle` para conduzir a UI até concluir a verificação.

---

## Exemplo Browser — Next.js 14 (App Router)

### Server route handler — cria a sessão

```ts
// app/api/agekey/start/route.ts
import { NextResponse } from 'next/server';
import { AgeKeyServer } from '@agekey/sdk-js/server';

const ageServer = new AgeKeyServer({
  apiKey: process.env.AGEKEY_API_KEY!,
  baseUrl: process.env.NEXT_PUBLIC_AGEKEY_API_BASE,
});

export async function POST(req: Request) {
  const { externalUserRef } = (await req.json()) as { externalUserRef?: string };

  const session = await ageServer.createSession({
    policy_slug: 'dev-18-plus',
    locale: 'pt-BR',
    ...(externalUserRef ? { external_user_ref: externalUserRef } : {}),
    client_capabilities: { platform: 'web' },
  });

  return NextResponse.json(session);
}
```

### Client component — conduz o fluxo

```tsx
'use client';

import { useState } from 'react';
import {
  AgeKeyClient,
  type SessionCreateResponse,
  type ApprovedEvent,
} from '@agekey/sdk-js';

const client = new AgeKeyClient({
  applicationId: process.env.NEXT_PUBLIC_AGEKEY_APP_ID!,
  baseUrl: process.env.NEXT_PUBLIC_AGEKEY_API_BASE,
  locale: 'pt-BR',
});

export function VerifyAgeButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'approved' | 'denied'>(
    'idle',
  );

  async function start() {
    setStatus('running');

    // 1) Pede ao seu backend para criar a sessão (server-to-server).
    const resp = await fetch('/api/agekey/start', { method: 'POST' });
    const session = (await resp.json()) as SessionCreateResponse;

    // 2) Inicia o handle no navegador.
    const handle = client.start({ session });

    handle.on('approved', (e: ApprovedEvent) => {
      setStatus('approved');
      // Envie e.jwt para o seu backend para registrar o resultado.
      fetch('/api/agekey/finalize', {
        method: 'POST',
        body: JSON.stringify({ jwt: e.jwt }),
      });
    });

    handle.on('denied', (e) => {
      setStatus('denied');
      console.warn('Verificação negada:', e.reasonCode);
    });

    handle.on('error', (e) => {
      console.error('Erro na verificação:', e.error);
    });

    // 3) Conclui via fallback (declaração assistida).
    //    Em apps reais você dará ao usuário a opção de Wallet (VC), gateway, etc.
    await handle.completeFallback({
      ageAtLeast: 18,
      captchaToken: 'turnstile_token_aqui',
    });
  }

  return (
    <button onClick={start} disabled={status === 'running'}>
      Verificar idade ({status})
    </button>
  );
}
```

### Trocar de método dinamicamente

```ts
const handle = client.start({ session });

if (handle.availableMethods.includes('vc')) {
  handle.selectMethod('vc');
  await handle.completeVc({
    credential: presentationJwt,
    format: 'sd_jwt_vc',
    issuerDid: 'did:web:wallet.exemplo.com',
    presentationNonce: session.challenge.nonce,
  });
}
```

### Cancelar uma sessão em andamento

```ts
const handle = client.start({ session });

const timeout = setTimeout(() => handle.cancel(), 30_000);

try {
  await handle.completeGateway({
    attestation: providerJwt,
    provider: 'yoti',
  });
} finally {
  clearTimeout(timeout);
}
```

---

## Exemplo Node.js — Express

### Backend completo: criar sessão + finalizar + webhook

```ts
import express from 'express';
import {
  AgeKeyServer,
  AgeKeyError,
  RateLimitError,
} from '@agekey/sdk-js/server';

const app = express();
const ageServer = new AgeKeyServer({
  apiKey: process.env.AGEKEY_API_KEY!,
  baseUrl: process.env.AGEKEY_API_BASE,
  issuer: process.env.AGEKEY_ISSUER, // default: https://agekey.com.br
});

// 1) Criar sessão (chamada do front-end → seu backend → AgeKey)
app.post('/api/agekey/start', express.json(), async (req, res) => {
  try {
    const session = await ageServer.createSession({
      policy_slug: 'dev-18-plus',
      external_user_ref: String(req.body.externalUserRef ?? ''),
      client_capabilities: { platform: 'web' },
    });
    res.json(session);
  } catch (err) {
    if (err instanceof RateLimitError) {
      res.status(429).json(err.toBody());
      return;
    }
    if (err instanceof AgeKeyError) {
      res.status(err.status).json(err.toBody());
      return;
    }
    res.status(500).json({ error: 'internal' });
  }
});

// 2) Finalizar — recebe o JWT do front e verifica localmente (JWKS cacheada)
app.post('/api/agekey/finalize', express.json(), async (req, res) => {
  const { jwt } = req.body as { jwt: string };
  const result = await ageServer.verifyToken(jwt, {
    expectedAudience: process.env.AGEKEY_AUDIENCE!,
  });
  if (!result.valid || !result.claims) {
    res.status(403).json({ error: 'invalid_token', reason: result.reason });
    return;
  }
  // Persistir result.claims.agekey.{decision, reason_code, jti, exp} no DB.
  res.json({ ok: true, decision: result.claims.agekey.decision });
});

// 3) Webhook — body raw é OBRIGATÓRIO para HMAC bater
app.post(
  '/api/agekey/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const signature = req.header('x-agekey-signature') ?? '';
      const payload = await ageServer.registerWebhookHandler(
        req.body, // Buffer (express.raw)
        signature,
        process.env.AGEKEY_WEBHOOK_SECRET_HASH!,
      );
      // Idempotência: deduplique por payload.event_id antes de processar.
      console.log('Webhook recebido:', payload.event_type, payload.session_id);
      res.sendStatus(204);
    } catch (err) {
      // Assinatura inválida => 400. Não devolva 5xx senão o cron retenta para sempre.
      res.status(400).json({ error: 'invalid_signature' });
    }
  },
);

app.listen(3000);
```

### Revogar token

```ts
await ageServer.revokeToken(
  '01926cb0-aaaa-7aaa-aaaa-aaaaaaaaaaaa',
  'usuário deslogou',
);
```

### Baixar artefato de prova

```ts
const url = await ageServer.getArtifactUrl(artifactId); // TTL 300s
const blob = await fetch(url).then((r) => r.blob());
```

---

## API — Browser (`@agekey/sdk-js`)

### `class AgeKeyClient`

| Método | Descrição |
|---|---|
| `new AgeKeyClient({ applicationId, baseUrl?, locale?, fetch? })` | Cria o cliente. **Não** aceita `apiKey`. |
| `start({ session })` | Recebe a `SessionCreateResponse` obtida no servidor e devolve um `SessionHandle`. |

### `class SessionHandle`

| Método / Propriedade | Descrição |
|---|---|
| `sessionId`, `availableMethods`, `preferredMethod`, `expiresAt`, `method` | Metadados da sessão. |
| `selectMethod(method)` | Troca o método ativo (deve constar em `availableMethods`). |
| `completeFallback({ ageAtLeast, captchaToken?, deviceFingerprint? })` | Declaração assistida (assurance `low`). |
| `completeVc({ credential, format, issuerDid, presentationNonce? })` | Apresenta uma VC ou SD-JWT-VC. |
| `completeZkp({ proof, proofFormat?, issuerDid })` | Submete prova de conhecimento zero. |
| `completeGateway({ attestation, provider })` | Submete atestação de provedor terceiro. |
| `refresh()` | Reconsulta a visão pública da sessão (sem PII). |
| `cancel()` | Aborta requisições pendentes (`AbortController`). |
| `on('approved' \| 'denied' \| 'needs_review' \| 'error', cb)` | Assina eventos. Retorna função de unsubscribe. |

### Eventos

```ts
type ApprovedEvent     = { jwt; jti; expiresAt; kid; reasonCode; method; claims? };
type DeniedEvent       = { reasonCode; method };
type NeedsReviewEvent  = { reasonCode; method };
type ErrorEvent        = { error: Error; reasonCode? };
```

---

## API — Server (`@agekey/sdk-js/server`)

### `class AgeKeyServer`

| Método | Descrição |
|---|---|
| `new AgeKeyServer({ apiKey, baseUrl?, issuer?, fetch? })` | Cria o cliente server-side. `apiKey` é **obrigatório**. |
| `createSession(input, init?)` | `POST /verifications-session-create` — server-to-server. |
| `getSession(sessionId)` | `GET /verifications-session-get/:id` — visão pública. |
| `verifyToken(jwt, opts?)` | Valida o JWT. `opts.fetchJwks=true` (default) verifica localmente com JWKS cacheada (5 min). `false` chama `/verifications-token-verify`. |
| `revokeToken(jti, reason)` | `POST /verifications-token-revoke`. |
| `getArtifactUrl(artifactId)` | `POST /proof-artifact-url` — devolve URL assinada (TTL 300s). |
| `registerWebhookHandler(rawBody, signatureHeader, secretHashHex)` | Verifica HMAC-SHA256 e devolve o payload decodificado. |

---

## Tratamento de erros

Todos os erros HTTP herdam de `AgeKeyError` (re-exportado de `@agekey/shared`):

```ts
import { AgeKeyError, RateLimitError, SessionExpiredError } from '@agekey/sdk-js';

try {
  await handle.completeFallback({ ageAtLeast: 18 });
} catch (err) {
  if (err instanceof RateLimitError) {
    // err.details.retry_after_seconds
  } else if (err instanceof SessionExpiredError) {
    // err.reasonCode === 'SESSION_EXPIRED'
  } else if (err instanceof AgeKeyError) {
    // err.status, err.reasonCode, err.message
  }
}
```

Catálogo completo de `reason_code` em `@agekey/shared/reason-codes` e mapeamentos de UX recomendados em `docs/HANDOFF_EDGE_TO_FRONTEND.md` §8.

---

## Variáveis de ambiente recomendadas

```dotenv
# Server-side apenas (NUNCA exponha no bundle)
AGEKEY_API_KEY=ak_live_...
AGEKEY_WEBHOOK_SECRET_HASH=sha256_em_hex_do_segredo_do_webhook

# Compartilhadas (podem ir para o NEXT_PUBLIC_)
NEXT_PUBLIC_AGEKEY_API_BASE=https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1
NEXT_PUBLIC_AGEKEY_APP_ID=meu-app
NEXT_PUBLIC_AGEKEY_ISSUER=https://agekey.com.br
```

---

## Compliance

- **LGPD/GDPR:** o motor não recebe nem persiste PII (DOB, documento, nome). `external_user_ref` é uma referência opaca do cliente — recomenda-se usar UUIDs internos, jamais email/CPF.
- **CORS:** o domínio do front-end deve estar registrado em `AGEKEY_ALLOWED_ORIGINS` antes de produção.
- **Tokens:** verifique sempre `jti` para idempotência e `exp` para expiração; revogue via `revokeToken` em logout.

---

## Tipos exportados

```ts
import type {
  // Browser
  AgeKeyClientOptions,
  SessionHandle,
  ApprovedEvent,
  DeniedEvent,
  NeedsReviewEvent,
  ErrorEvent,
  FallbackCompleteInput,
  VcCompleteInput,
  ZkpCompleteInput,
  GatewayCompleteInput,

  // Server
  AgeKeyServerOptions,
  AgeKeyWebhookPayload,

  // Re-exportados de @agekey/shared
  ResultTokenClaims,
  ReasonCode,
  VerificationMethod,
  VerificationDecision,
  AssuranceLevel,
  SessionCreateRequest,
  SessionCreateResponse,
  SessionCompleteRequest,
  SessionCompleteResponse,
} from '@agekey/sdk-js';
```

---

## Licença

Apache-2.0
