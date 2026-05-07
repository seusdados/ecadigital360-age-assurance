# PRD — AgeKey Parental Consent (MVP / Rodada 3)

## Problema

Plataformas que precisam liberar funcionalidades para usuários menores de
idade enfrentam três dificuldades:

1. **Conformidade legal** com LGPD (Brasil), GDPR (UE), COPPA (EUA) — todas
   exigem consentimento de responsável quando aplicável.
2. **Risco de coletar PII excessiva** ao tentar comprovar a relação
   menor↔responsável (KYC infantil é desproporcional, vetado em vários
   regimes regulatórios).
3. **Falta de evidência auditável** quando o consentimento é dado: muitas
   integrações guardam apenas um booleano `consented = true`, o que não
   resiste a auditoria nem a revogação.

## Solução

Um módulo do AgeKey que produz **consentimento parental auditável,
purpose-bound e revogável**, sem armazenar identidade civil. A relying party
recebe um token assinado curto que afirma:

- a finalidade (`purpose_codes`),
- as categorias de dados envolvidas (`data_categories`),
- o recurso liberado (`resource`),
- a versão exata do texto aceito (`consent_text_hash`),
- o método pelo qual o canal do responsável foi verificado (`method`,
  `assurance_level`),
- o nível de risco (`risk_tier`),
- a expiração (`exp`).

## Escopo do MVP

- ✅ Sessão de consentimento parental (`POST /v1/parental-consent/session`).
- ✅ Coleta de canal do responsável + envio de código (OTP digest persistido,
   dispatch real gated por feature flag).
- ✅ Confirmação com aceite de texto versionado e emissão de token JWS
   minimizado.
- ✅ Consulta de status pública (mínima).
- ✅ Revogação por responsável, admin do tenant, sujeito ou regulador.
- ✅ Verificação de token (público, sem API key).
- ✅ Painel administrativo mínimo no admin Next.js.
- ✅ Trilha de auditoria mínima em `audit_events`.
- ✅ Webhooks `parental_consent.*` assinados via trigger SQL.

## Fora do escopo do MVP

- ❌ SD-JWT VC real (sem biblioteca, sem issuer, sem registro de revogação).
- ❌ ZKP/BBS+ aplicado a consentimento.
- ❌ Provider de OTP real (e-mail/SMS/SSO) — gated por flag.
- ❌ Painel do responsável com login social.
- ❌ Importação em massa de consentimentos legados.
- ❌ Relatórios regulatórios formatados.

## Restrições não-negociáveis

1. **Sem KYC infantil.** Nenhum campo de documento civil, CPF, RG,
   passaporte, nome civil, foto, selfie, biometria, data de nascimento ou
   idade exata.
2. **Sem contato em texto plano em token, webhook ou API pública.** O
   contato do responsável só existe nas tabelas `guardian_contacts` como
   hash HMAC + ciphertext opcional.
3. **Privacy guard canônico em todos os boundaries públicos.**
4. **RLS em todas as tabelas tenant-scoped.**
5. **Service-role só server-side.**

## Critérios de aceitação

1. Tipos canônicos do Core (DecisionEnvelope, Privacy Guard, Webhook
   Contract, Reason Codes, Retention Classes) reutilizados sem duplicação.
2. Migration aplicável via Supabase com RLS habilitado.
3. Edge functions cobertas por testes Deno e os schemas testados em vitest.
4. Token assinado com a mesma chave ES256 do Core (`crypto_keys`).
5. Painel administrativo navegável e seguro contra leitura cross-tenant.

## KPIs (pós-MVP)

- Tempo médio entre `created` e `approved` (latência do fluxo).
- Taxa de aceite por canal (e-mail/telefone/SSO).
- Taxa de revogação no primeiro mês (sinal de UX confusa).
- Taxa de `needs_review` em risco alto.
