import type { Metadata } from 'next';
import { agekey, AgeKeyApiError } from '@/lib/agekey/client';
import type { ApplicationListItem, WebhookEndpointItem } from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { WebhooksList } from './webhooks-list';
import { NewWebhookButton } from './webhook-form';

export const metadata: Metadata = { title: 'Webhooks' };

export default async function WebhooksPage() {
  await requireTenantContext();

  let webhooks: WebhookEndpointItem[] = [];
  let applications: ApplicationListItem[] = [];
  let loadError: string | null = null;

  try {
    const [whResult, appResult] = await Promise.all([
      agekey.webhooks.list(),
      agekey.applications.list(),
    ]);
    webhooks = whResult.items;
    applications = appResult.items;
  } catch (err) {
    loadError =
      err instanceof AgeKeyApiError
        ? `Falha ao carregar webhooks (${err.reasonCode}).`
        : 'Falha ao carregar webhooks.';
  }

  const hasApplications = applications.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-md font-thin">Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Endpoints HTTP que recebem eventos do AgeKey. O secret de
            assinatura HMAC é exibido apenas uma vez na criação ou rotação.
          </p>
        </div>
        {hasApplications ? (
          <NewWebhookButton applications={applications} />
        ) : null}
      </header>

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </p>
      ) : null}

      {!hasApplications && !loadError ? (
        <NoApplicationsState />
      ) : webhooks.length === 0 && !loadError ? (
        <EmptyState />
      ) : webhooks.length > 0 ? (
        <WebhooksList webhooks={webhooks} applications={applications} />
      ) : null}
    </div>
  );
}

function NoApplicationsState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <p className="text-sm">Crie uma aplicação antes de configurar webhooks.</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Webhooks pertencem a uma aplicação — vá em Aplicações para começar.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <p className="text-sm">Nenhum webhook cadastrado ainda.</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Clique em &quot;Novo webhook&quot; para receber eventos do AgeKey.
      </p>
    </div>
  );
}
