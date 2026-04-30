import type { Metadata } from 'next';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { cn, formatDateTime, shortId } from '@/lib/utils';
import type { TenantUserRow } from '@/types/database';

export const metadata: Metadata = { title: 'Equipe' };

type TeamRow = Pick<TenantUserRow, 'role' | 'user_id' | 'created_at'>;

export default async function TeamPage() {
  const ctx = await requireTenantContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tenant_users')
    .select('role, user_id, created_at')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: true });

  const rows = (data ?? []) as TeamRow[];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-md font-thin">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            Membros do tenant <strong>{ctx.tenantName}</strong> e seus papéis.
            O envio de convites por e-mail entra em uma próxima entrega.
          </p>
        </div>

        <span title="Em breve" aria-describedby="invite-disabled-hint">
          <Button type="button" size="sm" variant="outline" disabled>
            <UserPlus aria-hidden="true" />
            Convidar
          </Button>
        </span>
      </header>

      <p
        id="invite-disabled-hint"
        className="rounded-md border border-dashed border-border bg-card/40 px-4 py-2 text-xs text-muted-foreground"
      >
        Em breve: convites por e-mail com escolha de papel e expiração. Por
        enquanto, papéis são atribuídos manualmente via banco / suporte.
      </p>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Falha ao carregar membros: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-sm">Nenhum membro encontrado.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Isso é incomum — pelo menos o owner do tenant deveria aparecer.
            Verifique as políticas RLS de <code className="font-mono">tenant_users</code>.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-accent/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-normal">
                  Usuário
                </th>
                <th scope="col" className="px-3 py-2 font-normal">
                  Papel
                </th>
                <th scope="col" className="px-3 py-2 font-normal">
                  Membro desde
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isMe = row.user_id === ctx.userId;
                return (
                  <tr
                    key={row.user_id}
                    className="border-t border-border transition hover:bg-accent/20"
                  >
                    <td className="px-3 py-2">
                      <code
                        className="font-mono text-xs text-muted-foreground"
                        title={row.user_id}
                      >
                        {shortId(row.user_id)}
                      </code>
                      {isMe ? (
                        <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                          você
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <RoleBadge role={row.role} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        E-mails dos membros não são exibidos no painel — a leitura de
        <code className="mx-1 font-mono">auth.users</code> requer
        <code className="mx-1 font-mono">service_role</code>, que o painel
        intencionalmente não usa. Esta tela passa a mostrar e-mails depois que
        criarmos uma view RLS dedicada.
      </p>
    </div>
  );
}

function RoleBadge({ role }: { role: TeamRow['role'] }) {
  const tone =
    role === 'owner'
      ? 'bg-primary/15 text-primary'
      : role === 'admin'
        ? 'bg-success/15 text-success'
        : role === 'auditor'
          ? 'bg-warning/15 text-warning'
          : 'bg-muted text-muted-foreground';
  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 text-[11px] uppercase tracking-wide',
        tone,
      )}
    >
      {role}
    </span>
  );
}
