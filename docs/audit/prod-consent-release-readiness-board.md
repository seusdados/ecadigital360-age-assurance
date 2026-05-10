# PROD Consent Release — Readiness Board

> **Status**: Painel preparatório de prontidão. Atualizado em 2026-05-10 (commit `9e85b64`).
> **Use**: cada item deve ser independentemente verificável. Nenhum item ❌ Bloqueador → NO-GO automático.
> **Companheiros**: `docs/release/prod-consent-mvp-executive-go-no-go-pack.md`, `docs/release/prod-consent-mvp-execution-runbook.md`.

---

## Legenda

| Símbolo | Significado |
|---|---|
| ✅ OK | cumprido, evidenciado |
| ⏸ Pendente | conhecido, aguardando ação operacional/governança |
| ⛔ Bloqueador | impede abertura da janela |
| — N/A | fora de escopo desta janela |

---

## Tabela consolidada (25 itens)

| # | Item | Status | Responsável sugerido | Evidência | Risco | Próxima ação |
|---|---|---|---|---|---|---|
| 1 | HML Consent E2E validado | ✅ OK | Eng | `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` (8/8 smoke) | Baixo (regressão monitorada via CI) | Manter HML estável até janela; rodar smoke comparativo |
| 2 | PROD Core + 017 validado | ✅ OK | Eng | `docs/audit/prod-phase-1-migration-017-execution-report.md` + MCP `list_migrations` em PR #81 | Baixo | Reconfirmar via MCP no início da Fase 0 |
| 3 | PROD migrations 020–023 ainda ausentes | ✅ OK (caminho limpo) | Eng | MCP `list_migrations` confirma 18 entradas (000-017) em PR #81 | Baixo (sem conflito de schema) | Aplicar na Fase 1 do runbook |
| 4 | PROD Safety fora do escopo | ✅ OK | PO | Memo `docs/release/prod-consent-mvp-executive-go-no-go-pack.md` §5 | Médio se acidentalmente aplicado (R4 do memo) | Não aplicar 024-027; manter `AGEKEY_SAFETY_ENABLED` ausente |
| 5 | PROD retention/cron fora do escopo | ✅ OK | PO + Eng | Memo §5; defer para janela própria | Baixo | Não aplicar 028 nesta janela |
| 6 | OTP provider PROD definido | ⛔ Bloqueador | Operador + PO | — (a configurar) | Crítico — `deliverOtp` lança sem provider real | Escolher (Twilio/Mailgun/SES/etc.); contratar; configurar secrets em Supabase Dashboard |
| 7 | DEV_RETURN_OTP ausente/false em PROD | ⏸ Pendente verificação | Operador | — (verificar Dashboard antes da janela) | Crítico se setado; proibido | Confirmar ausência via Dashboard; se presente, deletar |
| 8 | PANEL_BASE_URL PROD definido | ⛔ Bloqueador | PO + Operador | — | Médio (URL compõe `guardian_panel_url`) | Decidir URL pública; setar `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` no Dashboard |
| 9 | Tenant inicial definido | ⛔ Bloqueador | PO | MCP read-only: 1 tenant existe (`dev`/AgeKey Dev) | Médio — decisão tenant interno vs piloto externo | Recomendado: usar `dev` (interno) primeiro |
| 10 | Application inicial definida | ⏸ Pendente decisão #9 | Operador | MCP read-only: 1 application (`dev-app`) existe | Baixo se #9 = interno | Se piloto externo, criar via `applications-write` antes da janela |
| 11 | Policy inicial definida | ✅ OK (10 ativas) | PO | MCP read-only: 7 templates globais + 3 dev | Baixo | Confirmar slug a usar no smoke |
| 12 | Backup/snapshot definido | ⛔ Bloqueador | DBA | — (snapshot < 24h antes da janela) | Crítico — sem backup, rollback de migration impossível | Operador confirma no Dashboard → Database → Backups; registra `backup_id` |
| 13 | Janela de manutenção definida | ⛔ Bloqueador | PO + Operador | — | Médio | Definir início/fim em UTC; recomendado: madrugada |
| 14 | Operador técnico definido | ⛔ Bloqueador | Eng Lead | — | Crítico | Nomear pessoa com acesso GitHub + Supabase Dashboard PROD |
| 15 | DBA/on-call definido | ⛔ Bloqueador | Eng Lead | — | Alto (caso §5.3 do rollback) | Nomear plantão para janela + 72h |
| 16 | Rollback owner definido | ⏸ Pendente (geralmente = operador) | Operador | — | Baixo | Confirmar que operador da janela executa rollback rápido se necessário |
| 17 | Smoke test owner definido | ⏸ Pendente (geralmente = operador) | Operador | — | Baixo | Confirmar que operador roda `consent-smoke.sh` adaptado para PROD |
| 18 | Feature flags definidas | ⏸ Pendente | Operador | `docs/audit/agekey-env-feature-flag-matrix.md` | Médio | `AGEKEY_PARENTAL_CONSENT_ENABLED=false` antes; `=true` no fim Fase 3 |
| 19 | Secrets/env vars definidos | ⏸ Pendente | Operador | `infrastructure/secrets.md` | Crítico | Configurar antes: `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` (real), secrets do provider, `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` |
| 20 | Comunicação interna definida | ⏸ Pendente | PO | — | Baixo | Notificar Slack interno + tenant piloto (se externo) antes da janela |
| 21 | RIPD atualizado | ⏸ Pendente assinatura | DPO | `compliance/ripd-agekey.md` (vivo, mas falta assinatura formal Consent v1) | Crítico legal | DPO assina cerimonialmente |
| 22 | Privacy by Design atualizado | ✅ OK | Eng + DPO | `compliance/privacy-by-design-record.md` (vivo) | Baixo | Adicionar entrada referente ao release Consent PROD após execução |
| 23 | Incident response pronto | ✅ OK | Eng | `compliance/incident-response-playbook.md` | Baixo | Plantão alinhado com playbook (cobre SEV-1/SEV-2) |
| 24 | Runbook de execução pronto | ✅ OK | Eng | `docs/release/prod-consent-mvp-execution-runbook.md` (este pacote) + `docs/audit/prod-consent-mvp-release-runbook.md` (PR #79) | Baixo | Operador lê e simula mentalmente |
| 25 | Runbook de rollback pronto | ✅ OK | Eng | `docs/release/prod-consent-mvp-rollback-runbook.md` (este pacote) | Baixo | Operador lê; decora rollback rápido (flag OFF < 2 min) |

---

## Critério agregado de GO

**Critério**: zero itens ⛔ Bloqueador.

**Status atual**: **8 bloqueadores** (#6, #8, #9, #12, #13, #14, #15, #21) → **NO-GO** para abrir janela hoje.

**Predição**: assim que os 8 bloqueadores forem resolvidos (governança + operacional), passa a **GO**.

**Itens pendentes que viram bloqueadores se não resolvidos antes da janela**: #7 (DEV_RETURN_OTP), #10 (application — depende de #9), #18 (feature flags), #19 (secrets/env vars), #20 (comunicação).

---

## Cronologia sugerida (ordem de resolução)

```
T-7d    DPO assina RIPD (#21)
T-7d    PO+DPO+TechLead assinam memo executivo (#9, #4)
T-5d    Operador escolhe provider OTP (#6); contrato fechado
T-5d    Operador configura secrets em Supabase Dashboard (#19)
T-5d    Operador define PANEL_BASE_URL (#8)
T-5d    Decisão tenant alvo (#9) → application correspondente (#10)
T-3d    Operador cria workflow GHA PROD (PR separado) — opcional mas recomendado
T-3d    Janela definida (#13); operador (#14) e DBA on-call (#15) nomeados
T-1d    Comunicação interna + tenant (#20)
T-2h    Operador inicia Fase 0 do runbook
T-1h    Backup/snapshot confirmado (#12)
T-0h    Iniciar Fase 1 (migrations)
T+1h    Fase 4 (smoke) completa
T+72h   Postmortem; PbD atualizado (#22)
```

---

## Confirmações de não-ação

- ❌ Nada executado em PROD ou HML.
- ❌ Nenhuma migration / deploy / alteração remota.
- ❌ Nenhum secret real listado neste documento.
- ✅ Apenas painel de prontidão para revisão/decisão.
