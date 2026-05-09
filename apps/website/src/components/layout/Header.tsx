'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { siteCopy } from '@/content/site';
import { Logo } from '@/components/brand/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="AgeKey — página inicial">
          <Logo />
        </Link>

        <nav
          className="hidden lg:flex items-center gap-6"
          aria-label="Navegação principal"
        >
          {siteCopy.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <ButtonLink href="/contato" variant="secondary" size="md">
            Falar com vendas
          </ButtonLink>
          <ButtonLink href="/demo" variant="primary" size="md">
            Solicitar demo
          </ButtonLink>
        </div>

        <button
          type="button"
          className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-border"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        id="mobile-nav"
        hidden={!open}
        className={cn('lg:hidden border-t border-border bg-background')}
      >
        <nav
          className="container flex flex-col gap-1 py-4"
          aria-label="Navegação mobile"
        >
          {siteCopy.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-3 flex flex-col gap-2">
            <ButtonLink href="/contato" variant="secondary">
              Falar com vendas
            </ButtonLink>
            <ButtonLink href="/demo" variant="primary">
              Solicitar demo
            </ButtonLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
