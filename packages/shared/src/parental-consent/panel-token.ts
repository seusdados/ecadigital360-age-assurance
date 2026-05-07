// Token de painel parental — geração + hash. Pure crypto.
//
// Este NÃO é o `parental_consent_token` (JWT ES256). É o token curto
// e escopado para acesso à página pública do painel parental.

const ENCODER = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * 32 bytes random URL-safe base64. Prefixo `pcpt_` (parental-consent
 * panel token) para fácil identificação.
 */
export function generatePanelToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `pcpt_${bytesToBase64Url(bytes)}`;
}

/**
 * SHA-256 hex do token raw — único valor que persiste.
 */
export async function hashPanelToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', ENCODER.encode(token));
  return bytesToHex(new Uint8Array(buf));
}

export function constantTimeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
