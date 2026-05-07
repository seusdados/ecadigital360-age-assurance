// Helpers puros de OTP e identificação de contato — testáveis no
// browser/Node/Deno, sem qualquer dependência de runtime de servidor.

const ENCODER = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Gera OTP de 6 dígitos com rejection sampling para evitar bias.
 */
export function generateOtp(): string {
  const buf = new Uint32Array(1);
  const limit = 3_999_999_000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    crypto.getRandomValues(buf);
    if ((buf[0] ?? 0) < limit) {
      const n = (buf[0] ?? 0) % 1_000_000;
      return n.toString().padStart(6, '0');
    }
  }
}

/**
 * SHA-256 hex do OTP, salt obrigatório.
 */
export async function hashOtp(otp: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    ENCODER.encode(`${salt}|${otp}`),
  );
  return bytesToHex(new Uint8Array(buf));
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function maskContact(
  channel: 'email' | 'phone',
  value: string,
): string {
  if (channel === 'email') {
    const [local, domain] = value.split('@');
    if (!local || !domain) return '***';
    const head = local.length > 0 ? local.charAt(0) : '';
    return `${head}***@${domain}`;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  const head = digits.slice(0, 4);
  const tail = digits.slice(-4);
  return `+${head}****${tail}`;
}

export function normalizeContact(
  channel: 'email' | 'phone',
  value: string,
): string {
  if (channel === 'email') return value.trim().toLowerCase();
  const digits = value.replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export async function hmacContact(
  tenantId: string,
  channel: 'email' | 'phone',
  value: string,
): Promise<string> {
  const normalized = normalizeContact(channel, value);
  const key = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(tenantId),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    ENCODER.encode(normalized),
  );
  return bytesToHex(new Uint8Array(sig));
}
