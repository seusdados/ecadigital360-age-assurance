import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Faturamento' };

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Faturamento</h1>
        <p className="text-sm text-muted-foreground">
          Uso por aplicação, eventos de cobrança e integrações com Asaas /
          Mercado Pago. Em construção.
        </p>
      </header>
    </div>
  );
}
