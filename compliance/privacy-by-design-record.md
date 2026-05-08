# Privacy by Design — Registro de Decisões (AgeKey)

> Registro auditável das decisões de Privacy by Design e by Default tomadas durante o desenvolvimento do AgeKey.
> Versão: 2026-05-07.
> Status: vivo — atualizar a cada decisão arquitetural relevante.

Cada decisão segue o formato: contexto → decisão → motivo → controle → status.

## D1. Não criar tabela de usuários finais

- **Contexto:** o AgeKey é multi-tenant; integradores enviam usuários de contextos distintos.
- **Decisão:** não persistir dados de usuário final no core. Não há tabela `users` para titulares.
- **Motivo:** evitar que o produto se transforme em uma base de identidade. Reduzir superfície de PII.
- **Controle:** schema sem tabela de usuários; `external_user_ref` opaco como única correlação.
- **Status:** obrigatório, vigente.

## D2. Pseudônimo do menor via HMAC client-side

- **Contexto:** módulo Parental Consent (R3) precisa correlacionar consentimento ↔ menor sem expor identidade.
- **Decisão:** o cliente computa `child_ref_hmac = HMAC(secret_tenant, child_id)` antes de enviar.
- **Motivo:** o segredo HMAC não sai do tenant; o AgeKey nunca recebe identificador reversível do menor.
- **Controle:** SDK fornece helper; documentação do contrato em `docs/specs/sdk-public-contract.md`; servidor recusa valores que pareçam PII direta.
- **Status:** obrigatório, vigente desde R3.

## D3. Persistir hash de artefato, não o conteúdo

- **Contexto:** algumas verificações exigem prova documental processada por gateway externo.
- **Decisão:** persistir apenas `proof_artifact_hash` + `storage_path` privado (quando estritamente necessário). Nunca o conteúdo bruto no domínio público.
- **Motivo:** preservar integridade auditável sem reter conteúdo sensível.
- **Controle:** Privacy Guard rejeita campos com payload bruto em saídas públicas; storage privado por padrão.
- **Status:** vigente.

## D4. Token sem idade exata

- **Contexto:** clientes precisam do resultado da verificação para gating.
- **Decisão:** o token (`AgeKey Token`) contém `decision`, `assurance_level`, `policy_id`, `jti`, `exp` — **não** contém idade ou data de nascimento.
- **Motivo:** a idade exata não é necessária para decisão de acesso.
- **Controle:** spec em `docs/specs/agekey-token.md`; testes de Privacy Guard validam ausência de campos proibidos.
- **Status:** obrigatório.

## D5. `external_user_ref` opaco

- **Contexto:** integradores precisam reconciliar resultado com seu próprio sistema.
- **Decisão:** aceitar referência opaca fornecida pelo controlador. Recusar valores com aparência de PII (e-mail, telefone, CPF, nome).
- **Motivo:** permitir correlação no lado do cliente sem expor identidade ao AgeKey.
- **Controle:** Privacy Guard P0-06 rejeita PII trivial; SDK fornece helper de hash; documentação reforça uso de HMAC.
- **Status:** vigente.

## D6. Service role server-side apenas

- **Contexto:** Supabase concede uma `service_role` com bypass de RLS.
- **Decisão:** essa chave nunca está em frontend. Está apenas em Edge Functions e CI/CD.
- **Motivo:** preservar isolamento RLS multi-tenant.
- **Controle:** revisão de variáveis em `apps/admin/`, runbook `docs/audit/...environments.md`.
- **Status:** obrigatório.

## D7. Fallback com assurance `low`

- **Contexto:** quando todos os métodos fortes falham, ainda pode haver autodeclaração.
- **Decisão:** autodeclaração resulta em `assurance_level=low`. Policy engine pode rejeitar `low` em contextos de alto risco.
- **Motivo:** evitar que autodeclaração satisfaça políticas de alto impacto.
- **Controle:** policy engine canônico em `packages/shared/src/policy/`; testes de matriz de assurance.
- **Status:** vigente.

## D8. Modos criptográficos avançados em stub honesto (R10/R11)

- **Contexto:** SD-JWT VC (R10) e BBS+ ZKP (R11) exigem auditoria criptográfica externa antes de uso real.
- **Decisão:** publicar como **stub honesto** — recusa explícita em fabricar verificação. Real-mode bloqueado por feature flag até auditoria.
- **Motivo:** evitar falsa sensação de segurança criptográfica não validada.
- **Controle:** flags `credential.real`, `proof.real` desligadas; specs `docs/specs/agekey-credential-mode.md` e `docs/specs/agekey-proof-mode.md`.
- **Status:** vigente — destravar exige auditoria externa documentada.

