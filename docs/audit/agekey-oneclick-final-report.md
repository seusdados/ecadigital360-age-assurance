# AgeKey OneClick — Final Report (Contract-Ready PR)

> **Esta PR não cria fluxo produtivo OneClick. Ela prepara contratos, tipos,
> adapters desabilitados e documentação para implementação operacional
> posterior.**

## 1. Branch e PR

- Branch: `claude/agekey-oneclick-contract-ready`
- Base: `main`
- Tipo: **draft** (sempre)
- Título: *Prepare AgeKey OneClick contract layer for SD-JWT, ZKP and
  parental consent integration*

## 2. Arquivos criados

### `packages/shared/src/oneclick/` (novo diretório)

- `types.ts` — `OneclickSessionType`, `OneclickStatus`,
  `OneclickRequiredAction`, `OneclickAgePredicate`,
  `OneclickStartInput`, `OneclickStartResult`, `OneclickCompleteInput`,
  `OneclickCompleteResult`, `OneclickDecisionSummary` (placeholder
  temporário), `OneclickFeatureNotImplementedError`.
- `oneclick-credential-adapter.ts` — interface
  `OneclickCredentialAdapter` + `disabledOneclickCredentialAdapter`.
- `oneclick-proof-adapter.ts` — interface `OneclickProofAdapter` +
  `disabledOneclickProofAdapter` + `ONECLICK_BBS_FORMATS` +
  `isBbsLikeScheme`.
- `oneclick-consent-evidence-adapter.ts` — interface
  `OneclickConsentEvidenceAdapter` +
  `disabledOneclickConsentEvidenceAdapter`.
- `index.ts` — barrel.

### `packages/shared/src/parental-consent/` (novo arquivo, mesma pasta)

- `evidence-types.ts` — `ParentalConsentEvidenceMethod`,
  `ParentalConsentEvidenceInput`, `ParentalConsentEvidenceInputSchema`,
  `FORBIDDEN_EVIDENCE_PII_FIELDS` (17 chaves),
  `findForbiddenEvidencePiiKeys`.

### `packages/sdk-js/src/` (novo arquivo)

- `oneclick.ts` — `OneclickClient` (preview/experimental),
  `OneclickEndpointUnavailableError`.

### `packages/shared/__tests__/` (4 testes novos)

- `oneclick-types.test.ts`
- `oneclick-proof-adapter-rejects-bbs.test.ts`
- `oneclick-credential-adapter-honest-stub.test.ts`
- `oneclick-evidence-types.test.ts`

### `docs/`

- `docs/audit/agekey-oneclick-preflight.md`
- `docs/audit/agekey-oneclick-final-report.md` (este arquivo)
- `docs/specs/agekey-oneclick.md`
- `docs/modules/oneclick/README.md`
- `docs/security/agekey-oneclick-no-fake-crypto.md`
- `docs/roadmap/agekey-oneclick-p4-path.md`

## 3. Arquivos modificados (apenas exports aditivos)

- `packages/shared/src/index.ts` — adiciona
  `export * from './oneclick/index.ts'` (aditivo, não remove nada).
- `packages/shared/src/parental-consent/index.ts` — adiciona
  `export * from './evidence-types.ts'` (aditivo).
- `packages/shared/package.json` — adiciona export `./oneclick`.
- `packages/sdk-js/src/index.ts` — adiciona re-export de
  `OneclickClient`, `OneclickEndpointUnavailableError`,
  `OneclickClientOptions` (marcados `@experimental`).
- `packages/sdk-js/package.json` — adiciona export `./oneclick`.

## 4. Arquivos NÃO modificados (declaração explícita)

Garantia de não-regressão. `git diff main -- <path>` deve ser vazio:

- `packages/shared/src/privacy/privacy-guard.ts` ✓
- `packages/shared/src/decision/decision-envelope.ts` ✓
- `packages/shared/src/webhooks/webhook-types.ts` ✓
- `packages/shared/src/webhooks/webhook-signer.ts` ✓
- `packages/shared/src/retention/retention-classes.ts` ✓
- `packages/shared/src/policy/policy-engine.ts` ✓
- `packages/shared/src/policy/policy-types.ts` ✓
- `packages/shared/src/safety/**` ✓
- `packages/shared/src/credential/types.ts` ✓ (apenas referenciado por
  import-only no novo adapter)
