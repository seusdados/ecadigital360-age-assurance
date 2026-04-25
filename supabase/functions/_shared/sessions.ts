// Session lifecycle helpers — create + load + transition.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  NotFoundError,
  SessionAlreadyCompletedError,
  SessionExpiredError,
} from './errors.ts';
import type { SessionStatus, VerificationMethod } from '../../../packages/shared/src/types.ts';

export interface SessionRecord {
  id: string;
  tenant_id: string;
  application_id: string;
  policy_id: string;
  policy_version_id: string;
  status: SessionStatus;
  method: VerificationMethod | null;
  external_user_ref: string | null;
  locale: string;
  client_capabilities_json: Record<string, unknown>;
  redirect_url: string | null;
  cancel_url: string | null;
  client_ip: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  completed_at: string | null;
}

export async function loadSession(
  client: SupabaseClient,
  sessionId: string,
  tenantId: string,
): Promise<SessionRecord> {
  const { data, error } = await client
    .from('verification_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError('Session not found');
  return data as SessionRecord;
}

export function assertSessionWritable(s: SessionRecord): void {
  if (s.status === 'expired' || new Date(s.expires_at).getTime() < Date.now()) {
    throw new SessionExpiredError();
  }
  if (s.status === 'completed' || s.status === 'cancelled') {
    throw new SessionAlreadyCompletedError();
  }
}

export async function loadAndConsumeChallenge(
  client: SupabaseClient,
  sessionId: string,
): Promise<{ nonce: string; expires_at: string }> {
  const { data, error } = await client
    .from('verification_challenges')
    .select('id, nonce, expires_at, consumed_at')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError('Challenge not found for session');
  if (data.consumed_at) throw new SessionAlreadyCompletedError();
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new SessionExpiredError();
  }

  const upd = await client
    .from('verification_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', data.id)
    .is('consumed_at', null);
  if (upd.error) throw upd.error;

  return { nonce: data.nonce, expires_at: data.expires_at };
}

// Generates a 256-bit cryptographic nonce, base64url-encoded (43 chars).
export function newNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
