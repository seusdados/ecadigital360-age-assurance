# AgeKey — Relatório de Consolidação dos PRDs

> Status: artefato de referência da Rodada 1 (consolidação canônica).
> Branch de origem: `claude/agekey-canonical-modular-architecture` (a partir de `agekey/production-readiness-20260429`).
> Data: 2026-05-04.

## 1. PRDs e documentos considerados

Esta consolidação leva em conta três PRDs/documentos canônicos do produto AgeKey, somados ao estado real do repositório:

1. **AGEKEY_CANONICAL_PRD.md** — define o AgeKey como infraestrutura de elegibilidade etária preservadora de privacidade. Ponto central: validar requisito etário sem revelar identidade, documento ou data de nascimento. AgeKey **não é** sistema de identificação civil.
2. **AGEKEY_CONSENTIMENTO_PARENTAL_DOCUMENTACAO_COMPLETA.md** — define o módulo `AgeKey Consent` (consentimento parental auditável). Ponto central: a relying party não precisa conhecer identidade civil da criança, adolescente ou responsável; precisa apenas de prova mínima, assinada, verificável, revogável e auditável de que a política foi satisfeita. **Não é KYC** e **não cria cadastro civil**.
3. **AGEKEY_SAFETY_SIGNALS_PRD_TECNICO_COMPLEMENTAR.md** — define o módulo `AgeKey Safety Signals`. Ponto central: camada de eventos mínimos, sinais de risco, regras, alertas, step-up de age assurance e auditoria minimizada. **Não é** interceptação, vigilância parental, spyware, KYC, detector automático de crimes, reconhecimento facial, biometria, emoção ou moderação autônoma.

Documentos do repositório lidos como ponto de verdade do estado atual:

- `README.md`
- `DEPLOY.md`
- `docs/PLATFORM_DEVELOPMENT_PLAN.md`
- `docs/data-model.md`
- `docs/audit/current-state.md`
- `docs/architecture/open-source-foundation.md`
- `docs/specs/agekey-token.md`
- `docs/specs/sdk-public-contract.md`
- `docs/implementation/pending-work-backlog.md`
- `docs/implementation/claude-code-minimal-context.md`
- `packages/shared/src/privacy-guard.ts`
- `packages/shared/src/reason-codes.ts`
- `packages/shared/src/agekey-claims.ts`
- `packages/shared/src/schemas/*`
- `packages/shared/src/jws.ts`
- `compliance/ripd-agekey.md`
- `compliance/privacy-by-design-record.md`
- `compliance/data-retention-policy.md`
- `security/pentest/threat-model.md`
- `infrastructure/supabase-hardening.md`
- `infrastructure/environments.md`
- Migrações `supabase/migrations/000_*.sql` → `016_*.sql`.

> Observação: o arquivo `.claude/AGEKEY_IMPLEMENTATION_HANDOFF.md` mencionado no prompt **não existe** nesta branch (`agekey/production-readiness-20260429`). Não foi recriado por esta rodada — registrado como pendência informativa.

## 2. O que está correto no Core (AgeKey Verify)

O núcleo já implementa, de forma defensável, os princípios de minimização e prova de elegibilidade:

- Modelo de dados separa sessão (`verification_sessions`), prova (`proof_artifacts`, hash + storage path), decisão (`verification_results`) e token (`result_tokens`). Não existe tabela de "usuário verificado".
- Token `AgeKey` é JWT ES256, sem PII, com claim `agekey.decision`, `agekey.threshold_satisfied`, `agekey.age_threshold` (limiar de política, não idade do usuário) e `agekey.reason_code`.
- Privacy guard inicial em `packages/shared/src/privacy-guard.ts` rejeita 18 chaves comuns (`birthdate`, `cpf`, `selfie`, `email`, etc.).
- Reason codes em `UPPER_SNAKE_CASE` e separados por método (`ZKP_*`, `VC_*`, `GATEWAY_*`, `FALLBACK_*`).
- Adapters honestos: ZKP/BBS+ retorna `ZKP_CURVE_UNSUPPORTED` quando não há lib/test vectors; gateway sem configuração retorna `GATEWAY_CONFIG_MISSING`.
- RLS habilitada por tenant em todas as tabelas de negócio (migration `008_rls.sql`).
- JWS/JWT usando Web Crypto puro (`packages/shared/src/jws.ts`) — funciona em Deno, Node 20+ e browser.

