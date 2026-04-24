# Plano Completo de Desenvolvimento — AgeKey

## Contexto

O objetivo é construir, a partir do repositório `seusdados/ecadigital360-age-assurance` (hoje vazio), a plataforma **AgeKey** (nome provisório — antes referido no PRD como AgePass Privacy): um motor de prova de elegibilidade etária com preservação de privacidade, licenciável como SaaS B2B, multi-tenant, white-label, com quatro modos de verificação (ZKP, Credential/VC, Gateway, Fallback) e trilhas de auditoria minimizadas.

**Marca, domínio e identificadores definidos:**
- Nome: **AgeKey**
- Domínio-alvo: **agekey.com.br** (ainda não configurado — provisionar antes do GA)
- npm scope: `@agekey/*`
- iOS bundle id: `com.ecadigital.agekey`
- Android package: `com.ecadigital.agekey`
- Issuer no JWT: `https://agekey.com.br` (produção) / `https://staging.agekey.com.br` (staging)

**Infraestrutura alvo confirmada:**
- Repositório: `https://github.com/seusdados/ecadigital360-age-assurance` (branch de trabalho: `claude/platform-development-plan-vn48w`).
- Projeto Supabase: `https://tpdiccnmsnjtjwhardij.supabase.co` — instância única para staging/dev inicial; produção migrará para projeto novo na mesma organização quando estiver pronto para GA.
- Build/deploy web via **Vercel**, com **Next.js 14+ App Router**.
- Deploy de Edge Functions via `supabase functions deploy` acionado pelo CI.

**Regime de execução:**
- Dedicação intensiva e início imediato após aprovação deste plano.
- Monitoramento pós-produção (SRE, on-call, incident response) fica fora do escopo inicial.

## Decisões confirmadas

| Decisão | Resposta |
|---|---|
| Modos de verificação no MVP | Todos os 4 (ZKP + Credential/VC + Gateway + Fallback) |
| SDK mobile | No MVP, em paralelo ao widget web (iOS + Android nativos) |
| Layout do repositório | Monorepo pnpm workspaces |
| Stack obrigatória | Supabase (PG + Auth + Storage + Edge Functions Deno), Next.js, Vercel, GitHub |
| Licenciamento | Open core — SDK/widget/schemas MIT; core (painel, policy, trust registry) proprietário |
| Nome do produto | AgeKey (provisório) |
| Domínio | agekey.com.br (a provisionar) |
| Jurisdições do MVP | Brasil + União Europeia |
| Billing providers | Asaas (primário BR) + Mercado Pago (fallback BR/LatAm). Stripe na Fase 4. |

## Estrutura do monorepo

