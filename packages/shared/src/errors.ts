import { REASON_CODES, type ReasonCode } from './reason-codes.ts';

export interface ErrorBody {
  error: string;
  reason_code: ReasonCode;
  message: string;
  trace_id?: string;
  details?: unknown;
}

export class AgeKeyError extends Error {
  readonly status: number;
  readonly reasonCode: ReasonCode;
  readonly details?: unknown;

  constructor(
    status: number,
    reasonCode: ReasonCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AgeKeyError';
    this.status = status;
    this.reasonCode = reasonCode;
    this.details = details;
  }

  toBody(traceId?: string): ErrorBody {
    return {
      error: this.name,
      reason_code: this.reasonCode,
      message: this.message,
      ...(traceId ? { trace_id: traceId } : {}),
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

export class InvalidRequestError extends AgeKeyError {
  constructor(message = 'Invalid request', details?: unknown) {
    super(400, REASON_CODES.INVALID_REQUEST, message, details);
    this.name = 'InvalidRequestError';
  }
}

export class UnauthorizedError extends AgeKeyError {
  constructor(message = 'Unauthorized') {
    super(401, REASON_CODES.INVALID_REQUEST, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AgeKeyError {
  constructor(message = 'Forbidden') {
    super(403, REASON_CODES.INVALID_REQUEST, message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AgeKeyError {
  constructor(message = 'Not found') {
    super(404, REASON_CODES.INVALID_REQUEST, message);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AgeKeyError {
  constructor(retryAfterSeconds: number) {
    super(429, REASON_CODES.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', {
      retry_after_seconds: retryAfterSeconds,
    });
    this.name = 'RateLimitError';
  }
}

export class SessionExpiredError extends AgeKeyError {
  constructor() {
    super(409, REASON_CODES.SESSION_EXPIRED, 'Verification session expired');
    this.name = 'SessionExpiredError';
  }
}

export class SessionAlreadyCompletedError extends AgeKeyError {
  constructor() {
    super(
      409,
      REASON_CODES.SESSION_ALREADY_COMPLETED,
      'Verification session already completed',
    );
    this.name = 'SessionAlreadyCompletedError';
  }
}

export class InternalError extends AgeKeyError {
  constructor(message = 'Internal error', details?: unknown) {
    super(500, REASON_CODES.INTERNAL_ERROR, message, details);
    this.name = 'InternalError';
  }
}
