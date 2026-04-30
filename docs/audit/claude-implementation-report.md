# AgeKey — Claude implementation report

Relatório final da execução de implementação iniciada a partir do PR
#16 (`AgeKey production readiness architecture`).

## 1. Branch trabalhada

`claude/agekey-architecture-setup-BVrLC`, derivada do tip `53875b3`
(o mesmo SHA da branch `agekey/production-readiness-20260429`
referenciada pelo PR #16). Como o mesmo commit já estava acessível,
trabalhei em incremental sobre a branch `claude/agekey-architecture-
setup-BVrLC` em vez de criar uma branch paralela, mantendo o
histórico linear.

## 2. Commits desta passagem

(Em ordem cronológica; head desta branch.)

| SHA | Resumo |
|---|---|
| `32e7a86` | fix(admin): replace aria-invalid on role=group with aria-describedby |
| `ae07b50` | feat(shared): consolidate AgeKey token public contract |
| `581ebb5` | feat(privacy): harden privacy-guard and integrate in public surfaces |
| `c9213b0` | feat(gateway): provider framework with safe stubs and registry |
| `cc8b4f8` | feat(zkp): make BBS+ readiness gate exhaustive + production checklist |
| `a57b807` | docs(sdk-js): note privacy-guard contract in README compliance section |
| `ac3f3bb` | docs(sdk-mobile): mark iOS/Android SDKs as honest reference implementations |
| `ded32b3` | docs(compliance): expand RIPD with KYC delineation and audit guidance |
| `fdfb4cc` | docs(security): add manual smoke tests checklist + severity criteria |
| `2b297d0` | docs(infra): add consolidated go-live checklist |
| `c35c93e` | docs(product): add public language guide |
| `f845aca` | docs(commercial): screen-capture shot list + 15-slide pitch deck outline |
| `a7abe9e` | docs(backlog): convert pending-work-backlog into actionable matrix |

## 3. Arquivos alterados / criados

**Criados:**

- `packages/shared/vitest.config.ts`
- `packages/shared/src/privacy-guard.test.ts`
- `packages/shared/src/schemas/agekey-token.test.ts`
- `packages/adapter-contracts/vitest.config.ts`
- `packages/adapter-contracts/src/gateway-providers.test.ts`
- `packages/adapter-contracts/src/zkp-bbs-contract.test.ts`
- `security/pentest/manual-smoke-tests.md`
- `infrastructure/go-live-checklist.md`
- `docs/product/product-language-guide.md`
- `docs/commercial/screen-capture-shot-list.md`
- `docs/commercial/pitch-deck-outline.md`
- `docs/implementation/github-issues-ready.md`
- `docs/audit/claude-implementation-report.md`

**Modificados:**

- `apps/admin/app/(app)/policies/policy-form.tsx`
- `packages/shared/package.json`
- `packages/shared/src/index.ts`
- `packages/shared/src/privacy-guard.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/schemas/agekey-token.ts`
- `packages/adapter-contracts/package.json`
- `packages/adapter-contracts/src/index.ts`
- `packages/adapter-contracts/src/gateway-providers.ts`
- `packages/adapter-contracts/src/zkp-bbs-contract.ts`
- `supabase/functions/_shared/adapters/gateway-providers.ts`
- `supabase/functions/verifications-session-complete/index.ts`
- `supabase/functions/verifications-session-get/index.ts`
- `supabase/functions/verifications-token-verify/index.ts`
- `sdk-mobile/ios/AgeKeySwift/README.md`
- `sdk-mobile/android/agekey-android/README.md`
- `packages/sdk-js/README.md`
- `compliance/ripd-agekey.md`
- `compliance/subprocessors-register.md`
- `security/pentest/scope.md`
- `docs/architecture/open-source-foundation.md`
- `docs/specs/sdk-public-contract.md`
- `docs/audit/current-state.md`
- `docs/implementation/pending-work-backlog.md`

## 4. O que foi implementado

- **Acessibilidade:** correção do `aria-invalid` em `role="group"`,
  substituindo por `aria-describedby` + `data-invalid` (lint volta
  a zero warnings).
- **Token public contract consolidado:** `AgeKeyTokenPublicClaimsSchema`
  agora é alias do canônico `ResultTokenClaimsSchema` (eliminando
  divergência entre os dois schemas). `FORBIDDEN_PUBLIC_KEYS`
  centralizado em `privacy-guard.ts`. Subpath exports
  (`@agekey/shared/privacy-guard`, `@agekey/shared/agekey-claims`,
  `@agekey/adapter-contracts/gateway-providers`,
  `@agekey/adapter-contracts/zkp-bbs-contract`).
- **Privacy guard endurecido:** lista expandida (BR-specific +
  biometric variants); canonicalização de chaves
  (lowercase + strip `_-` + trailing digits) para detectar
  `DateOfBirth`, `date-of-birth`, `birthDate2`; suporte a
  `allowedKeys` para overrides locais; integração em três Edge
  Functions críticas; 15 testes unitários.
- **Gateway provider framework:** `ContractOnlyGatewayProvider` +
  `GatewayProviderRegistry` + `buildGatewayProviderRegistry`
  promovidos para `packages/adapter-contracts` como fonte
  canônica; `GatewayProviderUnknownError` adicionado;
  Deno-side passa a re-exportar (sem duplicação); 13 testes
  garantindo que cada stub NEVER aprova.
- **ZKP/BBS+ contract gate corrigido:** `requireBbsProductionReadiness`
  era um falso positivo (passava silenciosamente quando chamado
  com `{}`); agora itera lista exaustiva
  `BBS_PRODUCTION_REQUIREMENTS`. 7 testes adicionais.
- **Test infrastructure:** vitest configurado em duas packages;
  48 testes ativos onde antes só havia `echo 'no jest tests yet'`.

## 5. O que foi apenas documentado (sem código novo)

- SDK mobile iOS/Android: READMEs honestos (limitações + secure
  model planejado v0.1).
- SDK JS: nota explícita do contrato privacy-guard no README.
- RIPD §14 ("Por que AgeKey não é KYC"), §15 (auditoria sem
  identidade civil), §16 (vocabulário minimização vs
  pseudonimização vs unlinkability).
- Registro de subprocessadores publicável com regiões e base legal.
- `security/pentest/manual-smoke-tests.md` (checklist defensivo
  com 9 áreas e go-live blockers explícitos).
- Severity rubric em `security/pentest/scope.md`.
- `infrastructure/go-live-checklist.md` (12 seções + sign-off).
- `docs/product/product-language-guide.md` (vocabulário
  permitido/proibido, claims comerciais seguros).
- `docs/commercial/screen-capture-shot-list.md` (S-01..S-15) +
  `docs/commercial/pitch-deck-outline.md` (15 slides honestos).
- `docs/implementation/pending-work-backlog.md` virou matriz
  acionável (P0/P1/P2/P3, ID, estimativa, dependências, critério
  de aceite, arquivos prováveis, risco).
- `docs/implementation/github-issues-ready.md` com 10 issues P0
  prontas para abertura manual.
- Checklist de production-readiness BBS+ em
  `docs/architecture/open-source-foundation.md`.

## 6. O que permanece pendente por dependência externa

| ID | Razão | Bloqueia |
|---|---|---|
| AK-P0-01 | Acesso/contrato Supabase Pro para 2 projetos | go-live |
| AK-P0-02 | Acesso ao registrar do `agekey.com.br` | go-live |
| AK-P0-07 | Acesso ao Vercel (auditoria de env per-scope) | go-live |
| AK-P0-09 | DPO + tabletop SEV-1 com a equipe | go-live |
| AK-P0-10 | Vendor de pentest + budget | go-live |
| AK-P1-01 | Xcode + Android Studio + simulator/device matrix | release mobile |
| AK-P1-02..05 | DPAs e credenciais reais Yoti/Veriff/Onfido/Serpro/iDwall | venda enterprise |
| AK-P2-01 | Lib BBS+ + test vectors RFC 9508 + auditoria cripto externa | claim "ZKP real" |
| AK-P3-01..02 | Wallets EUDI / gov.br homologados | ecossistema VC |

## 7. Resultado dos comandos

(Último run, branch `claude/agekey-architecture-setup-BVrLC`.)

| Comando | Resultado | Notas |
|---|---|---|
| `pnpm install --frozen-lockfile` | OK | 0 drift |
| `pnpm typecheck` | 5/5 PASS | 4 cached, 1 cold após mudanças |
| `pnpm lint` | OK, 0 warnings | era 1 warning conhecido (corrigido) |
| `pnpm test` | 48 PASS / 0 FAIL | 28 shared + 20 adapter-contracts |
| `pnpm build` (apps/admin) | OK | todas as rotas (`/audit /billing /dashboard /issuers /login /onboarding /policies /settings/* /verifications`) compilam; First-Load JS shared = 87.3 kB |
| `cd packages/sdk-js && pnpm build` | FAIL | limitação pré-existente: `@agekey/shared` distribui TS source — documentado no SDK README; não afeta o produto em produção (admin + Edge Functions) |

## 8. Riscos remanescentes

- **`external_user_ref` permite string livre.** Cliente pode
  inserir e-mail/CPF mesmo com a documentação. Mitigado por:
  privacy-guard nas saídas, documentação no SDK, recomendação de
  usar HMAC. Endurecimento (rejeitar literais que casam regex
  PII) é AK-P0-06 no backlog.
- **BBS+ continua bloqueado por design.** Qualquer chamada com
  `bls12381-bbs+` retorna `ZKP_CURVE_UNSUPPORTED`. Esta é uma
  posição **defensável**, não um bug. Levantar somente após
  cumprir o checklist em `docs/architecture/open-source-
  foundation.md`.
- **Mobile SDKs continuam reference implementation insegura.**
  Atual `AgeKeyClient.{swift,kt}` aceita `apiKey` no `config` —
  isso vaza em apps publicados. Não habilitar em produção mobile
  até v0.1 (AK-P1-01).
- **Build do `@agekey/sdk-js` em isolamento falha.** A pipeline
  do produto não depende disso (admin Next.js compila), mas
  publicação npm precisará primeiro compilar `@agekey/shared`.
- **CI ainda não tem privacy-guard fuzz.** Testes unitários cobrem
  o caminho feliz; o cenário "adapter retornando `birthdate`"
  é coberto pelo `assertPublicPayloadHasNoPii` em runtime, mas
  não há fuzz contra os endpoints em CI. Backlog AK-P0-05.
- **Sem testes RLS cross-tenant ainda.** Tem `pnpm test:rls`
  declarado na pipeline raiz, mas o pacote `@agekey/admin` é o
  único na escopo. Backlog AK-P0-04.

## 9. Recomendação de próximos PRs

Em ordem:

1. **AK-P0-04 + AK-P0-05** (testes RLS cross-tenant + privacy
   guard fuzz em CI) — desbloqueia o pentest e dá garantia
   automatizada das duas fronteiras mais sensíveis.
2. **AK-P0-06** (validação de `external_user_ref`) — fecha a
   brecha operacional mais provável.
3. **AK-P0-01 + AK-P0-02 + AK-P0-03** (Supabase prod separado +
   DNS + proxy `api.agekey.com.br`) — desbloqueia comercial e
   estabiliza contrato público.
4. **AK-P0-07 + AK-P0-08 + AK-P0-09** (env hygiene + key rotation
   + tabletop SEV-1) — fecha postura defensiva.
5. **AK-P1-08 + AK-P1-09 + AK-P1-10** (webhook UI + token tester
   + audit export) — quick wins enterprise.
6. **AK-P0-10** (pentest externo) → marca prontidão GA.
7. **AK-P1-02..05** quando DPAs forem assinadas.

## 10. Sign-off técnico

Esta passagem entrega um pacote de production readiness que:

- não introduz dependência pesada,
- não quebra typecheck/lint/test/build (admin),
- não mistura código com mockup ou cripto falsa,
- aumenta cobertura de teste de 0 para 48,
- documenta limitações em vez de escondê-las.

Não substitui pentest externo, separação Supabase, DNS, DPA com
gateways, validação Xcode/Android Studio, nem auditoria
criptográfica BBS+. Esses itens precisam de ações de pessoas e
orçamento que estão fora do escopo desta execução.
