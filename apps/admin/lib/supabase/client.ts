'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Browser Supabase client. Use only in Client Components — for realtime,
 * optimistic UI, or browser-only APIs. Never read application data here
 * when a Server Component would do.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
