# Auditoria prudente do estado atual - AgeKey

## Escopo desta auditoria

Esta auditoria toma como base o repositório `seusdados/ecadigital360-age-assurance` na branch `main`, o plano de desenvolvimento já versionado, o PRD da ferramenta e a arquitetura discutida para o produto AgeKey.

O objetivo não é substituir o desenvolvimento já feito. O objetivo é reduzir retrabalho: registrar o que está consolidado, o que está parcialmente implementado, o que não deve ser prometido como pronto, e qual material deve ser entregue ao Claude Code para avançar sem gastar tokens em redescoberta.

## Estado geral observado

O repositório já deixou de ser um esqueleto. Ele contém um monorepo com `pnpm`, `turbo`, `apps/*`, `packages/*`, Supabase migrations, Edge Functions e painel administrativo em Next.js.

A raiz declara o projeto como `agekey`, privado, versão `0.0.1`, com scripts para `dev`, `build`, `test`, `test:rls`, `test:integration`, `lint`, `typecheck` e `format`. Isso indica uma estrutura coerente para desenvolvimento incremental e CI. O workspace atual, entretanto, inclui apenas `apps/*` e `packages/*`, portanto qualquer SDK mobile em `sdk-mobile/*` ainda não entra automaticamente no workspace pnpm, o que é correto, pois iOS e Android não devem ser gerenciados por pnpm.

## O que está forte

### 1. Conceito de produto

O README já posiciona AgeKey como motor de prova de elegibilidade etária com preservação de privacidade, licenciável como SaaS B2B, multi-tenant e white-label. Isso está alinhado ao PRD e deve ser preservado.

### 2. Modelo de dados

As migrations de verificação estão muito bem direcionadas. O núcleo transacional separa:

- `verification_sessions`
- `verification_challenges`
- `proof_artifacts`
- `verification_results`
- `result_tokens`

Essa separação é correta porque evita uma tabela central de usuários verificados. O banco registra sessão, prova, decisão e token, não identidade civil.

O campo `external_user_ref` existe, mas a documentação diz que deve ser referência opaca, nunca PII. O risco aqui é operacional: clientes podem inserir e-mail, CPF ou identificador civil nesse campo. A recomendação é evoluir para hash obrigatório ou criar função de normalização client-side/server-side.

### 3. Anti-replay

A tabela `verification_challenges` tem `nonce` único, `expires_at` e `consumed_at`. O endpoint de complete consome o challenge antes de acionar o adapter. Isso é fundamental.

### 4. Minimização

A documentação do modelo de dados já explicita ausência de data de nascimento, documento civil e nome completo. O schema de artefatos persiste hash e storage path, não o conteúdo bruto por padrão.

### 5. RLS

O arquivo `008_rls.sql` habilita RLS em tabelas de negócio e bloqueia escrita direta em sessões, challenges, results e tokens por usuários comuns. A decisão de permitir escrita apenas via Edge Functions/service_role é correta.

### 6. Edge Functions

O backend já tem functions para criação, consulta, conclusão de sessão, token verify/revoke, JWKS, rotação de chaves, trust registry, webhooks, policies, issuers, audit e billing.

### 7. Tokenização

O token usa JWS/JWT ES256 via Web Crypto em `packages/shared/src/jws.ts`. Isso é uma boa decisão para Deno, Node moderno e browser/server consumers.

### 8. Adapter registry

O registry de adapters já existe com métodos `zkp`, `vc`, `gateway` e `fallback`. Isso preserva a arquitetura modular.

## O que está parcialmente pronto e precisa de cuidado

### 1. ZKP/BBS+

O adapter ZKP atual é honesto: reconhece formatos BBS+/BLS12-381, mas retorna unsupported até existir verifier real. Ele implementa um caminho de predicate attestation via JWS. Isso é prudente e não deve ser apagado.

Recomendação: documentar claramente como `ZKP-ready`, não como "BBS+ production verifier".

### 2. Gateway providers

O adapter gateway atual aceita atestação JWS genérica e normaliza claims por metadata do issuer. Essa é uma boa base. O que falta são provider adapters reais, cada um com start, callback, verificação de assinatura e normalização específica.

Recomendação: manter o core genérico e adicionar provider contracts sem acoplar o produto a um gateway específico.

### 3. SDKs mobile

O plano fala em `sdk-mobile/ios` e `sdk-mobile/android`, mas o workspace não contém pacotes mobile efetivos. Isso não bloqueia o MVP web, mas bloqueia promessa de SDK nativo.

Recomendação: criar SDKs nativos como bibliotecas client-only, sem lógica sensível e sem coleta de PII.

### 4. Manual e materiais comerciais

Há `DEPLOY.md`, `docs/data-model.md` e `docs/PLATFORM_DEVELOPMENT_PLAN.md`, mas falta um manual integral para leigos e devs com fluxo, diagramas, responsabilidades e narrativa comercial.

## Riscos prioritários

### Risco 1 - `external_user_ref` pode virar PII

