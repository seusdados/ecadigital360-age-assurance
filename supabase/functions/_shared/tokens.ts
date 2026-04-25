// Re-export of the platform-agnostic JWS helpers from @agekey/shared.
// Edge Functions pin the import to the workspace path; the runtime is Deno
// but the implementation only depends on Web Crypto, which is identical.

export {
  signResultToken,
  verifyResultToken,
  generateEs256KeyPair,
  fetchJwks,
} from '../../../packages/shared/src/jws.ts';

export type {
  JwsSigningKey,
  VerifyOptions,
  VerifiedToken,
  VerifyReason,
} from '../../../packages/shared/src/jws.ts';
