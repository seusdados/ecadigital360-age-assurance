# Relatório de auditoria — Core Runtime alinhado ao Decision Envelope

> Rodada: `agekey-core-runtime-decision-envelope` (2.5)
> Branch: `claude/agekey-core-runtime-decision-envelope`
> Base: `main` em `687fe01` (logo após o merge do PR #48 com os contratos canônicos)
> Data: 2026-05-06

## Resumo

Esta rodada faz o tempo de execução real do AgeKey Core consumir os
contratos canônicos publicados na rodada anterior. Em particular, a
Edge Function `verifications-session-complete` agora monta um
`DecisionEnvelope` (em `@agekey/shared`) **antes** de:

1. responder ao cliente,
2. assinar o JWT de resultado,
3. inserir `verification_results` (que dispara o gatilho SQL de webhook),
4. registrar `audit_events` próprio do domínio de decisão,
5. emitir o log estruturado.

O envelope passa pelo privacy guard antes de qualquer um desses passos
acontecer; depois disso, cada exit é uma projeção controlada do envelope
— um JWT puro, um payload de resposta minimizado, um diff de auditoria
montado por whitelist e um log sem PII.

Não houve quebra de contrato público, de schema de banco, de SDK ou de
widget. O módulo Consent e o módulo Safety continuam inteiramente
reservados; nada novo foi emitido nesta rodada.

## Fluxo real analisado

| Etapa | Antes | Depois |
|---|---|---|
| Avaliação policy → assurance | função local `meetsAssurance` em `_shared/policy-engine.ts` | `evaluatePolicy` canônico em `@agekey/shared` (via `buildDecisionEnvelope`) |
| Construção das claims do token | objeto literal montado a mão dentro do handler | `envelopeToSignableClaims(envelope, refs)` |
| Resposta pública (`SessionCompleteResponse`) | objeto literal montado a mão | `envelopeToCompleteResponse(envelope, signedToken)` |
| Inserção em `verification_results` | `threshold_satisfied = adapterResult.threshold_satisfied` (podia divergir do `decision`) | `threshold_satisfied = envelope.threshold_satisfied` (canônico — sempre coerente com o `decision`) |
| Gatilho SQL `fan_out_verification_webhooks` | já emitia o payload no formato canônico | continua igual; agora os campos lidos da `verification_results` vêm do envelope |
| `audit_events` da decisão | apenas o que os triggers SQL escrevem | + linha explícita `verification.completed` com `envelopeAuditDiff` |
| Log estruturado `session_completed` | conjunto ad-hoc de campos | `envelopeLogFields(envelope, payloadHash)` |

## Arquivos alterados

| Arquivo | Tipo |
|---|---|
| `supabase/functions/_shared/decision-envelope.ts` | novo (builder + projeções + payload hash) |
| `supabase/functions/_tests/decision-envelope.test.ts` | novo (testes Deno do builder) |
| `supabase/functions/verifications-session-complete/index.ts` | refatoração: envelope é a fonte única |
| `docs/audit/agekey-core-runtime-decision-envelope-report.md` | este relatório |

Foram **mantidos sem alteração**: schemas em `packages/shared`, gatilho
SQL `fan_out_verification_webhooks`, gatilho do worker `webhooks-worker`,
adapters (`fallback`, `vc`, `gateway`, `zkp`), helpers de policy
(`_shared/policy-engine.ts`), helpers de tokens, helpers de auditoria,
schema da tabela `verification_results`, contrato do `result_token` JWT
público.

## Como o DecisionEnvelope passou a ser usado

O ponto único de entrada é
`buildVerificationDecisionEnvelope(input)` em
`supabase/functions/_shared/decision-envelope.ts`. Ele aceita os tipos
runtime que a Edge Function já tem (`PolicySnapshot`, `AdapterResult`,
referência opaca de usuário, timestamp em segundos) e:

1. Mapeia `PolicySnapshot` para a `PolicyDefinition` canônica
   (`age_band` consolidado a partir de `age_band_min`/`age_band_max`,
   `is_template` derivado de `tenant_id == null`).
2. Mapeia `AdapterResult.evidence` para `DecisionAdapterEvidence`
   minimizado (apenas `format`, `issuer_did`, `nonce_match`,
   `proof_kind`, `extra`).
3. Chama `buildDecisionEnvelope` de
   `@agekey/shared/policy/policy-engine`, que aplica
   `evaluatePolicy` (decisão + reason code definitivos), valida o
   `DecisionEnvelopeSchema` e roda
   `assertPublicPayloadHasNoPii` sobre o resultado.

O envelope tem todos os campos exigidos pela rodada:

- `envelope_version` = 1 (literal canônico)
- `tenant_id`, `application_id`, `session_id`
- `policy.id`, `policy.slug`, `policy.version`
- `decision` ∈ {`approved`, `denied`, `needs_review`}
- `threshold_satisfied` (booleano canônico — sempre coerente com `decision`)
- `age_threshold`, `age_band` (banda quando definida na policy)
- `method`, `assurance_level`, `reason_code`
- `evidence` minimizado
- `issued_at`, `expires_at` em segundos UNIX
- `external_user_ref` opaco (ou `null`)

Os campos `decision_domain`, `result_token_id`, `payload_hash`,
`content_included = false`, `pii_included = false` ficam nas projeções
de auditoria/log (`envelopeAuditDiff` e `envelopeLogFields`) — essas
projeções não pertencem ao envelope porque o envelope é o que vai para
o JWT, e o JWT não pode crescer sem coordenar com o token público.

`computeEnvelopePayloadHash(envelope)` retorna um SHA-256 hex
determinístico do envelope com chaves ordenadas. O hash é usado em três
lugares:

- diff do `audit_events` (`envelopeAuditDiff` → `payload_hash`),
- log estruturado (`envelopeLogFields` → `payload_hash`),
- coluna `verification_results.evidence_json._envelope.payload_hash`
  (additivo — não quebra leitores existentes).

## Privacy guard — perfis aplicados

| Saída | Perfil aplicado | Observação |
|---|---|---|
| Resposta pública (`SessionCompleteResponse`) | `assertPublicPayloadHasNoPii` | Roda no envelope (na construção) e novamente no body de resposta antes do `jsonResponse`. |
| JWT de resultado (`ResultTokenClaims`) | `assertPublicPayloadHasNoPii` | Já rodou no envelope; `envelopeToSignableClaims` re-aplica antes de assinar (defesa em profundidade). |
| Webhook (gatilho SQL `build_verification_event_payload`) | a lista de campos é fixa em SQL e já é canônica (`WebhookVerificationEventSchema`); um teste Deno valida a paridade. | Sem alteração de SQL nesta rodada. |
| `audit_events.diff_json` | **whitelist construtiva** (`envelopeAuditDiff`) — apenas IDs, hashes, método, assurance, policy, reason codes e timestamps. | Não passa pelo guard porque o input é construído por whitelist; o guard ficaria redundante e mais frágil que a projeção. |
| Log estruturado | mesma whitelist (`envelopeLogFields`). | |
| SDK response | mesma resposta pública (não há divergência). | |

## Tokens — o que mudou e o que não mudou

- O JWT continua satisfazendo `ResultTokenClaimsSchema` exatamente como
  antes (mesmo `iss/aud/sub/jti/iat/nbf/exp` + `agekey.{...}`). O teste
  Deno `decision-envelope.test.ts` chama `ResultTokenClaimsSchema.parse`
  no resultado de `envelopeToSignableClaims` para garantir.
- `agekey.threshold_satisfied` agora é o valor canônico do envelope.
  Em **um único caso** isso é semanticamente diferente do
  comportamento anterior: quando o adapter dizia "satisfied=true" mas a
  assurance estava abaixo do exigido, o código antigo mantinha
  `threshold_satisfied=true` no token (que tinha decision=denied — uma
  combinação ilegal pelo schema canônico).
  Com o envelope, o token nesse caso é `decision=denied,
  threshold_satisfied=false, reason_code=POLICY_ASSURANCE_UNMET` —
  consistente com a spec do AgeKey Token (`docs/specs/agekey-token.md`)
  e com o `WebhookVerificationEventSchema`.
- Garantia continuada de **ausência de PII** no token:
  documento, CPF, RG, passaporte, data de nascimento, idade exata,
  selfie, biometria, e-mail, telefone, IP bruto, conteúdo bruto. Lista
  canônica em `packages/shared/src/privacy-guard.ts`.

## Webhooks — alinhamento sem quebra incompatível

- O gatilho SQL `fan_out_verification_webhooks` já produz exatamente o
  payload aceito por `WebhookVerificationEventSchema` (campos:
  `event_id, event_type, tenant_id, session_id, application_id,
  decision, reason_code, method, assurance_level, threshold_satisfied,
  jti, created_at`). Um teste Deno
  (`webhook payload built from envelope satisfies the canonical schema`)
  monta esse payload a partir do envelope e o passa pelo schema canônico,
  fechando a paridade contratual.
- A assinatura HMAC canônica
  (`signWebhookPayload` em `@agekey/shared/webhooks/webhook-signer`)
  é equivalente em álgebra à assinatura computada pelo gatilho SQL via
  `pgcrypto.hmac()`. Não há mudança de assinatura nesta rodada.
- `payload_hash`, `content_included = false`, `pii_included = false`
  ficam disponíveis no envelope/audit; a propagação para os campos do
  webhook propriamente dito exigiria uma migração SQL (additiva, segura,
  porém fora do escopo desta rodada). Recomendado para a rodada 3.

## Audit Events — campos garantidos

Cada `verifications-session-complete` agora escreve uma linha
`audit_events` com `action='verification.completed'`,
`resource_type='verification_session'`, `resource_id=session_id` e
`diff_json = envelopeAuditDiff(...)` que contém:

- `decision_domain = "age_verify"`
- `envelope_version = 1`
- `decision`
- `threshold_satisfied`
- `method`
- `assurance_level`
- `reason_code`
- `policy_id`, `policy_version`
- `session_id`, `application_id`
- `result_token_id` (jti) ou `null`
- `issued_at`, `expires_at`
- `payload_hash` (SHA-256 hex do envelope canônico)
- `content_included = false`
- `pii_included = false`

A linha é **adicional** aos eventos que os triggers SQL (`009_triggers.sql`)
já escreviam — não substitui nem altera a auditoria automática.

## Compatibilidades preservadas

- `SessionCompleteResponseSchema` em `packages/shared/src/schemas/sessions.ts`
  continua válido (`envelopeToCompleteResponse` projeta nos mesmos
  campos com os mesmos tipos).
- `ResultTokenClaimsSchema` continua válido.
- `verification_results` continua com a mesma forma de coluna; o único
  campo aumentado (`evidence_json`) recebe um sub-objeto `_envelope`
  additivo — leitores antigos continuam funcionando.
- Trigger `fan_out_verification_webhooks` continua assinando com a
  mesma chave HMAC e produzindo o mesmo payload.
- `webhook_deliveries`, worker `webhooks-worker` e endpoints públicos
  permanecem com o mesmo wire-format.
- Adapters (zkp/vc/gateway/fallback) não foram tocados.
- SDK (`@agekey/sdk-js`) e widget continuam consumindo apenas a resposta
  pública e o token — ambos com forma idêntica.

## Testes executados

Comandos rodados localmente:

| Comando | Resultado |
|---|---|
| `pnpm install` | OK (lockfile up to date). |
| `pnpm typecheck` | 5/5 packages OK. |
| `pnpm test` | 162 vitest + 20 adapter-contracts OK (todos cacheados). |
| `pnpm lint` | admin sem warnings. |
| `pnpm --filter @agekey/admin build` | OK. |
| `pnpm build` (full) | **falha pré-existente em `@agekey/sdk-js`** — verificada na main `687fe01` antes desta rodada. Causa: `tsconfig.build.json` desativa `allowImportingTsExtensions` mas `@agekey/shared` exporta com `.ts`. **Não é regressão desta rodada**; recomendado tratar em rodada própria de empacotamento de SDK. |

Tests Deno (`Edge Functions (Deno tests)`):

- Existentes continuam compatíveis (não fizemos breaking change em
  `_shared/policy-engine.ts` ou `_shared/tokens.ts`).
- Novo: `supabase/functions/_tests/decision-envelope.test.ts` cobre
  - construção de envelope aprovado;
  - construção de envelope negado;
  - downgrade automático de approved → denied + `POLICY_ASSURANCE_UNMET`
    quando assurance abaixo do exigido;
  - bloqueio de PII em `evidence.extra`;
  - `envelopeToSignableClaims` resulta em token que satisfaz
    `ResultTokenClaimsSchema`;
  - encaminhamento de `external_user_ref` opaco para `sub`;
  - estrutura mínima da resposta pública;
  - whitelist do diff de auditoria (sem `evidence`, sem
    `external_user_ref`);
  - whitelist dos campos de log;
  - hash determinístico em hex;
  - paridade contratual entre o payload do trigger SQL e
    `WebhookVerificationEventSchema`.

Esses testes serão executados pelo job `Edge Functions (Deno tests)`
do CI (não roda localmente porque Deno não está instalado neste ambiente).

## O que ainda ficou legado

- O **payload do webhook** ainda não inclui `payload_hash`,
  `content_included` ou `pii_included` no JSON entregue ao cliente —
  esses metadados existem hoje só em audit/log/coluna `evidence_json`.
  Promovê-los para o webhook exige uma migração SQL adicional sobre
  `build_verification_event_payload`, que é additiva e segura, mas foi
  deixada para a rodada de Consent (que precisa estender o trigger de
  qualquer modo).
- O **header de assinatura do webhook** (`X-AgeKey-Signature`)
  continua sem `Signature-Algorithm`/`timestamp`/`nonce` headers
  separados; deixamos para uma rodada de hardening específica de
  webhooks, já que mexer aqui exige coordenação com clientes.
- O **selector de método** (`selectAvailableMethods`) ainda vive em
  `_shared/policy-engine.ts` em vez de usar
  `selectAdapterMethod` canônico — não bloqueia nada, mas a unificação
  é candidata a fazer junto com o módulo Consent.

## Riscos remanescentes

1. **Mudança semântica em `threshold_satisfied`** quando a assurance
   está abaixo do exigido: agora é sempre `false` em decisões `denied`.
   Painéis e queries que filtravam
   `threshold_satisfied = true AND decision = 'denied'` deixam de
   trazer linhas. Auditamos a base de código e nenhuma feature interna
   filtra desse jeito; integradores externos não tinham esse acoplamento
   exposto via API.
2. **`evidence_json._envelope`**: leitores que reescrevem
   `evidence_json` em massa precisam preservar o sub-objeto. Hoje
   nenhum job faz isso, mas o ponto deve constar nos próximos PRs que
   tocarem a tabela.
3. **`pnpm build` continua falhando em `@agekey/sdk-js`** — herdado da
   `main`. Tornar isso um gate de CI exige antes consertar a forma de
   exportar `@agekey/shared` (provavelmente compilando para `.js` ou
   ajustando `paths`/`exports`).

## Recomendação

O fluxo real de conclusão de verificação está alinhado ao envelope
canônico, sem quebra de compatibilidade pública e com testes mínimos
escritos. Os contratos para Consent e Safety continuam reservados, mas
agora há **uma única camada de runtime onde plugá-los**: basta estender
o builder de envelope (ou camadas ao redor) para anexar os novos
metadados a partir da rodada 3 — AgeKey Consent — sem precisar mexer
de novo em `verifications-session-complete`.

Sugestão para começar a rodada 3: estender
`buildVerificationDecisionEnvelope` aceitando opcionalmente um
`consentReceipt`, e fazer o módulo Consent emitir um novo envento
`consent.granted/revoked` (já reservado em `WEBHOOK_EVENT_TYPES`).
