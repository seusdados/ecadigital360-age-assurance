# Especificação — Contratos canônicos do Core AgeKey

> Versão 1 (rodada `agekey-core-canonical-contracts`).
> Estabelece os contratos compartilhados que o Core, o módulo de Consent
> (próxima rodada) e o módulo de Safety (rodada seguinte) usarão. Tudo aqui
> é **público-seguro**: nenhum payload referenciado nesta spec carrega
> identidade civil, idade exata, documento, nome ou contato direto.

## Visão geral

Os contratos canônicos vivem em `packages/shared/src/` e são publicados pelo
package `@agekey/shared`. Cada módulo tem uma responsabilidade única:

| Domínio | Módulo | Arquivo |
|---|---|---|
| Decisão única assinável | Decision Envelope | `src/decision/decision-envelope.ts` |
| Guarda anti-PII (canônico) | Privacy Guard | `src/privacy-guard.ts` (+ re-export em `src/privacy/privacy-guard.ts`) |
| Catálogo de motivos de decisão | Reason Codes | `src/taxonomy/reason-codes.ts` (+ catálogo runtime em `src/reason-codes.ts`) |
| Faixas e thresholds etários | Age Taxonomy | `src/taxonomy/age-taxonomy.ts` |
| Assinatura HMAC de webhooks | Webhook Signer | `src/webhooks/webhook-signer.ts` |
| Tipos de evento e payload de webhooks | Webhook Types | `src/webhooks/webhook-types.ts` |
| Classes de retenção | Retention Classes | `src/retention/retention-classes.ts` |
| Tipos de policy | Policy Types | `src/policy/policy-types.ts` |
| Engine puro de decisão | Policy Engine | `src/policy/policy-engine.ts` |

Todos os módulos são re-exportados pelo `index.ts` e estão listados no campo
`exports` de `packages/shared/package.json`. Nenhum contrato duplica o
privacy guard nem o schema de token; ambos têm uma única origem.

## Decision Envelope

`DecisionEnvelopeSchema` é a **única** estrutura usada pelo Core para
representar o resultado de uma sessão antes de qualquer assinatura. A partir
dela são derivados:

1. As claims do JWT de resultado (`envelopeToTokenClaims`).
2. O payload do webhook `verification.*`.
3. A linha de `verification_results` no banco.

Garantias:

- `envelope_version` (literal `1`) permite o módulo Consent e o módulo
  Safety acrescentarem campos sem quebrar consumidores existentes.
- `assertDecisionEnvelopeIsPublicSafe()` valida o schema **e** roda o
  privacy guard sobre `evidence` (incluindo `evidence.extra`), bloqueando
  qualquer chave que se pareça com PII.
- A consistência interna é checada por `superRefine`:
  - `expires_at > issued_at`;
  - `decision === 'approved'` exige `threshold_satisfied === true`;
  - `decision === 'denied'` exige `threshold_satisfied === false`.

`envelopeToTokenClaims` é a **única** ponte entre o envelope e o token
público (`ResultTokenClaimsSchema` em `src/schemas/tokens.ts`). A função é
total: tudo que aparece no JWT vem do envelope, então o token não pode
conter informação que o envelope não tinha.

## Privacy Guard (canônico)

O privacy guard mantém a implementação histórica em
`packages/shared/src/privacy-guard.ts` (importada por todas as Edge
Functions e SDKs). O caminho canônico solicitado pela rodada
(`packages/shared/src/privacy/privacy-guard.ts`) é um **re-export** do
mesmo módulo — não há cópia da lista `FORBIDDEN_PUBLIC_KEYS`, conforme a
regra de projeto "não duplicar privacy guard".

## Reason Codes

`src/reason-codes.ts` continua sendo o catálogo runtime importado por
SQL bridges, Edge Functions e SDKs. O módulo canônico
`src/taxonomy/reason-codes.ts`:

- Re-exporta o catálogo live (`REASON_CODES`, `POSITIVE_REASON_CODES`,
  `isPositive`, `ReasonCode`).
- Adiciona uma categorização por prefixo (`categorizeReasonCode`) que o
  painel administrativo e o pipeline de auditoria usam para agrupar
  eventos sem depender da grafia exata.
- Reserva os identificadores `CONSENT_*` e `SAFETY_*` (objeto
  `RESERVED_REASON_CODES`). Estes códigos NÃO são emitidos hoje — mas a
  grafia fica congelada para que adapters externos possam se preparar
  desde já.

## Age Taxonomy

`AgeThresholdSchema` aceita inteiros entre `AGE_THRESHOLD_MIN = 1` e
`AGE_THRESHOLD_MAX = 120`, espelhando o `CHECK` da migração
`002_policies.sql`. `AgeBandSchema` valida bandas inclusivas com
`min <= max` quando ambos os lados estão presentes.

`describeAgeRequirement(threshold, band?)` produz a descrição em pt-BR
usada nos logs de auditoria e no histórico de versões de policy.

`COMMON_AGE_THRESHOLDS = [13, 14, 16, 18, 21]` é apenas o **picker
default**: o schema continua aceitando qualquer inteiro válido.

## Webhook Signer

`signWebhookPayload(secret, body)` calcula HMAC-SHA256 hex da mensagem,
exatamente como o trigger SQL `fan_out_verification_webhooks()` faz com
`pgcrypto.hmac()` em `012_webhook_enqueue.sql`. O receptor da webhook
verifica recomputando o HMAC com sua cópia do secret raw.

Headers canônicos (constantes exportadas):

- `X-AgeKey-Signature` — assinatura hex em minúsculas.
- `X-AgeKey-Delivery-Id` — `idempotency_key` da entrega.
- `X-AgeKey-Event-Type` — nome do evento.

