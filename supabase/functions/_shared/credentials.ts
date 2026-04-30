// Generate AgeKey raw credentials.
//
// Format:
//   api_key:        ak_<env>_<32 b64url chars>      → ~38 chars total
//   webhook_secret: whsec_<32 b64url chars>          → ~38 chars total
//
// The env discriminator (live/test/dev) appears in the api_key prefix so
// support staff can spot misuse without seeing the secret. Hash stored in
// `applications.api_key_hash` is sha256 of the full raw key.
//
// Both functions return both the raw value and the prefix portion that's
// safe to display in the panel.

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function randomB64Url(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) {
    const byte = bytes[i] ?? 0;
    out += B64URL[byte % 64];
  }
  return out;
}

export function newApiKey(envLabel: 'live' | 'test' | 'dev' = 'live'): {
  raw: string;
  prefix: string;
} {
  const random = randomB64Url(32);
  const raw = `ak_${envLabel}_${random}`;
  // Prefix: keep the env discriminator + first 6 random chars for visual ID.
  const prefix = `ak_${envLabel}_${random.slice(0, 6)}…`;
  return { raw, prefix };
}

export function newWebhookSecret(): string {
  return `whsec_${randomB64Url(32)}`;
}
