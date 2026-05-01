# AgeKey — Backlog acionável

Backlog de engenharia versionado. Cada item tem ID, prioridade,
estimativa, dependências, critério de aceite, arquivos prováveis e
risco. Itens marcados P0 são bloqueadores de go-live.

> **Convenções**
>
> - Estimativa: T-shirt (`S` ≤ 2d, `M` ≤ 1w, `L` ≤ 2w, `XL` > 2w).
> - Risco: técnico, regulatório, comercial, dependência externa.
> - Status: `open | in-progress | blocked | done | accepted-with-risk`.
> - Não criar issues no GitHub automaticamente. Usar
>   `docs/implementation/github-issues-ready.md` como source.

---

## P0 — Bloqueadores de go-live

| ID | Área | Item | Estimativa | Dependências | Critério de aceite | Arquivos prováveis | Risco | Status |
|---|---|---|---|---|---|---|---|---|
| AK-P0-01 | Infra | Separar projetos Supabase staging e production | M | acesso Supabase Pro | dois projetos distintos com migrations sincronizadas; cron retention rodando em ambos | `infrastructure/environments.md`, `supabase/scripts/migrate.sh` | dependência externa | done (doc); execução = ação humana |
| AK-P0-02 | Infra | Configurar DNS `agekey.com.br` (apex + subdomínios + CAA + SPF/DKIM/DMARC) | M | acesso ao registrar | `agekey.com.br`, `app`, `api`, `verify`, `docs`, `status` resolvendo HTTPS; CAA/SPF/DMARC ativos | `infrastructure/dns/agekey-dns-plan.md` | dependência externa | done |
| AK-P0-03 | Infra | Proxy estável `api.agekey.com.br` → Edge Functions | M | AK-P0-02 | clientes consomem `api.agekey.com.br` em vez do domínio Supabase; troca de provider não quebra contrato público | `apps/admin/next.config.mjs`, `infrastructure/dns/agekey-dns-plan.md`, `vercel.json` | técnico | done |
| AK-P0-04 | Segurança | Testes RLS cross-tenant automatizados | M | nenhum | `pnpm test:rls` cobre 6+ cenários de breakout; CI bloqueia merge em regressão | `supabase/functions/_tests/rls-cross-tenant.test.ts`, `supabase/functions/_tests/_rls_seed.sql`, `.github/workflows/ci.yml` (job `rls-cross-tenant`) | técnico | done |
| AK-P0-05 | Privacidade | Privacy guard automated payload scan em CI | S | privacy-guard.ts (já feito) | CI roda fuzz determinístico cobrindo 100% das chaves PII canônicas em PR; nenhum forbidden key escapa | `packages/shared/src/privacy-guard.test.ts`, `.github/workflows/ci.yml` (job `privacy-guard-fuzz`) | técnico | done |
| AK-P0-06 | Privacidade | Validar formato de `external_user_ref` (rejeitar e-mail / CPF / valores triviais) | S | nenhum | createSession rejeita entradas que casam regex de PII (e-mail/CPF/CNPJ/telefone/RG/triviais); 65 testes unitários PASS; reason_code dedicado `EXTERNAL_USER_REF_PII_DETECTED`; cobertura em `packages/shared/src/external-user-ref.ts`, `packages/shared/src/external-user-ref.test.ts`, `packages/shared/src/schemas/sessions.ts`, `supabase/functions/verifications-session-create/index.ts`, `packages/shared/src/reason-codes.ts` | `supabase/functions/verifications-session-create/`, `packages/shared/src/schemas/sessions.ts` | regulatório | done |
| AK-P0-07 | Infra | Auditoria de env vars Vercel (Production vs Preview vs Development) | S | acesso ao painel Vercel | nenhum secret server-only em scope `Preview/Development`; `NEXT_PUBLIC_*` clean | `infrastructure/secrets.md` (matriz canônica), `infrastructure/vercel-deploy.md` (procedimento + critérios), `infrastructure/scripts/audit-vercel-env.sh` (verificação automatizada) | regulatório | done |
| AK-P0-08 | Segurança | Confirmar key rotation cron + JWKS estável | S | nenhum | rotação automática agendada; JWKS sem `d`; reteste passa | `supabase/functions/key-rotation/`, `supabase/functions/jwks/`, `supabase/functions/_shared/{keys.ts,jwks-response.ts,key-rotation-logic.ts}`, `packages/shared/src/jws.ts`, suítes em `supabase/functions/_tests/{jwks-endpoint,key-rotation-logic}.test.ts` + `packages/shared/src/jws-public-only.test.ts` | técnico | done |
| AK-P0-09 | Compliance | Política de incident response — tabletop SEV-1 | S | nenhum | exercício SEV-1 documentado nos últimos 90 dias com lições aprendidas | `compliance/incident-response-playbook.md`, `compliance/post-mortems/`, `compliance/tabletops/`, `compliance/oncall/` | regulatório | in-progress (doc done; tabletop SEV-1 = ação humana) |
| AK-P0-10 | Segurança | Pentest externo antes de GA | XL | DPO + budget | escopo `security/pentest/scope.md` cumprido; findings Crítica/Alta corrigidas ou aceitas com mitigação | `security/pentest/` | dependência externa | open |

## P1 — Enterprise readiness

