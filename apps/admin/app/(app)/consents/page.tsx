import type { Metadata } from 'next';
import Link from 'next/link';
import { ParentalConsentStatusSchema } from '@agekey/shared';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { cn, formatDateTime, shortId } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Consentimentos Parentais',
};

interface ConsentsPageProps {
  searchParams: Promise<{
    status?: string;
    cursor?: string;
  }>;
}

const STATUS_OPTIONS = ParentalConsentStatusSchema.options;

interface ConsentRow {
  id: string;
  status: string;
  resource: string;
  child_ref_hmac: string;
  decided_at: string | null;
  reason_code: string | null;
  created_at: string;
  policy_id: string;
  application_id: string;
}

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  awaiting_guardian: 'Aguardando responsável',
  awaiting_verification: 'Aguardando OTP',
  awaiting_confirmation: 'Aguardando confirmação',
  approved: 'Aprovado',
  denied: 'Negado',
  expired: 'Expirado',
  revoked: 'Revogado',
};

const STATUS_TONE: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-900',
  denied: 'bg-rose-100 text-rose-900',
  revoked: 'bg-amber-100 text-amber-900',
  expired: 'bg-stone-100 text-stone-700',
};

export default async function ConsentsPage({ searchParams }: ConsentsPageProps) {
  await requireTenantContext();
  const params = await searchParams;
  const status =
    params.status && (STATUS_OPTIONS as readonly string[]).includes(params.status)
      ? params.status
      : undefined;

  const supabase = await createClient();

  // Cast: tabelas Consent ainda não estão no `Database` type gerado.
  // Após primeira aplicação das migrations 020-023, regenerar via
  // `supabase gen types` e remover o cast.
  let query = supabase
    .from('parental_consent_requests' as never)
    .select(
      'id, status, resource, child_ref_hmac, decided_at, reason_code, created_at, policy_id, application_id',
    )
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (status) query = query.eq('status', status);

  const { data: consentsData, error } = await query;
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
        Erro ao listar consentimentos: {error.message}
      </div>
    );
  }

  const items = (consentsData as unknown as ConsentRow[] | null) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Consentimentos parentais</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicitações de consentimento criadas via{' '}
            <code className="rounded bg-muted px-1">/v1/parental-consent/session</code>.
            Sem PII de criança ou responsável — apenas referências opacas.
          </p>
        </div>
      </header>

      <form className="flex items-end gap-3" method="GET">
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <select
            name="status"
            defaultValue={status ?? ''}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">ID</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Recurso</th>
              <th className="px-4 py-2 font-medium">Ref. criança</th>
              <th className="px-4 py-2 font-medium">Reason</th>
              <th className="px-4 py-2 font-medium">Criado em</th>
              <th className="px-4 py-2 font-medium">Decidido em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Nenhuma solicitação de consentimento encontrada.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link
                      href={`/consents/${c.id}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {shortId(c.id)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs',
                        STATUS_TONE[c.status] ?? 'bg-muted text-foreground',
                      )}
                    >
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{c.resource}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {shortId(c.child_ref_hmac)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {c.reason_code ?? '—'}
                  </td>
                  <td className="px-4 py-2">{formatDateTime(c.created_at)}</td>
                  <td className="px-4 py-2">
                    {c.decided_at ? formatDateTime(c.decided_at) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
