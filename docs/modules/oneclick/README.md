# AgeKey OneClick — Module Overview

> **STATUS**: contract-ready apenas. Esta PR não cria fluxo produtivo.

OneClick é o orquestrador planejado para combinar credential, proof e
consentimento parental num único fluxo. Esta PR estabelece a camada de
contratos — sem cripto real, sem migrations, sem edge functions
operacionais.

## Documentos relacionados

- Spec: [`docs/specs/agekey-oneclick.md`](../../specs/agekey-oneclick.md)
- Política no-fake-crypto: [`docs/security/agekey-oneclick-no-fake-crypto.md`](../../security/agekey-oneclick-no-fake-crypto.md)
- Roadmap P4: [`docs/roadmap/agekey-oneclick-p4-path.md`](../../roadmap/agekey-oneclick-p4-path.md)
- Auditoria preflight: [`docs/audit/agekey-oneclick-preflight.md`](../../audit/agekey-oneclick-preflight.md)

## Código entregue nesta PR

- `packages/shared/src/oneclick/` — tipos, adapters desabilitados.
- `packages/shared/src/parental-consent/evidence-types.ts` — schema Zod
  de evidência parental sem PII.
- `packages/sdk-js/src/oneclick.ts` — `OneclickClient` preview.
- `packages/shared/__tests__/oneclick-*.test.ts` — 4 suites.

## O que NÃO está entregue nesta PR

- Migration de schema (zero migrations).
- Edge functions operacionais.
- Componentes React.
- Eventos webhook canônicos (deferido para após PR #88).
- Cripto real SD-JWT/BBS+ (deferida para P4).

## Como contribuir para a próxima fase

Veja `docs/roadmap/agekey-oneclick-p4-path.md` para a sequência de PRs
prevista após o merge de #88.
