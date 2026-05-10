# HML — `consent-smoke` pós-migration 031: dois novos bloqueadores diagnosticados

> **Status**: Migration 031 efetivada e validada. Autenticação e fluxo Consent passos 1-3 passaram. Dois bloqueadores remanescentes identificados (causa raiz documentada). Sem alteração em PROD/HML/dados/RLS/flags. Sem novo smoke executado.
>
> Branch: `claude/fix-token-verify-activated-at-column`
> Migration aplicada em HML (referência): `031_fix_guardian_contacts_store` (registro `20260509222948`).
> Commit `main` na investigação: `3394dfeec0e0579374531d2f80ac770ef0a6d3df`.

## 1. Resultado consolidado do smoke pós-031

### 1.1. Autenticação resolvida ✅

`TENANT_API_KEY` rotacionada (PR #68) autenticou com sucesso. Hash em HML bate com SHA-256 da raw local (operador confirmou). Endpoints deixaram de retornar 401 `Invalid api_key`.

### 1.2. Consent passos 1-3 ✅

| Step | Endpoint | Status |
|---|---|---|
| 1 | `parental-consent-session` | HTTP 200, `consent_request_id`, `guardian_panel_token`, `consent_text.id`, `decision_envelope` (`expires_at` em `+00:00`) |
| 2 | `parental-consent-session-get/<id>?token=…` | HTTP 200 |
| 3 | `parental-consent-text-get/<id>?token=…` | HTTP 200 |

`content_included=false` e `pii_included=false` confirmados nas respostas.

### 1.3. Bloqueadores identificados

| Bug | Endpoint | trace_id | Causa raiz | Tipo |
|---|---|---|---|---|
| A | `parental-consent-guardian-start/<id>` | `01bcc9c8-c9c2-44af-b7a1-5b4f36cb2445` | OTP delivery provider em `noop` + `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` desligado | **Configuração de env var em HML** |
| B | `parental-consent-token-verify` | `7ef4c71a-51aa-4d9c-b08c-c479718fecfd` | `loadJwksPublic` faz `.order('rotated_at', …)`, mas a coluna correta é `activated_at` em `crypto_keys` | **Bug de código** |

## 2. Diagnóstico — Bug A (`guardian-start`)

### 2.1. Migration 031 está aplicada e funciona

Validação read-only:

```
schema:           public
function:         guardian_contacts_store(p_consent_request_id uuid, p_contact_value text)
returns:          uuid
security definer: true
search_path:      public, vault
proacl:           postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres
body:             v_secret_id := vault.create_secret(...)   ← API canônica ✅
```

Confirmado: `INSERT INTO vault.secrets` direto **não existe mais**. A migration 031 está vigente.

### 2.2. Estado pós-tentativa de guardian-start (consent_request `019e11d6-f6ef-763e-be17-b5132628836d`)

| Métrica | Valor |
|---|---|
| `parental_consent_requests.status` | `awaiting_guardian` (deveria ser `awaiting_verification`) |
| `guardian_contacts` (count) | **1** (gravado!) |
| `guardian_verifications` (count) | **1** (gravado!) |

**Conclusão**: o RPC `guardian_contacts_store` SUCEDEU. A cifragem via `vault.create_secret()` funcionou. O INSERT de `guardian_verifications` também passou. O erro ocorreu **depois** desses dois passos, **antes** do UPDATE final em `parental_consent_requests`.

### 2.3. Causa raiz exata — `deliverOtp` lança por design

`supabase/functions/_shared/parental-consent/otp.ts:61-65`:

```ts
if (provider.id === NOOP_PROVIDER_ID && !env.devReturnOtp) {
  throw new Error(
    'OTP delivery provider is "noop" but AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP is off — would silently drop. Configure a real provider before going to production.',
  );
}
```

Configuração HML atual (`supabase/functions/_shared/parental-consent/feature-flags.ts:22-25`):

```ts
const provider = Deno.env.get('AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER') ?? 'noop';
const devReturnOtp =
  (Deno.env.get('AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP') ?? '').toLowerCase() ===
    'true' || Deno.env.get('AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP') === '1';
```

Default: `provider='noop'` e `devReturnOtp=false`. Combinação fatal: `deliverOtp` **lança por design** para evitar drop silencioso de OTP em produção sem provider real.

A função handler em `parental-consent-guardian-start/index.ts:192-204` chama `deliverOtp` após criar `guardian_verifications`. Quando `deliverOtp` throw, o catch externo retorna `InternalError` (500) — mas as rows já criadas em `guardian_contacts` e `guardian_verifications` permanecem (não há transação atômica).

### 2.4. Por que isso é configuração e não bug

O comportamento é **intencional**. A mensagem de erro é explicitamente didática: "Configure a real provider before going to production."

Em HML, o caminho correto é setar `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` (provider segue `noop`, mas o OTP é retornado em cleartext na resposta — só seguro em ambiente dev/HML, nunca PROD).

Em PROD, configurar provider real (`AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER=twilio` ou similar) e manter `DEV_RETURN_OTP` desligado.

### 2.5. Ação proposta para Bug A — não posso aplicar, é trabalho do operador

Setar env var no projeto HML (`wljedzqgprkpqhuazdzv`) via Supabase Dashboard → Settings → Edge Functions → Environment variables (ou via API com SUPABASE_ACCESS_TOKEN):

```
AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP = true
```

**Não é env var de aplicação tradicional** — em Supabase Edge Functions, são "secrets". Seu acesso requer permissão administrativa do projeto. Eu, na sessão atual, **não tenho** acesso a esse painel/API.

Após o operador setar o secret, todas as 14 funções Consent + Safety precisam ser **redeployadas** para herdar o novo env (Edge Functions só leem env via `Deno.env.get` no boot do worker; setar o secret não recicla os workers existentes). Use `supabase functions deploy` ou o workflow GHA de PR #64.

**Não autorizo nem proponho redeploy automático nesta sessão.** Operador decide.

### 2.6. Nota sobre cleanup das rows órfãs

`guardian_contacts.id` e `guardian_verifications.id` foram criados para o consent_request `019e11d6-f6ef-763e-be17-b5132628836d` mas não estão usáveis (OTP nunca foi entregue, request status = `awaiting_guardian`). São benignas — expiram naturalmente em 24h via `parental_consent_requests.expires_at` + cron de retention (`safety-retention-cleanup` em conjunto com `028_retention_cron_schedule`).

## 3. Diagnóstico — Bug B (`token-verify`)

### 3.1. Causa raiz exata

`supabase/functions/parental-consent-token-verify/index.ts:30-43`:

```ts
async function loadJwksPublic(client: ReturnType<typeof db>): Promise<...> {
  const { data, error } = await client
    .from('crypto_keys')
    .select('kid, public_jwk_json')
    .eq('status', 'active')
    .order('rotated_at', { ascending: false });   // ← coluna inexistente
  if (error) throw error;                         // ← error aqui dispara catch externo
  ...
}
```

Verificação no schema HML (read-only):

```
crypto_keys.<columns>: id, kid, algorithm, status, public_jwk_json,
  private_key_enc, private_key_iv, activated_at, retired_at,
  created_at, updated_at, vault_secret_id
```

**`rotated_at` não existe.** A coluna semântica equivalente é `activated_at`.

A consulta retorna erro `42703: column "rotated_at" does not exist` → `if (error) throw error` → catch externo de `serve()` → `respondError → InternalError 500`.

### 3.2. Por que cai em "token inválido" no smoke

O smoke envia `'eyJhbGciOiJFUzI1NiJ9.invalid.smoke'` (token sintético inválido). O handler chama:
1. `loadJwksPublic(client)` ← falha aqui (antes mesmo de tentar verificar o JWT) → throw → 500.

Ou seja, o bug **não é específico de tokens inválidos** — afeta toda chamada a `parental-consent-token-verify`, mesmo com token válido. Toda invocação atualmente retorna 500.

### 3.3. Fix code-only proposto (1 linha)

`supabase/functions/parental-consent-token-verify/index.ts:37`:

```diff
-    .order('rotated_at', { ascending: false });
+    .order('activated_at', { ascending: false });
```

Sem mudança de schema, RLS, dados, ou outras funções. Sem migration nova. Apenas redeploy da function `parental-consent-token-verify` em HML após merge.

### 3.4. Validação local

| Comando | Resultado |
|---|---|
| `pnpm test` | 359/359 ✅ |
| `pnpm typecheck --filter @agekey/shared --filter @agekey/admin` | ✅ |
| `pnpm typecheck` (total) | falha pré-existente em `@agekey/website` (deps Next/Node não instaladas; **não causada por este fix** — confirmado via `git stash` em main) |

## 4. Plano de correção consolidado

| Bug | Tipo | Como corrigir | Quem |
|---|---|---|---|
| A — guardian-start | Configuração HML | Setar `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` no Supabase Dashboard de HML + redeploy 14 funções | **Operador** (não posso aplicar) |
| B — token-verify | Código | PR `claude/fix-token-verify-activated-at-column` com `s/rotated_at/activated_at/` + redeploy `parental-consent-token-verify` em HML | Claude (PR aberto após merge → operador autoriza redeploy) |

## 5. Observação de segurança operacional

A raw `TENANT_API_KEY` foi exposta novamente em log/chat. Conforme orientação do operador, a chave atual deve ser tratada como **comprometida** e rotacionada antes de qualquer novo smoke. Mesmo procedimento dos PRs #65 e #68:

1. Operador gera nova raw localmente.
2. Envia somente HASH + PREFIX para Claude.
3. Claude executa UPDATE controlado em `applications` (HML only) sob autorização explícita.
4. Operador roda novo smoke com a nova raw.

**Não vou pedir nem registrar a raw key.** Não vou rodar novo smoke.

## 6. Confirmações de não-ação

- ❌ **PROD intocada.** Zero chamadas MCP contra `tpdiccnmsnjtjwhardij`.
- ❌ Nenhum `db push`, `migration repair`, `db reset`, `db pull`.
- ❌ Nenhuma alteração em schema, migrations, RLS, dados ou feature flags.
- ❌ Nenhum SQL corretivo executado.
- ❌ Nenhum redeploy de Edge Function executado.
- ❌ Nenhum disparo de workflow.
- ❌ Nenhum smoke novo executado.
- ❌ Raw TENANT_API_KEY não solicitada nem registrada.
- ❌ Contato/token/secret não expostos.
- ✅ Apenas: leituras MCP (logs + SQL select) + edição de 1 linha em `parental-consent-token-verify/index.ts` + este relatório.

## 7. Próximos passos (aguardando autorização do operador)

1. **Operador**: setar `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` no Supabase Dashboard de HML (Settings → Edge Functions → Environment variables). **Não fazer em PROD.**
2. **Claude**: abrir PR para o fix code-only do token-verify nesta branch.
3. **Operador**: autorizar merge do PR após CI verde.
4. **Operador**: redeployar 14 funções em HML (provavelmente via workflow GHA do PR #64) — necessário para que o env var Bug A pegue efeito **e** para que o fix Bug B suba.
5. **Operador**: rotacionar a TENANT_API_KEY (raw atual comprometida) antes do novo smoke.
6. **Operador**: rodar novo `consent-smoke.sh` em HML com raw key fresca.
7. **Claude**: validar via MCP logs se novos smokes passam end-to-end.

## 8. Hashes / referências

| Item | Valor |
|---|---|
| trace_id Bug A (guardian-start) | `01bcc9c8-c9c2-44af-b7a1-5b4f36cb2445` |
| trace_id Bug B (token-verify) | `7ef4c71a-51aa-4d9c-b08c-c479718fecfd` |
| consent_request_id da tentativa | `019e11d6-f6ef-763e-be17-b5132628836d` |
| Migration 031 aplicada | `20260509222948` |
| Função afetada Bug A (config) | `parental-consent-guardian-start` v21 (Edge Function) |
| Função afetada Bug B (code) | `parental-consent-token-verify` v21 (Edge Function) |
| HML project ref | `wljedzqgprkpqhuazdzv` |
| PROD project ref | `tpdiccnmsnjtjwhardij` — **não tocado** |
