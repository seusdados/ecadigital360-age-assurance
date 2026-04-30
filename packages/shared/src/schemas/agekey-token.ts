// AgeKey Token public contract.
//
// The canonical Zod schema for the result token lives in `./tokens.ts`
// (`ResultTokenClaimsSchema`). This file re-exports it under public-contract
// names and exposes the list of forbidden public claim keys so that SDKs,
// adapters and clients import a single, stable surface from
// `@agekey/shared/schemas` or `@agekey/shared`.
//
// Contract reference: docs/specs/agekey-token.md

import { ResultTokenClaimsSchema, type ResultTokenClaims } from './tokens.ts';
import { FORBIDDEN_PUBLIC_KEYS } from '../privacy-guard.ts';

export const AgeKeyTokenPublicClaimsSchema = ResultTokenClaimsSchema;
export type AgeKeyTokenPublicClaims = ResultTokenClaims;

// Forbidden top-level / nested claim keys for the public AgeKey token surface.
// This list is the single source of truth and is enforced by privacy-guard.
export const AgeKeyForbiddenPublicClaimKeys = FORBIDDEN_PUBLIC_KEYS;
