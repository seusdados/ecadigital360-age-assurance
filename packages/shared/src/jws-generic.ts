// Generic JWS verification — used by the VC adapter to validate credentials
// signed by external issuers (ES256/ES384/RS256 typical for W3C VC and SD-JWT).
//
// For result tokens (AgeKey's own JWS), use signResultToken/verifyResultToken
// from ./jws.ts which is typed against ResultTokenClaims and only handles ES256.

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const ALG_TO_PARAMS: Record<
  string,
  | { kty: 'EC'; namedCurve: 'P-256' | 'P-384' | 'P-521'; hash: 'SHA-256' | 'SHA-384' | 'SHA-512' }
  | { kty: 'RSA'; hash: 'SHA-256' | 'SHA-384' | 'SHA-512' }
> = {
  ES256: { kty: 'EC', namedCurve: 'P-256', hash: 'SHA-256' },
  ES384: { kty: 'EC', namedCurve: 'P-384', hash: 'SHA-384' },
  ES512: { kty: 'EC', namedCurve: 'P-521', hash: 'SHA-512' },
  RS256: { kty: 'RSA', hash: 'SHA-256' },
  RS384: { kty: 'RSA', hash: 'SHA-384' },
  RS512: { kty: 'RSA', hash: 'SHA-512' },
};

export interface ParsedJws {
  header: { alg: string; kid?: string; typ?: string; [k: string]: unknown };
  payload: Record<string, unknown>;
  signingInput: string;
  signature: Uint8Array;
}

export function parseJws(jws: string): ParsedJws | null {
  const parts = jws.split('.');
  if (parts.length !== 3) return null;
  const [headerB, payloadB, sigB] = parts as [string, string, string];
  try {
    const header = JSON.parse(DECODER.decode(b64urlDecode(headerB))) as ParsedJws['header'];
    const payload = JSON.parse(DECODER.decode(b64urlDecode(payloadB))) as ParsedJws['payload'];
    const signature = b64urlDecode(sigB);
    return { header, payload, signingInput: `${headerB}.${payloadB}`, signature };
  } catch {
    return null;
  }
}

export interface VerifyJwsOptions {
  jwksKeys: Array<JsonWebKey & { kid?: string; alg?: string }>;
  expectedIssuer?: string;
  expectedAudience?: string;
  clockSkewSeconds?: number;
  now?: number;
}

export type JwsVerifyReason =
  | 'malformed'
  | 'unsupported_alg'
  | 'unknown_kid'
  | 'bad_signature'
  | 'expired'
  | 'not_yet_valid'
  | 'wrong_issuer'
  | 'wrong_audience';

export interface JwsVerifyResult {
  valid: boolean;
  reason?: JwsVerifyReason;
  parsed?: ParsedJws;
}

export async function verifyJws(
  jws: string,
  opts: VerifyJwsOptions,
): Promise<JwsVerifyResult> {
  const parsed = parseJws(jws);
  if (!parsed) return { valid: false, reason: 'malformed' };

  const algParams = ALG_TO_PARAMS[parsed.header.alg];
  if (!algParams) {
    return { valid: false, reason: 'unsupported_alg', parsed };
  }

  const matching = parsed.header.kid
    ? opts.jwksKeys.find((k) => k.kid === parsed.header.kid)
    : opts.jwksKeys.find((k) => k.alg === parsed.header.alg) ?? opts.jwksKeys[0];
  if (!matching) {
    return { valid: false, reason: 'unknown_kid', parsed };
  }

  let cryptoKey: CryptoKey;
  try {
    if (algParams.kty === 'EC') {
      cryptoKey = await crypto.subtle.importKey(
        'jwk',
        matching as JsonWebKey,
        { name: 'ECDSA', namedCurve: algParams.namedCurve },
        false,
        ['verify'],
      );
      const ok = await crypto.subtle.verify(
        { name: 'ECDSA', hash: algParams.hash },
        cryptoKey,
        parsed.signature,
        ENCODER.encode(parsed.signingInput),
      );
      if (!ok) return { valid: false, reason: 'bad_signature', parsed };
    } else {
      cryptoKey = await crypto.subtle.importKey(
        'jwk',
        matching as JsonWebKey,
        { name: 'RSASSA-PKCS1-v1_5', hash: algParams.hash },
        false,
        ['verify'],
      );
      const ok = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        parsed.signature,
        ENCODER.encode(parsed.signingInput),
      );
      if (!ok) return { valid: false, reason: 'bad_signature', parsed };
    }
  } catch {
    return { valid: false, reason: 'bad_signature', parsed };
  }

  const skew = opts.clockSkewSeconds ?? 30;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const exp = parsed.payload.exp;
  const nbf = parsed.payload.nbf;
  if (typeof exp === 'number' && exp + skew <= now) {
    return { valid: false, reason: 'expired', parsed };
  }
  if (typeof nbf === 'number' && nbf - skew > now) {
    return { valid: false, reason: 'not_yet_valid', parsed };
  }

  if (opts.expectedIssuer && parsed.payload.iss !== opts.expectedIssuer) {
    return { valid: false, reason: 'wrong_issuer', parsed };
  }
  if (opts.expectedAudience) {
    const aud = parsed.payload.aud;
    const matches = Array.isArray(aud)
      ? aud.includes(opts.expectedAudience)
      : aud === opts.expectedAudience;
    if (!matches) return { valid: false, reason: 'wrong_audience', parsed };
  }

  return { valid: true, parsed };
}

/**
 * SD-JWT (Selective Disclosure for JWTs, draft-ietf-oauth-selective-disclosure-jwt-08):
 * the credential is `<JWS>~<disclosure1>~<disclosure2>~...`. Each disclosure is
 * b64url(JSON [salt, claim_name, claim_value]). The JWS payload contains an array
 * `_sd` of base64url-encoded SHA-256 hashes; verifying a disclosure means
 * recomputing the hash and finding it in `_sd`.
 *
 * This helper splits the SD-JWT, returns the JWS plus a map of disclosed
 * claims that pass the digest check.
 */
export interface SdJwt {
  jws: string;
  disclosures: Array<{ raw: string; salt: string; name: string; value: unknown }>;
  // Disclosed claims keyed by name, after digest verification.
  claims: Record<string, unknown>;
}

export async function parseSdJwt(input: string): Promise<SdJwt | null> {
  const parts = input.split('~').filter(Boolean);
  if (parts.length === 0) return null;
  const [jws, ...rawDisclosures] = parts as [string, ...string[]];
  const parsed = parseJws(jws);
  if (!parsed) return null;

  const sdDigests = Array.isArray(parsed.payload._sd) ? (parsed.payload._sd as string[]) : [];
  const disclosures: SdJwt['disclosures'] = [];
  const claims: Record<string, unknown> = {};

  for (const raw of rawDisclosures) {
    const decoded = JSON.parse(DECODER.decode(b64urlDecode(raw))) as [string, string, unknown];
    if (!Array.isArray(decoded) || decoded.length < 3) continue;
    const [salt, name, value] = decoded;

    const digest = await crypto.subtle.digest('SHA-256', ENCODER.encode(raw));
    const digestB64 = uint8ToB64Url(new Uint8Array(digest));
    if (!sdDigests.includes(digestB64)) continue;

    disclosures.push({ raw, salt, name, value });
    claims[name] = value;
  }

  return { jws, disclosures, claims };
}

function uint8ToB64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
