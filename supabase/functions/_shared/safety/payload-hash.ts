// Hash do payload safety (correlação em audit). Sem conteúdo bruto.
const ENCODER = new TextEncoder();

export async function safetyPayloadHash(rawBody: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', ENCODER.encode(rawBody));
  let hex = '';
  for (const b of new Uint8Array(buf)) hex += b.toString(16).padStart(2, '0');
  return hex;
}
