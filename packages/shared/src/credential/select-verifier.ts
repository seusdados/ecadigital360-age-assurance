// Selector do verifier de credential.
//
// Comportamento:
//   - Flag desabilitada → `disabledCredentialVerifier` (nega tudo).
//   - Flag habilitada SEM provider configurado → LANÇA erro explícito.
//
// NUNCA retorna verifier que aprova falsamente.

import { disabledCredentialVerifier } from './disabled-verifier.ts';
import type { CredentialEnv, CredentialVerifier } from './types.ts';

function isFlagOn(value: string | boolean | undefined): boolean {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'on' || v === 'yes';
}

export class CredentialModeNotImplementedError extends Error {
  constructor() {
    super(
      'AGEKEY_SD_JWT_VC_ENABLED=true but no SD-JWT VC provider library is bound. ' +
        'Refusing to fabricate verification. See docs/specs/agekey-credential-mode.md ' +
        'for the prerequisites checklist before enabling in production.',
    );
    this.name = 'CredentialModeNotImplementedError';
  }
}

export function selectCredentialVerifier(env: CredentialEnv): CredentialVerifier {
  const credentialMode = isFlagOn(env.AGEKEY_CREDENTIAL_MODE_ENABLED);
  const sdJwtVc = isFlagOn(env.AGEKEY_SD_JWT_VC_ENABLED);

  if (!credentialMode && !sdJwtVc) {
    return disabledCredentialVerifier;
  }

  // Flag(s) ligada(s), mas não há lib real bound. Falha eager.
  throw new CredentialModeNotImplementedError();
}
