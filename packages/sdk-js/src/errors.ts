// Re-export AgeKeyError + subclasses from @agekey/shared for SDK consumers.
//
// SDK consumers should `catch (err)` and inspect `err instanceof AgeKeyError`
// plus `err.reasonCode` to map errors to UX messages — see the catalog in
// `@agekey/shared/reason-codes`.

export {
  AgeKeyError,
  InvalidRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  SessionExpiredError,
  SessionAlreadyCompletedError,
  InternalError,
} from '@agekey/shared';

export type { ErrorBody } from '@agekey/shared';