Mitigação: documentar como hash/ref opaca; criar helper no SDK para hash; adicionar privacy tests que falham se payload público contém `birthdate`, `dob`, `document`, `cpf`, `name`, `email`, `phone`, `selfie`, `raw_id`.

### Risco 2 - confusão entre ZKP real e attestation JWS

Mitigação: manter nomenclatura técnica: "predicate attestation" para o caminho atual; "BBS+ verifier" somente quando houver lib, issuer, test vectors e validação externa.

### Risco 3 - Supabase service role exposta

Mitigação: reforçar `infrastructure/secrets.md`; SDKs e widget nunca recebem service role.

### Risco 4 - tenant breakout

Mitigação: ampliar testes RLS e testes de API com dois tenants; garantir que `setTenantContext()` sempre ocorre depois da autenticação e antes de query sensível.

### Risco 5 - payload público com dado sensível

Mitigação: `packages/shared/src/privacy-guard.ts` e testes de payload.

## Matriz de maturidade

| Componente | Estado | Decisão |
|---|---|---|
| Modelo de dados | Forte | manter, endurecer privacy tests |
| RLS | Bom | testar cross-tenant com dois tenants reais |
| Edge Functions | Bom | revisar rotas e path conventions |
| Token JWS | Bom | publicar spec AgeKey Token |
| ZKP BBS+ | Não production-ready | manter como contrato/futuro |
| Predicate attestation | Usável | documentar sem inflar claim |
| Gateway genérico | Bom | adicionar provider contracts |
| SDK Web/widget | pendente/indeterminado | priorizar |
| SDK iOS | ausente | adicionar Swift Package client-only |
| SDK Android | ausente | adicionar Kotlin lib client-only |
| Manual | ausente | adicionar MD/PDF/DOCX |
| Pentest pack | ausente | adicionar escopo e threat model |
| RIPD/DPIA | ausente | adicionar artefatos |
| DNS agekey.com.br | comprado, não operacional | criar plano DNS |

## Estado após implementação Claude Code (2026-04-30)

**Branch:** `claude/agekey-architecture-setup-BVrLC`
**Base PR:** #16 (`agekey/production-readiness-20260429`)

### Comandos executados (último run)

| Comando | Status |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `pnpm typecheck` | 5/5 PASS |
| `pnpm lint` | 0 warnings |
| `pnpm test` | 48/48 tests PASS (28 shared + 20 adapter-contracts) |
| `pnpm build` (apps/admin) | OK — todas as rotas compilam |

### O que foi efetivamente implementado nesta passagem

- **Acessibilidade (apps/admin):** removido o anti-pattern
  `aria-invalid` em `role="group"` no `MethodPriorityEditor`,
  substituído por `aria-describedby` + `data-invalid` +
  `border-destructive`. Lint volta a 0 warnings.
- **Token contract:** `AgeKeyTokenPublicClaimsSchema` consolidado
  como alias para o canônico `ResultTokenClaimsSchema`.
  `FORBIDDEN_PUBLIC_KEYS` exportado a partir de `privacy-guard.ts`
  como single source of truth.
- **Privacy guard:** lista expandida (BR + biométricos),
  canonicalização (lowercase + strip `_-` + trailing digits),
  `allowedKeys` para overrides locais, e integração nas Edge
  Functions críticas (`verifications-session-complete`,
  `verifications-token-verify`, `verifications-session-get`).
- **Gateway framework:** `ContractOnlyGatewayProvider`,
  `GatewayProviderRegistry` e `buildGatewayProviderRegistry`
  promovidos para `packages/adapter-contracts` como fonte
  canônica; `GatewayProviderUnknownError` adicionado.
- **ZKP/BBS+:** `requireBbsProductionReadiness` corrigido
  (antes aprovava silenciosamente quando chamado com `{}`);
  checklist de production-readiness adicionado.
- **Tests:** vitest configurado em `@agekey/shared` e
  `@agekey/adapter-contracts`. 48 testes passando.
- **SDK mobile:** READMEs iOS/Android reescritos como reference
  implementation honesta.
- **Compliance:** RIPD enriquecida com "Por que AgeKey não é KYC"
  e auditoria sem identidade civil; subprocessors register
  publicável.
- **Security:** `manual-smoke-tests.md` + severity rubric.
- **Infra:** `go-live-checklist.md` consolidado.
- **Product:** `product-language-guide.md` com claims comerciais
  seguros.
- **Commercial:** `screen-capture-shot-list.md` +
  `pitch-deck-outline.md`.
- **Backlog:** matriz acionável + 10 issues P0 prontas.

### O que continua pendente por dependência externa

- AK-P0-01 separar Supabase staging/production (acesso Supabase Pro);
- AK-P0-02 DNS `agekey.com.br` (acesso ao registrar);
- AK-P0-10 pentest externo (vendor + budget);
- AK-P1-02..05 providers reais (DPAs Yoti/Veriff/Onfido/Serpro/iDwall);
- AK-P2-01 BBS+ verifier real (lib + test vectors + audit cripto);
- AK-P1-01 SDKs iOS/Android validados (Xcode/Android Studio).
