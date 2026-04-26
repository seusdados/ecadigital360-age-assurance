import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/app/(app)/actions';

interface TopbarProps {
  email: string;
  role: string;
}

export function Topbar({ email, role }: TopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <h1 className="sr-only">Painel AgeKey</h1>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {/* Placeholder for breadcrumbs / search; comes in slice 2. */}
          AgeKey Admin
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 sm:flex">
          <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs">{email}</span>
          <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent-foreground">
            {role}
          </span>
        </div>

        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            aria-label="Sair da conta"
          >
            <LogOut aria-hidden="true" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
