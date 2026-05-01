'use client';

import { useId, useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FAQ_CATEGORIES,
  FAQ_ITEMS,
  type FaqCategoryId,
  type FaqItem,
} from '@/lib/faq/data';

type CategoryFilter = 'all' | FaqCategoryId;

const FILTERS: ReadonlyArray<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  ...FAQ_CATEGORIES.map((c) => ({ id: c.id as CategoryFilter, label: c.label })),
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matches(item: FaqItem, query: string, categoryLabel: string): boolean {
  if (!query) return true;
  const haystack = normalize(
    `${item.question} ${item.answer} ${categoryLabel}`,
  );
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

export function FaqExplorer() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const searchId = useId();

  const normalizedQuery = useMemo(() => normalize(query.trim()), [query]);

  const grouped = useMemo(() => {
    const filtered = FAQ_ITEMS.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      const label =
        FAQ_CATEGORIES.find((c) => c.id === item.category)?.label ?? '';
      return matches(item, normalizedQuery, label);
    });

    const byCategory = new Map<FaqCategoryId, FaqItem[]>();
    for (const item of filtered) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    return FAQ_CATEGORIES.map((cat) => ({
      category: cat,
      items: byCategory.get(cat.id) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [normalizedQuery, category]);

  const totalResults = grouped.reduce((acc, g) => acc + g.items.length, 0);

  function toggle(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <section
      aria-labelledby="faq-heading"
      className="mx-auto w-full max-w-4xl px-6 pb-24"
    >
      <h2 id="faq-heading" className="sr-only">
        Lista de perguntas
      </h2>

      <div className="space-y-5">
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            Buscar nas perguntas frequentes
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por pergunta, resposta ou categoria"
            autoComplete="off"
            className={cn(
              'flex h-11 w-full rounded-md border border-input bg-background pl-9 pr-10 py-2 text-sm shadow-sm transition-colors',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div role="tablist" aria-label="Filtrar por categoria" className="-mx-1 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = category === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(f.id)}
                className={cn(
                  'inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-normal transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {totalResults === 0
            ? 'Nenhuma pergunta encontrada para os filtros atuais.'
            : `${totalResults} ${totalResults === 1 ? 'pergunta' : 'perguntas'} encontradas`}
        </p>
      </div>

      <div className="mt-10 space-y-12">
        {grouped.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Tente outros termos ou selecione uma categoria diferente.
            </p>
          </div>
        )}

        {grouped.map(({ category: cat, items }) => (
          <div key={cat.id} className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-md font-thin tracking-tight text-foreground">
                {cat.label}
              </h3>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {items.length} {items.length === 1 ? 'pergunta' : 'perguntas'}
              </span>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {items.map((item) => {
                const open = openId === item.id;
                const buttonId = `faq-q-${item.id}`;
                const panelId = `faq-a-${item.id}`;
                return (
                  <li key={item.id}>
                    <h4>
                      <button
                        type="button"
                        id={buttonId}
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => toggle(item.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors',
                          'hover:bg-accent/40',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        )}
                      >
                        <span className="text-sm font-normal text-foreground">
                          {item.question}
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className={cn(
                            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                            open && 'rotate-180 text-foreground',
                          )}
                        />
                      </button>
                    </h4>
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      hidden={!open}
                      className="px-5 pb-5"
                    >
                      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                        {item.answer}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
