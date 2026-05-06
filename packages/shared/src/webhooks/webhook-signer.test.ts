import { describe, expect, it } from 'vitest';
import {
  constantTimeEqualHex,
  signWebhookPayload,
  verifyWebhookPayload,
} from './webhook-signer.ts';

const SECRET = 'whsec_demo_seed_value';
const BODY = JSON.stringify({
  event_type: 'verification.approved',
  session_id: '018f7b8c-aaaa-1111-2222-2b31319d6eaf',
  threshold_satisfied: true,
});

describe('webhook-signer', () => {
  it('produces a stable 64-char lowercase hex digest', async () => {
    const sig = await signWebhookPayload(SECRET, BODY);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    const sigAgain = await signWebhookPayload(SECRET, BODY);
    expect(sig).toBe(sigAgain);
  });

  it('produces a different signature when the body changes', async () => {
    const a = await signWebhookPayload(SECRET, BODY);
    const b = await signWebhookPayload(SECRET, BODY + ' ');
    expect(a).not.toBe(b);
  });

  it('produces a different signature when the secret changes', async () => {
    const a = await signWebhookPayload(SECRET, BODY);
    const b = await signWebhookPayload(SECRET + 'x', BODY);
    expect(a).not.toBe(b);
  });

  it('verifyWebhookPayload returns true for the matching signature', async () => {
    const sig = await signWebhookPayload(SECRET, BODY);
    expect(await verifyWebhookPayload(SECRET, BODY, sig)).toBe(true);
  });

  it('verifyWebhookPayload accepts uppercase hex', async () => {
    const sig = (await signWebhookPayload(SECRET, BODY)).toUpperCase();
    expect(await verifyWebhookPayload(SECRET, BODY, sig)).toBe(true);
  });

  it('verifyWebhookPayload returns false on bad signature', async () => {
    const tampered = '0'.repeat(64);
    expect(await verifyWebhookPayload(SECRET, BODY, tampered)).toBe(false);
  });

  it('verifyWebhookPayload returns false on malformed input', async () => {
    expect(await verifyWebhookPayload(SECRET, BODY, 'not-hex')).toBe(false);
    expect(await verifyWebhookPayload(SECRET, BODY, '')).toBe(false);
    expect(
      await verifyWebhookPayload(SECRET, BODY, 'a'.repeat(63)),
    ).toBe(false);
  });

  it('constantTimeEqualHex respects length and content', () => {
    expect(constantTimeEqualHex('aabb', 'aabb')).toBe(true);
    expect(constantTimeEqualHex('aabb', 'aabc')).toBe(false);
    expect(constantTimeEqualHex('aabb', 'aabbcc')).toBe(false);
  });
});