- `packages/shared/src/proof/types.ts` ✓ (idem)
- `packages/shared/src/parental-consent/{otp-utils,otp-templates,panel-token}.ts` ✓
- `packages/shared/src/schemas/parental-consent.ts` ✓
- `supabase/migrations/**` ✓ (zero migrations criadas)
- `supabase/functions/parental-consent-*/` ✓
- `supabase/functions/_shared/adapters/zkp.ts` ✓
- `supabase/functions/_shared/adapters/vc.ts` ✓

## 5. Migrations

**Zero.** Nenhuma migration criada nesta PR (default declarado no plano).
Migration `032_oneclick_and_consent_evidence.sql` é deferida para a PR
seguinte, condicionada à validação do schema com base em uso real do
contrato.

## 6. Edge functions

**Zero criadas. Zero modificadas.** O orquestrador
(`agekey-oneclick-*`) e as funções de evidência
(`parental-consent-evidence-*`) ficam para a PR seguinte.

## 7. Dependência declarada do PR #88

Esta PR foi sequenciada para não conflitar com #88 (Safety operational
hardening + PROD readiness), que está modificando `privacy-guard.ts` e
`decision-envelope.ts`. Os seguintes itens são bloqueados até #88
mergear:

- Substituição de `OneclickDecisionSummary` (placeholder) pelo
  `DecisionEnvelope` canônico.
- Adição de eventos webhook `agekey.oneclick.*` em `webhook-types.ts`.
- Adição de retention classes `ONECLICK_SESSION` e
  `PARENTAL_CONSENT_EVIDENCE` em `retention-classes.ts`.
- Integração de adapter operacional com `privacy-guard.ts`.

## 8. Itens deferidos para P4 (cripto real)

- Tabelas `agekey_credentials`, `agekey_credential_disclosures`,
  `agekey_zkp_schemes`, `agekey_zkp_proofs`.
- Edge functions `issue-sdjwt`, `prove-age-zkp`, `verify-age-zkp` com
  cripto real.
- Implementação real dos adapters (substituindo `disabled*`).
- Threat model criptográfico.

Ver `docs/roadmap/agekey-oneclick-p4-path.md` para a sequência completa.

## 9. Critérios de aceitação verificados

| Critério | Estado |
| --- | --- |
| PR aberta como draft contra `main` | A ser confirmado no push |
| Zero alterações em `privacy-guard.ts` | ✓ |
| Zero alterações em `decision-envelope.ts` | ✓ |
| Zero alterações em `webhook-types.ts` | ✓ |
| Zero alterações em `retention-classes.ts` | ✓ |
| Zero migrations criadas | ✓ |
| Zero alterações em `parental-consent-*` existentes | ✓ |
| Teste `oneclick-proof-adapter-rejects-bbs` verde | A confirmar no CI |
| Teste `oneclick-credential-adapter-honest-stub` verde | A confirmar no CI |
| Teste `oneclick-evidence-types` verde | A confirmar no CI |
| Teste `oneclick-types` verde | A confirmar no CI |
| `pnpm lint` verde | A confirmar |
| `pnpm typecheck` verde | A confirmar |
| `pnpm test` verde | A confirmar |
| `preflight.md` presente | ✓ |
| `final-report.md` presente | ✓ |

## 10. Deploy

Nenhum. Esta PR é puramente código TypeScript + documentação. Sem
artefatos de runtime que exijam deploy a Supabase, Vercel ou similar.

## 11. Próximos passos

1. Mergear PR #88.
2. Abrir PR seguinte (`claude/agekey-oneclick-orchestrator`) que:
   - Substitui `OneclickDecisionSummary` por `DecisionEnvelope`
     canônico.
   - Adiciona migration `032` (se justificada pelo schema review).
   - Adiciona edge functions operacionais.
   - Adiciona eventos webhook e retention classes.
3. Posteriormente, abrir PR P4 com cripto real e UI completa.
