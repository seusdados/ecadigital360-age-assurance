# Memo executivo — Decisão de release PROD do AgeKey Consent

> **Status**: Documento preparatório. Aguarda decisão de produto/legal antes da execução.
>
> Project ref PROD: `tpdiccnmsnjtjwhardij`.
> Documento companheiro: `docs/audit/prod-consent-release-readiness-final-report.md`, `docs/release/prod-consent-release-runbook.md`, `docs/release/prod-consent-go-no-go-checklist.md`.

---

## 1. Para quem este memo é

Decisão executiva (produto + legal/DPO) sobre **ativar o módulo AgeKey Consent em ambiente de produção** para um conjunto inicial de tenants piloto.

**Não** é decisão técnica — a parte técnica está pronta e validada em homologação. Este memo trata de:

- Quais dados o módulo trata.
- Quais não trata.
- Por que isso é defensável legalmente em LGPD/ECA.
- Por que Consent pode (e deve) entrar antes de Safety Signals.
- Riscos residuais aceitos pelo decisor.
- A decisão concreta solicitada.

---

## 2. O que será ativado em PROD nesta janela

**Módulo**: AgeKey Consent — fluxo de consentimento parental para uso de plataforma por menor (LGPD art. 14 §1º; ECA art. 17).

**Funcionalidades expostas**:

1. Tenant cliente (ex.: rede social, plataforma de jogos) chama AgeKey informando que um menor quer ativar uma feature.
2. AgeKey cria uma `parental_consent_request` e devolve um **painel parental** dedicado (URL + token de sessão).
3. O responsável legal acessa o painel, registra um contato (email/SMS) e recebe um **OTP** real via provider configurado.
4. O responsável confirma com o OTP, lê o texto de consentimento versionado por hash (LGPD art. 9º — informação clara), e aprova ou nega.
5. Se aprovado, AgeKey emite um `parental_consent_token` (JWS/JWT ES256) que o tenant pode validar online a qualquer momento.
6. Responsável pode **revogar** a qualquer momento (LGPD art. 8º §5º — revogabilidade).

**Ambiente**: somente PROD (`tpdiccnmsnjtjwhardij`). HML segue o mesmo padrão e está validada (`docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md`).

**Tenants alvo**: piloto controlado, definido pelo time de produto.

---

## 3. O que NÃO será ativado nesta janela

| Item | Razão para deferir |
|---|---|
| **Safety Signals** (análise de risco metadata-only entre adulto e menor) | RIPD próprio em curso; tratamento de relacionamento entre adulto e menor exige análise jurídica separada; primeiro release Consent dá tempo de operação para validar a infra antes de adicionar mais um vetor de tratamento. |
| **Identidade civil ou KYC** | AgeKey **não é** KYC. Não coleta nome civil, CPF, RG, foto de documento, selfie de prova de vida, biometria. Ver §6. |
| **Coleta de dados de menor** | Apenas hash opaco (`child_ref_hmac`) gerado pelo tenant. AgeKey não vê nem armazena identidade do menor. |
| **Coleta de dados além do contato do responsável** | Apenas o canal e valor de contato (email/telefone), cifrados em vault e não persistidos em claro. Ver §4. |
| **Dispositivo/IP/Geolocalização** | Não coletados. |
| **Uso de OTP em texto claro em PROD** | A flag `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` é **proibida** em PROD; OTP só viaja via provider real. |

---

## 4. Quais dados são tratados pelo AgeKey Consent

### 4.1. Dados de entrada (recebidos do tenant)

| Dado | Tipo | Tratamento |
|---|---|---|
| `application_slug` | identificador do tenant | armazenado em referência |
| `policy_slug` | identificador da policy aplicável | armazenado em referência |
| `child_ref_hmac` | **hash opaco** gerado pelo tenant | armazenado como hash; AgeKey não tem como reverter |
| `purpose_codes` | enum de finalidades (ex.: account_creation) | armazenado |
| `data_categories` | enum de categorias de dados que o tenant trata (ex.: nickname) | armazenado |
| `resource` | string de identificação da feature (ex.: `feature/social-feed`) | armazenado |
| `locale` | preferência de idioma (ex.: `pt-BR`) | armazenado |
| `redirect_url` | URL de retorno opcional | armazenado |

### 4.2. Dados do responsável (coletados pelo painel parental)

| Dado | Tratamento |
|---|---|
| `contact_channel` | enum (`email`/`sms`) |
| `contact_value` | **cifrado em Supabase Vault via `vault.create_secret()`**; jamais em claro no DB |
| `contact_hmac` | HMAC com sal por tenant; permite deduplicação sem ler o claro |
| `contact_masked` | display de UI (ex.: `r***@example.com`) |
| `otp_hash` | apenas hash do OTP entregue, jamais o OTP em claro |

