// Re-export shared error classes from @agekey/shared and add Edge-side helpers.
// In Deno we use a path-based import; the npm package equivalent is
// "@agekey/shared". Both resolve to the same source files at runtime.

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
} from '../../../packages/shared/src/errors.ts';

export type { ErrorBody } from '../../../packages/shared/src/errors.ts';
export {
  REASON_CODES,
  type ReasonCode,
  isPositive,
} from '../../../packages/shared/src/reason-codes.ts';

import {
  AgeKeyError,
  InternalError,
} from '../../../packages/shared/src/errors.ts';
import { corsHeaders } from './cors.ts';
import { log } from './logger.ts';

export function jsonResponse(
  body: unknown,
  init: { status?: number; origin: string | null; headers?: Record<string, string> } = {
    origin: null,
  },
): Response {
  const status = init.status ?? 200;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(init.origin),
      ...(init.headers ?? {}),
    },
  });
}

export interface ResponseContext {
  origin: string | null;
  trace_id: string;
  fn: string;
}

export function respondError(ctx: ResponseContext, err: unknown): Response {
  if (err instanceof AgeKeyError) {
    log.warn('error_response', {
      fn: ctx.fn,
      trace_id: ctx.trace_id,
      status: err.status,
      reason_code: err.reasonCode,
      error_name: err.name,
    });
    return jsonResponse(err.toBody(ctx.trace_id), {
      status: err.status,
      origin: ctx.origin,
    });
  }
  // Unknown error → wrap as InternalError, do NOT leak details to client.
  const internal = new InternalError();
  log.error('unexpected_error', {
    fn: ctx.fn,
    trace_id: ctx.trace_id,
    error_name: err instanceof Error ? err.name : 'unknown',
    error_message: err instanceof Error ? err.message : String(err),
  });
  return jsonResponse(internal.toBody(ctx.trace_id), {
    status: internal.status,
    origin: ctx.origin,
  });
}
