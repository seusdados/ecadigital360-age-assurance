import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { requireTenantContext } from '@/lib/agekey/tenant';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireTenantContext();

  return (
    <div className="flex min-h-screen">
      <Sidebar tenantName={ctx.tenantName} tenantSlug={ctx.tenantSlug} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar email={ctx.email} role={ctx.role} />
        <main id="main" className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
