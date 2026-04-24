# AgeKey — Age Assurance Platform

Motor de prova de elegibilidade etária com preservação de privacidade, licenciável como SaaS B2B, multi-tenant, white-label.

**Stack:** Supabase · Next.js 14 · Vercel · pnpm workspaces · Turborepo

**Documentação:** [`docs/PLATFORM_DEVELOPMENT_PLAN.md`](docs/PLATFORM_DEVELOPMENT_PLAN.md)

## Início rápido (dev local)

```bash
pnpm install
supabase start
supabase db reset
pnpm dev
```

## Estrutura

```
apps/       — admin (Next.js), docs (Docusaurus), widget-demo
packages/   — shared, sdk-js, widget, crypto-core, adapter-contracts
sdk-mobile/ — ios (Swift), android (Kotlin)
supabase/   — migrations, functions, seed
```

## Licença

Open core — SDKs e widget: MIT. Painel, policy engine, trust registry: proprietário.