### 4.3. Dados gerados pelo AgeKey

| Dado | Significado |
|---|---|
| `parental_consent_request.id` | UUID v7 da solicitação |
| `guardian_panel_token` (hash) | sessão única para o painel; raw retornado uma vez ao tenant |
| `parental_consent.id` | UUID v7 da decisão |
| `parental_consent_token` (JWT) | token assinado ES256, com claims minimizadas |
| `decision_envelope` | contrato canônico AgeKey, sem PII, com `content_included=false` e `pii_included=false` |

---

## 5. Quais dados **não são** tratados pelo AgeKey Consent

- ❌ Nome civil / CPF / RG / Passaporte / qualquer documento civil.
- ❌ Foto, selfie, biometria, faceprint.
- ❌ Data de nascimento real (apenas idade-policy: ex.: "atende 13+").
- ❌ Endereço, geolocalização precisa.
- ❌ IP do menor ou do responsável (logging técnico genérico só, sem cross-link a usuários).
- ❌ Identidade do menor (apenas `child_ref_hmac` opaco).
- ❌ Conteúdo de mensagens, mídia, áudio, vídeo (`content_included=false` em todo decision envelope).
- ❌ Histórico de comportamento do menor.

Estes campos são **rejeitados** pelo Privacy Guard canônico em runtime (`packages/shared/src/privacy/forbidden-claims.ts`).

---

## 6. Por que **não é KYC**

| Característica de KYC | AgeKey Consent |
|---|---|
| Verifica identidade civil | ❌ Não. |
| Coleta documento físico | ❌ Não. |
| Faz prova de vida (selfie/liveness) | ❌ Não. |
| Verifica idade biológica real | ❌ Apenas confirma elegibilidade conforme policy (ex.: 13+); não armazena idade real. |
| Resultado é "pessoa X tem Y anos" | ❌ Resultado é "policy P satisfeita / não satisfeita / pendente de consentimento". |
| Identifica indivíduos | ❌ Trabalha com referências opacas (`child_ref_hmac`). |
| Armazena selfie/documento | ❌ Não tem onde guardar — schema não tem coluna para isso. |
| Compartilha identidade entre verificações | ❌ Cada verificação é isolada por design. |

**Posicionamento**: AgeKey é **motor de prova de elegibilidade etária preservando privacidade**, não cadastro civil. O fluxo Consent acrescenta apenas **gestão de consentimento parental** sobre essa base.

---

## 7. Por que Consent pode entrar antes de Safety

| Argumento | Detalhe |
|---|---|
| **Independência funcional** | Consent não depende de Safety. Safety (quando ativado) usa Consent como pré-requisito quando aplicável, não o contrário. |
| **Maturidade técnica** | Consent MVP foi validado ponta-a-ponta em HML em 8/8 steps (`docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md`). Safety é metadata-only por design mas tem testes pendentes (alert/step-up/cron) que dependem de dados específicos. |
| **Maturidade legal** | LGPD art. 14 §1º + ECA art. 17 dão base direta para consentimento parental. Safety (análise de risco em interação adulto-menor) tem framework legal mais sutil (proteção do menor + proporcionalidade) que merece RIPD próprio. |
| **Risco de RIPD bloqueante** | Aprovar Safety na mesma janela exigiria fechar dois RIPDs simultaneamente. Separar reduz superfície e simplifica gates. |
| **Operação faseada** | Operação ganha tempo de observar Consent em PROD antes de adicionar Safety, reduzindo risco combinado. |
| **Reversibilidade** | Se Consent precisar ser desligado, basta flag OFF (rollback < 2min). Mais simples sem Safety acoplado na mesma janela. |

---

## 8. Riscos residuais aceitos

### 8.1. Riscos técnicos residuais

| # | Risco | Mitigação aceita |
|---|---|---|
| T1 | Provider OTP de produção pode falhar (entrega, latência) | Monitoramento + fallback documentado; SLA do provider contratado |
| T2 | Vault encryption performance em alto volume | Monitoramento de latência de `guardian-start`; rate limit já existe |
| T3 | Webhook fan-out backpressure | Monitoramento `webhooks-worker`; já há retry implícito |
| T4 | Migration 029 (cross-cutting) deferida → webhook payload Consent usa v1 sem `payload_hash` v2 | Não-bloqueante funcional; será corrigido na janela Safety |
| T5 | Workflow GHA novo para PROD precisa ser criado em PR separado antes da janela | Prerequisito explícito no checklist (item 7.2) |

