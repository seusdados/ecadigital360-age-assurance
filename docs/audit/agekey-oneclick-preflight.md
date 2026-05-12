# AgeKey OneClick — Preflight Audit

> Esta PR não cria fluxo produtivo OneClick. Ela prepara contratos, tipos,
> adapters desabilitados e documentação para implementação operacional
> posterior.

## 1. Objetivo do preflight

Comando original solicitou módulo `agekey-oneclick` completo: SD-JWT VC,
ZKP/BBS+, consentimento parental probatório, SDK, componentes React,
migrations, edge functions, deploy HML/PROD. A auditoria abaixo justifica
a redução de escopo para uma **camada contract-ready** sem regressão.

## 2. Inventário do que já existe

### 2.1 Parental Consent (PROD)

Implementação completa, em produção a partir de maio/2026.

| Migration | Conteúdo |
| --- | --- |
| `020_parental_consent_core.sql` | `consent_text_versions`, `parental_consent_requests`, `parental_consents`, `parental_consent_tokens`, `parental_consent_revocations` |
| `021_parental_consent_guardian.sql` | `guardian_contacts` (Vault-encrypted), `guardian_verifications` |
| `022_parental_consent_rls.sql` | RLS por `current_tenant_id()`, append-only triggers |
| `023_parental_consent_webhooks.sql` | Triggers de fanout para eventos `parental_consent.*` |
| `031_fix_guardian_contacts_store.sql` | Última migration aplicada |

Edge functions (`supabase/functions/parental-consent-*`):

- `parental-consent-session`
- `parental-consent-session-get`
- `parental-consent-guardian-start`
- `parental-consent-token-verify`
- `parental-consent-confirm`
- `parental-consent-revoke`
- `parental-consent-text-get`

Schemas Zod: `packages/shared/src/schemas/parental-consent.ts` (~442 linhas).
Utilitários: `packages/shared/src/parental-consent/{otp-utils,otp-templates,panel-token}.ts`.
Testes: 7+ arquivos em `packages/shared/__tests__/parental-consent-*.test.ts`.

**Princípios já adotados (a serem respeitados pelo OneClick)**:

- Criança referenciada por `child_ref_hmac` opaco — sem PII direta.
- Texto exibido é versionado e referenciado por hash (`consent_text_versions`).
- `parental_consents` é APPEND-ONLY.
- Token ES256 reusa `crypto_keys` do Core (mesma JWKS).
- Contatos do responsável em `guardian_contacts` cifrados em Vault.

### 2.2 Credential mode (SD-JWT VC) — stub honesto

Arquivos:

- `packages/shared/src/credential/types.ts` — contratos.
- `packages/shared/src/credential/disabled-verifier.ts` — sempre nega com `feature_disabled`.
- `packages/shared/src/credential/select-verifier.ts` — lança `CredentialModeNotImplementedError` se flag ON sem provider.

Flags: `AGEKEY_CREDENTIAL_MODE_ENABLED`, `AGEKEY_SD_JWT_VC_ENABLED` (default off).

Documentação: `docs/specs/agekey-credential-mode.md`.

Bloqueantes para implementação real (P4):

- Biblioteca SD-JWT VC validada externamente.
- Issuer real com chaves rotacionadas.
- Test vectors oficiais (IETF/W3C).
- Revisão criptográfica externa.

### 2.3 Proof mode (ZKP/BBS+) — stub honesto + predicate attestation

Arquivos:

- `packages/shared/src/proof/types.ts` — contratos.
- `packages/shared/src/proof/disabled-verifier.ts` — sempre nega com `feature_disabled`.
- `packages/shared/src/proof/select-verifier.ts` — lança `ProofModeNotImplementedError` se flag ON sem provider.
- `supabase/functions/_shared/adapters/zkp.ts` — implementa **predicate attestation JWS** como caminho operacional default. Rejeita BBS+ real com `ZKP_CURVE_UNSUPPORTED` (constante `BBS_FORMATS`).

Flags: `AGEKEY_PROOF_MODE_ENABLED`, `AGEKEY_ZKP_BBS_ENABLED` (default off).

Documentação: `docs/specs/agekey-proof-mode.md`.

Bloqueantes para BBS+ real (P4): biblioteca BBS+ validada (CFRG-aligned),
test vectors IRTF, StatusList2021, revisão criptográfica externa.

### 2.4 Camada canônica compartilhada (reusada, não tocada)

- `packages/shared/src/decision/decision-envelope.ts`
- `packages/shared/src/privacy/privacy-guard.ts`
- `packages/shared/src/policy/policy-engine.ts`
- `packages/shared/src/webhooks/webhook-signer.ts` + `webhook-types.ts`
- `packages/shared/src/retention/retention-classes.ts`
- `packages/shared/src/taxonomy/{age-taxonomy,reason-codes}.ts`
- `packages/shared/src/safety/{rule-engine,alert-list-filters,audit-sanitize,relationship}.ts`

### 2.5 SDK e widget

- `packages/sdk-js` — `AgeKeyClient` browser-safe (sessões já criadas no servidor).
- `packages/widget` — widget de verificação (i18n, UI).
- **Nenhum** package `@agekey/sdk` ou `@agekey/react` separado existe — convenção atual é estender os pacotes acima.

## 3. Gap analysis (em relação ao comando original)

