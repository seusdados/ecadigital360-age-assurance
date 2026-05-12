# AgeKey OneClick — Caminho para Produção (P4)

> Esta PR não cria fluxo produtivo OneClick. Ela prepara contratos, tipos,
> adapters desabilitados e documentação para implementação operacional
> posterior.

## Sequência prevista

### Etapa 0 — Esta PR (contract-ready)

- Tipos canônicos, adapters desabilitados, schema Zod de evidência,
  cliente SDK preview, testes anti-fake-crypto, documentação.
- Dependência: nenhuma. Independente.

### Etapa 1 — Após PR #88 mergear (orquestrador operacional)

- Migration `032_oneclick_and_consent_evidence.sql` (a definir):
  tabela `parental_consent_evidence` (FK para `parental_consents`),
  tabela `agekey_oneclick_sessions`, RLS por `current_tenant_id()`,
  triggers de audit.
- Edge functions:
  - `parental-consent-evidence-create`
  - `parental-consent-evidence-revoke`
  - `agekey-oneclick-start`
  - `agekey-oneclick-complete`
- Substituição de `OneclickDecisionSummary` por
  `DecisionEnvelope` canônico.
- Adição de eventos webhook `agekey.oneclick.*` em
  `packages/shared/src/webhooks/webhook-types.ts`.
- Adição de classes de retenção em
  `packages/shared/src/retention/retention-classes.ts`:
  `ONECLICK_SESSION`, `PARENTAL_CONSENT_EVIDENCE`.
- Integração com `privacy-guard.ts` (após estabilizado pelo #88).
- Componentes React (`AgeGate`, `ParentalConsentWizard`,
  `ProofBadge`) em `packages/widget`.

Dependências:
- PR #88 mergeado em `main`.
- Inventário confirmando que tabela filha é necessária (vs. uso direto
  de `parental_consents`).

### Etapa 2 — Cripto real (SD-JWT VC e BBS+)

Pré-requisitos formais:

1. **Biblioteca BBS+** escolhida (CFRG-aligned). Candidatas:
   - `mattrglobal/jsonld-signatures-bbs` (TypeScript + WASM).
   - `bbs-signatures-rs` via WASM.
   - `aries-askar` para storage de chaves.
2. **Biblioteca SD-JWT VC** com suporte a:
   - Key binding (holder binding via WebAuthn ou DID-bound key).
   - StatusList2021 para revogação.
   - Disclosure salting.
3. **Test vectors oficiais** IRTF CFRG (BBS+) e IETF/W3C (SD-JWT VC)
   inseridos em `tests/vectors/`.
4. **Issuer BBS+ real** registrado em `issuers` com
   `trust_status='trusted'`.
5. **StatusList2021** integrada ao `verifications-session-complete`.
6. **Revisão criptográfica externa** (3–6 semanas tipicamente):
   auditoria de assinatura, key binding, disclosure, replay defense.
7. **Hardware security module** para chave do issuer em PROD
   (Vault/KMS).

Entregas desta etapa:

- Migration `0XX` para `agekey_credentials`,
  `agekey_credential_disclosures`, `agekey_zkp_schemes`,
  `agekey_zkp_proofs`.
- Substituição de `disabledOneclickCredentialAdapter` e
  `disabledOneclickProofAdapter` por implementações reais.
- Atualização de `BBS_FORMATS` em `_shared/adapters/zkp.ts` para
  delegar ao crypto-core em vez de retornar `ZKP_CURVE_UNSUPPORTED`.
- Edge functions `issue-sdjwt`, `prove-age-zkp`, `verify-age-zkp`.
- Threat model criptográfico em `docs/security/`.

### Etapa 3 — UI e widgets completos

- `AgeGate`, `ParentalConsentWizard`, `ProofBadge` no `packages/widget`.
- Hooks React (`useOneclick`).
- Documentação de integração para apps consumidores.

## Riscos abertos a vigiar

- **Drift entre `_shared/adapters/zkp.ts` e
  `OneclickProofAdapter`**: ambos listam BBS+ formats. Quando
  crypto-core chegar, atualizar AMBOS atomicamente.
- **Migration `032`** num módulo (Consent) em PROD — exigirá runbook
  de homologação como o usado para `031_fix_guardian_contacts_store`.
- **Dependência circular `oneclick → decision-envelope`**: hoje
  evitada via `OneclickDecisionSummary` placeholder. Após #88, importar
  diretamente do canônico e remover o placeholder.
