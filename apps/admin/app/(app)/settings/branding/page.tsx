import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Branding' };

export default function BrandingPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Branding</h1>
        <p className="text-sm text-muted-foreground">
          Logo, cores e domínio custom para o widget. Em construção.
        </p>
      </header>
    </div>
  );
}