| ID | Área | Item | Estimativa | Dependências | Critério de aceite | Arquivos prováveis | Risco | Status |
|---|---|---|---|---|---|---|---|---|
| AK-P1-01 | SDK | Mobile SDK seguro (iOS/Android) v0.1 — sem API key embutida | L | AK-P0-01 | SDK aceita `sessionToken` curto criado pelo app-server; deep-link de retorno; tests `swift test` e `./gradlew :agekey:test` PASS em CI mobile | `sdk-mobile/ios/AgeKeySwift/`, `sdk-mobile/android/agekey-android/` | técnico | open |
| AK-P1-02 | Integração | Provider real Yoti (start + callback + signature mapping + test vectors) | L | DPA Yoti + creds | `YotiGatewayProvider` extends `BaseGatewayProvider`; suite de test vectors em `supabase/functions/_shared/adapters/test-vectors/yoti/`; smoke test passa | `supabase/functions/_shared/adapters/`, `packages/adapter-contracts/` | dependência externa | open |
| AK-P1-03 | Integração | Provider real Veriff | L | DPA Veriff + creds | idem AK-P1-02 | idem | dependência externa | open |
| AK-P1-04 | Integração | Provider real Onfido | L | DPA Onfido + creds | idem | idem | dependência externa | open |
| AK-P1-05 | Integração | Provider Serpro/iDwall (BR) | L | contratos Serpro / iDwall | idem | idem | regulatório | open |
| AK-P1-06 | SDK | VC / SD-JWT-VC adapter completo | L | issuer real homologado | adapter aceita SD-JWT-VC e w3c-vc; trust registry com issuer DID; reason_codes ZKP_PROOF_INVALID / VC_ISSUER_UNTRUSTED | `supabase/functions/_shared/adapters/vc.ts` | técnico | open |
| AK-P1-07 | SDK | OpenID4VP request builder | M | AK-P1-06 | server SDK monta `request_uri` OpenID4VP válido com nonce binding | `packages/sdk-js/src/server.ts` | técnico | open |
| AK-P1-08 | Painel | Webhook endpoint management UI (CRUD, signing secret rotation, dead-letter inspection) | M | nenhum | painel cobre criar/listar/rotacionar/eventos | `apps/admin/app/(app)/webhooks/` | técnico | done |
| AK-P1-09 | Painel | Token verify dashboard / tester | S | nenhum | tela `Settings/API` permite testar token JWT, mostra `valid`, `claims`, `revoked` | `apps/admin/app/(app)/settings/api/` | técnico | open |
| AK-P1-10 | Painel | Audit log com filtros + export CSV | M | nenhum | filtros por actor / target / período; export limited a 10k linhas | `apps/admin/app/(app)/audit/` | técnico | open |

## P2 — Advanced crypto

| ID | Área | Item | Estimativa | Dependências | Critério de aceite | Arquivos prováveis | Risco | Status |
|---|---|---|---|---|---|---|---|---|
| AK-P2-01 | Cripto | BBS+ verifier real | XL | lib + test vectors + audit | checklist `docs/architecture/open-source-foundation.md` §"Checklist de production-readiness para BBS+ / ZKP" 100% PASS; `requireBbsProductionReadiness()` retorna OK no boot | `supabase/functions/_shared/adapters/zkp.ts`, `packages/crypto-core/` (novo) | técnico + regulatório | blocked |
| AK-P2-02 | Cripto | Auditoria criptográfica externa | L | AK-P2-01 | relatório assinado de auditoria entregue antes de habilitar BBS+ em produção | `docs/architecture/` | dependência externa | blocked |
| AK-P2-03 | Cripto | Test vectors RFC 9508 commitados + CI | M | AK-P2-01 | `packages/adapter-contracts/test-vectors/` com vetores oficiais + provenance; CI roda-os | `packages/adapter-contracts/test-vectors/`, `supabase/functions/_shared/adapters/test-vectors/` | técnico | open |

## P3 — Marketplace / ecossistema

| ID | Área | Item | Estimativa | Dependências | Critério de aceite | Arquivos prováveis | Risco | Status |
|---|---|---|---|---|---|---|---|---|
| AK-P3-01 | Wallet | Compatibilidade EUDI ARF | XL | AK-P1-06, AK-P2-01 | testes contra wallet de referência EUDI; fluxo OpenID4VP bidirecional | adapter VC | técnico | blocked |
| AK-P3-02 | Wallet | Compatibilidade gov.br / DTC BR | XL | DPA gov.br | trust registry inclui issuer gov.br | adapter VC + trust registry | regulatório | blocked |
| AK-P3-03 | Marketplace | Diretório público de issuers/gateways homologados | M | AK-P1-02 a 05 | landing page lista issuers/gateways suportados | `apps/site/` (novo) | comercial | open |
| AK-P3-04 | SLA | SLA enterprise + multi-region | XL | AK-P0-01 | espelho production em região alternativa; failover testado | infra | técnico | open |

---

## Itens removidos / consolidados

- `Sessões expiradas auto-cancel` — já implementado em
  `retention-job`. Removido.
- `Logs com trace_id` — já implementado em `_shared/logger.ts`.
  Removido.
- `Privacy guard básico` — entregue nesta branch. Removido.
- `Token public contract` — entregue nesta branch. Removido.
- `Gateway provider framework` — entregue nesta branch. Removido.

## Próximos PRs sugeridos (ordem)

1. AK-P0-04 + AK-P0-05 (testes RLS cross-tenant + privacy guard
   fuzz em CI) — bloqueia AK-P0-10.
2. AK-P0-01 + AK-P0-02 + AK-P0-07 — desbloqueia mobile SDK e
   gateways reais.
3. AK-P0-08 + AK-P0-09 — fecham postura defensiva.
4. AK-P1-08 + AK-P1-09 + AK-P1-10 — quick wins de painel
   enterprise.
5. AK-P0-10 (pentest) → marca prontidão de GA.
6. AK-P1-02..05 entram conforme DPAs forem assinadas.
