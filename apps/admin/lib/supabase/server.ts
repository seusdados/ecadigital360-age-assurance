import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Canonical SSR Supabase client. Reads/writes auth cookies on the
 * `next/headers` cookie store; safe to call from Server Components,
 * Server Actions, and Route Handlers.
 *
 * service_role is NEVER referenced here — RLS is the authority.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot write cookies — safe to ignore;
            // middleware handles refresh.
          }
        },
      },
    },
  );
}
