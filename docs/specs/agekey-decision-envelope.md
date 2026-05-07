# AgeKey — Decision Envelope (canônico)

> Status: contrato canônico da Rodada 1.
> Implementação: `packages/shared/src/decision/decision-envelope.ts`.

## 1. Finalidade

O **Decision Envelope** é o contrato único de "decisão pública" do AgeKey. Toda resposta pública de qualquer módulo (Core, Consent, Safety Signals e, futuramente, Pass) deve ser este envelope ou uma derivação minimizada dele.

Sem um envelope canônico, três módulos divergentes produzem três contratos divergentes. Painel admin, SDKs, webhooks, API pública e clientes de tenant precisam então conhecer três formatos diferentes para a mesma pergunta — "essa interação foi aprovada, negada, pendente ou precisa revisão?".

## 2. Tipos canônicos

```ts
export type AgeKeyDecisionDomain =
  | "age_verify"
  | "parental_consent"
  | "safety_signal"
  | "credential"
  | "gateway"
  | "fallback";

export type AgeKeyDecisionStatus =
  | "approved"
  | "denied"
  | "pending"
  | "pending_guardian"
  | "pending_verification"
  | "needs_review"
  | "expired"
  | "revoked"
  | "blocked_by_policy"
  | "step_up_required"
  | "rate_limited"
  | "soft_blocked"
  | "hard_blocked"
  | "error";

export type AgeKeySeverity = "info" | "low" | "medium" | "high" | "critical";

export type AgeKeyDecisionEnvelope = {
  decision_id?: string;
  decision_domain: AgeKeyDecisionDomain;
  decision: AgeKeyDecisionStatus;

  tenant_id?: string;
  application_id?: string;
  policy_id?: string;
  policy_version?: string;

  resource?: string;
  scope?: string[];

  verification_session_id?: string;
  result_token_id?: string;
  consent_token_id?: string;
  safety_alert_id?: string;

  assurance_level?: string;
  method?: string;

  reason_code: string;
  reason_codes?: string[];

  risk_category?: string;
  severity?: AgeKeySeverity;

  actions?: string[];
  step_up_required?: boolean;
  parental_consent_required?: boolean;

  expires_at?: string;
  ttl_seconds?: number;

  content_included: false;
  pii_included: false;
};
```

## 3. Regras de uso

1. **`reason_code` é obrigatório** em qualquer envelope, mesmo em status `error`. Um reason code vazio é inaceitável.
2. **`reason_codes` é opcional** e cumulativo — usar quando múltiplas razões coexistirem (ex.: `["SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE", "POLICY_REQUIRES_HUMAN_REVIEW"]`).
3. **`content_included` e `pii_included` são literais `false`** — o envelope é, por definição, livre de PII e livre de conteúdo bruto.
4. **`policy_age_threshold`, `minimum_age` e `age_threshold` não pertencem ao envelope.** Esses valores existem em `policy_versions` e nos claims do token, e representam a **regra do recurso** — nunca a idade do usuário. Se algum módulo precisar transmitir o limiar da política, faz isso pelo `policy_id` + `policy_version` (que apontam para o snapshot imutável).
5. **`scope`, `actions` e `risk_category` são strings controladas** por catálogos próprios de cada módulo. Não devem ser texto livre.
6. **`expires_at` é ISO-8601 UTC**; `ttl_seconds` é inteiro positivo.
7. **`decision_id` é UUID v7** quando presente, alinhado ao padrão das tabelas de decisão.
8. **Nenhum campo pode conter PII**, nem em `risk_category`, nem em `actions`, nem em qualquer outro lugar. Isso é validado pelo Privacy Guard com perfil `public_api_response`.
9. **Nunca incluir** `name`, `email`, `phone`, `cpf`, `rg`, `passport`, `birthdate`, `dob`, `age`, `exact_age`, `selfie`, `face`, `ip`, `gps`, `latitude`, `longitude`, `address`, `message`, `image`, `video`, `audio`, `raw_text`.

## 4. Status canônicos por módulo