## 3. O que está correto no Consent (PRD)

O PRD de consentimento parental, **ainda não implementado em código**, está corretamente estruturado em torno de:

- Solicitação (`parental_consent_requests`) emitida pelo recurso/política, sem coletar dados civis da criança ou adolescente.
- Contato do responsável (`guardian_contacts`) cifrado e com retenção própria; responsável é identificado por contato verificado, não por documento.
- Verificação do responsável (`guardian_verifications`) por OTP/link curto + escopo restrito; nunca por upload de documento no MVP.
- Versionamento textual obrigatório (`consent_text_versions`) — texto exibido ao responsável é imutável e referenciado por versão.
- Registro do consentimento (`parental_consents`) com `policy_id`, `policy_version`, `purpose_codes` e `data_categories` específicos, **sem conteúdo livre**.
- Token de consentimento (`parental_consent_tokens`) **assinado, verificável e sem PII**, equivalente em forma ao `result_token` do Core.
- Revogação (`parental_consent_revocations`) e renovação obrigatórias.
- Painel parental acessado por backend via token curto e escopado, nunca consulta direta a tabela.

## 4. O que está correto no Safety Signals (PRD)

O PRD de sinais de risco, **ainda não implementado em código**, está corretamente estruturado em torno de:

- Modelo `metadata-only` no MVP — eventos não armazenam mensagem, imagem, vídeo ou áudio.
- Sujeitos por referência opaca (`safety_subjects.subject_ref_hmac`), nunca por dado civil.
- Eventos com tipos restritos (`allowed_event_types`) e categorização por regra (`safety_rules`).
- Alertas (`safety_alerts`) com `severity` controlada e `actions` proporcionais.
- Step-up via Core (`verification_session` nova) e parental consent check via Consent — Safety **não cria sua própria verificação** nem seu próprio token.
- Retenção curta por classe de evento; agregados (`safety_aggregates`) podem sobreviver aos eventos individuais.
- Webhooks com mesmo padrão de assinatura HMAC do Core.
- Revisão humana obrigatória para alertas de alto impacto.

## 5. Duplicidades identificadas (risco arquitetural)

Se Consent e Safety forem implementados como silos, **cinco duplicidades sérias surgem**:

1. **Decisão pública duplicada.** Cada módulo tenderia a criar seu próprio formato de "resposta de decisão". Já temos `verification_results` no Core. Sem um envelope canônico, painel admin, SDK, webhook e API pública passam a ter três contratos divergentes para responder "essa interação foi aprovada/negada/precisa revisão".
2. **Privacy guard duplicado.** O `privacy-guard.ts` atual conhece 18 chaves proibidas. Consent precisará incluir `guardian_email`, `guardian_phone`, `guardian_name` na lista de bloqueios em payloads públicos. Safety precisará bloquear `message`, `raw_text`, `image`, `video`, `audio`. Sem perfis (`public_token`, `webhook`, `safety_event_v1`, `guardian_contact_internal`), cada módulo replicará sua versão e divergirá.
3. **Webhook signer duplicado.** O Core usa HMAC SHA-256 em `webhook_deliveries`. Consent quer eventos `parental_consent.*` e Safety quer `safety.*`. Sem um signer único, vão surgir três algoritmos, três cabeçalhos e três janelas de replay.
4. **Reason codes duplicados.** Já existem `THRESHOLD_SATISFIED`, `POLICY_ASSURANCE_UNMET` etc. Consent precisa de `CONSENT_*` e Safety precisa de `SAFETY_*`. Sem um catálogo canônico, painéis e clientes vão receber strings inconsistentes (ex.: `consent_pending_guardian` vs `CONSENT_PENDING_GUARDIAN` vs `pending_guardian`).
5. **Retenção duplicada.** O Core tem `tenant.retention_days`. Consent precisa de `consent_active_until_expiration` e `consent_expired_audit_window`. Safety precisa de `event_30d`, `aggregate_12m`, `legal_hold`. Sem classes nomeadas, cada módulo vai escrever sua lógica de cleanup, e o `retention-job` cron vai sobrepor regras.

Riscos secundários:

