# AgeKey — Release order + risk matrix

> Critério: PRs ordenados por risco crescente. Documentação primeiro,
> hardening de código por último.

## Release order

```
Tier 1 — Documentação pura (zero impacto runtime):
  PR A (orchestrator)         claude/orchestrator-release-coordination
  PR C (prod readiness)       claude/prod-readiness-consent-safety-plan
  PR F (docs/compliance)      claude/docs-compliance-release-pack
  PR G (infra/flags audit)    claude/infra-feature-flags-readiness

Tier 2 — QA / scripts:
  PR B (QA HML)               claude/qa-hml-intensive-smoke-tests

Tier 3 — Hardening de código (com testes):
  PR D (consent hardening)    claude/consent-hardening-next
  PR E (safety hardening)     claude/safety-hardening-next
```

## Risk matrix

| PR | Tipo | Risco runtime | Risco produto | Risco compliance | Validação obrigatória |
|---|---|---|---|---|---|
| A | Docs orq | 0 | 0 | 0 | Validar links + ausência de segredos |
| C | Docs PROD | 0 | 0 | 0 | Validar comandos não executados |
| F | Docs compliance | 0 | 0 | 0 (consolidação) | Revisão jurídica recomendada |
| G | Docs infra | 0 | 0 | 0 | Validar matriz de envs vs prod real |
| B | QA scripts | Baixo (só scripts smoke, opcional executar) | 0 | 0 | `pnpm test` passa; placeholders em vez de keys |
| D | Consent hardening | Médio (toca edge functions Consent) | Baixo (HML only) | Médio (Privacy Guard) | typecheck/lint/test verde + testes novos |
| E | Safety hardening | Médio (toca edge functions Safety) | Baixo (HML only) | Médio (metadata-only enforcement) | idem D |

## Justificativa Tier 3

D antes de E porque Safety usa Consent como dependência:
- `safety-event-ingest` chama `_shared/safety/consent-check.ts` que
  cria `parental_consent_request` quando regra exige.
- Se contratos de Consent mudarem em D, E precisa rebase. Mergear D
  primeiro evita retrabalho.

## Critérios de go/no-go por tier

### Tier 1 (Docs)
- Sem segredos em texto plano.
- Comandos PROD listados como "propostos, não executados".
- Sem afirmações jurídicas absolutas.

### Tier 2 (Scripts)
- `pnpm test` verde.
- Placeholders padronizados (`$TENANT_API_KEY`, `$BASE_URL`, etc.).
- Sem credenciais commitadas.

### Tier 3 (Code)
- `pnpm typecheck` 6/6.
- `pnpm lint` clean.
- `pnpm test` ≥ 236 (sem regressão; novos testes incluídos).
- Sem alteração em arquivos shared comuns (lista no plano §4).
- Conformidade com Privacy Guard / Decision Envelope canônicos.

## Pontos de bloqueio

Se qualquer um destes ocorrer, **parar e escalar para o usuário**:

1. Conflito real em arquivo shared comum.
2. Regressão em `pnpm test` que não pode ser fixada no escopo do PR.
3. Necessidade de migration nova (mesmo HML).
4. Necessidade de alterar feature flag remota.
5. Detecção de PII em payload público.
6. Detecção de SD-JWT/ZKP real sendo introduzido.
7. Detecção de gateway/integração real falsa.

## Não-merge

Todos os 7 PRs são abertos como **draft**. Nenhum é mergeado por
agente ou Orquestrador automaticamente. Merge depende de:

1. CI verde no PR.
2. Decisão explícita do usuário.
3. Order do tier respeitada.
