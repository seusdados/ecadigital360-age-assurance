import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = {
  title: 'Configure seu tenant',
};

/**
 * RSC entry for first-run onboarding.
 *
 * - Requires authenticated user (otherwise → /login).
 * - If the user already has any tenant_users row, redirect to /dashboard.
 * - Otherwise renders the bootstrap form.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/onboarding');
  }

  // Codex P1: requireTenantContext em (app)/* só aceita memberships cujo
  // tenant NÃO está soft-deleted. Se filtrarmos só por tenant_users.user_id
  // aqui, usuários cujo único tenant foi marcado deleted_at entram em loop
  // /onboarding → /dashboard → /onboarding. Por isso fazemos JOIN e
  // filtramos tenants.deleted_at IS NULL, espelhando a regra do app.
  const { data: activeMemberships, error } = await supabase
    .from('tenant_users')
    .select('tenant_id, tenants:tenant_id ( id, deleted_at )')
    .eq('user_id', user.id);

  if (error) throw error;

  const hasActiveTenant = (activeMemberships ?? []).some((row) => {
    const tenant = (row as { tenants: { deleted_at: string | null } | null }).tenants;
    return tenant !== null && tenant.deleted_at === null;
  });

  if (hasActiveTenant) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Bem-vindo
        </p>
        <h1 className="text-md font-thin">Vamos configurar seu tenant</h1>
        <p className="text-sm text-muted-foreground">
          Em uma etapa criamos a organização e a primeira aplicação. Você
          recebe imediatamente sua API key e webhook secret.
        </p>
      </header>

      <OnboardingForm userEmail={user.email ?? ''} />
    </div>
  );
}
