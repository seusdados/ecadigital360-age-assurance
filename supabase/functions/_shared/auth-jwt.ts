// Supabase Auth JWT authentication.
//
// Used by endpoints that operate on behalf of an end-user (panel) instead
// of an application (X-AgeKey-API-Key). Today only `tenant-bootstrap`,
// because every other admin endpoint already operates within an existing
// tenant via the application api_key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { config } from './env.ts';
import { UnauthorizedError } from './errors.ts';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

/**
 * Validates the Authorization: Bearer <jwt> header against Supabase Auth.
 * Throws UnauthorizedError on invalid or missing token.
 */
export async function authenticateUser(req: Request): Promise<AuthenticatedUser> {
  const authz = req.headers.get('authorization');
  if (!authz || !authz.toLowerCase().startsWith('bearer ')) {
    throw new UnauthorizedError('Missing Authorization Bearer token');
  }
  const token = authz.slice('bearer '.length).trim();
  if (token.length < 10) {
    throw new UnauthorizedError('Invalid token');
  }

  // Lightweight client with the anon key — getUser(token) accepts the JWT
  // explicitly so we don't need to maintain session cookies in this runtime.
  const anon = createClient(config.supabaseUrl(), config.supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user) {
    throw new UnauthorizedError('Invalid token');
  }

  return { id: data.user.id, email: data.user.email ?? null };
}
