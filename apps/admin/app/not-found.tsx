import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-6 px-6"
    >
      <p className="text-sm uppercase tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="text-xl font-thin">Página não encontrada.</h1>
      <Link href="/" className="text-sm underline-offset-4 hover:underline">
        Voltar para o início →
      </Link>
    </main>
  );
}
