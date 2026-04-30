import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { BrandingForm } from './branding-form';

export const metadata: Metadata = { title: 'Branding' };

interface TenantBrandingRow {
  branding_json: Record<string, unknown> | null;
  retention_days: number;
}

function readString(json: Record<string, unknown> | null, key: string): string {
  if (!json) return '';
  const value = json[key];
  return typeof value === 'string' ? value : '';
}

export default async function BrandingPage() {
  const ctx = await requireTenantContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('branding_json, retention_days')
    .eq('id', ctx.tenantId)
    .single();

  const row = (data ?? null) as TenantBrandingRow | null;

  const canEdit = ctx.role === 'owner' || ctx.role === 'admin';

  const defaults = {
    primary_color: readString(row?.branding_json ?? null, 'primary_color'),
    logo_url: readString(row?.branding_json ?? null, 'logo_url'),
    support_email: readString(row?.branding_json ?? null, 'support_email'),
    retention_days:
      typeof row?.retention_days === 'number' ? row.retention_days : 90,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Branding</h1>
        <p className="text-sm text-muted-foreground">
          Logo, cores e e-mail de suporte exibidos no widget e na página de
          consentimento. Retenção controla por quantos dias guardamos artefatos
          e eventos antes do expurgo.
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Falha ao carregar branding: {error.message}
        </p>
      ) : null}

      {!canEdit ? (
        <p
          id="branding-readonly-hint"
          role="status"
          className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          Você está conectado como <strong>{ctx.role}</strong>. Apenas papéis
          <strong> owner </strong> ou <strong> admin </strong> podem alterar o
          branding deste tenant — campos abaixo aparecem somente para
          consulta.
        </p>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-6">
        <BrandingForm defaults={defaults} canEdit={canEdit} />
      </div>
    </div>
  );
}
