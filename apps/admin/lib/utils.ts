import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Locale-aware date formatter. Always pt-BR for now; i18n in M11.
const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '—';
  return DATE_TIME.format(d);
}

const NUMBER = new Intl.NumberFormat('pt-BR');

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return NUMBER.format(n);
}

// Truncate hex/UUID for display without copy-paste loss.
export function shortId(id: string, head = 8, tail = 4): string {
  if (!id || id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}
