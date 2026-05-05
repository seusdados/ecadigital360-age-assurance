'use client';

// Client Component justification: highlights the active route via
// `usePathname()` for instant feedback without a server round-trip.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AppWindow,
  CreditCard,
  FileText,
  Gauge,
  Settings,
  Shield,
  ShieldCheck,
  Stamp,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  tenantName: string;
  tenantSlug: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Visão geral', icon: Gauge },
  { href: '/verifications', label: 'Verificações', icon: ShieldCheck },
  { href: '/consents', label: 'Consentimentos', icon: UserCheck },
  { href: '/safety', label: 'Safety Signals', icon: Shield },
  { href: '/applications', label: 'Aplicações', icon: AppWindow },
  { href: '/policies', label: 'Políticas', icon: FileText },
  { href: '/issuers', label: 'Emissores', icon: Stamp },
  { href: '/audit', label: 'Auditoria', icon: Activity },
  { href: '/billing', label: 'Faturamento', icon: CreditCard },
  { href: '/settings/team', label: 'Configurações', icon: Settings },
];

function isActive(href: string, current: string): boolean {
  if (href === '/dashboard') return current === href;
  if (href === '/settings/team') return current.startsWith('/settings');
  return current === href || current.startsWith(`${href}/`);
}

export function Sidebar({ tenantName, tenantSlug }: SidebarProps) {
  const pathname = usePathname() ?? '/';
  return (
    <aside
      aria-label="Navegação principal"
      className="hidden w-64 shrink-0 border-r border-border bg-card lg:flex lg:flex-col"
    >
      <div className="border-b border-border px-6 py-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Tenant
        </p>
        <p className="truncate text-base font-normal" title={tenantName}>
          {tenantName}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          /{tenantSlug}
        </p>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href, pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-6 py-4">
        <p className="text-xs text-muted-foreground">AgeKey · staging</p>
      </div>
    </aside>
  );
}
