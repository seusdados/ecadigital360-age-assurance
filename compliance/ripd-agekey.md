# RIPD — Relatório de Impacto à Proteção de Dados (AgeKey)

> Documento de referência LGPD (Lei 13.709/2018, art. 38).
> Versão: 2026-05-07.
> Status: vivo — atualizar a cada mudança material de tratamento.
> Substitui versões anteriores deste arquivo.

## 1. Identificação

### 1.1 Produto

**AgeKey** — infraestrutura privacy-first de verificação de elegibilidade etária.
A solução cria sessão temporária, recebe declaração e/ou prova de elegibilidade, avalia uma policy e devolve uma decisão mínima (Decision Envelope canônico) e, opcionalmente, um token assinado curto.

O AgeKey **não é** uma solução de KYC e **não realiza** identificação civil de menores. Verifica apenas elegibilidade etária por declaração e/ou prova proporcional.

### 1.2 Papéis (LGPD art. 5º, VI/VII)

| Papel | Entidade |
|---|---|
| Controlador | Cliente licenciado (tenant), conforme contrato e caso de uso |
| Operador | AgeKey (entidade provedora da plataforma) |
| Encarregado/DPO do operador | indicado em contrato e em `https://agekey.com.br/dpo` |
| Encarregado/DPO do controlador | conforme contrato do tenant |

A plataforma é **multi-tenant**. Cada tenant é um controlador autônomo. A AgeKey opera **em nome do controlador** sob instruções contratuais.

## 2. Finalidades do tratamento

1. Verificar cumprimento de uma política de elegibilidade etária definida pelo controlador (ex.: maior/menor de 13/14/16/18 anos).
2. Emitir evidência mínima auditável da decisão (Decision Envelope).
3. Permitir validação posterior de token (online/offline com JWKS público).
4. Prevenir replay/fraude (nonce, JTI, expiração).
5. Operar fluxo de consentimento parental para menores quando aplicável (módulo Consent — R3/R5/R6).
6. Coletar sinais de risco proporcionais para guardrails (módulo Safety v1 — somente metadados; sem conteúdo bruto).
7. Gerar métricas operacionais e de billing por tenant **sem PII**.
8. Cumprir obrigações de segurança e auditabilidade.

## 3. Hipóteses legais (LGPD art. 7º e art. 14)

A base legal **não é universal**: depende do controlador e do caso de uso. O AgeKey foi desenhado para suportar múltiplas bases.

### 3.1 Adultos (art. 7º LGPD)

| Inciso | Hipótese | Quando se aplica |
|---|---|---|
| II | Cumprimento de obrigação legal/regulatória pelo controlador | Acesso a conteúdo regulado, regras setoriais (ex.: jogos, álcool, saúde). |
| V | Execução de contrato | Termos de uso do controlador exigem confirmação etária. |
| IX | Legítimo interesse, balanceado | Mitigação de fraude e proteção de menores; só vale após teste de necessidade/proporcionalidade. |
| I | Consentimento | Quando o controlador opta por modelo opt-in com finalidade específica e destacada. |

### 3.2 Crianças e adolescentes (art. 14 LGPD)

| Cenário | Hipótese | Como o AgeKey opera |
|---|---|---|
| Tratamento de dados do menor | Consentimento específico e em destaque por **um dos pais ou responsável legal** (art. 14, §1º) | Módulo Parental Consent (R3/R5/R6) — registro auditável, OTP do guardian via relay HTTPS (R5), painel parental com texto integral da policy (R6), revogação simétrica. |
| Proteção do melhor interesse da criança (art. 14, §3º) | Tratamento sem consentimento quando estritamente necessário | Caminho explícito documentado em `docs/modules/parental-consent/integration-guide.md`; exige justificativa do controlador. |

O AgeKey **não trata** dados pessoais sensíveis (LGPD art. 5º, II) no core. Quando o caso de uso do controlador exigir prova baseada em documento, o tratamento é delegado a um *issuer/gateway* externo (subprocessador) sob contrato — o AgeKey persiste apenas hash opaco do artefato e metadados mínimos.

## 4. Categorias de dados

### 4.1 Permitido no core (lista taxativa)

