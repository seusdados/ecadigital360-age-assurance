// AgeKey Credential Mode (SD-JWT VC) — interface contracts.
//
// **STATUS: NOT IMPLEMENTED.** Esta camada provê apenas tipos. Não
// existe implementação criptográfica neste código. Ativar
// `AGEKEY_SD_JWT_VC_ENABLED=true` em produção SEM uma biblioteca real,
// issuer real, test vectors e revisão criptográfica externa é
// **proibido** — o `selectVerifier` falha eager nesse cenário.
//
// Documentação completa: docs/specs/agekey-credential-mode.md

export type CredentialFormat = 'sd_jwt_vc' | 'w3c_vc_jwt';

export interface CredentialIssuer {
  /** DID do issuer (ex.: did:web:issuer.example.com). */
  readonly did: string;
  /** JWKs públicas do issuer (para verificar assinatura da credential). */
  readonly publicKeyJwks: ReadonlyArray<JsonWebKey>;
  /** URL do StatusList2021 / status registry. NULL se não suportado. */
  readonly statusListUrl: string | null;
  /** Indica se o issuer está em `issuers.trust_status='trusted'`. */
  readonly trusted: boolean;
}

export interface DisclosureClaim {
  /** JSONPath do claim disclosed (ex.: "$.age_over_18"). */
  readonly path: string;
  /**
   * Valor disclosed. Tipos boolean / string / number / null.
   * NUNCA aceita PII — privacy guard rejeita objetos com chaves
   * proibidas (name, cpf, birthdate, etc.).
   */
  readonly value: boolean | string | number | null;
}

export interface CredentialPresentation {
  readonly format: CredentialFormat;
  readonly issuerDid: string;
  readonly disclosures: ReadonlyArray<DisclosureClaim>;
  /** Key binding proof (holder binding via WebAuthn ou DID-bound key). */
  readonly keyBindingProof?: string;
  /** Nonce do AgeKey contra replay. */
  readonly nonce: string;
}

export interface CredentialPredicate {
  readonly path: string;
  readonly comparator: 'gte' | 'lte' | 'eq' | 'over' | 'under';
  /** Valor de referência público (ex.: 18 para `over_18`). */
  readonly value: unknown;
}

export interface CredentialPredicates {
  readonly required: ReadonlyArray<CredentialPredicate>;
}

export type CredentialVerificationReason =
  | 'feature_disabled'
  | 'library_unavailable'
  | 'issuer_untrusted'
  | 'signature_invalid'
  | 'expired'
  | 'not_yet_valid'
  | 'revoked'
  | 'format_unsupported'
  | 'predicate_unmet'
  | 'key_binding_invalid'
  | 'nonce_mismatch'
  | 'success';

export interface CredentialVerificationResult {
  readonly valid: boolean;
  readonly reason: CredentialVerificationReason;
  /** AAL atribuído quando `valid=true`. */
  readonly assuranceLevel?: 'AAL-3' | 'AAL-4';
}

export interface CredentialVerifier {
  /** Verifica presentation contra predicates. */
  verify(
    presentation: CredentialPresentation,
    expected: CredentialPredicates,
  ): Promise<CredentialVerificationResult>;
}

/**
 * Variáveis de ambiente lidas pelo `selectVerifier`.
 */
export interface CredentialEnv {
  AGEKEY_CREDENTIAL_MODE_ENABLED?: string | boolean | undefined;
  AGEKEY_SD_JWT_VC_ENABLED?: string | boolean | undefined;
}
