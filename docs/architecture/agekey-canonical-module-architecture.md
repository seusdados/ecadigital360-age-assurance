# AgeKey — Arquitetura Modular Canônica

> Status: especificação canônica da Rodada 1.
> Branch: `claude/agekey-canonical-modular-architecture`.
> Documentos relacionados: `docs/audit/agekey-prd-consolidation-report.md`, `docs/specs/agekey-decision-envelope.md`, `docs/specs/agekey-policy-engine-canonical.md`, `docs/specs/agekey-privacy-guard-canonical.md`, `docs/specs/agekey-product-taxonomy.md`, `docs/specs/agekey-webhook-contract.md`, `docs/specs/agekey-reason-codes.md`, `docs/specs/agekey-retention-classes.md`, `docs/architecture/agekey-canonical-data-model.md`.

## 1. Visão geral

O AgeKey é uma plataforma modular composta por quatro módulos hierárquicos, todos subordinados a uma camada canônica compartilhada:

| Módulo | Função | Status atual |
|---|---|---|
| **AgeKey Core / Verify** | Núcleo de verificação de elegibilidade etária e emissão de token assinado. | Implementado (production-readiness) |
| **AgeKey Consent** | Extensão de autorização parental auditável. | Apenas PRD; não implementado |
| **AgeKey Safety Signals** | Extensão de risk orchestration metadata-only. | Apenas PRD; não implementado |
| **AgeKey Pass** | Evolução credential (SD-JWT VC) e proof mode (ZKP/BBS+). | Atrás de feature flag; sem código real |

Todos os módulos compartilham obrigatoriamente:

- mesmo `decision envelope` para qualquer resposta de decisão pública;
- mesmo `policy engine` (com extensões por domínio);
- mesmo `privacy guard` (com perfis de saída);
- mesmo `webhook signer` (HMAC SHA-256, assinatura, replay, idempotency);
- mesmo catálogo de `reason codes` (`UPPER_SNAKE_CASE` por grupo);
- mesma família de `retention classes`;
- mesmo registro `audit_events`;
- mesmo registro `billing_events`;
- mesma segregação multi-tenant via RLS;
- mesma segregação de credenciais (`service-role` exclusivamente server-side).

## 2. Módulos

### 2.1 AgeKey Core / Verify

Responsável por:

- `tenants`, `tenant_users`, `applications`
- `policies`, `policy_versions`, `jurisdictions`
- `verification_sessions`, `verification_challenges`
- `proof_artifacts`
- `verification_results`
- `result_tokens`
- `issuers`, `trust_lists`, `issuer_revocations`, `revocations`
- `crypto_keys` (Vault)
- `audit_events`
- `billing_events`, `usage_counters`
- `webhook_endpoints`, `webhook_deliveries`
- `rate_limit_buckets`, `ip_reputation`

Endpoints canônicos (Edge Functions já existentes):

- `POST /v1/verifications/session`
- `GET  /v1/verifications/session/:id`
- `POST /v1/verifications/session/:id/complete`
- `POST /v1/verifications/token/verify`
- `POST /v1/verifications/token/revoke`
- `GET  /.well-known/jwks.json`
- `POST /v1/tenant-bootstrap`
- `GET/POST /v1/applications-*`
- `GET/POST /v1/policies-*`
- `POST /v1/issuers-*`
- `GET  /v1/audit-list`

Decisão pública padrão: **Decision Envelope** com `decision_domain = "age_verify"`.

### 2.2 AgeKey Consent

Responsável por (a implementar em rodada própria):

- `parental_consent_requests` — solicitação criada pelo recurso/política.
- `guardian_contacts` — contato cifrado do responsável; retenção própria; nunca exposto em payload público.
- `guardian_verifications` — OTP/link curto verificado, com janela curta e tentativas limitadas.
- `consent_text_versions` — texto exibido ao responsável, imutável e versionado.
- `parental_consents` — registro do consentimento aceito, com `policy_id`, `policy_version`, `purpose_codes`, `data_categories`.
- `parental_consent_tokens` — token assinado equivalente ao `result_token`, **sem PII**.
- `parental_consent_revocations` — revogação por jti, motivo e timestamp.

Painel parental:

- Acesso por backend via token curto e escopado, único por solicitação.
- Sem login civil. Sem cadastro de criança/adolescente.
- Texto exibido sempre referencia versão (`consent_text_versions`).

Endpoints canônicos sugeridos:

- `POST /v1/parental-consent/request`
- `GET  /v1/parental-consent/request/:id`
- `POST /v1/parental-consent/guardian/verify`
- `POST /v1/parental-consent/approve`
- `POST /v1/parental-consent/deny`
- `POST /v1/parental-consent/revoke`
- `POST /v1/parental-consent/token/verify`

Integração com Core:

- Consent **não** cria sessão de verificação própria. Quando precisar provar idade do responsável, abre `verification_session` no Core.
- Consent emite seu próprio token (`parental_consent_token`), mas com **forma e proteções idênticas** ao `result_token` do Core: ES256, JWKS comum, mesma rotação de chave, mesmo guarda de PII.
- Decisão pública padrão: **Decision Envelope** com `decision_domain = "parental_consent"`.

### 2.3 AgeKey Safety Signals

Responsável por (a implementar em rodada própria):