### 8.2. Riscos legais residuais

| # | Risco | Mitigação aceita |
|---|---|---|
| L1 | Tenant pode armazenar contato em claro do seu lado (fora do AgeKey) | Documentação contratual exige; AgeKey não controla esse lado |
| L2 | Tenant pode usar `child_ref_hmac` que de fato seja PII (ex.: hash de email) | Documentação do contrato exige hash opaco; AgeKey defensivamente rejeita PII conhecida no `child_ref_hmac` via Privacy Guard |
| L3 | Provider OTP terceiro processa contato do responsável | Listado em ROPA do tenant; provider deve estar em rol de operadores autorizados |
| L4 | Consent token, se vazado, permite ler estado de aprovação | Token tem TTL curto e é revogável; assinado ES256; verificação online detecta revogação |
| L5 | Painel parental URL pode ser interceptada (token na query) | Painel TLS-only; token expira em janela curta (default 24h); rate limit em `/text-get` |

### 8.3. Riscos operacionais residuais

| # | Risco | Mitigação aceita |
|---|---|---|
| O1 | Operador da janela pode aplicar comando errado (ex.: HML em vez de PROD) | Runbook tem guard defensivo, project ref hardcoded em workflow PROD futuro |
| O2 | Dependência humana no operador para o smoke pós-ativação (precisa receber OTP real) | Combinado: operador é o `DEV_CONTACT_VALUE` no smoke piloto |
| O3 | Observação de 72h pós-release exige plantão | Combinado e nominal no checklist |

---

## 9. Decisão solicitada

**Este memo solicita ao decisor**:

### 9.1. Aprovações executivas

- [ ] **Aprovar release Consent em PROD** com escopo definido neste documento.
- [ ] **Manter Safety fora desta janela** explicitamente.
- [ ] **Aprovar provider OTP** escolhido (nome do provider): _____________________
- [ ] **Aprovar lista de tenants piloto**: _____________________
- [ ] **Aprovar janela de manutenção** (data/hora UTC): _____________________
- [ ] **Aprovar operador responsável**: _____________________

### 9.2. Confirmações de governança

- [ ] **RIPD do AgeKey Consent v1** revisado e aceito (anexo externo).
- [ ] **Contrato com tenant piloto** prevê o escopo deste memo (operação + dados).
- [ ] **Ciência da revogabilidade** (LGPD art. 8º §5º) garantida em UX do painel.
- [ ] **Política de retenção** dos dados de Consent em produção definida (default: `retention-job` cron a ser ativado em janela posterior; até lá, gestão manual).

### 9.3. Compromissos de pós-release

- [ ] **Postmortem em 72h** mesmo se sem incidente.
- [ ] **Janela Safety** será planejada em PR/memo separado, com seu próprio RIPD.
- [ ] **Auditoria interna** trimestral do módulo Consent em PROD.

### 9.4. Assinatura

| Papel | Nome | Decisão | Data UTC | Assinatura |
|---|---|---|---|---|
| Produto (PO) | ____________________ | ☐ Aprovado ☐ Recusado | ____________ | ____________ |
| Legal / DPO | ____________________ | ☐ Aprovado ☐ Recusado | ____________ | ____________ |
| Engenharia (Tech Lead) | ____________________ | ☐ Aprovado ☐ Recusado | ____________ | ____________ |
| Decisão final | — | ☐ **APROVADO** ☐ **RECUSADO** | ____________ | ____________ |

---

## 10. Referências documentais

- `docs/audit/prod-consent-release-readiness-final-report.md` — readiness técnico
- `docs/release/prod-consent-release-runbook.md` — runbook operacional
- `docs/release/prod-consent-go-no-go-checklist.md` — checklist
- `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` — validação HML
- `docs/specs/agekey-decision-envelope.md` — contrato canônico de decisão
- `docs/specs/agekey-privacy-guard-canonical.md` — Privacy Guard
- `packages/shared/src/privacy/forbidden-claims.ts` — código do Privacy Guard
- `supabase/functions/_shared/parental-consent/feature-flags.ts` — feature flags do módulo

---

## 11. Confirmações de não-ação (esta rodada)

- ❌ Nada executado em PROD.
- ❌ Nenhuma migration aplicada em qualquer ambiente nesta rodada.
- ❌ Nenhum deploy nesta rodada.
- ❌ Nenhum SQL escrito em PROD.
- ❌ Nenhum segredo exposto.
- ❌ Nenhuma alteração de feature flag remota.
- ❌ Nenhuma alteração em Vercel.
- ❌ Nenhuma alteração em Supabase PROD.
- ✅ Apenas: 4 documentos preparatórios em `docs/`.
