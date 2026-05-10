# ADR — AgeKey Consent MVP em PROD (release inicial)

> **ADR ID**: ADR-AGEKEY-CONSENT-PROD-RELEASE
> **Status**: Proposed (aguarda decisão executiva)
> **Data**: 2026-05-10
> **Author**: Release Manager (Claude) com base em validação HML + auditoria PROD read-only
> **Commit `main` na proposta**: `9e85b64`

---

## 1. Contexto

AgeKey é um motor de prova de elegibilidade etária com preservação de privacidade, multi-tenant, B2B SaaS. Há quatro módulos planejados:

- **Core** (verifications, applications, policies, issuers, audit, jwks, key-rotation, etc.) — em produção desde 2026-04-29.
- **Consent** (parental consent flow conforme LGPD art. 14 §1º + ECA art. 17) — validado em HML 2026-05-10 ponta-a-ponta.
- **Safety Signals** (análise de risco metadata-only entre adulto e menor) — validado em HML no núcleo metadata-only; não pronto para PROD nesta janela.
- **Credential / Proof** (ZKP, SD-JWT VC, gateways governamentais) — adapters honest stubs; sem implementação real.

A próxima decisão é: **qual módulo entra em PROD a seguir, e quando**.

A camada técnica está madura para Consent: 8/8 passos do `consent-smoke.sh` passaram em HML, todos os bugs identificados durante o ciclo (DecisionEnvelope offset, vault.create_secret, token-verify column, env var DEV_RETURN_OTP) foram corrigidos e versionados (PRs #66, #70/#71, #73, configuração HML).

PROD está limpo: Phase 1 (000-017) aplicada, sem migrations 020-031, sem funções `parental-consent-*` ou `safety-*`, 19 Edge Functions Core estáveis com `verify_jwt: false`.

---

## 2. Decisão proposta

**Liberar o módulo AgeKey Consent MVP em PROD** em janela controlada, mantendo Safety, retention/cron, ZKP, SD-JWT VC real e gateways novos **fora** do escopo desta janela.

### 2.1. Escopo concreto

- **Migrations a aplicar em PROD** (`tpdiccnmsnjtjwhardij`):
  - 5 obrigatórias: `020`, `021`, `022`, `023`, `031`.
  - 1 opcional defensiva: `030`.
- **Edge Functions a deployar em PROD**:
  - 7 funções `parental-consent-*` com `--no-verify-jwt`.
- **Feature flag**:
  - `AGEKEY_PARENTAL_CONSENT_ENABLED=true` ao final da Fase 3 do runbook.
- **Provider OTP**:
  - **Real** (Twilio/Mailgun/SES/etc.); operador escolhe e configura antes da janela.

### 2.2. Tenant alvo

Recomendação: **tenant interno `dev` em PROD** (já existente) para release técnico inicial. Piloto externo em janela posterior independente.

---

## 3. Alternativas consideradas

### 3.1. Alt-1 — Liberar Consent + Safety juntos

❌ **Rejeitado**:
- Aumenta superfície técnica e legal na mesma janela.
- Força fechar 2 RIPDs simultâneos (Consent + Safety).
- Dificulta isolamento de incidente (qual módulo falhou?).
- Safety v1 metadata-only ainda exige análise legal específica (relacionamento adulto-menor).

### 3.2. Alt-2 — Liberar Safety primeiro, Consent depois

❌ **Rejeitado**:
- Safety usa Consent como pré-requisito quando aplicável (não o contrário).
- LGPD art. 14 §1º + ECA art. 17 dão base direta para Consent; Safety tem framework legal mais sutil (proteção do menor + proporcionalidade).
- Maturidade técnica: Consent MVP 8/8 smoke; Safety tem alert/step-up/cron pendentes em HML.

### 3.3. Alt-3 — Adiar Consent até ter ZKP/SD-JWT real

❌ **Rejeitado**:
- ZKP e SD-JWT VC real dependem de wallets / Digital Credentials API ainda imaturas no mercado BR.
- Adapter `fallback` (OTP + texto + revoke) cobre 100% dos casos de uso atuais.
- Consent MVP não bloqueia roadmap futuro de ZKP/VC (são camadas independentes).

### 3.4. Alt-4 — Aplicar todas as migrations 020-031 em PROD na mesma janela

❌ **Rejeitado**:
- Migrations 024-027 trazem Safety, fora do escopo.
- Migration 028 (cron retention) requer GUCs adicionais (`agekey.cron_secret`, `agekey.retention_job_url`) — pode ser deferida.
- Migration 029 referencia tabelas Safety (`safety_recompute_messages_24h`) — falha sem 024.

### 3.5. Alt-5 — Liberar com `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` em PROD

❌ **Rejeitado expressamente** por design:
- Em HML, esse flag retorna o OTP em cleartext na resposta para fins de smoke. Em PROD, isso quebraria o canal de prova de posse do contato (qualquer um com a `TENANT_API_KEY` veria o OTP).
- O código tem proteção explícita: `_shared/parental-consent/otp.ts:61-65` lança quando provider=`noop` e DEV_RETURN_OTP=false. Em PROD, provider deve ser real.

### 3.6. Alt-6 — Adiar indefinidamente até criar tenant piloto externo

⚠ **Rejeitado por enquanto**:
- Tenant interno `dev` em PROD permite validação técnica sem dependência contratual de cliente externo.
- Piloto externo pode entrar em janela posterior, sem bloquear release técnico inicial.

### 3.7. Alt-7 — Manter status quo (somente Core em PROD)

❌ **Rejeitado**:
- AgeKey precisa demonstrar Consent funcional para evolução comercial.
- Gap entre HML (3 módulos) e PROD (1 módulo) começa a divergir conceitualmente.
- Risco de "morte por inação": código maduro perdendo relevância.

### 3.8. Decisão

**Escolhido**: **Decisão proposta (§2)** — Consent MVP isolado, em janela controlada, tenant interno primeiro.

---

## 4. Por que Safety fica fora

### 4.1. Razões técnicas

- Safety MVP em HML tem alert-dispatch e step-up dependentes de `safety_alert_id` real (gerado por evento real disparando regra) — não há cobertura completa de smoke.
- Cron jobs de Safety (`safety-aggregates-refresh`, `safety-retention-cleanup`) requerem `SAFETY_CRON_SECRET` — secret não pertence a esta janela.
- Migration `029_post_merge_p0_fixes` referencia `safety_events`/`safety_interactions` — só pode ser aplicada após 024.

### 4.2. Razões legais

- Tratamento de relacionamento adulto-menor (mesmo metadata-only) tem framework legal mais sutil:
  - LGPD: base legal de proteção da criança (art. 14 §3º).
  - Marco Civil + Lei do Cybercrime.
  - ECA: dever de proteção integral.
- RIPD próprio do Safety v1 ainda não foi formalmente assinado pelo DPO.

### 4.3. Razões operacionais

- Aprovar 2 módulos na mesma janela = 2 RIPDs, 2 memos, 2 sets de smoke, 2 superfícies de incidente.
- Risco combinado é maior que soma dos riscos individuais.
- Postmortem mais difícil de atribuir causa raiz.

---

## 5. Por que `DEV_RETURN_OTP` fica fora

### 5.1. Função do flag

`AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` (em HML) faz `parental-consent-guardian-start` retornar o OTP gerado em cleartext no campo `dev_otp` da resposta. Isso é necessário em HML para que `consent-smoke.sh` consiga prosseguir para o `confirm` sem provider real.

### 5.2. Por que proibido em PROD

- Quem tem a `TENANT_API_KEY` chamaria `guardian-start`, leria o OTP da resposta, e usaria em `confirm` — quebrando o pressuposto de "prova de posse do contato" pelo responsável.
- Bypass do canal real de delivery; o responsável real nunca seria notificado.
- Privacy by Design (compliance/privacy-by-design-record.md): OTP deve viajar **apenas** via canal independente (email/SMS).

### 5.3. Garantia em código

`_shared/parental-consent/otp.ts:61-65`:

```ts
if (provider.id === NOOP_PROVIDER_ID && !env.devReturnOtp) {
  throw new Error('OTP delivery provider is "noop" but ... — would silently drop. Configure a real provider before going to production.');
}
```

→ Em PROD, sem `DEV_RETURN_OTP=true`, o provider deve ser **real**, ou a função lança intencionalmente. Defesa em profundidade.

---

## 6. Por que Consent é o primeiro módulo candidato

### 6.1. Maturidade técnica

- Smoke 8/8 passos em HML.
- Bugs identificados e corrigidos: PR #66 (DecisionEnvelope offset), PR #70+#71 (vault.create_secret + migration 031), PR #73 (token-verify activated_at).
- Privacy Guard validado: `decision_envelope.content_included = false`, `pii_included = false` em todas as respostas.
- Token revogado detectado online (verificado em smoke).

### 6.2. Maturidade legal

- LGPD art. 14 §1º: tratamento de dados de menor exige consentimento parental "específico e em destaque".
- ECA art. 17: direito de respeito (intimidade, honra, identidade).
- AgeKey Consent fornece exatamente o canal: OTP → texto versionado → assinatura → token revogável.

### 6.3. Independência arquitetural

- Consent não depende de Safety (Safety usa Consent como pré-requisito).
- Consent não depende de ZKP/VC reais (adapter `fallback` cobre).
- Consent é self-contained: 7 funções + 5 migrations + Vault.

### 6.4. Reversibilidade

- Rollback rápido < 2 min via flag (`AGEKEY_PARENTAL_CONSENT_ENABLED=false`).
- Sem perda de dados.
- Workers reciclam; tráfego volta a `503` defensivo.

### 6.5. Demanda comercial

- Cliente piloto em discussão precisa de Consent funcional.
- Sem Consent ativo, AgeKey só atende casos de adulto (que já são cobertos por Core em PROD).

---

## 7. Riscos da decisão

### 7.1. Bloqueadores externos (não controlamos)

| Risco | Mitigação |
|---|---|
| Provider OTP real ainda não escolhido/contratado | Operador + PO selecionam antes da janela |
| RIPD não assinado pelo DPO | Cerimônia de assinatura agendada |
| Tenant piloto externo não definido | Recomendação: usar tenant interno `dev` primeiro |

### 7.2. Operacionais (controlamos parcialmente)

| Risco | Mitigação |
|---|---|
| Confusão HML vs PROD em comandos | Project ref hardcoded em runbook + workflow PROD próprio (PR separado) |
| `--no-verify-jwt` esquecido em algum deploy | Loop `for fn in ...` no runbook + checagem MCP pós-deploy |
| Migration 029 deferida → webhook payload v1 sem `payload_hash` v2 | Documentado; não-bloqueante; corrigido na janela Safety |
| Workflow GHA HML usado por engano para PROD | Workflow HML tem `wljedzqgprkpqhuazdzv` hardcoded; PR separado de workflow PROD recomendado |

### 7.3. Latentes (monitoraremos)

| Risco | Monitor |
|---|---|
| Provider OTP delivery rate baixa | Audit `delivered=false`; SLA do provider |
| Vault encryption performance | Latência `guardian-start` |
| Webhook fan-out backpressure | `webhooks-worker` execution_time |

### 7.4. Risco residual aceito

| Risco | Aceitação |
|---|---|
| Tenant pode armazenar contato em claro do seu lado (fora do AgeKey) | Documentação contratual; AgeKey não controla |
| Tenant pode usar `child_ref_hmac` que de fato é PII | Privacy Guard rejeita PII conhecida; revisão contratual |
| Provider OTP terceiro processa contato do responsável | Listado em ROPA do tenant |
| Token vazado permite ler estado de aprovação | Token tem TTL curto; revogável; ES256; verificação online |

---

## 8. Plano de rollback

### 8.1. Rápido (< 2 min)

`AGEKEY_PARENTAL_CONSENT_ENABLED=false` no Dashboard → workers reciclam → 7 funções retornam `503` defensivo → tráfego interrompido sem perda.

### 8.2. Função específica

Dashboard Supabase → Edge Functions → "Restore" versão anterior. Útil se 1 função tem bug isolado.

### 8.3. Migration

⛔ **Não automático**. Exige aprovação produto + legal + DBA on-call. Detalhes em `docs/release/prod-consent-mvp-rollback-runbook.md` §4.

---

## 9. Status

**Proposed** — esta decisão aguarda assinatura formal de:

- Produto (PO).
- Legal / DPO.
- Engenharia (Tech Lead).

A assinatura ocorre no memo executivo `docs/audit/prod-consent-mvp-release-decision-memo.md` §13 (mergeado em main no PR #79).

---

## 10. Implicações futuras

### 10.1. Após este release

- AgeKey Consent MVP em PROD para tenant interno (ou piloto externo, se decisão D4 = externo).
- Pode-se aceitar tenants comerciais com fluxo Consent ativo.
- Roadmap Safety continua, com janela própria após estabilização Consent.

### 10.2. Itens diferidos para janelas futuras

| Item | Janela esperada |
|---|---|
| Safety Signals em PROD | T+30 dias (após estabilização Consent + RIPD próprio) |
| Migration 028 (cron retention) | Junto com Safety ou independente |
| Migration 029 (cross-cutting) | Com janela Safety, com cherry-pick se necessário |
| ZKP real | Roadmap longo (depende de wallets BR) |
| SD-JWT VC real | Roadmap longo (depende de wallets BR) |
| Gateway real (Gov.br/Serpro) | Depende de contrato com integrador |

---

## 11. Referências

- `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` — evidência HML 8/8.
- `docs/audit/prod-consent-mvp-preflight-readiness-report.md` — auditoria PROD read-only.
- `docs/audit/prod-consent-mvp-release-decision-memo.md` — memo executivo (PR #79).
- `docs/release/prod-consent-mvp-execution-runbook.md` — runbook operacional (este pacote).
- `docs/release/prod-consent-mvp-rollback-runbook.md` — rollback runbook (este pacote).
- `docs/release/prod-consent-mvp-smoke-test-pack.md` — smoke pack (este pacote).
- `docs/release/prod-consent-mvp-executive-go-no-go-pack.md` — exec go/no-go (este pacote).
- `docs/audit/prod-consent-release-readiness-board.md` — readiness board (este pacote).
- `compliance/ripd-agekey.md` — RIPD vivo.
- `compliance/privacy-by-design-record.md` — PbD.

---

## 12. Não-ações desta proposta

- ❌ Nada executado em PROD.
- ❌ Nenhum deploy.
- ❌ Nenhuma migration aplicada.
- ❌ Nenhuma alteração de feature flag, secret ou schema.
- ❌ Nenhum segredo exposto.
- ✅ Apenas registro arquitetural de decisão proposta.