| Status | Core/Verify | Consent | Safety Signals |
|---|---|---|---|
| `approved` | Token emitido, política satisfeita | Consentimento aceito pelo responsável | Alerta resolvido positivamente |
| `denied` | Política não satisfeita | Consentimento negado | Alerta confirmado e bloqueio aplicado |
| `pending` | Sessão criada e aguardando conclusão | Solicitação criada e aguardando | Alerta gerado, aguardando triage |
| `pending_guardian` | — | Aguardando ação do responsável | — |
| `pending_verification` | Aguardando complete da sessão | Aguardando OTP/verificação do responsável | Aguardando step-up |
| `needs_review` | Decisão escalada para humano | Texto/política dúbia exige revisão | Alerta exige revisão humana |
| `expired` | Sessão/token expirado | Solicitação/token expirado | Alerta expirado sem ação |
| `revoked` | JTI revogado | Consentimento revogado | Alerta cancelado |
| `blocked_by_policy` | Recurso bloqueado pela política | Consentimento não cobre o recurso | Política bloqueia ação |
| `step_up_required` | Assurance entregue < requerido | — | Safety pede step-up |
| `rate_limited` | Bucket esgotado | Bucket esgotado | Bucket esgotado |
| `soft_blocked` | — | — | Bloqueio temporário/proporcional |
| `hard_blocked` | — | — | Bloqueio definitivo (com revisão) |
| `error` | Erro transversal | Erro transversal | Erro transversal |

## 5. Exemplos

### 5.1 Aprovação Core/Verify

```json
{
  "decision_id": "018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf",
  "decision_domain": "age_verify",
  "decision": "approved",
  "tenant_id": "018f7b8c-dddd-eeee-ffff-2b31319d6eaf",
  "application_id": "018f7b8c-2222-3333-4444-2b31319d6eaf",
  "policy_id": "018f7b8c-5555-6666-7777-2b31319d6eaf",
  "policy_version": "1",
  "resource": "checkout/age-gated-product",
  "verification_session_id": "018f7b8c-1111-7777-9999-2b31319d6eaf",
  "result_token_id": "018f7b8c-2222-7777-9999-2b31319d6eaf",
  "assurance_level": "substantial",
  "method": "vc",
  "reason_code": "AGE_POLICY_SATISFIED",
  "expires_at": "2026-05-04T18:00:00Z",
  "ttl_seconds": 3600,
  "content_included": false,
  "pii_included": false
}
```

### 5.2 Pendência de consentimento parental

```json
{
  "decision_domain": "parental_consent",
  "decision": "pending_guardian",
  "tenant_id": "018f7b8c-dddd-eeee-ffff-2b31319d6eaf",
  "application_id": "018f7b8c-2222-3333-4444-2b31319d6eaf",
  "policy_id": "018f7b8c-5555-6666-7777-2b31319d6eaf",
  "policy_version": "1",
  "resource": "social-feed/post-creation",
  "reason_code": "CONSENT_PENDING_GUARDIAN",
  "parental_consent_required": true,
  "expires_at": "2026-05-05T18:00:00Z",
  "ttl_seconds": 86400,
  "content_included": false,
  "pii_included": false
}
```

### 5.3 Alerta Safety com step-up

```json
{
  "decision_domain": "safety_signal",
  "decision": "step_up_required",
  "tenant_id": "018f7b8c-dddd-eeee-ffff-2b31319d6eaf",
  "application_id": "018f7b8c-2222-3333-4444-2b31319d6eaf",
  "safety_alert_id": "018f7b8c-9999-aaaa-bbbb-2b31319d6eaf",
  "reason_code": "SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE",
  "reason_codes": [
    "SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE",
    "SAFETY_STEP_UP_REQUIRED"
  ],
  "severity": "high",
  "risk_category": "unknown_to_minor_contact",
  "actions": ["request_step_up", "notify_safety_team"],
  "step_up_required": true,
  "content_included": false,
  "pii_included": false
}
```

### 5.4 Erro

```json
{
  "decision_domain": "age_verify",
  "decision": "error",
  "reason_code": "SYSTEM_INTERNAL_ERROR",
  "content_included": false,
  "pii_included": false
}
```

## 6. Validação

A validação canônica é feita em três camadas:

1. **TypeScript** — o tipo `AgeKeyDecisionEnvelope` força `content_included: false` e `pii_included: false` literais.
2. **Privacy Guard** — antes de serializar, o envelope passa pelo perfil `public_api_response` (ou `webhook` quando for entrega assíncrona).
3. **Testes** — `packages/shared/__tests__/decision-envelope.test.ts` cobre payload válido, payload com PII, payload com `reason_code` vazio.

## 7. Não-objetivos

- Não substituir os schemas Zod de cada endpoint específico (`SessionCompleteResponseSchema`, etc.). O envelope é o **denominador comum mínimo** que todo módulo deve produzir; cada endpoint pode acrescentar campos próprios desde que o envelope canônico esteja embarcado.
- Não substituir o `result_token` JWT. O envelope **descreve** a decisão; o token a **prova**. Os dois coexistem.
- Não substituir o registro `verification_results`. O envelope é a **forma pública** da decisão; o registro é o **histórico privado** dela.
