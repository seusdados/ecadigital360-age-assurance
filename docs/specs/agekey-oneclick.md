# AgeKey OneClick — Spec (Contract-Ready Layer)

> **STATUS**: contract-ready apenas. Esta PR define tipos, interfaces de
> adapter e adapters desabilitados. NÃO há orquestrador operacional,
> edge functions, migrations ou componentes UI nesta entrega.

## 1. Objetivo do módulo

OneClick é um orquestrador de jornada única que combina:

1. Avaliação de policy (reusa `policy-engine.ts`).
2. Coleta de credential SD-JWT (P4) **ou** prova ZKP (predicate
   attestation hoje, BBS+ em P4).
3. Coleta de consentimento parental quando aplicável (reusa módulo
   `parental_consents` em PROD).
4. Coleta de evidência probatória do consentimento (novo, contract-ready
   nesta PR).
5. Retorno consolidado num decision envelope canônico.

## 2. Por que apenas contract-ready agora?

- O comando original solicitou implementação completa, mas SD-JWT VC e
  BBS+ reais são P4 (bloqueados por escolha de biblioteca, test vectors
  IRTF/IETF, issuer real e revisão criptográfica externa).
- PR #88 (Safety hardening) está em HML modificando exatamente os
  arquivos que o orquestrador OneClick precisaria tocar (`privacy-guard`,
  `decision-envelope`). Sequenciar conservadoramente evita conflitos.
- Parental Consent já está em PROD. Duplicar tabelas e funções causaria
  drift. Antes de operacionalizar, precisamos validar formalmente se
  uma tabela filha `parental_consent_evidence` (FK para
  `parental_consents`) é a melhor opção — decisão deferida.

## 3. Superfície pública (esta PR)

Importe via `@agekey/shared/oneclick`:

```ts
import {
  // Tipos
  type OneclickSessionType,
  type OneclickStatus,
  type OneclickRequiredAction,
  type OneclickAgePredicate,
  type OneclickStartInput,
  type OneclickStartResult,
  type OneclickCompleteInput,
  type OneclickCompleteResult,
  type OneclickDecisionSummary, // placeholder temporário

  // Adapters (default disabled)
  type OneclickCredentialAdapter,
  type OneclickProofAdapter,
  type OneclickConsentEvidenceAdapter,
  disabledOneclickCredentialAdapter,
  disabledOneclickProofAdapter,
  disabledOneclickConsentEvidenceAdapter,

  // Anti-fake-crypto
  ONECLICK_BBS_FORMATS,
  isBbsLikeScheme,

  // Erros
  OneclickFeatureNotImplementedError,
} from '@agekey/shared/oneclick';
```

Para evidência parental, via `@agekey/shared/parental-consent`:

```ts
import {
  type ParentalConsentEvidenceMethod,
  type ParentalConsentEvidenceInput,
  ParentalConsentEvidenceInputSchema,
  FORBIDDEN_EVIDENCE_PII_FIELDS,
  findForbiddenEvidencePiiKeys,
} from '@agekey/shared/parental-consent';
```

Cliente SDK preview, via `@agekey/sdk-js`:

```ts
import {
  OneclickClient,
  OneclickEndpointUnavailableError,
} from '@agekey/sdk-js';
```

## 4. Contratos principais

### `OneclickStartInput` / `OneclickStartResult`

Inicia uma sessão. O resultado contém `requiredActions` que indicam ao
frontend o que coletar antes de chamar `.complete()`.

### `OneclickCompleteInput` / `OneclickCompleteResult`

Submete payloads das ações coletadas. O orquestrador (próxima PR) decide
e devolve `OneclickDecisionSummary`.

### Adapters

Três interfaces puras:

- `OneclickCredentialAdapter` — emite e verifica credenciais (P4).
- `OneclickProofAdapter` — produz e verifica provas (P4 para BBS+ real;
  predicate attestation JWS via adapter existente `_shared/adapters/zkp.ts`
  para o caminho operacional).
- `OneclickConsentEvidenceAdapter` — cria e revoga evidências
  probatórias de consentimento parental.

Cada interface tem um adapter `disabled*` default que sempre nega.
Trocar implementação é responsabilidade da PR que adicionar o
orquestrador operacional.

### `OneclickDecisionSummary` (placeholder temporário)

Projeção mínima usada apenas até #88 mergear. Após #88, este tipo
**será removido** e substituído pela importação direta de
`DecisionEnvelope` canônico de `@agekey/shared/decision`.

## 5. Política anti-fake-crypto

`disabledOneclickProofAdapter` REJEITA qualquer scheme listado em
`ONECLICK_BBS_FORMATS` com `curve_unsupported`. Comportamento espelha
`supabase/functions/_shared/adapters/zkp.ts`. Esta política é coberta
pelo teste `oneclick-proof-adapter-rejects-bbs.test.ts` (vide
`docs/security/agekey-oneclick-no-fake-crypto.md`).

## 6. Política de privacidade da evidência parental

`ParentalConsentEvidenceInputSchema` rejeita as 17 chaves PII listadas
em `FORBIDDEN_EVIDENCE_PII_FIELDS`. Defesa em profundidade independente
do `privacy-guard.ts` global (que está em mudança no #88). Coberto pelo
teste `oneclick-evidence-types.test.ts`.

## 7. Próximos passos

Ver `docs/roadmap/agekey-oneclick-p4-path.md`.
