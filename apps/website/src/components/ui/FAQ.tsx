'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FAQ({
  items,
}: {
  items: ReadonlyArray<{ q: string; a: string }>;
}) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {items.map((item, i) => {
        const isOpen = open === i;
        const id = `faq-${i}`;
        return (
          <div key={i}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={id}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
            >
              <span className="text-base font-medium text-foreground">
                {item.q}
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180',
                )}
              />
            </button>
            <div
              id={id}
              hidden={!isOpen}
              className="px-5 pb-5 text-sm md:text-base text-muted-foreground"
            >
              {item.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
