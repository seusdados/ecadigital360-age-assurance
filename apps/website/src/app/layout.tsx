import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agekey.com.br';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'AgeKey | Age Assurance com Privacidade para Sites e Apps',
    template: '%s · AgeKey',
  },
  description:
    'AgeKey é uma infraestrutura de age assurance para sites, apps e plataformas digitais. Verifique elegibilidade etária com API, widget e SDK, sem transformar o fluxo em KYC.',
  applicationName: 'AgeKey',
  keywords: [
    'age assurance',
    'verificação etária',
    'idade online',
    'privacy by design',
    'KYC',
    'AgeKey',
  ],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: siteUrl,
    siteName: 'AgeKey',
    title: 'AgeKey | Age Assurance com Privacidade',
    description:
      'Prove elegibilidade etária sem transformar privacidade em risco. Integre por API, widget ou SDK.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgeKey | Age Assurance com Privacidade',
    description:
      'Prove elegibilidade etária sem transformar privacidade em risco.',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f3ec' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1014' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={cn(inter.variable)}>
      <body className="min-h-screen font-sans antialiased flex flex-col">
        <a href="#main" className="skip-link">
          Pular para o conteúdo principal
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
