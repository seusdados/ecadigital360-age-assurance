import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['200', '400'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://staging.agekey.com.br',
  ),
  title: {
    default: 'AgeKey — Age Assurance Platform',
    template: '%s · AgeKey',
  },
  description:
    'Motor de prova de elegibilidade etária com preservação de privacidade. Painel multi-tenant.',
  applicationName: 'AgeKey',
  authors: [{ name: 'ECA Digital' }],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0e1014' },
    { media: '(prefers-color-scheme: light)', color: '#f7f3ec' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-theme="obsidian" className={cn(inter.variable)}>
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="skip-link">
          Pular para o conteúdo principal
        </a>
        {children}
      </body>
    </html>
  );
}
