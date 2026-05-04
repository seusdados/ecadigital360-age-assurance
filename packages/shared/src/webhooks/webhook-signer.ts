// Webhook signer canônico do AgeKey — HMAC SHA-256 puro via Web Crypto.
//
// Funciona em Deno (Edge Functions), Node 20+ e browsers. Não depende de
// libs externas. Documentação: docs/specs/agekey-webhook-contract.md

const ENCODER = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('hex string with odd length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Assinatura canônica de webhook do AgeKey.
 *
 * Entrada para o HMAC: `${timestamp}.${nonce}.${rawBody}`.
 *
 * Retorna a assinatura em hex lowercase, formato `sha256=...`. O receiver
 * deve comparar em tempo constante.
 */
export async function signWebhookPayload(args: {
  secret: string;
  rawBody: string;
  timestamp: string; // segundos epoch como string
  nonce: string;
}): Promise<string> {
  const key = await importHmacKey(args.secret);
  const input = `${args.timestamp}.${args.nonce}.${args.rawBody}`;
  const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(input));
  return `sha256=${bytesToHex(new Uint8Array(sig))}`;
}

/**
 * Verifica assinatura recebida em tempo constante.
 *
 * Devolve `false` quando a estrutura é inválida, em vez de lançar — para
 * facilitar tratamento defensivo no receiver.
 */
export async function verifyWebhookSignature(args: {
  secret: string;
  rawBody: string;
  timestamp: string;
  nonce: string;
  signatureHeader: string; // `sha256=<hex>`
}): Promise<boolean> {
  if (!args.signatureHeader.startsWith('sha256=')) return false;
  const provided = args.signatureHeader.slice('sha256='.length);
  let providedBytes: Uint8Array;
  try {
    providedBytes = hexToBytes(provided);
  } catch {
    return false;
  }

  const key = await importHmacKey(args.secret);
  const input = `${args.timestamp}.${args.nonce}.${args.rawBody}`;
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, ENCODER.encode(input)),
  );
  if (expected.length !== providedBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= (expected[i] ?? 0) ^ (providedBytes[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Hash canônico do payload (`payload_hash` no `AgeKeyWebhookPayload`).
 * SHA-256 hex lowercase do `rawBody` JSON canônico.
 */
export async function payloadHash(rawBody: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', ENCODER.encode(rawBody));
  return bytesToHex(new Uint8Array(digest));
}