- `tenant_id`, `application_id`, `policy_id`.
- `session_id`, `nonce`, `challenge` (uso único, com TTL).
- `method`, `decision`, `assurance_level`, `reason_code` (taxonomia canônica).
- `proof_artifact_hash` (hash criptográfico do artefato; **não** o conteúdo).
- `issuer_id`, `provider_id`.
- `jti` do token, timestamps.
- `external_user_ref` **opaco**, fornecido pelo controlador (preferencialmente HMAC pré-computado client-side).
- IP e user-agent, **somente** para *rate limit* / segurança, com retenção curta.
- Logs técnicos minimizados (sem corpo de requisição/resposta).

### 4.2 Permitido em módulos opcionais

| Módulo | Dado | Controle |
|---|---|---|
| Parental Consent | E-mail/telefone do **guardian** (não do menor) | Criptografado via `pgsodium` Vault; nunca exposto em payload público; usado apenas para entregar OTP. |
| Parental Consent | `child_ref` (referência opaca à criança) | HMAC pré-computado pelo cliente; o AgeKey **não** recebe nome ou data de nascimento do menor. |
| Safety v1 | Metadados de eventos de risco | Apenas contagem/agregados/timestamps; **sem** conteúdo bruto de mensagens, **sem** mídia, **sem** texto. |
| Credential (R10, stub) | SD-JWT VC opaco | Adapter-only; modo real exige auditoria criptográfica externa. |
| Proof (R11, stub) | BBS+ ZKP opaco | Adapter-only; modo real exige auditoria criptográfica externa. |

### 4.3 Proibido em qualquer camada (Privacy Guard)

- Data de nascimento ou idade exata.
- Documento civil (CPF, RG, passaporte, CNH).
- Selfie, biometria facial, vídeo.
- Nome completo, endereço, e-mail ou telefone do **usuário final** (menor ou adulto verificado).
- Payload bruto de documento.
- Credencial/atestação completa quando não estritamente necessária.
- Score universal cross-tenant de qualquer indivíduo.

A camada `packages/shared/src/privacy-guard.ts` impõe esses limites em runtime; testes em `packages/shared/__tests__/privacy-guard*.test.ts` (≥ 100 vetores) bloqueiam regressões.

## 5. Princípios LGPD aplicados (art. 6º)

| Princípio | Como o AgeKey atende |
|---|---|
| Finalidade | Cada tenant declara finalidade na configuração da policy. |
| Adequação | Decision Envelope retorna apenas `decision`/`assurance_level`/`reason_code`. |
| Necessidade (minimização) | O core nunca solicita idade exata; resposta é binária + nível de garantia. |
| Livre acesso | Titular pode pedir confirmação ao controlador via `session_id`/`external_user_ref`. |
| Qualidade | Decisão é determinística por policy; idem token. |
| Transparência | Endpoint público de texto integral da policy parental (R6); JWKS público; documentação `docs/specs/`. |
| Segurança | RLS multi-tenant, JWS ES256, rotação de chaves, nonce/JTI, *rate limit*. |
| Prevenção | Privacy Guard, testes cross-tenant, retention job, IR playbook. |
| Não discriminação | Sem score universal cross-tenant; decisão restrita à policy do tenant. |
| Responsabilização | Audit log minimizado, RIPD vivo, registro de subprocessadores. |

## 6. Decisão automatizada (LGPD art. 20)

- Cada decisão é estritamente **por policy** do tenant.
- **Não há** score universal cross-tenant. **Não há** perfilamento agregado entre tenants.
- A cada decisão registra-se `policy_id`, `policy_version`, `reason_code` e `assurance_level`, suportando direito de revisão pelo titular junto ao controlador.
- O controlador deve declarar ao titular, em sua privacy notice, o uso de decisão automatizada e o canal de revisão.