- `safety_subjects` — sujeito por referência opaca (`subject_ref_hmac`).
- `safety_interactions` — registro mínimo de interação (sem conteúdo).
- `safety_events` — evento ingerido **metadata-only** no MVP.
- `safety_rules` — regras configuráveis por tenant/recurso.
- `safety_alerts` — alerta gerado por regra, com severidade e ações proporcionais.
- `safety_aggregates` — contadores agregados (sobrevivem aos eventos individuais).
- `safety_evidence_artifacts` — referências mínimas (hash + path) para evidência opcional, **nunca conteúdo bruto** no MVP.
- `safety_model_runs` — execuções de classificadores (governança), sem PII.
- `safety_webhook_deliveries` — entregas de eventos `safety.*`.

Endpoints canônicos sugeridos:

- `POST /v1/safety/event` (ingest, server-side, com `service_role` ou api_key dedicada)
- `GET  /v1/safety/alerts`
- `POST /v1/safety/alert/:id/ack`
- `POST /v1/safety/alert/:id/escalate`

Integração com Core e Consent:

- Safety **não** cria KYC. Não armazena dado civil. Não armazena conteúdo bruto.
- Safety chama o Core para **step-up** (`require_step_up_on_unknown_age`) abrindo nova `verification_session`.
- Safety chama o Consent (ou exige `require_parental_consent_check`) quando a política assim o determinar.
- Decisão pública padrão: **Decision Envelope** com `decision_domain = "safety_signal"`.

### 2.4 AgeKey Pass (futuro)

- SD-JWT VC, verifiable credentials, disclosures seletivas, key binding, status/revogação, integração wallet.
- **Feature flag desligada** até existir biblioteca real, issuer, test vectors e suíte de testes.
- Quando ativar, decisão pública usa **Decision Envelope** com `decision_domain = "credential"`.
- ZKP/BBS+ idem: feature flag, sem implementação real até existir lib validada externamente.

## 3. Métodos de integração entre módulos

| Cenário | Quem decide | Quem executa | Decision domain |
|---|---|---|---|
| Verificação simples de elegibilidade etária | Core (policy engine) | Core | `age_verify` |
| Verificação que exige consentimento parental | Core + Consent | Core abre sessão; Consent conduz consentimento | `age_verify` ou `parental_consent` (conforme passo) |
| Evento Safety com idade desconhecida + política exige step-up | Safety + Core | Safety pede step-up; Core abre sessão; Safety atualiza alerta | `safety_signal` no alerta, `age_verify` no step-up |
| Evento Safety entre adulto desconhecido e menor + política exige consentimento | Safety + Consent + Core | Safety bloqueia/limita; Consent conduz; Core registra | `safety_signal` + `parental_consent` |
| Credential mode com VC válida | Core + Pass | Pass valida VC; Core registra resultado | `credential` |

**Regras de composição:**

- Safety **nunca** cria KYC.
- Safety **nunca** emite token próprio.
- Consent **nunca** processa conteúdo bruto.
- Consent **nunca** confunde verificação de idade do responsável com prova de identidade civil.
- Core **nunca** persiste data de nascimento, idade exata, documento ou nome civil.
- Toda decisão pública atravessa o **Decision Envelope** canônico.
- Toda saída pública atravessa o **Privacy Guard** com perfil apropriado.
- Todo webhook obedece ao **Webhook Contract** comum (HMAC SHA-256, headers padrão, replay protection).
- Toda regra atravessa o **Policy Engine** canônico (com extensões `age`, `consent`, `safety`).

## 4. Componentes compartilhados

### 4.1 `packages/shared/src/decision/`

- `decision-envelope.ts` — tipos e helpers do envelope.
- `index.ts` — re-exports.

### 4.2 `packages/shared/src/policy/`

- `policy-types.ts` — tipos canônicos da política (com extensões por domínio).
- `policy-engine.ts` — helpers puros de avaliação canônica (não substituem o engine das Edge Functions, mas o alimentam).
- `index.ts` — re-exports.

### 4.3 `packages/shared/src/privacy/`

- `forbidden-claims.ts` — listas de chaves proibidas em profundidade, por perfil.
- `privacy-guard.ts` — guarda canônica com perfis (`public_token`, `webhook`, `sdk_response`, `widget_response`, `public_api_response`, `admin_minimized_view`, `audit_internal`, `safety_event_v1`, `guardian_contact_internal`).
- `index.ts` — re-exports.

### 4.4 `packages/shared/src/taxonomy/`

- `age-taxonomy.ts` — predicados de idade, estados de elegibilidade, níveis de assurance.
- `reason-codes.ts` — catálogo canônico expandido (re-exporta o legado e adiciona grupos `CONSENT_*`, `SAFETY_*`, `POLICY_*`, `PRIVACY_*`, `RETENTION_*`, etc.).
- `index.ts` — re-exports.

### 4.5 `packages/shared/src/webhooks/`

- `webhook-types.ts` — tipos de evento e payload mínimo.
- `webhook-signer.ts` — helpers puros de assinatura HMAC SHA-256 e cabeçalhos canônicos.
- `index.ts` — re-exports.

### 4.6 `packages/shared/src/retention/`

- `retention-classes.ts` — classes nomeadas com TTL/política.
- `index.ts` — re-exports.

## 5. Não-objetivos desta arquitetura

1. **Não duplicar** policy engine, privacy guard, webhook signer, decision status, token claims, audit events, reason codes, retention logic ou billing logic.
2. **Não recomeçar** o repositório nem renomear o produto.
3. **Não criar** mockups enganosos, gateway real falso, SD-JWT VC real falso, ZKP real falso ou BBS+ real falso.
4. **Não implementar** Consent completo nesta rodada.
5. **Não implementar** Safety completo nesta rodada.
6. **Não criar** migrations nesta rodada (canonical layer é pura — TypeScript em `packages/shared` + documentação).
