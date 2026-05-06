// Canonical re-export of the privacy guard.
//
// The implementation lives in `../privacy-guard.ts` (the original location
// referenced by every existing edge function and SDK import). This file
// exposes the same surface under the canonical `@agekey/shared/privacy/...`
// path so the Core, Consent and Safety modules import from a stable location.
//
// IMPORTANT: do NOT add a second copy of the FORBIDDEN_PUBLIC_KEYS list — the
// CLAUDE.md rule "Não duplicar privacy guard" is enforced by code review.

export {
  FORBIDDEN_PUBLIC_KEYS,
  findForbiddenPublicPayloadKeys,
  assertPublicPayloadHasNoPii,
  redactTokenForDisplay,
  type PrivacyGuardOptions,
  type PrivacyGuardViolation,
} from '../privacy-guard.ts';
