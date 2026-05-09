# HML Consent smoke — fix `DecisionEnvelope.expires_at` aceitar offset de timezone

> **Status**: ✅ Fix runtime aplicado em branch `claude/fix-decision-envelope-datetime-offset`. Testes 359/359 ✅. Typecheck 6/6 ✅. Lint clean ✅. **Sem deploy executado, sem alteração em PROD/HML/scripts smoke.**
>
> Alvo do fix: `packages/shared/src/decision/decision-envelope.ts` — 1 linha.
> Alvo dos testes: `packages/shared/__tests__/decision-envelope.test.ts` — 8 novos casos.

## 1. Contexto operacional

Operador rodou `scripts/smoke/consent-smoke.sh` em HML após rotação da `TENANT_API_KEY` (PR #65). Resultado:

- `parental-consent-session` retornou **HTTP 500 InternalError**.
- **trace_id (X-Trace-Id do operador)**: `91809ecd-cf0c-4879-87be-179b938e15fe`.
- Etapas subsequentes (guardian-start, confirm, etc.) ficaram bloqueadas por falta de `consent_request_id` e `guardian_panel_token`.

Safety smoke separadamente: privacy guard 9/9 ✅, núcleo `safety-event-ingest`/`safety-rule-evaluate` ✅. Falhas de contrato em rules-write/step-up/alert-dispatch e cron 403 esperado em aggregates/retention — **tratadas em PR separado para scripts**, não neste documento.

## 2. Causa raiz

### 2.1. Onde o erro ocorreu

Logs da plataforma Supabase (HML) confirmam:

```
POST | 500 | https://wljedzqgprkpqhuazdzv.functions.supabase.co/parental-consent-session
function_id: c646502c-e986-4077-bd12-2ea6b312bc64
version: 21
timestamp: 1778331591690000  (= 2026-05-09 12:59:51 UTC)
execution_time_ms: 1248
```

### 2.2. Evidência de INSERT bem-sucedido

A linha `parental_consent_requests.id = 019e0cd2-a400-797e-bfe7-5776775ce2bf` foi **inserida** com sucesso em HML no mesmo timestamp:

| Campo | Valor |
|---|---|
| `id` | `019e0cd2-a400-797e-bfe7-5776775ce2bf` |
| `tenant_id` | `019de8cd-d297-7db2-8f50-3ab5724d1645` (dev) |
| `application_id` | `019de8cd-d298-74f0-a029-f4258242baf1` (dev-app) |
| `policy_id` | `019de8cd-d298-70a3-9670-08e3959f4a61` (dev-13-plus) |
| `consent_text_version_id` | `019e0337-a9d9-79e5-b82f-0fa173e67d4c` (pt-BR, is_active=true) |
| `status` | `awaiting_guardian` |
| `created_at` | `2026-05-09 12:59:51.677584+00` |

**Conclusão**: o INSERT no DB funcionou. O 500 ocorreu **depois**, dentro do mesmo handler.

### 2.3. Linha exata da falha

`packages/shared/src/decision/decision-envelope.ts` (pré-fix):

```ts
expires_at: z.string().datetime().optional(),
```

Zod `.datetime()` **sem `{ offset: true }`** rejeita strings com offset de timezone. Da documentação Zod:

> The string must be a valid ISO 8601 datetime, but with no timezone offsets or with the literal `Z` suffix.

Em `supabase/functions/parental-consent-session/index.ts:180`:

```ts
expiresAt: req_.expires_at as string,
```

`req_.expires_at` vem do retorno de `.insert(...).select('id, status, expires_at').single()` — o tipo Postgres é `timestamp with time zone` e supabase-js serializa com offset (formato típico: `"2026-05-10T12:59:51.658+00:00"`). Esse valor é então passado para `buildConsentDecisionEnvelope` → `createDecisionEnvelope` → `DecisionEnvelopeSchema.parse()` → **throw ZodError** → cai no `catch` que retorna `InternalError` (500).

### 2.4. Pré-condições de DB validadas (read-only via MCP)

Todas estavam saudáveis na hora do erro — nenhuma é causa do problema:

| Verificação | Resultado |
|---|---|
| `applications.dev-app` em HML | active, hash novo `1624f0d2...` (rotação PR #65) |
| `policies.dev-13-plus` (tenant=dev) | active, `current_version=1` |
| `policy_versions` para policy_id + version=1 | existe (`019de8cd-d2a8-7b0b-b150-8f97d3e1d4c1`) |
| `consent_text_versions` ativo (policy + version=1 + locale=pt-BR) | existe (`019e0337-...`) |
| Enum `parental_consent_status` inclui `awaiting_guardian` | ✅ |
| Schema `parental_consent_requests` compatível com insertPayload | ✅ |

## 3. Por que corrigir no schema canônico (Opção A) e não no call site (Opção B)

### 3.1. Argumento de correção (RFC 3339)

ISO 8601 / RFC 3339 permitem:
- Sufixo `Z` (UTC).
- Offset explícito `±HH:MM` ou `±HH` ou `±HHMM`.

Postgres `timestamp with time zone` ao ser serializado por PostgREST/supabase-js usa tipicamente `+00:00`. Aceitar offset é o **comportamento correto** para o contrato canônico do AgeKey, que precisa transitar timestamps entre Postgres, Edge Functions, JWTs, webhooks, SDKs e UIs.

### 3.2. Por que call-site é insuficiente

O bug ocorre em qualquer caller que construa um envelope a partir de timestamps de DB:

| Função | Padrão similar latente |
|---|---|
| `parental-consent-session` | ✅ confirmado (causa do bug) |
| `parental-consent-confirm` | provável (gera token TTL) |
| `parental-consent-revoke` | provável |
| `safety-event-ingest` | provável (window/expiry) |
| `safety-rule-evaluate` | provável |
| `safety-step-up` | provável |
| `verifications-*` (Core) | provável |

Corrigir só `parental-consent-session/index.ts:180` deixaria as outras 13+ funções com a mesma armadilha latente. Corrigir o schema canônico **resolve todas de uma vez** sem mudanças em runtime — apenas mais permissivo no parse.

### 3.3. Compatibilidade

Mais permissivo, não mais restritivo. Todos os testes existentes (que usam `Z`) continuam passando.

## 4. Implementação

### 4.1. Diff aplicado

`packages/shared/src/decision/decision-envelope.ts`:

```diff
-    expires_at: z.string().datetime().optional(),
+    expires_at: z.string().datetime({ offset: true }).optional(),
```

1 linha. Único arquivo runtime alterado.

### 4.2. Testes adicionados

`packages/shared/__tests__/decision-envelope.test.ts` — novo `describe('expires_at — datetime com timezone offset (RFC 3339)')` com 8 casos:

**Aceitação** (não devem lançar):
1. `2026-05-10T12:59:51.658Z` (UTC com Z).
2. `2026-05-10T12:59:51.658+00:00` (Postgres timestamptz UTC).
3. `2026-05-10T12:59:51.658+02:00` (offset positivo).
4. `2026-05-10T09:59:51.658-03:00` (offset negativo, BRT).
5. `2026-05-10T12:59:51+00:00` (sem milissegundos).

**Rejeição** (devem lançar):
6. `not-a-datetime` (string arbitrária).
7. `2026-05-10 12:59:51+00:00` (espaço no lugar do `T`).
8. `2026-05-10T12:59:51` (naive, sem timezone).

## 5. Validação

### 5.1. Comandos executados

| Comando | Resultado |
|---|---|
| `cd packages/shared && pnpm test -- --run __tests__/decision-envelope.test.ts` | 15/15 passed (era 7 antes, +8 novos) |
| `pnpm test` (raiz, recursivo, todos pacotes) | **359/359 passed** (era 351 antes, +8 novos casos) |
| `pnpm typecheck` (raiz, recursivo) | 6/6 ✅ |
| `pnpm -r lint` | clean (1 warning a11y pré-existente em `apps/admin`) ✅ |

### 5.2. Garantias

- Nenhum teste pré-existente quebrou — todas as 351 baselines continuam verdes.
- Nenhum tipo TypeScript mudou (apenas o runtime de validação Zod).
- Nenhum endpoint mudou de comportamento exceto: agora aceita timestamps com offset que **antes lançavam 500**.

## 6. Impacto esperado

### 6.1. Em runtime (após redeploy)

`parental-consent-session` deixará de retornar 500 ao construir o `decision_envelope` com `expires_at` vindo de Postgres. Outras funções com o mesmo padrão latente também ficam protegidas pela mesma correção.

### 6.2. Em wire format

Nenhuma mudança. O envelope continua exatamente igual ao especificado em `docs/specs/agekey-decision-envelope.md`. Apenas a tolerância do parser foi expandida para o que RFC 3339 já permite.

### 6.3. Em PROD

**Sem impacto até decisão explícita de redeploy em PROD.** Esta PR é apenas de código compartilhado; não toca PROD. PROD não tem o módulo Consent ativo (Phase 1 apenas).

## 7. Plano pós-merge

1. **Após merge desta PR em `main`**: redeploy das **14 funções Consent + Safety** em HML usando o workflow GitHub Actions de PR #64 (ou Supabase CLI local) com `--no-verify-jwt`.
2. **Validação MCP**: `list_edge_functions(wljedzqgprkpqhuazdzv)` para confirmar versions ↑ e `verify_jwt: false` mantido.
3. **Re-rodar consent-smoke.sh**: deve atravessar `parental-consent-session` com HTTP 200, retornar `consent_request_id` + `guardian_panel_token`, permitindo seguir para guardian-start, text-get, confirm, session-get, token-verify, revoke.
4. **Cleanup opcional**: a linha órfã `parental_consent_requests.019e0cd2-a400-797e-bfe7-5776775ce2bf` (criada no momento do 500) ficará em `awaiting_guardian` e expirará naturalmente em 24h. Sem ação imediata necessária.
5. **PR separado**: ajuste dos scripts smoke Safety/Consent para refletir contratos reais (`rule_code/severity/actions`, `safety_alert_id`, cron secrets, slugs HML). **Não misturado** com este fix runtime.

## 8. Constraints respeitadas nesta operação

- ❌ Não toquei em PROD (`tpdiccnmsnjtjwhardij`).
- ❌ Não rodei `db push`, `migration repair`, `db reset`, `db pull`.
- ❌ Não alterei schema, migrations, RLS, dados, feature flags em HML/PROD.
- ❌ Não fiz redeploy de Edge Functions.
- ❌ Não disparei o workflow `Deploy HML Edge Functions`.
- ❌ Não atualizei scripts smoke (PR separado conforme orientação).
- ✅ Apenas: 1 linha runtime + 8 casos de teste + este relatório.
- ✅ Suite de testes 359/359; typecheck 6/6; lint clean.

## 9. Trace e referências

- **trace_id (X-Trace-Id operador)**: `91809ecd-cf0c-4879-87be-179b938e15fe` — usado para correlacionar com a request 500 nos logs de plataforma.
- **trace_id interno (gerado pela função via `newTraceId()`)**: não disponível para o operador externamente; o `X-Trace-Id` do header é o canal correto de correlação.
- **Linha órfã criada pela falha**: `parental_consent_requests.id = 019e0cd2-a400-797e-bfe7-5776775ce2bf`.
- **Função afetada**: `parental-consent-session` v21 em HML.
- **PR de origem do envelope canônico**: PR #62 (Consent hardening, `fa5552e`).
- **Branch deste fix**: `claude/fix-decision-envelope-datetime-offset`.
