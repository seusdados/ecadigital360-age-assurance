// JWS / JWT helpers using ES256 (P-256). Pure Web Crypto — works in Deno,
// Node 18+, and browsers without any polyfill. Used by Edge Functions to
// sign result tokens and by client/server consumers to verify them locally.
//
// Importing this module requires `crypto.subtle` to be available globally.

import type { ResultTokenClaims } from './schemas/tokens.ts';

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function jsonToB64Url(obj: unknown): string {
  return b64urlEncode(ENCODER.encode(JSON.stringify(obj)));
}

export interface JwsSigningKey {
  kid: string;
  privateJwk: JsonWebKey;
}

export async function signResultToken(
  claims: ResultTokenClaims,
  signing: JwsSigningKey,
): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT', kid: signing.kid };
  const headerB = jsonToB64Url(header);
  const payloadB = jsonToB64Url(claims);
  const signingInput = `${headerB}.${payloadB}`;

  const key = await crypto.subtle.importKey(
    'jwk',
    signing.privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    ENCODER.encode(signingInput),
  );

  return `${signingInput}.${b64urlEncode(new Uint8Array(sig))}`;
}

export interface VerifyOptions {
  jwksKeys: Array<{ kid: string; publicJwk: JsonWebKey }>;
  expectedIssuer?: string;
  expectedAudience?: string;
  // Tolerance for clock skew, in seconds. Default 30s.
  clockSkewSeconds?: number;
  now?: number;
}

export type VerifyReason =
  | 'malformed'
  | 'unknown_kid'
  | 'bad_signature'
  | 'expired'
  | 'not_yet_valid'
  | 'wrong_issuer'
  | 'wrong_audience';

export interface VerifiedToken {
  valid: boolean;
  reason?: VerifyReason;
  claims?: ResultTokenClaims;
  kid?: string;
}

export async function verifyResultToken(
  jwt: string,
  opts: VerifyOptions,
): Promise<VerifiedToken> {
  const parts = jwt.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };
  const [headerB, payloadB, sigB] = parts as [string, string, string];

  let header: { alg?: string; kid?: string };
  let claims: ResultTokenClaims;
  try {
    header = JSON.parse(DECODER.decode(b64urlDecode(headerB)));
    claims = JSON.parse(DECODER.decode(b64urlDecode(payloadB))) as ResultTokenClaims;
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  if (header.alg !== 'ES256' || !header.kid) {
    return { valid: false, reason: 'malformed' };
  }

  const matching = opts.jwksKeys.find((k) => k.kid === header.kid);
  if (!matching) return { valid: false, reason: 'unknown_kid', kid: header.kid };

  const key = await crypto.subtle.importKey(
    'jwk',
    matching.publicJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );

  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    b64urlDecode(sigB),
    ENCODER.encode(`${headerB}.${payloadB}`),
  );
  if (!ok) return { valid: false, reason: 'bad_signature', kid: header.kid };

  const skew = opts.clockSkewSeconds ?? 30;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (claims.exp + skew <= now) {
    return { valid: false, reason: 'expired', claims, kid: header.kid };
  }
  if (claims.nbf - skew > now) {
    return { valid: false, reason: 'not_yet_valid', claims, kid: header.kid };
  }

  if (opts.expectedIssuer && claims.iss !== opts.expectedIssuer) {
    return { valid: false, reason: 'wrong_issuer', claims, kid: header.kid };
  }
  if (opts.expectedAudience && claims.aud !== opts.expectedAudience) {
    return { valid: false, reason: 'wrong_audience', claims, kid: header.kid };
  }

  return { valid: true, claims, kid: header.kid };
}

export async function generateEs256KeyPair(): Promise<{
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
}> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicJwk, privateJwk };
}

// Loads a remote JWKS document and returns the keys array. Caller is
// responsible for caching (Cache-Control header is honored when available).
export async function fetchJwks(
  url: string,
  init: RequestInit = {},
): Promise<Array<{ kid: string; publicJwk: JsonWebKey }>> {
  const resp = await fetch(url, init);
  if (!resp.ok) throw new Error(`JWKS fetch failed: ${resp.status}`);
  const body = (await resp.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
  if (!body || !Array.isArray(body.keys)) {
    throw new Error('Invalid JWKS document');
  }
  return body.keys
    .filter((k) => typeof k.kid === 'string')
    .map((k) => ({ kid: k.kid as string, publicJwk: k }));
}