- **Token claims divergentes.** Sem alinhar `consent_token_id`, `result_token_id` e `decision_id`, painel e clientes precisam saber qual token validar onde.
- **Policy engine fragmentado.** Cada módulo aplicaria suas regras (`requires_parental_consent`, `require_step_up_on_unknown_age`, `blocked_if_minor`) em código próprio, perdendo visibilidade central.
- **Audit events incompatíveis.** Hoje `audit_events` é particionado mensalmente. Sem uniformizar o `action`/`resource_type` entre módulos, queries de auditoria global ficam impossíveis.
- **Billing fragmentado.** Verificação cobra por `billing_events`. Consent + Safety precisam decidir se cobram por solicitação, por token, por evento ingerido — mas tudo deve passar pela mesma tabela.

## 6. Decisão final de arquitetura

Os três módulos compartilham uma **camada canônica obrigatória** e se compõem hierarquicamente:

```
                ┌────────────────────────────┐
                │   AgeKey Canonical Layer   │
                │   (Rodada 1 — esta)        │
                │                            │
                │   - Decision Envelope      │
                │   - Policy Engine          │
                │   - Privacy Guard          │
                │   - Reason Codes           │
                │   - Retention Classes      │
                │   - Webhook Contract       │
                │   - Age Taxonomy           │
                │   - Audit/Billing schemas  │
                └────────────┬───────────────┘
                             │
        ┌────────────────────┼─────────────────────┐
        ▼                    ▼                     ▼
┌──────────────┐    ┌──────────────────┐   ┌──────────────────┐
│  AgeKey Core │    │  AgeKey Consent  │   │  Safety Signals  │
│  / Verify    │◀───│  (extends Core)  │   │ (extends Core +  │
│              │    │                  │   │  Consent quando  │
│  núcleo      │    │  parental flow   │   │  policy exige)   │
└──────┬───────┘    └──────────────────┘   └──────────────────┘
       │
       └──── futuro: AgeKey Pass (SD-JWT VC, ZKP/BBS+) sob feature flag
```

**Regras estruturais:**

1. **Core é o núcleo.** Tudo que precisa de verificação de idade ou emissão de token assinado passa pelo Core.
2. **Consent é extensão de autorização parental** — usa `verification_sessions` do Core, emite `parental_consent_token` que é uma especialização minimizada de `result_token`. Consent não cria seu próprio motor de verificação.
3. **Safety é extensão de risk orchestration** — quando precisa de step-up, chama o Core para criar `verification_session`; quando precisa de consentimento parental, exige `require_parental_consent_check` via policy. Safety **não emite tokens próprios** e **não toma decisões de elegibilidade** isoladamente.
4. **AgeKey Pass** (SD-JWT VC, ZKP/BBS+) é evolução credential do Core, atrás de feature flag, sem implementação real até haver biblioteca, issuer, test vectors e revogação/status reais.

## 7. Ordem de implementação recomendada

1. **Canonical contracts (esta rodada).** Documentos + tipos compartilhados em `packages/shared`. Sem migrations, sem módulos completos.
2. **Core readiness final.** Pequenos ajustes para alinhar `result_token` claims, audit events e webhook payloads ao envelope canônico. Branch sugerida: `claude/agekey-core-readiness-canonical-alignment`.
3. **AgeKey Consent MVP.** Migrations + edge functions + painel parental + dashboard admin. Branch sugerida: `claude/agekey-parental-consent-module`.
4. **AgeKey Safety Signals MVP (metadata-only).** Migrations + edge functions + ingest + ruleset + step-up via Core + parental consent check via Consent + dashboard admin. Branch sugerida: `claude/agekey-safety-signals`.
5. **Credential mode (SD-JWT VC).** Apenas com biblioteca real, issuer, test vectors. Branch sugerida: `claude/agekey-credential-mode`.
6. **Proof mode (ZKP/BBS+).** Apenas com biblioteca real, test vectors, revisão criptográfica externa. Branch sugerida: `claude/agekey-proof-mode-zkp`.

## 8. Conclusão

Os três PRDs são compatíveis e complementares **se** implementados sobre uma camada canônica única. Esta rodada produz exatamente essa camada — documentos de arquitetura, contratos TypeScript em `packages/shared` e testes mínimos. Nenhum módulo Consent ou Safety é implementado por completo aqui; nenhuma migration nova é criada; nenhuma promessa criptográfica falsa é introduzida.

A próxima rodada (`claude/agekey-core-readiness-canonical-alignment`) poderá então alinhar incrementalmente o Core ao envelope canônico antes de Consent e Safety entrarem.
