// AGENT 5 (Safety Hardening) — confirma que o perfil `safety_event_v1`
// rejeita TODOS os campos forbidden enumerados em
// SAFETY_EVENT_FORBIDDEN_KEYS (e variantes *_data) ANTES da validação
// Zod (mesma sequência usada pelo edge function `safety-event-ingest`).
//
// Isto é o backstop principal do contrato "Safety v1 metadata-only".

import { describe, expect, it } from 'vitest';
import {
  assertPayloadSafe,
  findPrivacyViolations,
  isPayloadSafe,
  PrivacyGuardForbiddenClaimError,
} from '../src/privacy/index.ts';
import { SAFETY_EVENT_FORBIDDEN_KEYS } from '../src/schemas/safety.ts';

const PROFILE = 'safety_event_v1' as const;

describe('Safety v1 — Privacy Guard rejeita conteúdo bruto / PII', () => {
  for (const key of SAFETY_EVENT_FORBIDDEN_KEYS) {
    it(`rejeita "${key}" no nível raiz`, () => {
      const payload: Record<string, unknown> = {
        event_type: 'message_sent',
        [key]: 'qualquer valor',
      };
      expect(isPayloadSafe(payload, PROFILE)).toBe(false);
      expect(() => assertPayloadSafe(payload, PROFILE)).toThrow(
        PrivacyGuardForbiddenClaimError,
      );
    });

    it(`rejeita "${key}" aninhado em metadata`, () => {
      const payload = {
        event_type: 'message_sent',
        metadata: { nested: { [key]: 'x' } },
      };
      const violations = findPrivacyViolations(payload, PROFILE);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.key.toLowerCase() === key.toLowerCase())).toBe(true);
    });
  }

  it('rejeita variantes *_data de mídia', () => {
    for (const key of ['image_data', 'video_data', 'audio_data']) {
      const payload = { event_type: 'message_sent', body: { [key]: 'x' } };
      expect(isPayloadSafe(payload, PROFILE)).toBe(false);
    }
  });

  it('rejeita keys com case/separador variantes (case-insensitive, _ vs -)', () => {
    const cases: Record<string, string> = {
      BIRTHDATE: 'x',
      MESSAGE_BODY: 'x',
      'Raw-Text': 'x',
      'GPS': '-12,123',
      'Date-Of-Birth': '2010-01-01',
    };
    for (const [k, v] of Object.entries(cases)) {
      const payload = { event_type: 'message_sent', meta: { [k]: v } };
      expect(isPayloadSafe(payload, PROFILE), `key=${k}`).toBe(false);
    }
  });

  it('aceita payload metadata-only legítimo', () => {
    const payload = {
      event_type: 'message_sent',
      actor_subject_ref_hmac: 'a'.repeat(64),
      counterparty_subject_ref_hmac: 'b'.repeat(64),
      actor_age_state: 'adult',
      counterparty_age_state: 'minor',
      metadata: {
        is_private_chat: true,
        has_external_url: false,
        message_length: 42,
      },
    };
    expect(isPayloadSafe(payload, PROFILE)).toBe(true);
  });

  it('aceita exceções controladas (regras de política — age_band etc.)', () => {
    const payload = {
      event_type: 'message_sent',
      metadata: {
        actor_age_band: 'adult',
        counterparty_age_band: 'minor',
        policy_age_threshold: 13,
      },
    };
    expect(isPayloadSafe(payload, PROFILE)).toBe(true);
  });
});
