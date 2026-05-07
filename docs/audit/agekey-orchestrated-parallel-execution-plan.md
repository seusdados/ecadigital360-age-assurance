# AgeKey — Plano de execução paralela orquestrada

> **Branch do Orquestrador**: `claude/orchestrator-release-coordination` (PR A).
> Data: 2026-05-07.
> Estado de `main`: `bbf9a46` (post-PR #54 reconciliação HML).

## 1. Mapa de agentes

| # | Agente | Branch | PR previsto | Tipo |
|---|---|---|---|---|
| 1 | Orquestrador / Release Manager | `claude/orchestrator-release-coordination` | PR A | Coordenação |
| 2 | QA Intensivo HML | `claude/qa-hml-intensive-smoke-tests` | PR B | Docs + scripts |
| 3 | PROD Readiness (Fases 2–4) | `claude/prod-readiness-consent-safety-plan` | PR C | Docs |
| 4 | Consent Hardening | `claude/consent-hardening-next` | PR D | Código + testes |
| 5 | Safety Hardening | `claude/safety-hardening-next` | PR E | Código + testes |
| 6 | Docs / Compliance / RIPD | `claude/docs-compliance-release-pack` | PR F | Docs |
| 7 | Infra / Vercel / Supabase / Flags | `claude/infra-feature-flags-readiness` | PR G | Docs |

## 2. Escopo por agente (resumo)

### Agente 1 — Orquestrador

- 3 docs em `docs/audit/`: `agekey-orchestrated-parallel-execution-plan.md` (este), `agekey-parallel-agents-status-board.md`, `agekey-release-order-and-risk-matrix.md`.
- PR A em modo draft.
- Após Fase B concluída, escrever `agekey-parallel-execution-final-report.md`.

### Agente 2 — QA HML

- Confirmar HML alinhada (000–017, 020–030).
- Bateria de smoke tests (Core, Consent, Safety, RLS, feature flags).
- Scripts em `scripts/smoke/` com placeholders, sem segredos.
- Relatório `docs/audit/hml-intensive-smoke-test-report.md`.

### Agente 3 — PROD Readiness

- 4 docs: `prod-consent-safety-release-options.md`, `prod-release-go-no-go-checklist.md`, `prod-feature-flags-readiness.md`, `prod-rollback-playbook-consent-safety.md`.
- Sem execução em PROD.

### Agente 4 — Consent Hardening

- Hardening de Consent: Privacy Guard, Decision Envelope, OTP, painel parental, webhooks, token verify, revogação, audit, feature flags.
- Testes faltantes em `packages/shared/__tests__/`.
- Relatório `docs/audit/consent-hardening-next-report.md`.

### Agente 5 — Safety Hardening

- Hardening de Safety: rule engine, override, event ingest, Privacy Guard `safety_event_v1`, alerts, step-up, consent-check, retention, RLS.
- Testes faltantes.
- Relatório `docs/audit/safety-hardening-next-report.md`.

### Agente 6 — Docs/Compliance

- `compliance/ripd-agekey.md`, `privacy-by-design-record.md`, `data-retention-policy.md`, `subprocessors-register.md`, `incident-response-playbook.md`.
- 3 release docs em `docs/release/`.

### Agente 7 — Infra/Flags

- 2 docs: `agekey-env-feature-flag-matrix.md`, `vercel-supabase-deploy-readiness.md`.
- Sem alterar Vercel/Supabase remoto.

## 3. Dependências entre agentes

```
Agente 1 (Orquestrador) ─────────┐
                                  │
                ┌─────────────────┼──────────────────┐
                ↓                 ↓                  ↓
          Agente 2 (QA)     Agente 3 (PROD)    Agente 6 (Docs)
                                                      │
                                                      ↓
                                                Agente 7 (Infra)
                                  │
                ┌─────────────────┴──────────────────┐
                ↓                                    ↓
          Agente 4 (Consent)                  Agente 5 (Safety)
            (sem Safety)                       (sem Consent)
```

- **Sem dependências cíclicas.**
- **Conflitos potenciais**: Agentes 4 e 5 podem tocar arquivos compartilhados (`packages/shared/src/index.ts`, `taxonomy/reason-codes.ts`, `privacy/*`). Diretiva: cada um cria arquivos novos no seu domínio; **não modifica** os 3 arquivos shared comuns.
- Se conflito real surgir → Orquestrador para e propõe PR de "shared adjustments" separado.

## 4. Arquivos com possível conflito (proibidos por agentes 4 e 5)

| Arquivo | Razão |
|---|---|
| `packages/shared/src/index.ts` | Re-exports compartilhados |
| `packages/shared/src/taxonomy/reason-codes.ts` | Catálogo central de reason codes |
| `packages/shared/src/privacy/index.ts` | Re-exports do Privacy Guard |
| `packages/shared/src/privacy-guard.ts` | Implementação canônica |
| `packages/shared/src/decision/decision-envelope.ts` | Contrato canônico |
| `packages/shared/src/webhooks/webhook-types.ts` | Catálogo de event types |
| `packages/shared/src/retention/retention-classes.ts` | Retention canônica |

Se um agente julgar imprescindível alterar um destes, deve **abortar e reportar ao Orquestrador**.

## 5. Riscos

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| 1 | Dois agentes alteram mesmo arquivo shared simultâneo | Alta | Diretiva explícita + verificação no relatório final |
| 2 | Agente 2 ou 3 tenta rodar comando em PROD | Crítica | Diretiva explícita + agentes só rodam read-only via MCP |
| 3 | Agente 4 ou 5 introduz regressão em Consent/Safety canonical | Alta | Cada PR com `pnpm typecheck && pnpm lint && pnpm test` verde |
| 4 | Documentação contém segredo/credencial em texto plano | Crítica | Diretiva explícita + revisão final pelo Orquestrador |
| 5 | Agentes geram audit reports inconsistentes entre si | Média | Status board (Agente 1) consolida |
| 6 | Branches abertas excessivas confundem CI/CD | Baixa | Cada agente abre exatamente 1 PR draft |
| 7 | PR mergeado sem review humano | Crítica | Todos PRs em draft; merge só após autorização explícita do usuário |

## 6. Critérios de aceite globais

- [ ] Cada agente produziu sua branch + PR draft.
- [ ] Cada agente produziu seu relatório.
- [ ] Nenhum agente tocou em PROD.
- [ ] Nenhum agente rodou `db push`/`migration repair`/`db reset`/`db pull`.
- [ ] Nenhum PR teve regressão em `pnpm typecheck/lint/test`.
- [ ] Orquestrador produziu relatório final consolidado.
- [ ] Status board mantido atualizado durante execução.
- [ ] Sem segredos em arquivos commitados.
- [ ] Sem KYC, PII pública, SD-JWT real, ZKP real, gateway falso.

## 7. Ordem de merge recomendada (após aprovação do usuário)

```
Tier 1 — Documentação pura (sem risco runtime):
  PR A (orchestrator)
  PR C (prod readiness)
  PR F (docs/compliance)
  PR G (infra/flags)

Tier 2 — QA / scripts (sem alteração de runtime):
  PR B (QA HML)

Tier 3 — Hardening de código (com testes):
  PR D (consent hardening) — primeiro
  PR E (safety hardening)  — depois
```

Justificativa do Tier 3: Consent é dependência de Safety (Safety chama Consent via `consent-check`). Mergear D antes de E reduz risco de retrabalho em E se D mudar contratos compartilhados.

## 8. Não-objetivos desta orquestração

- ❌ Não aplicar nada em PROD.
- ❌ Não habilitar feature flags em PROD.
- ❌ Não abrir Consent ou Safety para tenants em PROD.
- ❌ Não implementar SD-JWT VC real ou ZKP/BBS+ real.
- ❌ Não implementar gateway de pagamento, OTP, ou KYC real.
- ❌ Não criar tabelas em PROD.
- ❌ Não rodar `db push`, `migration repair`, `db reset`, `db pull`.

## 9. Sequência de execução

| Fase | Quem | Estado |
|---|---|---|
| **A** — Pre-flight + plano | Orquestrador (síncrono) | ✅ Em execução |
| **B** — Despachar 6 agentes em paralelo (background) | Orquestrador → 6 agentes | ⏳ Próximo |
| **C** — Coletar resultados | Orquestrador | ⏳ Após B |
| **D** — Relatório final consolidado | Orquestrador | ⏳ Após C |
| **E** — Aprovação + merge | Usuário | ⏳ Após D |

## 10. Pontos onde o Orquestrador para e pede autorização

Já listados nas regras do usuário. Resumo:

- Qualquer comando em PROD.
- Qualquer migration em PROD.
- Qualquer alteração de feature flag remota.
- Qualquer alteração de Vercel env vars.
- Qualquer ativação de cron/retention em PROD.
- Qualquer integração real com gateway.
- Qualquer SD-JWT VC ou ZKP real.

## 11. Estado de git no início da Fase B

```
MAIN HEAD: bbf9a4656e36a27d353a97529bd613e66a0f8a65
MAIN MSG:  docs(audit): HML migration history reconciliation plan + execution report (#54)

Tree:    clean
Branches abertas relevantes (locais): 6 (claude/*)
PR aberta atualmente: #55 (PROD diagnostic)
PR mergeadas hoje (2026-05-07): #51, #52, #53, #54

Baseline tests:
  pnpm typecheck: 6/6 ✅
  pnpm lint:      OK ✅
  pnpm test:      236 vitest + 11 integration ✅
```
