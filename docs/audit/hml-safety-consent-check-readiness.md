# HML Safety Consent-Check — Readiness

**Branch:** `claude/safety-signals-operational-hardening`
**Base SHA:** `0cd4d8e`
**Data:** 2026-05-10
**Escopo:** análise read-only do helper `consent-check.ts` e da integração entre Safety e o módulo Consent. Sem execução, sem PROD.

---

## 1. Contrato auditado

`supabase/functions/_shared/safety/consent-check.ts:31` — `requestParentalConsentCheck(client, req)`:

```ts
ConsentCheckRequest = {
  tenantId, applicationId,
  policyId, policyVersionId,
  consentTextVersionId,
  resource,                  // ex: "safety/message_sent"
  childRefHmac,              // HMAC opaco da criança (counterparty)
  purposeCodes: ["safety_signal_response"],
  dataCategories: ["interaction_metadata"],
  locale: "pt-BR" | …
}
```

A função:
1. Gera `tokenRaw = "pcpt_" + base64url(32 random bytes)`.
2. Calcula `hashHex = SHA-256(tokenRaw)`.
3. **Descarta o `tokenRaw` raw** após persistir o hash — não retorna ao caller, não loga.
4. Insere em `parental_consent_requests` com:
   - `status = 'awaiting_guardian'`
   - `guardian_panel_token_hash = hashHex`
   - `guardian_panel_token_expires_at = +24h`
   - `expires_at = +24h`
5. Retorna `{ consent_request_id, expires_at }`.

## 2. Quando é chamado

Em `safety-event-ingest/index.ts:344-388`, o helper é invocado **somente quando todos** os seguintes forem verdadeiros:

1. `evalResult.aggregated.parental_consent_required === true` (rule-engine decide).
2. `flags.parentalConsentEnabled === true` (env `AGEKEY_PARENTAL_CONSENT_ENABLED`).
3. `counterparty` está presente e tem `subject_ref_hmac`.

Resolve a primeira `policy` ativa do tenant + a `policy_version` corrente + o `consent_text_versions.is_active=true` correspondente. Se qualquer um faltar, **silenciosamente** não cria o consent_request (linha 357 `if (policyRow) {...}`). O `safety_alert` ainda é criado mas sem `parental_consent_request_id`.

## 3. Regras hoje gatilhando consent-check

Lendo `packages/shared/src/safety/rule-engine.ts` (referenciada nos testes):

| Rule code | Gatilho | `parental_consent_required` quando |
| --- | --- | --- |
| `UNKNOWN_TO_MINOR_PRIVATE_MESSAGE` | adulto desconhecido manda DM para menor | severity=high → action `request_parental_consent_check` |
| `ADULT_MINOR_HIGH_FREQUENCY_24H` | >N msg adulto→menor em 24h | severity=critical → consent + step-up |
| `MEDIA_UPLOAD_TO_MINOR` | upload de mídia destinada a menor | severity=high → consent |
| `EXTERNAL_LINK_TO_MINOR` | link externo enviado a menor | severity=medium → step-up only (não consent) |
| `MULTIPLE_REPORTS_AGAINST_ACTOR` | ≥3 reports/7d contra mesmo ator | severity=critical → human review (não consent) |

Cobertura nos testes: `safety-rule-engine-severity-action.test.ts` (9 cenários) garante invariante severity↔action.

## 4. Verificações exigidas (do prompt) e status

| Verificação | Status | Evidência |
| --- | --- | --- |
| consent-check helper existe | ✅ | `_shared/safety/consent-check.ts` (80 linhas) |
| ligação com Consent | ✅ | insere direto em `parental_consent_requests` (tabela do módulo Consent) |
| reason code usado | ✅ | rule-engine emite `SAFETY_PARENTAL_CONSENT_REQUIRED` (canônico) |
| decision envelope | ✅ | resposta de ingest carrega `actions: [...,"request_parental_consent_check",...]` |
| fluxo quando consent não existe | ✅ documentado §2 — silencioso por design (não bloqueia ingest) |
| fluxo quando consent revoked/expired | ⚠ ver §5 (gap C2) |

## 5. Lacunas identificadas

### C1 — Helper bypassa Edge Function dedicada
O comentário em `consent-check.ts:25-29` declara explicitamente:

