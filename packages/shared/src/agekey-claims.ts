import type { ResultTokenClaims } from './schemas/tokens.ts';
import { assertPublicPayloadHasNoPii } from './privacy-guard.ts';

export function assertAgeKeyTokenClaimsArePublicSafe(
  claims: ResultTokenClaims,
): ResultTokenClaims {
  assertPublicPayloadHasNoPii(claims);
  return claims;
}

export function isApprovedAgeKeyToken(claims: ResultTokenClaims): boolean {
  return (
    claims.agekey.decision === 'approved' &&
    claims.agekey.threshold_satisfied === true &&
    claims.exp > Math.floor(Date.now() / 1000)
  );
}
