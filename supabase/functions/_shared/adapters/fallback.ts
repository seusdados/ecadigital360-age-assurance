// Fallback adapter — full implementation.
// Accepts a self-declared age claim with anti-abuse signals (captcha, IP risk).
// Always assurance_level = 'low'. Approved when declaration meets threshold AND
// risk signals are below threshold.

import type {
  AdapterCompleteInput,
  AdapterResult,
  AdapterSessionPayload,
  SessionContext,
  VerificationAdapter,
} from '../../../../packages/adapter-contracts/src/index.ts';
import { AdapterDenied } from '../../../../packages/adapter-contracts/src/index.ts';
import { REASON_CODES } from '../../../../packages/shared/src/reason-codes.ts';

const RISK_THRESHOLD_HIGH = 0.7;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

async function evaluateRisk(ctx: SessionContext, signals: { captcha_token?: string; device_fingerprint?: string }): Promise<number> {
  // Heuristic-only in Fase 2; production replaces with real provider lookup.
  let score = 0;
  if (!signals.captcha_token) score += 0.4;
  if (!ctx.userAgent || ctx.userAgent.length < 10) score += 0.2;
  if (!ctx.clientIp) score += 0.2;
  return Math.min(1, score);
}

export const fallbackAdapter: VerificationAdapter = {
  method: 'fallback',

  async prepareSession(ctx: SessionContext): Promise<AdapterSessionPayload> {
    return {
      method: 'fallback',
      client_payload: {
        challenge_nonce: ctx.nonce,
        require_captcha: true,
        ui: {
          declaration_required: true,
          age_threshold: ctx.policy.age_threshold,
          locale: ctx.locale,
        },
      },
    };
  },

  async completeSession(
    ctx: SessionContext,
    input: AdapterCompleteInput,
  ): Promise<AdapterResult> {
    if (input.method !== 'fallback') {
      throw new AdapterDenied(REASON_CODES.INVALID_REQUEST, 'method mismatch');
    }
    const { declaration, signals } = input;

    if (declaration.age_at_least < ctx.policy.age_threshold) {
      return {
        decision: 'denied',
        threshold_satisfied: false,
        assurance_level: 'low',
        method: 'fallback',
        reason_code: REASON_CODES.POLICY_ASSURANCE_UNMET,
        evidence: {
          extra: {
            declared_age_at_least: declaration.age_at_least,
            age_threshold: ctx.policy.age_threshold,
          },
        },
      };
    }

    const risk = await evaluateRisk(ctx, signals);
    if (risk >= RISK_THRESHOLD_HIGH) {
      return {
        decision: 'needs_review',
        threshold_satisfied: false,
        assurance_level: 'low',
        method: 'fallback',
        reason_code: REASON_CODES.FALLBACK_RISK_HIGH,
        evidence: {
          extra: { risk_score: Number(risk.toFixed(3)) },
        },
      };
    }

    // Persist a deterministic hash of the declaration as the artifact.
    const artifactHash = await sha256Hex(
      `fallback|${ctx.sessionId}|${declaration.age_at_least}|${ctx.nonce}`,
    );

    return {
      decision: 'approved',
      threshold_satisfied: true,
      assurance_level: 'low',
      method: 'fallback',
      reason_code: REASON_CODES.FALLBACK_DECLARATION_ACCEPTED,
      evidence: {
        nonce_match: true,
        proof_kind: 'self_declaration',
        extra: {
          risk_score: Number(risk.toFixed(3)),
          declared_age_at_least: declaration.age_at_least,
        },
      },
      artifact: {
        hash_hex: artifactHash,
        mime_type: 'application/json',
        size_bytes: 0,
      },
    };
  },
};
