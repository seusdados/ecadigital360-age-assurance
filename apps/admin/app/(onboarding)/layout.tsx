// Server component: minimal centered layout, no sidebar/topbar. This route
// group is intentionally OUTSIDE (app), so requireTenantContext (which would
// redirect to /onboarding) is not invoked — preventing a redirect loop for
// users who haven't created a tenant yet.

import Link from 'next/link';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-8 py-6">
        <Link
          href="/"
          className="text-xs uppercase tracking-widest text-muted-foreground"
        >
          AgeKey
        </Link>
      </header>
      <main
        id="main"
        className="flex flex-1 items-start justify-center px-6 pb-12"
      >
        <div className="w-full max-w-xl animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