| Solicitado pelo comando | Estado atual | Decisão |
| --- | --- | --- |
| Tabela `agekey_credentials` | Não existe; tipos só em `credential/` | **Deferida para P4** |
| Tabela `agekey_credential_disclosures` | Não existe | **Deferida para P4** |
| Tabela `agekey_zkp_schemes` / `agekey_zkp_proofs` | Não existe | **Deferida para P4** |
| Tabela `agekey_issuers` | Já existe `issuers` (trust registry) | **Reusar `issuers`** |
| Tabela `agekey_parental_consent_evidence` | Não existe | Avaliar via tipo + adapter; **migration NÃO criada nesta PR** |
| Tabela `agekey_oneclick_sessions` | Não existe | **Próxima PR** (após #88) |
| Edge function `issue-sdjwt` | Não existe | **Deferida para P4** (sem cripto real hoje) |
| Edge function `prove-age-zkp` | Não existe; predicate attestation cobre o caso operacional | **Reusar `_shared/adapters/zkp.ts`** |
| Edge function `verify-age-zkp` | Idem | **Reusar adapter existente** |
| Edge function `parental-consent-evidence` | Não existe | **Adapter contract-ready; integração real na próxima PR** |
| Edge function `agekey-oneclick` orquestrador | Não existe | **Próxima PR** (após #88) |
| Packages `@agekey/sdk`, `@agekey/react` | Não existem; convenção é estender `sdk-js`/`widget` | **Estender `sdk-js` com namespace `oneclick`** |
| Componentes React | Não existem | **Próxima PR** |

## 4. Conflitos com trabalho em andamento

### PR #88 — Safety hardening (em HML)

13 itens P1 pendentes que tocam:

- `packages/shared/src/privacy/privacy-guard.ts`
- `packages/shared/src/decision/decision-envelope.ts`

**Decisão**: esta PR NÃO modifica `privacy-guard`, `decision-envelope`,
`webhook-types`, `retention-classes`. Aguardamos #88 mergear antes de
adicionar:

- Eventos webhook `agekey.oneclick.*`.
- Retention classes específicas (`ONECLICK_SESSION`, `PARENTAL_CONSENT_EVIDENCE`).
- Integração de `OneclickDecisionSummary` com o decision envelope real.

`OneclickDecisionSummary` é um tipo local placeholder documentado como
temporário — não re-declara o subset do decision envelope canônico
(evita divergência futura).

### Outras PRs abertas

- #87, #85, #82, #91 (website/operacional) — sem conflito.
- #28 (webhook management UI) — sem conflito direto; eventos novos serão
  adicionados após #88 mergear.

## 5. Decisão técnica: evidência parental

Análise:

- `parental_consents` é APPEND-ONLY e já agrega o decision envelope.
- `guardian_contacts` cifra contatos em Vault.
- Não há tabela hoje que armazene **prova documental** da coleta
  (hash de evidência, payload assinado, referência de storage).

Opções avaliadas:

1. **Coluna `evidence_hash` em `parental_consents`** — minimalista, mas
   `parental_consents` é append-only e adicionar coluna exige migration
   delicada num módulo em PROD. Não recomendado nesta PR.
2. **Tabela filha `parental_consent_evidence`** — referência por FK,
   sem PII bruta, com `evidence_hash`, `storage_path`, `signed_payload_hash`.
   Recomendada, **mas a migration será criada na PR seguinte**, após
   inventário de schemas em PROD e validação de retention classes.
3. **Adapter abstrato** (esta PR) — define interface + tipo
   `ParentalConsentEvidenceInput` sem PII, com adapter desabilitado
   default. Permite escrever consumidores contract-ready sem decidir
   prematuramente o schema.

**Recomendação**: nesta PR, opção 3. Migration fica para PR seguinte
após decisão formal de schema com base em uso real do contrato.

## 6. Riscos de regressão

- **Baixo** — todos os arquivos criados são novos diretórios
  (`packages/shared/src/oneclick/`, `packages/sdk-js/src/oneclick.ts`,
  `packages/shared/src/parental-consent/evidence-types.ts`).
- `packages/shared/src/index.ts` recebe apenas exports novos (aditivo).
- `packages/shared/package.json` ganha um export adicional (`./oneclick`).
- `packages/sdk-js/src/index.ts` re-exporta `OneclickClient` como
  experimental — não altera `AgeKeyClient` existente.
- Nenhuma migration nova.
- Nenhuma edge function nova.
- Nenhuma alteração em `parental-consent-*` existente.

## 7. Plano de execução desta PR

1. Tipos: `oneclick/types.ts`, `parental-consent/evidence-types.ts`.
2. Adapters desabilitados: `oneclick-credential-adapter.ts`,
   `oneclick-proof-adapter.ts`, `oneclick-consent-evidence-adapter.ts`.
3. Barrel `oneclick/index.ts` + atualizar `shared/index.ts`,
   `shared/package.json`, `parental-consent/index.ts`.
4. SDK: `sdk-js/src/oneclick.ts` (OneclickClient experimental) +
   re-export em `sdk-js/src/index.ts`.
5. Testes: 4 testes obrigatórios em `packages/shared/__tests__/`.
6. Documentação: specs, security policy, roadmap, README.
7. Relatório final.

## 8. Verificação

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

Diff de regressão (deve ser vazio):

```bash
git diff main -- packages/shared/src/privacy/privacy-guard.ts
git diff main -- packages/shared/src/decision/decision-envelope.ts
git diff main -- packages/shared/src/webhooks/webhook-types.ts
git diff main -- packages/shared/src/retention/retention-classes.ts
git diff main -- supabase/migrations/
git diff main -- supabase/functions/parental-consent-
```