`verifyWebhookPayload(secret, body, signatureHex)`:

- Aceita hex em qualquer caixa.
- Rejeita strings que não são hex de 64 caracteres (assinatura malformada).
- Compara em tempo constante (`constantTimeEqualHex`) — sem oráculo de
  timing.

## Webhook Types

`WEBHOOK_EVENT_TYPES` declara os eventos emitidos hoje:

- `verification.approved`, `verification.denied`, `verification.needs_review`
  (gerados pelo trigger SQL após `verification_results INSERT`).
- `token.revoked`.

`RESERVED_WEBHOOK_EVENT_TYPES` (consent.*, safety.*) é apenas declarativo;
o Core não emite. `WebhookEventPayloadSchema` é uma união discriminada
sobre `event_type` para validar qualquer payload entregue.

## Retention Classes

`RETENTION_CLASSES` traduz os números das migrações em rótulos auditáveis:

| Classe | Cap |
|---|---|
| `ephemeral` | 24h |
| `short_lived` | 30 dias |
| `standard_audit` | 90 dias (default do tenant; teto 365 via tenant) |
| `regulatory` | 5 anos |
| `permanent_hash` | indefinido (apenas hashes irreversíveis) |

`RETENTION_CATEGORIES` mapeia cada categoria de dado para uma classe.
Categorias `consent_*` e `safety_*` aparecem aqui como **reservadas** —
o `retention-job` ainda não as enforce, mas o painel pode mostrar o
plano antes do módulo entrar em produção.

`effectiveRetentionSeconds(category, tenantRetentionDays)` retorna
`min(class.max_seconds, tenantRetentionDays * 86400)`. Quando a classe é
`permanent_hash` (`max_seconds === null`), retorna apenas o cap do
tenant.

## Policy Types

`PolicyDefinitionSchema` é a forma in-memory de uma policy (espelho de
`public.policies`). A invariante `tenant_id IS NULL ⇔ is_template = true`
é validada por `superRefine`, evitando que um row inconsistente saia do
banco e contamine o policy engine.

## Policy Engine

Funções puras (sem I/O) que produzem um `DecisionEnvelope` a partir de
uma `AdapterAttestation`:

1. `selectAdapterMethod(policy, availability)` — primeiro método em
   `policy.method_priority` cujo bit em `availability` é `true`.
2. `deriveAdapterAvailability(client_capabilities)` — heurística
   conservadora: ZKP exige carteira presente; VC aceita carteira ou
   Digital Credentials API; gateway/fallback estão sempre disponíveis.
3. `meetsAssurance(reported, required)` — comparação no rank
   `low < substantial < high`.
4. `evaluatePolicy(policy, attestation)` — três caminhos:
   - Adapter falhou (`threshold_satisfied !== true`): preserva o
     `reason_code` original do adapter, decisão `denied`.
   - Assurance abaixo do exigido: rebatiza para `POLICY_ASSURANCE_UNMET`,
     decisão `denied`.
   - Caso contrário: decisão `approved` com o reason positivo do adapter.
5. `buildDecisionEnvelope(input)` — compõe `evaluatePolicy` com o
   schema do envelope e o privacy guard. Retorna o envelope canônico,
   pronto para ser assinado.

O engine é deterministico: dado o mesmo `input` ele sempre produz o
mesmo envelope. Isso garante que a auditoria reprodutível funcione tanto
em produção quanto em testes locais.

## O que NÃO está aqui

- **Consent**: identidade do consentimento do titular, prova de coleta,
  TTL e revogação. Os reason codes `CONSENT_*`, eventos
  `consent.*` e categoria `consent_*` em retenção já estão reservados.
- **Safety**: scoring de risco, telemetria anonimizada, budget de
  privacidade. Reason codes `SAFETY_*` e evento `safety.risk_flagged`
  reservados.
- **Crypto real de ZKP/SD-JWT-VC** ou **gateway de provedor real**: o
  policy engine não inspeciona o material de prova; ele só consome a
  saída tipada do adapter (`AdapterAttestation`). Não há criptografia
  falsa nem provedor real nesta rodada.

## Mapa de imports

```ts
import {
  // Decision
  DECISION_ENVELOPE_VERSION,
  DecisionEnvelopeSchema,
  envelopeToTokenClaims,
  type DecisionEnvelope,
  // Taxonomy
  AGE_THRESHOLD_MIN, AGE_THRESHOLD_MAX,
  AgeThresholdSchema, AgeBandSchema,
  REASON_CODES, RESERVED_REASON_CODES,
  // Webhooks
  WEBHOOK_EVENT_TYPES,
  WebhookEventPayloadSchema,
  signWebhookPayload, verifyWebhookPayload,
  WEBHOOK_SIGNATURE_HEADER,
  // Retention
  RETENTION_CLASSES, RETENTION_CATEGORIES,
  effectiveRetentionSeconds,
  // Policy
  PolicyDefinitionSchema,
  buildDecisionEnvelope,
} from '@agekey/shared';
```

Imports namespaceados também são suportados (`@agekey/shared/decision/decision-envelope`,
`@agekey/shared/policy/policy-engine`, etc.) e podem ser usados quando o
consumidor quiser apenas um subdomínio.

## Critérios de pronto desta rodada

- `pnpm typecheck` verde.
- `pnpm lint` verde (Next.js admin).
- `pnpm --filter @agekey/shared test` verde — 162 testes.
- Nenhum payload com PII (privacy guard aplicado em
  `assertDecisionEnvelopeIsPublicSafe`).
- Nenhum gateway, ZKP ou SD-JWT-VC real implementado nesta rodada.
- Schemas existentes (`tokens.ts`, `sessions.ts`, `admin.ts`) intactos
  — os novos módulos só consomem.
