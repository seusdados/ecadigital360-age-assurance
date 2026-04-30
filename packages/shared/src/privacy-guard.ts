const FORBIDDEN_PUBLIC_KEYS = [
  'birthdate',
  'date_of_birth',
  'dob',
  'idade',
  'age',
  'exact_age',
  'document',
  'cpf',
  'rg',
  'passport',
  'name',
  'full_name',
  'email',
  'phone',
  'selfie',
  'face',
  'raw_id',
  'address',
] as const;

export interface PrivacyGuardViolation {
  readonly path: string;
  readonly key: string;
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
      const normalized = key.toLowerCase();
      if ((FORBIDDEN_PUBLIC_KEYS as readonly string[]).includes(normalized)) {
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
