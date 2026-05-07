import type {
  AdapterEvidence,
  AssuranceLevel,
  ClientCapabilities,
  PolicySnapshot,
  VerificationDecision,
  VerificationMethod,
} from '@agekey/shared';
import type { ReasonCode } from '@agekey/shared';

/**
 * Contexto da sessão repassado ao adapter.
 * Reúne tudo que adapters podem precisar SEM dar acesso a PII —
 * o adapter trabalha apenas com referências opacas (session_id, nonce, capabilities).
 */
export interface SessionContext {
  readonly tenantId: string;
  readonly applicationId: string;
  readonly sessionId: string;
  readonly policy: PolicySnapshot;
  readonly nonce: string;
  readonly nonceExpiresAt: string; // ISO-8601
  readonly capabilities: ClientCapabilities;
  readonly clientIp: string | null;
  readonly userAgent: string | null;
  readonly locale: string;
}

/**
 * O que o adapter devolve em prepareSession() — payload visível ao SDK
 * cliente para iniciar o fluxo correspondente (ex.: URL de Wallet, parâmetros do gateway).
 */
export interface AdapterSessionPayload {
  readonly method: VerificationMethod;
  // Pode incluir URL de redirect, parâmetros de Digital Credentials API, etc.
  readonly client_payload: Record<string, unknown>;
  // Se o adapter exige uma URL de retorno explícita
  readonly callback_url?: string;
}

/**
 * Entrada no completeSession — corpo enviado pelo SDK ao endpoint de complete,
 * já parseado pelo schema discriminado por method.
 */
export type AdapterCompleteInput =
  | {
      method: 'zkp';
      proof: string;
      proof_format: string;
      issuer_did: string;
    }
  | {
      method: 'vc';
      credential: string;
      format: 'w3c_vc' | 'sd_jwt_vc';
      issuer_did: string;
      presentation_nonce?: string;
    }
  | {
      method: 'gateway';
      attestation: string;
      provider: string;
    }
  | {
      method: 'fallback';
      declaration: { age_at_least: number; consent: true };
      signals: { captcha_token?: string; device_fingerprint?: string };
    };

/**
 * Resultado computado pelo adapter. O verifier-core converte em
 * verification_results + result_token quando approved.
 */
export interface AdapterResult {
  readonly decision: VerificationDecision;
  readonly threshold_satisfied: boolean;
  readonly assurance_level: AssuranceLevel;
  readonly method: VerificationMethod;
  readonly reason_code: ReasonCode;
  readonly issuer_did?: string;
  readonly evidence: AdapterEvidence;
  // Se o adapter produziu um artefato persistível (proof, attestation, etc.)
  readonly artifact?: {
    readonly hash_hex: string;
    readonly mime_type?: string;
    readonly size_bytes?: number;
    readonly storage_path?: string;
  };
}

export interface VerificationAdapter {
  readonly method: VerificationMethod;
  prepareSession(ctx: SessionContext): Promise<AdapterSessionPayload>;
  completeSession(
    ctx: SessionContext,
    input: AdapterCompleteInput,
  ): Promise<AdapterResult>;
}

/**
 * Erro lançado por adapters para sinalizar reason codes específicos
 * sem precisar de um caminho HTTP — o verifier-core os captura
 * e converte em verification_results.decision = 'denied'.
 */
export class AdapterDenied extends Error {
  readonly reason_code: ReasonCode;
  constructor(reason_code: ReasonCode, message?: string) {
    super(message ?? reason_code);
    this.name = 'AdapterDenied';
    this.reason_code = reason_code;
  }
}
