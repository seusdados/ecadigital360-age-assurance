// Privacy Guard
//
// Defensive utility that walks a payload tree and rejects keys that would
// leak personally identifiable / age-revealing data on the public AgeKey
// surface (tokens, adapter responses, SDK responses, webhook payloads).
//
// The guard inspects KEY NAMES, not values. It is a key-shape blacklist and
// does not replace the contract minimization performed by adapters and the
// token signer. It is meant to be the last line of defense before a payload
// crosses a tenant or product boundary.
//
// Keys are matched case-insensitively after stripping `-` and `_` so that
// `date_of_birth`, `date-of-birth`, `dateOfBirth` and `DATEOFBIRTH` all map
// to the same canonical token. `age_threshold` is intentionally NOT a
// violation — it describes policy, not the user.
//
// Reference: docs/specs/agekey-token.md, docs/specs/sdk-public-contract.md

export const FORBIDDEN_PUBLIC_KEYS = [
  // Birthdate / age (the user's age)
  'birthdate',
  'date_of_birth',
  'dob',
  'idade',
  'age',
  'exact_age',
  'birth_date',
  'birthday',
  'data_nascimento',
  'nascimento',
  // Civil identifiers
  'document',
  'cpf',
  'cnh',
  'rg',
  'passport',
  'passport_number',
  'id_number',
  'civil_id',
  'social_security',
  'ssn',
  // Personal names
  'name',
  'full_name',
  'nome',
  'nome_completo',
  'first_name',
  'last_name',
  // Direct contact
  'email',
  'phone',
  'mobile',
  'telefone',
  // Address
  'address',
  'endereco',
  'street',
  'postcode',
  'zipcode',
  // Biometrics / face / raw artifacts
  'selfie',
  'face',
  'face_image',
  'biometric',
  'biometrics',
  'raw_id',
] as const;

const ALLOWED_OVERRIDES: ReadonlySet<string> = new Set([
  // Policy-related — describes the threshold of the policy, not the user.
  'age_threshold',
  'age_band_min',
  'age_band_max',
]);

function canonicalize(key: string): string {
  // lower-case, strip separators, drop digits — so date_of_birth, dateOfBirth,
  // DATE-OF-BIRTH, date_of_birth_2 all collapse to "dateofbirth".
  return key.toLowerCase().replace(/[-_]/g, '').replace(/\d+$/, '');
}

const CANONICAL_FORBIDDEN: ReadonlySet<string> = new Set(
  FORBIDDEN_PUBLIC_KEYS.map(canonicalize),
);

const CANONICAL_ALLOWED: ReadonlySet<string> = new Set(
  Array.from(ALLOWED_OVERRIDES).map(canonicalize),
);

export interface PrivacyGuardViolation {
  readonly path: string;
  readonly key: string;
}

export interface PrivacyGuardOptions {
  /**
   * Extra keys that should be tolerated even if they look like PII. Use only
   * when the surface is non-public (internal logs) or when the field is a
   * policy descriptor (e.g. `age_threshold`).
   */
  readonly allowedKeys?: readonly string[];
  /**
   * When true, the walker descends into arrays. Defaults to true.
   */
  readonly walkArrays?: boolean;
}

export function findForbiddenPublicPayloadKeys(
  payload: unknown,
  basePath = '$',
  options: PrivacyGuardOptions = {},
): PrivacyGuardViolation[] {
  const violations: PrivacyGuardViolation[] = [];
  const localAllowed = new Set<string>(CANONICAL_ALLOWED);
  for (const k of options.allowedKeys ?? []) {
    localAllowed.add(canonicalize(k));
  }
  const walkArrays = options.walkArrays !== false;

  function visit(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      if (!walkArrays) return;
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    if (!value || typeof value !== 'object') return;

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const canon = canonicalize(key);
      if (
        !localAllowed.has(canon) &&
        CANONICAL_FORBIDDEN.has(canon)
      ) {
        violations.push({ path: `${path}.${key}`, key });
      }
      visit(child, `${path}.${key}`);
    }
  }

  visit(payload, basePath);
  return violations;
}

export function assertPublicPayloadHasNoPii(
  payload: unknown,
  options: PrivacyGuardOptions = {},
): void {
  const violations = findForbiddenPublicPayloadKeys(payload, '$', options);
  if (violations.length > 0) {
    const detail = violations.map((v) => v.path).join(', ');
    throw new Error(`Public payload contains forbidden PII-like keys: ${detail}`);
  }
}

export function redactTokenForDisplay(token: string): string {
  if (token.length <= 24) return '***';
  return `${token.slice(0, 12)}...${token.slice(-12)}`;
}