```
ecadigital360-age-assurance/
├── apps/
│   ├── admin/                  # Next.js 14 App Router — painel multi-tenant
│   ├── docs/                   # Docusaurus público
│   └── widget-demo/            # Sandbox público do widget
├── packages/
│   ├── shared/                 # Zod schemas, types TS, constantes, reason codes
│   ├── sdk-js/                 # SDK JS/TS embutível (browser + server)
│   ├── widget/                 # Web component / React embed
│   ├── crypto-core/            # Wrappers JWS/JWT, BBS+, SD-JWT, ZKP
│   └── adapter-contracts/      # Interfaces dos 4 adapters
├── sdk-mobile/
│   ├── ios/                    # Swift Package — AgePassKit
│   └── android/                # Kotlin lib — agepass-android
├── supabase/
│   ├── migrations/             # SQL versionado
│   ├── functions/              # Edge Functions Deno
│   ├── seed/                   # Seeds de desenvolvimento
│   └── config.toml
├── .github/workflows/          # CI/CD
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## FASE 1 — Arquitetura de Dados

**Objetivo:** definir o esquema PostgreSQL completo no Supabase, incluindo relacionamentos, índices, RLS multi-tenant, criptografia de colunas sensíveis, particionamento de eventos, migrations versionadas e seeds.

### 1.1 Princípios de modelagem
- Multi-tenant lógico: toda tabela de negócio carrega `tenant_id` com RLS obrigatório.
- Minimização: nenhuma coluna armazena data de nascimento, documento bruto ou identidade civil em texto claro.
- Imutabilidade de evidência: `verification_results`, `audit_events`, `billing_events` são append-only.
- Chaves primárias: UUID v7 (ordenável) via função `uuid_generate_v7()`.
- Soft delete apenas em tabelas de configuração.

### 1.2 Migrations planejadas (000–009)

| Migration | Conteúdo |
|---|---|
| `000_bootstrap.sql` | Extensões, helpers globais, funções utilitárias |
| `001_tenancy.sql` | tenants, tenant_users, applications |
| `002_policies.sql` | jurisdictions, policies, policy_versions |
| `003_verifications.sql` | verification_sessions, challenges, proof_artifacts, results, result_tokens |
| `004_trust.sql` | issuers, trust_lists, issuer_revocations, revocations, crypto_keys |
| `005_webhooks.sql` | webhook_endpoints, webhook_deliveries |
| `006_audit_billing.sql` | audit_events, billing_events, usage_counters (particionadas) |
| `007_security.sql` | rate_limit_buckets, ip_reputation |
| `008_rls.sql` | Políticas RLS em todas as tabelas de negócio |
| `009_triggers.sql` | updated_at, imutabilidade, auditoria automática, versionamento de policies |

### 1.3 Correlações

```
tenants 1——N tenant_users ——1 auth.users
tenants 1——N applications
tenants 1——N policies 1——N policy_versions
tenants 1——N trust_lists N——N issuers
applications 1——N verification_sessions
policies 1——N verification_sessions
verification_sessions 1——1 verification_challenges
verification_sessions 1——N proof_artifacts
verification_sessions 1——1 verification_results
verification_results 1——1 result_tokens
result_tokens 1——N revocations
issuers 1——N issuer_revocations
applications 1——N webhook_endpoints 1——N webhook_deliveries
tenants 1——N audit_events (partitioned)
tenants 1——N billing_events (partitioned)
crypto_keys (global)
```

### 1.4 Seeds de desenvolvimento

| Arquivo | Conteúdo |
|---|---|
| `01_dev_tenant.sql` | Tenant "dev", uma application, três policies (13+, 16+, 18+), issuer mock |
| `02_trust_registry.sql` | Issuers públicos conhecidos (EUDI Wallet mock, Google Wallet mock) |
| `03_jurisdictions.sql` | BR + UFs + 27 Estados-membro UE + bloco EU |
| `04_policies_default.sql` | Templates por jurisdição (BR: 13+/16+/18+/21+; UE: 13+/16+/18+) |

### 1.5 Critérios de aceite da Fase 1
- `supabase db reset` aplica tudo em banco limpo sem erro.
- RLS bloqueia cross-tenant em teste automatizado (`pnpm test:rls`).
- `EXPLAIN` confirma uso dos índices nas queries críticas.
- Revisão do modelo de dados assinada pelo usuário antes de seguir para Fase 2.

---

## FASE 2 — Engenharia de Edge Functions

**Objetivo:** construir o verifier-core completo como Supabase Edge Functions (Deno), agnóstico de método via pattern de adapters.

### 2.1 Estrutura

```
supabase/functions/
├── _shared/
│   ├── auth.ts, db.ts, errors.ts, logger.ts, rate-limit.ts
│   ├── tenant-context.ts, tokens.ts, policy-engine.ts
│   ├── trust-registry.ts, audit.ts, billing.ts
│   └── adapters/ (index.ts, zkp.ts, vc.ts, gateway.ts, fallback.ts)
├── verifications-session-create/
├── verifications-session-get/
├── verifications-session-complete/
├── verifications-token-verify/
├── verifications-token-revoke/
├── issuers-register/, issuers-list/
├── policies-list/, policies-write/
├── webhooks-test/, webhooks-worker/ (cron)
├── jwks/
├── key-rotation/ (cron)
├── retention-job/ (cron)
└── trust-registry-refresh/ (cron)
```

### 2.2 Contrato dos adapters

```typescript
export interface VerificationAdapter {
  readonly method: 'zkp' | 'vc' | 'gateway' | 'fallback';
  prepareSession(ctx: SessionContext): Promise<AdapterSessionPayload>;
  completeSession(ctx: SessionContext, input: AdapterCompleteInput): Promise<AdapterResult>;
}
```

### 2.3 Critérios de aceite da Fase 2
- Fluxos A (ZKP), B (VC), C (Gateway), D (Fallback) rodam end-to-end.
- Cobertura de testes >= 80% em `_shared`.
- Nenhuma resposta de API retorna PII.
- `POST /v1/verifications/session` < 150ms P95; `POST /v1/verifications/token/verify` < 50ms P95.

---

## FASE 3 — Engenharia de Frontend

**Objetivo:** painel admin multi-tenant, widget embutível, SDK JS, SDKs nativos iOS e Android no MVP.

### 3.1 Painel (`apps/admin`)
Next.js 14+ App Router, TypeScript strict, Tailwind, shadcn/ui.
Rotas: `/login`, `/onboarding`, `/app/(dashboard)/*` (verificações, applications, policies, issuers, audit, billing, settings).

### 3.2 Widget web (`packages/widget`)
Web Component nativo + wrapper React. Iframe isolado com postMessage.
4 métodos automáticos: Digital Credentials API → wallet → gateway → fallback.
i18n: pt-BR, en-US, es-ES. WCAG 2.1 AA.

### 3.3 SDK JS (`packages/sdk-js`)
Browser ESM + Node/Deno server. Licença MIT.

### 3.4 SDK iOS (`sdk-mobile/ios/AgePassKit`)
Swift 5.9+, iOS 15+, SwiftUI, Swift Package Manager.

### 3.5 SDK Android (`sdk-mobile/android/agepass-android`)
Kotlin 1.9+, Android API 26+, Jetpack Compose, Maven Central.

### 3.6 Critérios de aceite da Fase 3
- Integração web em < 5 min com o Quickstart.
- 4 fluxos rodam em iOS real e Android real.
- Painel permite criar tenant + app + policy + verificação fim-a-fim.

---

## Cross-cutting

### DevOps
- CI: lint → typecheck → unit tests → integration tests → build → preview deploy.
- Ambientes: `dev` (Supabase local), `staging` (`tpdiccnmsnjtjwhardij`), `production` (novo projeto antes do GA).

### Billing
- Asaas (primário BR): PIX, boleto, cartão, recorrência.
- Mercado Pago (alternativo BR/LatAm).
- Stripe: Fase 4 para enterprise EUR.

### Compliance
- DPIA + Registro de Tratamento LGPD/GDPR.
- Retention configurável 30–365 dias por tenant.
- Pentest externo antes do GA.

---

## Marcos

| Marco | Fase | Prazo | Entrega |
|---|---|---|---|
| M1 | 1 — Dados | 5 dias | Migrations + RLS + seeds aplicadas em `tpdiccnmsnjtjwhardij` |
| M2 | 1 — Review | +1 dia | Checkpoint antes Fase 2 |
| M3 | 2 — Edge core | 7 dias | verifier-core, policy engine, tokens, trust registry |
| M4 | 2 — Adapters | 10 dias | ZKP + VC + Gateway + Fallback |
| M5 | 2 — Webhooks | 3 dias | Worker + JWKS + logs |
| M6 | 2 — Review | +1 dia | Checkpoint antes Fase 3 |
| M7 | 3 — Painel | 10 dias | Todas as rotas no Vercel |
| M8 | 3 — Widget + SDK JS | 7 dias | Embed + integrações |
| M9 | 3 — SDK iOS | 10 dias | Swift Package completo |
| M10 | 3 — SDK Android | 10 dias | Maven Central |
| M11 | 3 — Docs | 4 dias | Docusaurus + WCAG |
| M12 | Cross — Pentest + GA | 7 dias | Release 1.0 |

**Total estimado:** 6–8 semanas até GA 1.0.

---

## Pergunta aberta

- **Gateways parceiros do MVP** — quais provedores terceiros priorizar em `adapter-gateway` (Serpro ID, Unico Check, Yoti, Veriff, Onfido, ClearSale, iDwall)? Pode ser decidido durante Fase 2 sem bloquear Fase 1.
