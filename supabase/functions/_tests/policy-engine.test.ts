// Deno tests — _shared/policy-engine.ts (selectAvailableMethods + meetsAssurance).
//
// Run with: deno test supabase/functions/_tests/policy-engine.test.ts

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  meetsAssurance,
  selectAvailableMethods,
} from '../_shared/policy-engine.ts';
import type { PolicySnapshot } from '../../../packages/shared/src/types.ts';

const policy: PolicySnapshot = {
  id: '01926cb0-0000-7000-8000-000000000010',
  tenant_id: '01926cb0-0000-7000-8000-000000000011',
  name: 'BR-18+',
  slug: 'br-18-plus',
  age_threshold: 18,
  age_band_min: null,
  age_band_max: null,
  jurisdiction_code: 'BR',
  method_priority: ['zkp', 'vc', 'gateway', 'fallback'],
  required_assurance_level: 'substantial',
  token_ttl_seconds: 86400,
  current_version: 1,
};

Deno.test('selectAvailableMethods drops zkp when DCAPI absent', () => {
  const methods = selectAvailableMethods(policy, { digital_credentials_api: false });
  assertEquals(methods.includes('zkp'), false);
  assertEquals(methods.includes('fallback'), true);
});

Deno.test('selectAvailableMethods always includes fallback', () => {
  const methods = selectAvailableMethods(policy, {});
  assertEquals(methods[methods.length - 1], 'fallback');
});

Deno.test('selectAvailableMethods keeps zkp + vc when capabilities full', () => {
  const methods = selectAvailableMethods(policy, {
    digital_credentials_api: true,
    wallet_present: true,
  });
  assertEquals(methods, ['zkp', 'vc', 'gateway', 'fallback']);
});

Deno.test('meetsAssurance respects rank ordering', () => {
  assertEquals(meetsAssurance('high', 'substantial'), true);
  assertEquals(meetsAssurance('substantial', 'substantial'), true);
  assertEquals(meetsAssurance('low', 'substantial'), false);
  assertEquals(meetsAssurance('low', 'high'), false);
  assertEquals(meetsAssurance('high', 'low'), true);
});
