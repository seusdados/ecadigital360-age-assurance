// Webhook signer — pure Web Crypto HMAC-SHA256.
//
// AgeKey webhooks are signed with HMAC-SHA256 over the exact JSON body that
// the receiver will see. The signature is sent as hex in the header
// `X-AgeKey-Signature`. The trigger in `supabase/migrations/012_webhook_enqueue.sql`
// computes the same HMAC inside Postgres using pgcrypto's `hmac()`; this
// module is the TypeScript equivalent used by SDK consumers and the
// edge-function side of the worker (when re-signing during enqueue).
//
// Comparison is constant-time to prevent signature timing oracles.
//
// Reference: docs/specs/agekey-core-canonical-contracts.md §Webhook signer.

export const WEBHOOK_SIGNATURE_HEADER = 'X-AgeKey-Signature';
export const WEBHOOK_DELIVERY_ID_HEADER = 'X-AgeKey-Delivery-Id';
export const WEBHOOK_EVENT_TYPE_HEADER = 'X-AgeKey-Event-Type';

const ENCODER = new TextEncoder();

function toBytes(value: string | Uint8Array): Uint8Array<ArrayBuffer> {
  if (typeof value === 'string') return ENCODER.encode(value);
  // Copy into a fresh ArrayBuffer-backed view so the result is always
  // assignable to the strict `Uint8Array<ArrayBuffer>` parameter that
  // crypto.subtle.{importKey,sign} expects.
  const out = new Uint8Array(value.byteLength);
  out.set(value);
  return out;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  for (const b of view) out += b.toString(16).padStart(2, '0');
  return out;
}

/**
 * Compute the lowercase hex HMAC-SHA256 of `body` using `secret`.
 *
 * `body` MUST be the exact byte sequence the HTTP receiver will read from the
 * wire — typically `JSON.stringify(payload)` with no surrounding whitespace.
 * The signer never re-serialises the payload itself; that is the caller's
 * responsibility, because any whitespace difference would invalidate the
 * signature on the receiver side.
 */
export async function signWebhookPayload(
  secret: string | Uint8Array,
  body: string | Uint8Array,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    toBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, toBytes(body));
  return bytesToHex(sig);
}

/**
 * Constant-time hex comparison. Returns false for any length mismatch and
 * never short-circuits on equal-length inputs.
 */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify a webhook signature. Returns false (never throws) if the signature
 * is malformed, the wrong length, or computed over a different body.
 *
 * Both ASCII case forms of the hex string are accepted on input; comparison
 * happens after lowercasing both sides.
 */
export async function verifyWebhookPayload(
  secret: string | Uint8Array,
  body: string | Uint8Array,
  signatureHex: string,
): Promise<boolean> {
  if (typeof signatureHex !== 'string') return false;
  if (!/^[0-9a-fA-F]{64}$/.test(signatureHex)) return false;
  const expected = await signWebhookPayload(secret, body);
  return constantTimeEqualHex(expected, signatureHex.toLowerCase());
}