## D9. Privacy Guard ativo no runtime

- **Contexto:** sem reforço em runtime, integradores podem inadvertidamente injetar PII.
- **Decisão:** camada `packages/shared/src/privacy-guard.ts` valida payloads de saída e entradas de `external_user_ref`.
- **Motivo:** controle proporcional contra inserção acidental de PII direta.
- **Controle:** ≥ 100 vetores de fuzz em `packages/shared/__tests__/privacy-guard*.test.ts`; bloqueia regressão em CI.
- **Status:** obrigatório.

## D10. RLS multi-tenant em todas as tabelas

- **Contexto:** uma falha de isolamento expõe dados entre tenants.
- **Decisão:** `ENABLE ROW LEVEL SECURITY` em todas as tabelas e partições, mesmo as históricas. Política `tenant_id = current_setting('app.current_tenant_id')`.
- **Motivo:** proporcionar isolamento default-deny.
- **Controle:** migration `030_enable_rls_audit_billing_partitions.sql`; suíte cross-tenant em `packages/integration-tests/`.
- **Status:** obrigatório.

## D11. Retenção proporcional por classe

- **Contexto:** dados operacionais não devem viver para sempre.
- **Decisão:** três classes (`event_90d`, `audit_5y`, `legal_hold`) com cron unificado (R7).
- **Motivo:** atender minimização e proporcionalidade.
- **Controle:** spec `docs/specs/agekey-retention-classes.md`; cron `retention-job` em Edge Functions; documento `compliance/data-retention-policy.md`.
- **Status:** vigente em HML; PROD pendente de configuração de GUCs.

## D12. Safety v1 metadata-only

- **Contexto:** detecção de sinais de risco proporcionais a guardrails para menores.
- **Decisão:** **nenhum** conteúdo bruto (mensagens, mídia, texto) é processado. Apenas metadados (timestamps, contadores, tipos enumerados, agregados por tenant).
- **Motivo:** evitar transformar Safety em monitoramento conteúdo-cêntrico.
- **Controle:** schema em migrations 024–027; agregados via `safety_aggregates`; specs `docs/modules/safety-signals/`.
- **Status:** obrigatório. Qualquer evolução para conteúdo exige nova RIPD.

## D13. OTP do guardian atrás de feature flag

- **Contexto:** OTP via relay HTTPS (R5) usa um provider externo configurável.
- **Decisão:** flag `consent.otp.real_provider` desligada por padrão. Modo eager-fail quando GUCs (`agekey.otp_relay_url`, `agekey.otp_relay_token`) não estão configurados.
- **Motivo:** prevenir vazamento de contato do guardian via configuração incorreta.
- **Controle:** spec `docs/specs/agekey-feature-flags.md`; documentação em `docs/modules/parental-consent/otp-providers.md`.
- **Status:** vigente.

## D14. Decision Envelope canônico em todos os outputs públicos

- **Contexto:** múltiplos endpoints retornam decisão.
- **Decisão:** todos os outputs públicos (token claims, webhook payload, REST response) seguem o mesmo `Decision Envelope` (`decision`, `assurance_level`, `reason_code`, `policy_id`, `policy_version`, `jti`, `iat`, `exp`).
- **Motivo:** consistência de contrato + Privacy Guard centralizado em uma única superfície.
- **Controle:** spec `docs/specs/agekey-decision-envelope.md`; tipos em `packages/shared/src/decision/`.
- **Status:** obrigatório.

## D15. Sem score universal cross-tenant

- **Contexto:** plataforma multi-tenant com sinais de risco poderia consolidar perfil global.
- **Decisão:** **nenhum** score, agregado ou perfil é computado entre tenants. Cada tenant é silo.
- **Motivo:** evitar criação de identidade transversal a integradores; proteger não-discriminação.
- **Controle:** RLS, ausência de jobs cross-tenant, revisão arquitetural por PR.
- **Status:** obrigatório.

## D16. Texto integral da policy parental publicável (R6)

- **Contexto:** consentimento parental válido exige clareza sobre o que se está consentindo.
- **Decisão:** endpoint público (não autenticado) que devolve o texto integral da policy parental aplicável.
- **Motivo:** transparência e prova auditável do conteúdo apresentado ao guardian.
- **Controle:** Edge Function `parental-consent-text-get`; `parental_consent_policies` versionada.
- **Status:** vigente.

## Histórico

| Data | Decisões introduzidas/atualizadas |
|---|---|
| 2026-04-29 | D1–D7 (versão original). |
| 2026-05-07 | D8–D16; reorganização e alinhamento com R1–R11 + post-merge fixes. |
