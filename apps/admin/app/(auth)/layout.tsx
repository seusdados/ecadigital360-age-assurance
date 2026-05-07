import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      {/* Marketing column — hidden on mobile to keep auth focused. */}
      <aside
        aria-hidden="true"
        className="hidden flex-col justify-between bg-card p-12 lg:flex"
      >
        <Link href="/" className="text-sm tracking-widest uppercase text-muted-foreground">
          AgeKey
        </Link>
        <div className="space-y-4 max-w-md">
          <h2 className="text-xl font-thin text-foreground/95">
            Prova de elegibilidade etária com preservação de privacidade.
          </h2>
          <p className="text-sm text-muted-foreground">
            Multi-tenant white-label. Quatro modos de verificação. Auditoria
            minimizada conforme LGPD/GDPR.
          </p>
        </div>
        <p className="text-xs text-muted-foreground/70">
          © 2026 ECA Digital
        </p>
      </aside>

      <main id="main" className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
