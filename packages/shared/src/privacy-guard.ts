// Privacy guard — bloqueia chaves PII em payloads públicos (tokens,
// webhooks, eventos de auditoria expostos ao cliente). Pensado para
// rodar como guarda final antes de qualquer escrita "out-bound".
//
// Estratégia de canonicalização (defensiva contra variações de naming):
//   1. lowercase
//   2. remove tudo que não for [a-z0-9] (descarta `_`, `-`, espaços, pontuação, camelCase boundaries)
//   3. remove dígitos finais (cobre nomes "BirthDate2", "dob1", etc.)
// O resultado é comparado contra um catálogo alfanumérico fechado.
//
// Decisões deliberadas:
//   - NÃO faz match por substring. `username`, `user_id`, `external_user_ref`
//     contêm "name"/"id" mas NÃO devem disparar — o catálogo é exato após
//     normalização.
//   - Catálogo fechado (não regex). Adições requerem revisão de segurança
//     explícita. Mudar este arquivo gera diff visível.

const FORBIDDEN_CANONICAL_KEYS: ReadonlySet<string> = new Set([
  // data de nascimento / idade exata
  'birthdate',
  'dateofbirth',
  'dob',
  'idade',
  'age',
  'exactage',
  // documentos civis
  'document',
  'cpf',
  'rg',
  'passport',
  // identidade direta
  'name',
  'fullname',
  'email',
  'phone',
  // biometria
  'selfie',
  'face',
  // identificadores brutos / endereço
  'rawid',
  'address',
]);

export interface PrivacyGuardViolation {
  readonly path: string;
  readonly key: string;
}

function canonicalize(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/[0-9]+$/g, '');
}

export function findForbiddenPublicPayloadKeys(
  payload: unknown,
  basePath = '$',
): PrivacyGuardViolation[] {
  const violations: PrivacyGuardViolation[] = [];

  function visit(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    if (!value || typeof value !== 'object') return;

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const canonical = canonicalize(key);
      if (canonical && FORBIDDEN_CANONICAL_KEYS.has(canonical)) {
        violations.push({ path: `${path}.${key}`, key });
      }
      visit(child, `${path}.${key}`);
    }
  }

  visit(payload, basePath);
  return violations;
}

export function assertPublicPayloadHasNoPii(payload: unknown): void {
  const violations = findForbiddenPublicPayloadKeys(payload);
  if (violations.length > 0) {
    const detail = violations.map((v) => `${v.path}`).join(', ');
    throw new Error(`Public payload contains forbidden PII-like keys: ${detail}`);
  }
}

export function redactTokenForDisplay(token: string): string {
  if (token.length <= 24) return '***';
  return `${token.slice(0, 12)}...${token.slice(-12)}`;
}
