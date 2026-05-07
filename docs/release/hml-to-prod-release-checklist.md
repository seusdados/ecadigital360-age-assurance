# Checklist de Release HML → PROD (AgeKey)

> Versão: 2026-05-07.
> Aplicar a cada release que toque PROD. Marcar item como `[x]` apenas quando confirmado.
> Itens críticos (marcados como **C**) bloqueiam a promoção.

## 0. Identificação da release

- Release ID: `<preencher>`
- Branch base: `<preencher>`
- HEAD SHA: `<preencher>`
- Escopo: `<resumir features incluídas>`
- Migrations envolvidas: `<lista — ex.: 020–030>`
- Edge Functions envolvidas: `<lista>`
- Feature flags introduzidas/alteradas: `<lista>`
- Responsável técnico: `<nome>`
- Aprovador (DPO/produto): `<nome>`

## 1. Validação em HML — funcional **C**

- [ ] CI verde no branch (typecheck + lint + tests + integration-tests).
- [ ] Suíte cross-tenant (`packages/integration-tests/`) executada contra HML — sem falha.
- [ ] Privacy Guard ≥ 100 vetores — verde.
- [ ] Smoke tests manuais documentados (ver §6) — todos passaram em HML.
- [ ] Advisors do Supabase HML revisados (`get_advisors`) — sem advisor crítico aberto.
- [ ] Logs HML revisados (`get_logs`) sem PII detectada.

## 2. Snapshot e rollback de PROD **C**

- [ ] Backup point-in-time confirmado em PROD (Supabase) com timestamp.
- [ ] Plano de rollback escrito:
  - [ ] Como reverter migrations (script `down` ou compensatória).
  - [ ] Como reverter Edge Functions (deploy da versão anterior).
  - [ ] Como desabilitar feature flag(s) introduzidas.
- [ ] Plano de rollback ensaiado em HML (dry-run quando possível).

## 3. Variáveis de ambiente e segredos **C**

- [ ] `apps/admin` (Vercel) — variáveis de ambiente revisadas.
- [ ] Edge Functions Supabase — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` corretas para o projeto PROD.
- [ ] GUCs de retention configuradas em PROD:
  - [ ] `agekey.retention_job_url`.
  - [ ] `agekey.cron_secret`.
  - [ ] `agekey.retention_dry_run = 'true'` (default seguro).
- [ ] GUCs de OTP (se aplicável):
  - [ ] `agekey.otp_relay_url`.
  - [ ] `agekey.otp_relay_token`.
- [ ] Nenhum segredo presente no código, documentação ou logs.
- [ ] Rotação de chaves (`crypto_keys`) revisada — chave ativa válida; backup de chave anterior preservado.

## 4. Migrations **C**

- [ ] Ordem das migrations a aplicar revisada e idempotente.
- [ ] Aplicação em ambiente intermediário (HML/staging) reproduzida com sucesso.
- [ ] RLS habilitada em todas as tabelas e partições novas.
- [ ] Privacy Guard cobre as colunas/tabelas novas.
- [ ] Aplicação em PROD em janela de manutenção declarada.
- [ ] Validação pós-aplicação (`list_tables`, queries-chave) — OK.

## 5. Feature flags **C**

- [ ] Flags novas começam **desligadas** em PROD.
- [ ] Lista de tenants autorizados ao rollout inicial registrada.
- [ ] Documentação da flag em `docs/specs/agekey-feature-flags.md` atualizada.
- [ ] Mecanismo de reversão (desligar a flag) testado.

## 6. Smoke tests pós-deploy

Executar imediatamente após o deploy em PROD:

- [ ] `GET /jwks` responde com chave pública vigente.
- [ ] Criar `verification_session` (tenant de smoke) — recebe Decision Envelope esperado.
- [ ] Token emitido valida via JWKS (online) e via biblioteca pública (offline).
- [ ] Webhook teste é entregue e validado (assinatura).
- [ ] Privacy Guard rejeita payload com PII intencional.
- [ ] RLS isola tenants distintos (par de tenants de smoke).
- [ ] (Se R3 ativada) fluxo de Parental Consent end-to-end (com OTP em modo `dry_run` ou tenant interno).
- [ ] (Se R4 ativada) ingest de Safety event metadata-only retorna 2xx; rule-evaluate sem ruído.
- [ ] (Se R7 ativada) `retention-job` em modo `dry_run` reporta contagens esperadas.

## 7. Comunicação a stakeholders **C**

- [ ] Janela de manutenção comunicada ≥ 24 h antes para tenants em PROD.
- [ ] Release notes ([`agekey-p0-release-notes.md`](./agekey-p0-release-notes.md) ou equivalente) publicadas.
- [ ] DPO ciente de quaisquer mudanças que afetem RIPD ou subprocessadores.
- [ ] Suporte/CS com runbook de FAQ atualizado.
- [ ] Status page (se aplicável) com aviso da manutenção.

## 8. Plano de rollback **C**

- [ ] Critérios objetivos de rollback definidos antes do deploy:
  - [ ] erro 5xx > X% por Y minutos;
  - [ ] suíte cross-tenant falha em PROD smoke;
  - [ ] Privacy Guard detecta vazamento;
  - [ ] qualquer SEV-1.
- [ ] Acionar [`../../compliance/incident-response-playbook.md`](../../compliance/incident-response-playbook.md) caso o rollback ocorra.

## 9. Pós-deploy (24 h iniciais)

- [ ] Monitoramento intensivo nas primeiras 24 h.
- [ ] Logs revisados a cada 4 h.
- [ ] Métricas de erro/latência comparadas ao baseline.
- [ ] Sanity check em advisors Supabase.
- [ ] Relatório de release publicado (resumo + métricas + incidentes, se houver).

## 10. Encerramento da release

- [ ] Tag git criada (`agekey-vX.Y.Z`).
- [ ] Release notes finalizadas.
- [ ] RIPD e PbD record atualizados se houve mudança material.
- [ ] Próximas pendências registradas no backlog.

## Apêndice — política de "no mid-flight"

- Não promover release com Privacy Guard ou suíte cross-tenant em vermelho.
- Não promover release com `service_role` recém-trocada sem invalidar deployments antigos.
- Não promover release que altere contrato público sem versionamento explícito.
- Não promover release com feature flag de modo "real" criptográfico (R10/R11) sem auditoria externa documentada.
