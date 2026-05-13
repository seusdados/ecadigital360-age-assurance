import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <section className="container py-24 md:py-32">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        404
      </p>
      <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">
        Página não encontrada
      </h1>
      <p className="mt-4 max-w-xl text-base text-muted-foreground">
        O endereço acessado não existe ou foi movido. Você pode voltar à página
        inicial ou falar com o time AgeKey.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <ButtonLink href="/">Voltar à home</ButtonLink>
        <ButtonLink href="/contato" variant="secondary">
          Falar com vendas
        </ButtonLink>
      </div>
    </section>
  );
}
