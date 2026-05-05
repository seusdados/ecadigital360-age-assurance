// AgeKey Proof Mode (ZKP/BBS+) — interface contracts.
//
// **STATUS: NOT IMPLEMENTED.** Esta camada provê apenas tipos. Não
// existe BBS+ real, pareamento BLS12-381, nem ZKP real neste código.
// Ativar `AGEKEY_ZKP_BBS_ENABLED=true` em produção SEM uma biblioteca
// BBS+ validada externamente, test vectors IETF/CFRG, issuer real e
// revisão criptográfica externa é **proibido** — o `selectVerifier`
// falha eager nesse cenário.
//
// Documentação completa: docs/specs/agekey-proof-mode.md

export type ProofScheme =
  | 'bls12381-bbs+'
  | 'bbs-2023'
  | 'bls12-381-g1';

export interface ProofPredicate {
  /** JSONPath do claim verificado (ex.: "$.age"). */
  readonly path: string;
  readonly comparator: 'gte' | 'lte' | 'eq' | 'over' | 'under';
  /** Valor de referência público (ex.: 18 para `over_18`). */
  readonly value: number | string;
}

export interface ProofPresentation {
  readonly scheme: ProofScheme;
  readonly issuerDid: string;
  /** Bytes da prova, base64url. Opaco. */
  readonly proof: string;
  /** Nonce contra replay. */
  readonly nonce: string;
  readonly predicates: ReadonlyArray<ProofPredicate>;
}

export interface ProofGeneratorRequest {
  /** Credencial do issuer (formato dependente do scheme). */
  readonly issuerCredential: string;
  /** Paths de claims a revelar selectivamente. */
  readonly disclosurePaths: ReadonlyArray<string>;
  readonly predicates: ReadonlyArray<ProofPredicate>;
  readonly nonce: string;
}

export type ProofVerificationReason =
  | 'feature_disabled'
  | 'library_unavailable'
  | 'curve_unsupported'
  | 'scheme_unsupported'
  | 'proof_invalid'
  | 'nonce_mismatch'
  | 'predicate_failed'
  | 'issuer_untrusted'
  | 'success';

export interface ProofVerificationResult {
  readonly valid: boolean;
  readonly reason: ProofVerificationReason;
  readonly assuranceLevel?: 'AAL-3' | 'AAL-4';
}

export interface ProofVerifier {
  verify(
    presentation: ProofPresentation,
  ): Promise<ProofVerificationResult>;
}

export interface ProofEnv {
  AGEKEY_PROOF_MODE_ENABLED?: string | boolean | undefined;
  AGEKEY_ZKP_BBS_ENABLED?: string | boolean | undefined;
}
