// Re-export schemas + types from @agekey/shared so SDK consumers don't need
// a separate dependency. Schemas remain available for runtime validation.

export {
  // Common
  VerificationMethodSchema,
  AssuranceLevelSchema,
  VerificationDecisionSchema,
  SessionStatusSchema,
  UuidSchema,
  LocaleSchema,
  ClientCapabilitiesSchema,
  // Sessions
  SessionCreateRequestSchema,
  SessionCreateResponseSchema,
  SessionCompleteRequestSchema,
  SessionCompleteResponseSchema,
  SessionGetResponseSchema,
  // Tokens
  ResultTokenClaimsSchema,
  TokenVerifyRequestSchema,
  TokenVerifyResponseSchema,
  TokenRevokeRequestSchema,
  // Reason codes
  REASON_CODES,
  POSITIVE_REASON_CODES,
  isPositive,
} from '@agekey/shared';

export type {
  // Domain types
  VerificationMethod,
  VerificationDecision,
  AssuranceLevel,
  SessionStatus,
  TokenStatus,
  ClientCapabilities,
  PolicySnapshot,
  AdapterEvidence,
  ReasonCode,
  // Request/response shapes
  SessionCreateRequest,
  SessionCreateResponse,
  SessionCompleteRequest,
  SessionCompleteResponse,
  SessionGetResponse,
  ResultTokenClaims,
  TokenVerifyRequest,
  TokenVerifyResponse,
  TokenRevokeRequest,
} from '@agekey/shared';
