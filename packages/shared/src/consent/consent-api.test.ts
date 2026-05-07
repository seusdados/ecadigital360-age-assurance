import { describe, expect, it } from 'vitest';
import {
  ConsentSessionCreateRequestSchema,
  ConsentGuardianStartRequestSchema,
  ConsentConfirmRequestSchema,
  ConsentSessionCreateResponseSchema,
  ConsentSessionStatusResponseSchema,
  ConsentTokenVerifyResponseSchema,
} from './consent-api.ts';

describe('consent API request schemas', () => {
  it('rejects PII-shaped fields in session create payload', () => {
    const body = {
      application_id: '018f7b8c-2222-7777-9999-2b31319d6ea2',
      external_user_ref: 'user@example.com', // looks like email — accepted as opaque ref but…
      resource: 'platform_use',
      purpose_codes: ['platform_use'],
      data_categories: ['profile_minimum'],
      // smuggle obvious PII keys at top level
      cpf: '123.456.789-00',
      birthdate: '2014-01-01',
    };
    const result = ConsentSessionCreateRequestSchema.safeParse(body);
    // strict() rejects any extra keys
    expect(result.success).toBe(false);
  });

  it('accepts a minimal session create payload', () => {
    const body = {
      application_id: '018f7b8c-2222-7777-9999-2b31319d6ea2',
      external_user_ref: 'opaque-ref-1234abcd',
      resource: 'platform_use',
      purpose_codes: ['platform_use'],
      data_categories: ['profile_minimum'],
      risk_tier: 'low',
    };
    const result = ConsentSessionCreateRequestSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  it('accepts contact in guardian/start but never echoes it back', () => {
    const req = ConsentGuardianStartRequestSchema.safeParse({
      contact: 'guardian@example.com',
      contact_type: 'email',
      preferred_method: 'otp_email',
    });
    expect(req.success).toBe(true);
    // Response must NOT carry contact / email / phone — see schema below.
    // The response schema is enforced separately.
  });

  it('confirm request requires all declaration flags', () => {
    const body = {
      otp: '123456',
      consent_text_version_id: '018f7b8c-7777-7777-9999-2b31319d6ea7',
      accepted: true,
      declaration: {
        guardian_responsibility_confirmed: true,
        understands_scope: true,
        // missing understands_revocation
      },
    };
    expect(ConsentConfirmRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe('consent API response schemas', () => {
  it('session create response carries pii_included=false', () => {
    const body = {
      session_id: '018f7b8c-aaaa-7777-9999-2b31319d6eaa',
      consent_request_id: '018f7b8c-3333-7777-9999-2b31319d6ea3',
      decision: 'pending',
      status: 'pending_guardian',
      reason_code: 'CONSENT_NOT_GIVEN',
      resource: 'platform_use',
      redirect_url: 'https://age.example.com/consent/abc',
      expires_at: '2026-05-07T12:00:00.000Z',
      pii_included: false,
      content_included: false,
    };
    const r = ConsentSessionCreateResponseSchema.safeParse(body);
    expect(r.success).toBe(true);
  });

  it('rejects session response with pii_included=true', () => {
    const body = {
      session_id: '018f7b8c-aaaa-7777-9999-2b31319d6eaa',
      consent_request_id: '018f7b8c-3333-7777-9999-2b31319d6ea3',
      decision: 'pending',
      status: 'pending_guardian',
      reason_code: 'CONSENT_NOT_GIVEN',
      resource: 'platform_use',
      redirect_url: 'https://age.example.com/consent/abc',
      expires_at: '2026-05-07T12:00:00.000Z',
      pii_included: true,
      content_included: false,
    };
    expect(ConsentSessionCreateResponseSchema.safeParse(body).success).toBe(
      false,
    );
  });

  it('status response is open to anonymous polling shape', () => {
    const body = {
      consent_request_id: '018f7b8c-3333-7777-9999-2b31319d6ea3',
      application_id: '018f7b8c-2222-7777-9999-2b31319d6ea2',
      resource: 'platform_use',
      decision: 'pending',
      status: 'pending_guardian',
      reason_code: 'CONSENT_NOT_GIVEN',
      parental_consent_id: null,
      parental_consent_status: null,
      consent_token_id: null,
      expires_at: '2026-05-07T12:00:00.000Z',
      requested_at: '2026-05-07T11:00:00.000Z',
      pii_included: false,
      content_included: false,
    };
    expect(ConsentSessionStatusResponseSchema.safeParse(body).success).toBe(
      true,
    );
  });

  it('token verify response schema rejects birthdate claims', () => {
    const body = {
      valid: true,
      revoked: false,
      parental_consent_id: '018f7b8c-5555-7777-9999-2b31319d6ea5',
      resource: 'platform_use',
      claims: {
        decision: 'approved',
        decision_domain: 'parental_consent',
        resource: 'platform_use',
        scope: null,
        purpose_codes: ['platform_use'],
        data_categories: ['profile_minimum'],
        method: 'otp_email',
        assurance_level: 'low',
        risk_tier: 'low',
        consent_token_id: '018f7b8c-6666-7777-9999-2b31319d6ea6',
        parental_consent_id: '018f7b8c-5555-7777-9999-2b31319d6ea5',
        tenant_id: '018f7b8c-1111-7777-9999-2b31319d6ea1',
        application_id: '018f7b8c-2222-7777-9999-2b31319d6ea2',
        iat: 1_700_000_000,
        exp: 1_700_003_600,
        // smuggle birthdate
        birthdate: '2014-01-01',
      },
      pii_included: false,
      content_included: false,
    };
    expect(ConsentTokenVerifyResponseSchema.safeParse(body).success).toBe(
      false,
    );
  });
});
