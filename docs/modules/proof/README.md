# AgeKey Proof — module overview

> **Status: HONEST STUB.** Spec completa: `docs/specs/agekey-proof-mode.md`.

Este módulo NÃO está implementado em produção. O código fornece apenas:

- Interfaces TypeScript estáveis (`packages/shared/src/proof/`).
- `disabledProofVerifier` que sempre retorna `{ valid: false, reason: 'feature_disabled' }`.
- `selectProofVerifier` que falha eager (`ProofModeNotImplementedError`) se `AGEKEY_ZKP_BBS_ENABLED=true` sem biblioteca BBS+ real bound.

**Predicate attestation JWS** (caminho legado em `_shared/adapters/zkp.ts`) NÃO é Proof Mode — é attestation simples assinada, sem propriedade zero-knowledge. NÃO confundir.

Para ativar Proof Mode real, ver gates de aprovação em `docs/specs/agekey-proof-mode.md` §4.
