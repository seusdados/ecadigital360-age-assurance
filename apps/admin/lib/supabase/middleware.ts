import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Refresh the Supabase auth session on every request and propagate
 * cookies. Called from the root middleware.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do NOT remove this getUser() call — it triggers the
  // session refresh that writes new cookies via setAll above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /app/* — redirect unauthenticated users to /login.
  const path = request.nextUrl.pathname;
  const isAppRoute =
    path === '/dashboard' ||
    path.startsWith('/dashboard/') ||
    path.startsWith('/verifications') ||
    path.startsWith('/applications') ||
    path.startsWith('/policies') ||
    path.startsWith('/issuers') ||
    path.startsWith('/audit') ||
    path.startsWith('/billing') ||
    path.startsWith('/settings');

  if (isAppRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // Authenticated users hitting /login → bounce to dashboard.
  if (user && (path === '/login' || path === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