> Optamos por chamar diretamente a tabela com service_role em vez de fazer HTTP→Edge Function pra evitar latência. O guardian_panel_token raw é gerado aqui e descartado após o INSERT — caso o tenant precise disponibilizar painel, deve obter via Edge Function própria.

Trade-off explícito: latência menor vs duplicação parcial de lógica. **Risco**: divergência entre `parental-consent-session` (Edge Function canônica) e o INSERT direto. **Mitigação**: ambas escrevem no mesmo schema; tenant deve usar Edge Function dedicada para entregar `tokenRaw` ao guardian. **Severidade**: baixa, já documentada. **Ação**: monitorar nos próximos sprints.

### C2 — Não há rechecagem de consent existente antes de criar novo
Hoje, cada evento que dispara `parental_consent_required` cria um **novo** `parental_consent_request`. Se um consent já existe e está `granted` (válido) para o mesmo `child_ref_hmac` + policy + resource, idealmente o Safety deveria reusá-lo em vez de criar duplicata. **Severidade**: média (custo: enxurrada de requests de consent não úteis para o guardian). **Ação**: PR futuro — adicionar lookup `WHERE status='granted' AND expires_at>now()` antes do INSERT. Não nesta sessão.

### C3 — `consent.revoked`/`consent.expired` não rebloqueiam ingest
Se um consent foi `revoked` posteriormente, eventos novos do mesmo par actor↔counterparty hoje não consideram o estado de consent ao decidir o envelope. **Severidade**: média — política deveria evoluir para "se o consent existe revoked, alertar com severity=high mesmo na primeira mensagem". **Ação**: próximo sprint do Safety.

### C4 — `consent_text_versions` não é versionado por evento
O ingest pega `is_active=true` no momento do alert (linha 366). Se o tenant publicar um novo `consent_text_version` no minuto seguinte, alerts retroativos podem reportar texto diferente do que o guardian assinou. **Severidade**: baixa em HML, **regulatória em PROD**. **Mitigação**: já existe `policy_version_id` snapshotado por requisição; falta o mesmo para `consent_text_version_id`. **Ação**: aprimorar em PR futuro.

### C5 — Sem teste unitário do helper
Não existe `safety-consent-check.test.ts`. Helper tem 80 linhas e gera token + hash. Casos a testar:
- Hash é determinístico para o mesmo input.
- Token raw nunca aparece no retorno.
- INSERT falha → throw propagado.
- `expires_at = +24h` é coerente com `guardian_panel_token_expires_at`.
**Severidade**: baixa. **Ação**: candidato a PR pequeno; não nesta sessão.

## 6. Privacidade — verificação

- ✅ `child_ref_hmac` é o HMAC do counterparty, nunca um identificador real.
- ✅ `purpose_codes` e `data_categories` são valores canônicos (não free-text livre).
- ✅ `tokenRaw` nunca é retornado nem logado; só o `hashHex` persiste.
- ✅ `resource = "safety/${event_type}"` é metadado, não conteúdo.
- ✅ Nenhuma referência a `email`, `phone`, `birthdate` ou `name` é introduzida pelo helper.

Privacy Guard `assertPayloadSafe` **não é chamado** dentro do helper — ele é chamado uma vez, no início do `safety-event-ingest`, antes de qualquer derivação. Isso é correto: o helper recebe valores já validados.

## 7. Veredito

- Consent-check helper está **pronto operacionalmente para HML**.
- Para PROD precisa:
  - C2 resolvido (idempotência por consent existente).
  - C3 resolvido (rebloqueio em consent revoked/expired).
  - C4 resolvido (snapshot de `consent_text_version_id`).
- C1 e C5 são debt menor; podem ser endereçados em sprints separados.
- **Sem ações executadas nesta sessão.**

## 8. Dependência com Consent PROD

Safety PROD **não pode** ir antes de Consent PROD. Razões:

1. `parental_consent_requests` precisa estar populada e auditável em PROD para receber INSERTs do Safety.
2. Edge Functions `parental-consent-session*` precisam estar deployadas em PROD para que o tenant consiga retornar o token ao guardian.
3. Webhooks `consent.*` precisam funcionar para comunicar status entre Safety e o backend do tenant.

A ordem canônica é: **Consent PROD → Safety PROD**, com janela própria para cada um.
