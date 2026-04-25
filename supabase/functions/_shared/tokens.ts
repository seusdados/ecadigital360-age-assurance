// JWS / JWT helpers using ES256 (P-256). Uses Web Crypto exclusively
// — no third-party library — so the bundle stays minimal in the Deno runtime.

import type { ResultTokenClaims } from '../../../packages/shared/src/schemas/tokens.ts';

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(s: string): Uint8Array {
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
  privateJwk: JsonWebKey; // ES256 (P-256, "EC")
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
  now?: number; // seconds since epoch — for tests
}

export interface VerifiedToken {
  valid: boolean;
  reason?:
    | 'malformed'
    | 'unknown_kid'
    | 'bad_signature'
    | 'expired'
    | 'not_yet_valid'
    | 'wrong_issuer'
    | 'wrong_audience';
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

  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (claims.exp <= now) return { valid: false, reason: 'expired', claims, kid: header.kid };
  if (claims.nbf > now) return { valid: false, reason: 'not_yet_valid', claims, kid: header.kid };

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
