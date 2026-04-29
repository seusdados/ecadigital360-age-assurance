import type { Metadata } from 'next';
import { agekey, AgeKeyApiError } from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { Button } from '@/components/ui/button';
import { cn, formatDateTime } from '@/lib/utils';
import {
  EditApplicationButton,
  NewApplicationButton,
  type ApplicationFormInitial,
} from './application-form';
import { RotateKeyDialog } from './rotate-key-dialog';

export const metadata: Metadata = { title: 'Aplicações' };

export default async function ApplicationsPage() {
  await requireTenantContext();

  let applications: Awaited<
    ReturnType<typeof agekey.applications.list>
  >['items'] = [];
  let loadError: string | null = null;

  try {
    const result = await agekey.applications.list();
    applications = result.items;
  } catch (err) {
    loadError =
      err instanceof AgeKeyApiError
        ? `Falha ao carregar aplicações (${err.reasonCode}).`
        : 'Falha ao carregar aplicações.';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-md font-thin">Aplicações</h1>
          <p className="text-sm text-muted-foreground">
            API keys e webhooks por aplicação. Cada aplicação possui uma
            api_key única — exibida apenas uma vez no momento da criação ou
            rotação.
          </p>
        </div>
        <NewApplicationButton />
      </header>

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </p>
      ) : null}

      {!loadError && applications.length === 0 ? (
        <EmptyState />
      ) : applications.length > 0 ? (
        <ApplicationsTable applications={applications} />
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <p className="text-sm">Nenhuma aplicação cadastrada ainda.</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Clique em &quot;Nova aplicação&quot; para gerar a primeira api_key do
        seu tenant.
      </p>
    </div>
  );
}

function ApplicationsTable({
  applications,
}: {
  applications: Awaited<ReturnType<typeof agekey.applications.list>>['items'];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-accent/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <Th>Nome</Th>
            <Th>Slug</Th>
            <Th>Status</Th>
            <Th>API key</Th>
            <Th>Webhook</Th>
            <Th>Origens</Th>
            <Th>Criada em</Th>
            <Th>
              <span className="sr-only">Ações</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => {
            const initial: ApplicationFormInitial = {
              id: app.id,
              name: app.name,
              slug: app.slug,
              description: app.description,
              callback_url: app.callback_url,
              webhook_url: app.webhook_url,
              allowed_origins: app.allowed_origins,
            };
            return (
              <tr
                key={app.id}
                className="border-t border-border transition hover:bg-accent/20"
              >
                <Td>{app.name}</Td>
                <Td>
                  <code className="font-mono text-xs">{app.slug}</code>
                </Td>
                <Td>
                  <StatusBadge status={app.status} />
                </Td>
                <Td className="font-mono text-xs">{app.api_key_prefix}…</Td>
                <Td className="max-w-[220px]">
                  {app.webhook_url ? (
                    <a
                      href={app.webhook_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      title={app.webhook_url}
                      className="block truncate text-primary underline-offset-4 hover:underline"
                    >
                      {app.webhook_url}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Td>
                <Td className="text-muted-foreground">
                  {app.allowed_origins.length}
                </Td>
                <Td className="text-muted-foreground">
                  {formatDateTime(app.created_at)}
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <EditApplicationButton application={initial} />
                    <RotateKeyDialog
                      applicationId={app.id}
                      applicationName={app.name}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled
                      title="Disponível na slice 5"
                    >
                      Webhook test
                    </Button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-normal">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn('px-3 py-2 align-middle', className)}>{children}</td>;
}

function StatusBadge({
  status,
}: {
  status: 'active' | 'inactive' | 'suspended';
}) {
  const tone =
    status === 'active'
      ? 'bg-success/15 text-success'
      : status === 'suspended'
        ? 'bg-destructive/15 text-destructive'
        : 'bg-muted text-muted-foreground';
  const label =
    status === 'active'
      ? 'Ativa'
      : status === 'suspended'
        ? 'Suspensa'
        : 'Inativa';
  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 text-[11px] uppercase tracking-wide',
        tone,
      )}
    >
      {label}
    </span>
  );
}
