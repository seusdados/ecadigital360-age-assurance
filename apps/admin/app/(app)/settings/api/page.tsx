import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { CodeBlock } from './code-block';
import { TokenVerifyForm } from './token-verify-form';

export const metadata: Metadata = { title: 'API' };

const DOCS_URL = 'https://docs.agekey.com.br';

function getApiBase(): string {
  return (
    process.env.NEXT_PUBLIC_AGEKEY_API_BASE ??
    'https://staging.agekey.com.br/v1'
  );
}

function getIssuerBase(): string {
  return (
    process.env.NEXT_PUBLIC_AGEKEY_ISSUER ?? 'https://staging.agekey.com.br'
  );
}

export default async function ApiSettingsPage() {
  const ctx = await requireTenantContext();
  const apiBase = getApiBase();
  const issuerBase = getIssuerBase();
  const jwksUrl = `${issuerBase.replace(/\/$/, '')}/.well-known/jwks.json`;

  const curlCreateSession = `curl -X POST "${apiBase}/verifications-session-create" \\
  -H "X-AgeKey-API-Key: ak_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "policy_slug": "br-18-substantial",
    "redirect_url": "https://seu-site.exemplo.com/age-callback"
  }'`;

  const curlGetSession = `curl -X GET "${apiBase}/verifications-session-get?session_id=<UUID>" \\
  -H "X-AgeKey-API-Key: ak_live_…"`;

  const curlVerifyToken = `curl -X POST "${apiBase}/verifications-token-verify" \\
  -H "X-AgeKey-API-Key: ak_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{ "token": "eyJhbGciOi..." }'`;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-md font-thin">API</h1>
        <p className="text-sm text-muted-foreground">
          Endpoints, JWKS e exemplos de integração para o tenant{' '}
          <strong>{ctx.tenantName}</strong>.
        </p>
      </header>

      <section
        aria-labelledby="endpoints-heading"
        className="space-y-3 rounded-lg border border-border bg-card p-6"
      >
        <h2
          id="endpoints-heading"
          className="text-sm uppercase tracking-widest text-muted-foreground"
        >
          Endpoints
        </h2>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              API base
            </dt>
            <dd className="mt-1 break-all font-mono text-xs">{apiBase}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              JWKS
            </dt>
            <dd className="mt-1 break-all font-mono text-xs">{jwksUrl}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Issuer
            </dt>
            <dd className="mt-1 break-all font-mono text-xs">{issuerBase}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Cabeçalho de autenticação
            </dt>
            <dd className="mt-1 font-mono text-xs">
              X-AgeKey-API-Key: ak_live_…
            </dd>
          </div>
        </dl>

        <p className="pt-2 text-xs text-muted-foreground">
          A API key raw (<code className="font-mono">ak_live_…</code>) é
          exibida uma única vez na criação da aplicação. Caso tenha perdido,
          use a rotação na página de Aplicações.
        </p>
      </section>

      <section aria-labelledby="docs-heading" className="space-y-3">
        <h2
          id="docs-heading"
          className="text-sm uppercase tracking-widest text-muted-foreground"
        >
          Documentação
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <DocLink
              href={DOCS_URL}
              title="Guia da API"
              description="Visão geral, autenticação, paginação e códigos de erro."
            />
          </li>
          <li>
            <DocLink
              href={`${DOCS_URL}/quickstart`}
              title="Quickstart"
              description="Embeda o widget em 5 passos: token, redirect e verificação."
            />
          </li>
          <li>
            <DocLink
              href={`${DOCS_URL}/webhooks`}
              title="Webhooks"
              description="Assinatura HMAC-SHA256, retries e formato dos eventos."
            />
          </li>
          <li>
            <DocLink
              href={`${DOCS_URL}/policies`}
              title="Políticas"
              description="Como modelar regras de elegibilidade etária por jurisdição."
            />
          </li>
        </ul>
      </section>

      <section aria-labelledby="examples-heading" className="space-y-3">
        <h2
          id="examples-heading"
          className="text-sm uppercase tracking-widest text-muted-foreground"
        >
          Exemplos curl
        </h2>

        <div className="space-y-4">
          <CodeBlock label="Criar sessão" code={curlCreateSession} />
          <CodeBlock label="Buscar sessão" code={curlGetSession} />
          <CodeBlock label="Verificar token" code={curlVerifyToken} />
        </div>
      </section>

      <section aria-labelledby="token-verify-heading" className="space-y-3">
        <h2
          id="token-verify-heading"
          className="text-sm uppercase tracking-widest text-muted-foreground"
        >
          Token verify tester
        </h2>
        <p className="text-sm text-muted-foreground">
          Cole um JWT emitido pelo AgeKey e veja{' '}
          <code className="font-mono">valid</code>,{' '}
          <code className="font-mono">claims</code> e{' '}
          <code className="font-mono">revoked</code>. Útil para suporte e
          como sanity check após rotação de chaves de assinatura.
        </p>
        <TokenVerifyForm />
      </section>
    </div>
  );
}

function DocLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col gap-1 rounded-lg border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-accent/30"
    >
      <span className="flex items-center justify-between gap-2 text-sm font-normal">
        {title}
        <ExternalLink
          className="h-3.5 w-3.5 text-muted-foreground transition group-hover:text-foreground"
          aria-hidden="true"
        />
      </span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </a>
  );
}
