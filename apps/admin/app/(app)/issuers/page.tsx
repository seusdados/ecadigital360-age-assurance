import type { Metadata } from 'next';
import { agekey, AgeKeyApiError } from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { cn, shortId } from '@/lib/utils';

export const metadata: Metadata = { title: 'Emissores' };

export default async function IssuersPage() {
  await requireTenantContext();

  let items: Awaited<ReturnType<typeof agekey.issuers.list>>['items'] = [];
  let loadError: string | null = null;

  try {
    const r = await agekey.issuers.list();
    items = r.items;
  } catch (err) {
    loadError =
      err instanceof AgeKeyApiError
        ? `Falha ao carregar emissores (${err.reasonCode}).`
        : 'Falha ao carregar emissores.';
  }

  const global = items.filter((i) => i.scope === 'global');
  const tenantOwned = items.filter((i) => i.scope === 'tenant');

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Emissores</h1>
        <p className="text-sm text-muted-foreground">
          Trust registry. Emissores globais são geridos pela AgeKey;
          o seu tenant pode adicionar overrides ou registrar emissores próprios.
        </p>
      </header>

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </p>
      ) : null}

      {global.length > 0 ? (
        <IssuersSection title="Globais" issuers={global} />
      ) : null}

      <IssuersSection
        title="Do seu tenant"
        issuers={tenantOwned}
        emptyHint="Nenhum emissor registrado no seu tenant ainda."
      />
    </div>
  );
}

function IssuersSection({
  title,
  issuers,
  emptyHint,
}: {
  title: string;
  issuers: Awaited<ReturnType<typeof agekey.issuers.list>>['items'];
  emptyHint?: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {issuers.length === 0 ? (
        emptyHint ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-10 text-center text-sm text-muted-foreground">
            {emptyHint}
          </div>
        ) : null
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-accent/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-normal">Nome</th>
                <th className="px-3 py-2 font-normal">DID</th>
                <th className="px-3 py-2 font-normal">Status</th>
                <th className="px-3 py-2 font-normal">Formatos</th>
              </tr>
            </thead>
            <tbody>
              {issuers.map((i) => (
                <tr
                  key={i.id}
                  className="border-t border-border transition hover:bg-accent/20"
                >
                  <td className="px-3 py-2">{i.name}</td>
                  <td className="px-3 py-2">
                    <code
                      className="font-mono text-xs text-muted-foreground"
                      title={i.issuer_did}
                    >
                      {shortId(i.issuer_did, 24, 8)}
                    </code>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'rounded px-2 py-0.5 text-[11px] uppercase',
                        i.trust_status === 'trusted'
                          ? 'bg-success/15 text-success'
                          : i.trust_status === 'suspended'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-destructive/15 text-destructive',
                      )}
                    >
                      {i.trust_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {i.supports_formats.join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