## 7. Riscos e mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Reidentificação por correlação de sessões | Alta | TTL curto, hashes opacos, `external_user_ref` HMAC client-side, retenção proporcional. |
| Vazamento de logs com dados pessoais | Alta | Logs sem PII por contrato; revisão automatizada via Privacy Guard; auditoria periódica. |
| Tenant breakout (RLS bypass) | Crítica | RLS em todas as tabelas (incl. partições — migration 030); service role apenas server-side; suíte cross-tenant em `packages/integration-tests/`. |
| Provider externo coletar dados além do necessário | Alta | DPA por subprocessador; contratos com cláusulas de minimização; documentação por tenant. |
| Replay de token | Média/Alta | JWS ES256, JTI único, expiração curta, JWKS rotativo. |
| Uso indevido do fallback (autodeclaração) | Média | `assurance_level=low` em fallback; policy engine bloqueia em casos de alto risco. |
| Inserção indevida de PII em `external_user_ref` | Alta | Privacy Guard rejeita strings com aparência de PII (P0-06); SDK fornece helper HMAC. |
| Indisponibilidade de provider | Média | Múltiplos issuers configuráveis; fallback documentado; circuit-breaker no gateway. |
| Coleta excessiva no módulo Consent | Alta | Apenas contato do guardian, criptografado; nunca contato do menor; texto da policy publicado. |
| Sinais de Safety serem usados para perfilamento | Crítica | Safety v1 é metadata-only; **sem** conteúdo bruto; agregados são por tenant; uso restrito a guardrails proporcionais. |

## 8. Transferência internacional (LGPD art. 33–36)

A AgeKey opera em provedores que podem armazenar dados em jurisdições fora do Brasil (Supabase, Vercel). Salvaguardas:

- Contratos com cláusulas-padrão alinhadas a LGPD/GDPR.
- Preferência por região com adequação reconhecida quando disponível.
- Subprocessadores listados em `compliance/subprocessors-register.md`.
- Cliente pode exigir, contratualmente, restrição de jurisdição.

Detalhes por subprocessador: ver [`subprocessors-register.md`](./subprocessors-register.md).

## 9. Incidentes (LGPD art. 48)

Detalhes operacionais em [`incident-response-playbook.md`](./incident-response-playbook.md).

Compromissos:

- Comunicação à ANPD em até 72 horas para incidentes com risco/dano relevante.
- Comunicação ao(s) controlador(es) afetado(s) em prazo proporcional à severidade.
- Preservação de evidências e relatório pós-incidente.

## 10. Direitos dos titulares (LGPD art. 18)

Como o core **não armazena identidade civil**, os direitos são exercidos via controlador, com `session_id`/`jti`/`external_user_ref` opaco como chave:

- Confirmação de tratamento.
- Acesso aos dados técnicos retidos.
- Eliminação dos dados quando aplicável e quando não houver retenção legal/contratual.
- Revisão de decisão automatizada.
- Portabilidade — limitada à natureza dos dados (metadados de decisão).
- Oposição/contestação conforme base legal.

## 11. Retenção

Detalhes em [`data-retention-policy.md`](./data-retention-policy.md). Resumo de classes:

- `event_90d` — sessões/challenges/eventos operacionais.
- `audit_5y` — `audit_events`, `verification_results`, `result_tokens` (após TTL).
- `legal_hold` — preservação por ordem judicial/regulatória.

## 12. DPO / Contato

- Encarregado AgeKey: `dpo@agekey.com.br` (preencher via contrato).
- Endereço: a definir por entidade contratante.
- Canal de incidentes: `security@agekey.com.br`.

Cada controlador deve indicar seu próprio DPO em sua privacy notice e em seu registro interno de tratamento.

## 13. Datas e versionamento

| Data | Mudança |
|---|---|
| 2026-04-29 | Versão inicial (R1–R11 consolidadas em HML). |
| 2026-05-07 | Reescrita estruturada por seção LGPD; alinhamento com Privacy Guard, Decision Envelope, Safety v1, Consent R5/R6, RLS partições (mig. 030). |

## 14. Conclusão preliminar

O tratamento operado pelo AgeKey é **proporcional** à finalidade declarada quando os controles de minimização (Privacy Guard, Decision Envelope, RLS, retenção) estão ativos. O maior risco residual está em integrações com gateways externos e em uso indevido de campos opacos (`external_user_ref`) para PII pelos integradores. A solução mantém controles técnicos, contratuais e documentais por tenant para mitigar esses riscos.

Este documento **não constitui** uma garantia de inviolabilidade. Trata-se de uma avaliação proporcional baseada em controles técnicos e organizacionais auditáveis na data de versionamento.
