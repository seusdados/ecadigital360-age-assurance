# Relatório de auditoria — Core Canonical Contracts

> Rodada: `agekey-core-canonical-contracts`
> Branch: `claude/agekey-core-contracts-DEy31` (branch designada por
> `BRANCH_README.md` para esta sessão)
> Data: 2026-05-06

## Resumo

Esta rodada transforma a arquitetura canônica do AgeKey em **contratos
TypeScript reais**, compartilhados pelo monorepo via `@agekey/shared`.
O Core fica preparado para receber, em rodadas seguintes, os módulos
**Consent** (registro e prova de consentimento do titular) e **Safety**
(score de risco e budget de privacidade) sem precisar mexer no shape
público dos tokens, dos webhooks ou das classes de retenção.

Nenhum gateway, prova ZKP, SD-JWT-VC ou criptografia foi implementado
de forma simulada. Tudo que toca segredo continua sendo Web Crypto real
(HMAC-SHA256 para webhooks, ES256 para tokens, ambos via `crypto.subtle`).

## Itens entregues

### Código (`packages/shared/src/`)

- `decision/decision-envelope.ts` — envelope canônico `v1` com schema Zod,
  invariantes de consistência (`expires_at > issued_at`, decisão ↔
  `threshold_satisfied`), guarda anti-PII e função total
  `envelopeToTokenClaims` que projeta para `ResultTokenClaimsSchema`.
- `taxonomy/reason-codes.ts` — re-export do catálogo runtime + categorias
  por prefixo + namespace reservado para `CONSENT_*` e `SAFETY_*`.
- `taxonomy/age-taxonomy.ts` — schemas/validadores para `age_threshold`
  (1–120) e `age_band`, mais helper de descrição em pt-BR.
- `webhooks/webhook-signer.ts` — HMAC-SHA256 hex via Web Crypto, com
  comparação em tempo constante e rejeição de hex malformado.
- `webhooks/webhook-types.ts` — `WEBHOOK_EVENT_TYPES`, schemas para os
  eventos `verification.*` e `token.revoked`, `RESERVED_*` para Consent
  e Safety.
- `retention/retention-classes.ts` — 5 classes (`ephemeral`,
  `short_lived`, `standard_audit`, `regulatory`, `permanent_hash`) e
  mapa `RETENTION_CATEGORIES`. `effectiveRetentionSeconds` aplica o min
  entre o cap da classe e a retenção do tenant.
- `policy/policy-types.ts` — `PolicyDefinitionSchema` espelhando a
  tabela `policies` com a invariante template ↔ tenant_id.
- `policy/policy-engine.ts` — pipeline puro
  `selectAdapterMethod → deriveAdapterAvailability → meetsAssurance →
  evaluatePolicy → buildDecisionEnvelope`.
- `privacy/privacy-guard.ts` — re-export do guard existente. Sem
  duplicação de `FORBIDDEN_PUBLIC_KEYS`.
- `index.ts` e `package.json` — novos módulos exportados; subpaths
  publicados em `package.json#exports`.

### Testes

162 testes vitest passam, incluindo:

- `decision/decision-envelope.test.ts` (8 testes) — schema, privacy
  guard, projeção em claims, omissão correta de `sub`.
- `taxonomy/reason-codes.test.ts` (4 testes) — categorização e
  segregação live × reservado.
- `taxonomy/age-taxonomy.test.ts` (8 testes) — limites, bandas
  inválidas, descrições.
- `webhooks/webhook-signer.test.ts` (8 testes) — estabilidade do hash,
  rejeição de hex inválido, comparação constant-time.
- `webhooks/webhook-types.test.ts` (4 testes) — schemas e flags
  live/reservado.
- `retention/retention-classes.test.ts` (8 testes) — ordenação dos caps,
  min-cap, validação de input do tenant.
- `policy/policy-engine.test.ts` (12 testes) — seleção de método,
  derivação de capabilities, escala de assurance, todas as variantes de
  decisão e bloqueio de evidência com PII.

### Documentação

- `docs/specs/agekey-core-canonical-contracts.md` — especificação
  pública dos contratos.
- `docs/audit/agekey-core-canonical-contracts-report.md` — este
  relatório.

## Comandos executados

```sh
pnpm install                  # ok
pnpm --filter @agekey/shared typecheck   # ok
pnpm --filter @agekey/shared test        # 162 passed
pnpm typecheck                # turbo: 5/5 ok
pnpm lint                     # turbo: 1/1 ok (apenas admin tem lint)
```

## Conformidade com o pedido

| Regra do pedido | Status |
|---|---|
| Não duplicar privacy guard | OK — `privacy/privacy-guard.ts` é re-export |
| Não duplicar token schema | OK — `decision-envelope` consome `ResultTokenClaimsSchema` |
| Não quebrar schema existente sem compatibilidade | OK — schemas anteriores intactos |
| Não criar gateway real falso | OK — engine só consome `AdapterAttestation` tipada |
| Não criar ZKP real falso | OK |
| Não criar SD-JWT VC real falso | OK |
| Não incluir PII em payload público | OK — guard roda dentro de `assertDecisionEnvelopeIsPublicSafe` e cobre `evidence.extra` |
| Rodar typecheck/lint/test | OK |
| Criar relatório de auditoria | Este arquivo |

## Limites desta rodada

- **Consent**: apenas reservado (códigos, eventos, categoria de
  retenção). Nada é emitido.
- **Safety**: apenas reservado.
- **Edge Functions**: continuam usando os imports existentes
  (`privacy-guard.ts`, `reason-codes.ts`, `tokens.ts`). Nenhuma função
  foi alterada — o objetivo da rodada é criar os contratos, não migrá-las.

## Próximos passos sugeridos

1. **Adoção interna** — refatorar `verifications-session-complete` para
   produzir um `DecisionEnvelope` antes de assinar e antes de
   enfileirar webhook (uma única fonte da verdade por sessão).
2. **Webhooks** — adicionar header `X-AgeKey-Signature-Algorithm: hmac-sha256`
   na próxima rodada, agora que o signer canônico existe.
3. **Retention-job** — passar a ler `RETENTION_CATEGORIES` em vez de
   inspecionar `tenants.retention_days` diretamente; ganha visibilidade
   por categoria e prepara terreno para Consent.
4. **Consent module** — primeira rodada que sai do "reservado":
   schemas para `consent_receipt`, integração com o envelope (campo
   opcional `consent_ref`), eventos `consent.granted/revoked`.
5. **Safety module** — score de risco assinado, budget de privacidade,
   integração com policy engine via novo predicado.
