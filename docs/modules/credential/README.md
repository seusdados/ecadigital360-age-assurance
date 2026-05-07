# AgeKey Credential — module overview

> **Status: HONEST STUB.** Spec completa: `docs/specs/agekey-credential-mode.md`.

Este módulo NÃO está implementado em produção. O código fornece apenas:

- Interfaces TypeScript estáveis (`packages/shared/src/credential/`).
- `disabledCredentialVerifier` que sempre retorna `{ valid: false, reason: 'feature_disabled' }`.
- `selectCredentialVerifier` que falha eager (`CredentialModeNotImplementedError`) se `AGEKEY_SD_JWT_VC_ENABLED=true` sem provider real bound.

Para ativar, ver gates de aprovação em `docs/specs/agekey-credential-mode.md` §4.
