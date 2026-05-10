# HML Safety Step-Up — Readiness

**Branch:** `claude/safety-signals-operational-hardening`
**Base SHA:** `0cd4d8e`
**Data:** 2026-05-10
**Escopo:** análise read-only do contrato e helper de step-up de Safety. Sem execução em HML que crie sessões reais; sem PROD.

---

## 1. Contrato auditado

### 1.1 Endpoint público

`POST {BASE_URL}/safety-step-up`

```
Headers:
  X-AgeKey-API-Key: <tenant api key>
  X-Trace-Id: <opcional>
  Content-Type: application/json

Body:
  {
    "safety_alert_id": <uuid>,            // obrigatório
    "policy_slug": <string min1 max64>,   // obrigatório
    "locale": "pt-BR" | "<lang>(-<REGION>)?"  // default "pt-BR"
  }

Response 200:
  {
    "safety_alert_id": <uuid>,
    "step_up_session_id": <uuid>,
    "step_up_expires_at": <ISO8601>,
    "content_included": false,            // invariante
    "pii_included": false                 // invariante
  }
```

Códigos de erro mapeados em `supabase/functions/safety-step-up/index.ts`:

| Status | Causa | Reason code emitido |
| --- | --- | --- |
| 400 | JSON inválido / body não passa schema | `INVALID_REQUEST` |
| 403 | Safety desabilitado ou cross-tenant access | `FORBIDDEN` |
| 404 | `safety_alert_id` não existe ou policy/policy_version não existe | `NOT_FOUND` |
| 405 | Method != POST | `METHOD_NOT_ALLOWED` |

### 1.2 Helper interno

`supabase/functions/_shared/safety/step-up.ts:25` — `createStepUpSession(client, req)`:

- Insere uma linha em `verification_sessions` com:
  - `tenant_id`, `application_id`, `policy_id`, `policy_version_id` resolvidos pelo handler.
  - `status = 'pending'`.
  - `external_user_ref = subject_ref_hmac` da contraparte (ou ator se contraparte ausente).
  - `locale` propagado.
- Retorna `{ session_id, expires_at }` lidos do INSERT.
- **Nunca cria registro de KYC**, nunca dispara documento, nunca contata pessoa.

## 2. Verificações exigidas (do prompt) e status

| Verificação | Status | Evidência |
| --- | --- | --- |
| exige `safety_alert_id` | ✅ | `RequestSchema` em `safety-step-up/index.ts:29` (`z.string().uuid()`) |
| exige `policy_slug` | ✅ | `RequestSchema:30` (`z.string().min(1).max(64)`) |
| cria `verification_session` do Core | ✅ | `step-up.ts:29-44` insere em `verification_sessions` |
| **não cria KYC** | ✅ | Nenhuma chamada a `verifications-session-create` ou tabela KYC; só `verification_sessions` |
| retorna DecisionEnvelope minimizado | ✅ | response shape em `index.ts:113-119` com `content_included=false`, `pii_included=false` |
| não expõe PII | ✅ | `assertPayloadSafe(response, 'public_api_response')` em `index.ts:120` |
| registra audit_event | ⚠ parcial | step-up emite `log.info('safety_step_up_created', …)` mas **não chama `writeAuditEvent`**. Ver §5. |
| funciona com Age Assurance core | ✅ | usa `verification_sessions`, `policies`, `policy_versions` do Core sem desviar do contrato |

## 3. Cross-tenant safety

`safety-step-up/index.ts:76-78`:

```ts
if (alertRow.tenant_id !== principal.tenantId) {
  throw new ForbiddenError('cross-tenant access denied');
}
```

Ataque de tenant A passar UUID de alert do tenant B é bloqueado em duas camadas:

1. RLS na tabela `safety_alerts` — `setTenantContext` define `agekey.tenant_id` antes do SELECT, então `maybeSingle()` retorna `null` para alert de outro tenant (linha 70-74).
2. Defesa em profundidade — comparação explícita `alert.tenant_id !== principal.tenantId` (linha 76-78).

Mesma lógica para `policies` e `policy_versions`: ambos `eq('tenant_id', principal.tenantId)` no SELECT (linhas 81-83).

## 4. Integração com `safety-event-ingest`

Em `supabase/functions/safety-event-ingest/index.ts:309-342`, quando `evalResult.aggregated.step_up_required = true`, o ingest **automaticamente** cria a `verification_session` via `createStepUpSession` e amarra ao `safety_alerts.step_up_session_id`. O endpoint `/safety-step-up` cobre o cenário em que o tenant prefere conduzir o flow do seu lado em vez de aceitar a session criada pelo ingest.

## 5. Lacunas identificadas

### S1 — `audit_events` não é escrito em step-up
O endpoint emite `log.info` mas não chama `writeAuditEvent` como fazem `safety-rules-write` e `safety-retention-cleanup`. Step-up é uma ação operacional administrativa: deveria gerar `audit_event` `safety.step_up.created` com `tenant_id`, `alert_id`, `session_id`, `actor_type='api_key'`. **Severidade**: média. **Ação**: PR doc/test/script é compatível com escopo, **PR de código exigiria smoke-validate antes de PROD** — fica como recomendação, não execução nesta sessão.

### S2 — Locale validation não é exaustiva
Schema permite `^[a-z]{2}(-[A-Z]{2})?$` (ex: `pt-BR`, `en`, `en-US`). Não bate com a lista de locales suportada pelo Core (`pt-BR`, `en-US`, possivelmente `es-ES`). Se o Core rejeitar, o handler propaga erro 500. **Severidade**: baixa. **Ação**: alinhar com lista canônica do Core em rodada futura (não nesta sessão).

### S3 — Não há rate limit dedicado
Diferente de `safety-event-ingest` (que chama `checkRateLimit`), step-up não tem rate limit. Pode permitir abuse criando muitas `verification_sessions` para um único alert. **Severidade**: baixa em HML, média em PROD. **Mitigação atual**: a tabela `verification_sessions` tem RLS por tenant; impacto fica contido. **Ação**: adicionar `checkRateLimit` em rodada futura.

### S4 — Sem teste unitário do helper
Não existe `step-up.test.ts` em `packages/shared/__tests__/`. O helper tem 49 linhas e é simples, mas merece test que:
- Verifica que insert recebe os campos corretos.
- Verifica que erro de DB propaga.
- Verifica que `external_user_ref` é o `subject_ref_hmac` correto.
**Severidade**: baixa. **Ação**: candidato a PR pequeno futuro; não bloqueia.

## 6. Critérios para executar smoke real em HML

Antes de rodar POS-5 do `safety-smoke.sh` (que cria uma `verification_session` real em HML):

1. ✅ Confirmar `SAFETY_ALERT_ID` aponta para um alert metadata-only criado por smoke autorizado (não real de produção, não com PII).
2. ✅ Confirmar `POLICY_SLUG` existe ativo para o tenant (default `dev-13-plus`).
3. ✅ Confirmar que a session resultante será limpa via retention ou marcada como teste.
4. ✅ Operador autorizado a criar sessões em HML.

**Esta sessão NÃO executa POS-5** — depende de `SAFETY_ALERT_ID` real.

## 7. Veredito

- Step-up está **pronto operacionalmente para HML** com smoke.
- Para PROD precisa de:
  - S1 corrigido (audit_event).
  - S3 corrigido (rate limit).
  - Janela própria de release.
  - Decisão executiva sobre habilitar Safety em PROD.
- **Sem ações executadas nesta sessão**.
