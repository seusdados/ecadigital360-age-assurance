# RIPD/DPIA - AgeKey

## 1. Identificação

Produto: AgeKey  
Finalidade: infraestrutura de verificação de elegibilidade etária com preservação de privacidade.  
Controlador: cliente licenciado, conforme caso de uso.  
Operador: AgeKey/empresa provedora, quando processar em nome do cliente.  
Contexto: proteção infantojuvenil, adequação regulatória, controle de acesso a conteúdos, serviços ou funcionalidades por faixa etária.

## 2. Descrição do tratamento

O AgeKey cria uma sessão temporária de verificação, recebe uma prova/attestation/credential ou declaração, valida a política aplicável e emite decisão mínima. O resultado pode ser um token assinado e temporário.

## 3. Dados tratados

Dados necessários:

- tenant_id;
- application_id;
- policy_id;
- session_id;
- nonce/challenge;
- method;
- decision;
- assurance_level;
- reason_code;
- proof artifact hash;
- issuer/provider id;
- JTI do token;
- timestamps;
- logs técnicos minimizados.

Dados que podem existir de forma limitada:

- IP e user-agent para segurança/rate limit;
- external_user_ref opaco fornecido pelo cliente;
- storage path de artefato, sem conteúdo público.

## 4. Dados proibidos no core

- data de nascimento;
- idade exata;
- documento civil;
- CPF/RG/passaporte;
- selfie;
- nome completo;
- endereço;
- telefone;
- e-mail do usuário final;
- payload bruto de documento;
- credencial completa quando não necessária.

## 5. Finalidades

1. Verificar cumprimento de política etária.
2. Emitir evidência mínima auditável.
3. Prevenir replay/fraude.
4. Permitir validação de token.
5. Gerar métricas de uso/billing sem PII.
6. Cumprir obrigações de segurança.

## 6. Bases legais possíveis

A base legal dependerá do cliente e do caso de uso. Possíveis enquadramentos:

- cumprimento de obrigação legal ou regulatória;
- legítimo interesse, quando cabível e balanceado;
- execução de contrato;
- proteção da criança e do adolescente;
- consentimento, quando exigido pelo contexto.

O AgeKey deve permitir configuração e documentação por tenant, mas não deve presumir uma base legal universal.

## 7. Necessidade e proporcionalidade

O desenho do AgeKey reduz coleta porque responde apenas se uma política foi satisfeita. A solução evita armazenar documento, data de nascimento e identidade civil, preservando utilidade operacional e reduzindo risco.

## 8. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| Reidentificação por correlação de sessões | Alta | TTL, hash, external_ref opaco, minimização |
| Vazamento de logs | Alta | logs sem PII, revisão e alertas |
| Tenant breakout | Crítica | RLS, service-only, testes |
| Provider externo coletar excesso | Alta | contratos, subprocessors, minimização no core |
| Token replay | Média/Alta | expiração, JTI, revogação, nonce |
| Uso indevido de fallback | Média | assurance policy e escalonamento |
| Dados sensíveis no external_user_ref | Alta | documentação, SDK helper hash, privacy guard |

## 9. Medidas técnicas

- RLS.
- Nonce de uso único.
- JWS/JWT ES256.
- Key rotation.
- JWKS.
- Rate limiting.
- Storage privado.
- Audit log minimizado.
- Service role server-only.
- Secrets management.
- Retention job.
- Privacy guard tests.

## 10. Medidas organizacionais

- política de retenção;
- contrato com subprocessadores;
- procedimento de incidente;
- revisão de privacy by design;
- pentest;
- controle de acesso;
- treinamento de equipe;
- registro de mudanças.

## 11. Direitos dos titulares

O AgeKey deve permitir que o cliente responda solicitações de:

- confirmação de tratamento;
- informação;
- eliminação quando aplicável;
- revisão de decisão automatizada, quando aplicável;
- oposição ou contestação, conforme base legal.

Como o core não armazena identidade civil, a resposta deve ser feita por session_id/JTI/external_ref opaco fornecido pelo cliente.

## 12. Retenção

Recomendação:

- sessions incompletas: 24 horas;
- challenges: até expiração + janela operacional curta;
- proof artifact storage: mínimo necessário;
- verification_results: 30 a 365 dias conforme contrato/regulação;
- audit_events: conforme necessidade de auditoria;
- billing_events: conforme obrigações fiscais/contratuais.

## 13. Transferências internacionais

Avaliar caso haja:

- provider fora do Brasil;
- Supabase/Vercel em região estrangeira;
- subprocessadores internacionais;
- storage/logs fora da jurisdição do cliente.

## 14. Por que AgeKey não é KYC

KYC (Know Your Customer) é um processo de identificação civil. KYC
exige saber **quem** é o usuário: nome, documento, data de nascimento,
endereço, em alguns casos selfie + biometria. KYC associa uma
identidade civil única a uma conta.

AgeKey é o oposto. AgeKey é uma infraestrutura de **prova de
elegibilidade etária** (age assurance). O AgeKey só responde a uma
pergunta:

> "Esta sessão satisfaz a política X (ex.: 18+)?"

A resposta é uma decisão minimizada (`approved | denied | needs_review`)
mais um token assinado e temporário. AgeKey:

- **NÃO** sabe o nome do usuário,
- **NÃO** guarda CPF, RG, passaporte ou documento civil,
- **NÃO** guarda data de nascimento,
- **NÃO** guarda idade exata,
- **NÃO** guarda selfie ou biometria bruta,
- **NÃO** correlaciona o usuário entre clientes diferentes (cada
  tenant tem seu próprio espaço de `external_user_ref`),
- **NÃO** mantém uma tabela de usuários verificados (nem mesmo
  pseudonimizada).

Quando AgeKey delega para um provedor de gateway (Yoti, Veriff,
Onfido, Serpro, iDwall etc.), o provedor pode realizar KYC do seu
lado conforme contrato com o cliente — mas o **núcleo AgeKey não
recebe nem persiste** nada além de uma decisão minimizada
(`{approved, assurance_level, age_threshold_satisfied,
artifact_hash}`). Esta separação é validada por contrato de adapter,
pelo `assertNoGatewayPii()` e pelo privacy guard de saída.

**Implicação regulatória:** AgeKey reduz a superfície de tratamento
LGPD/GDPR do cliente. Em vez de o cliente armazenar documento + DOB,
ele armazena apenas o resultado e o token. Isso reduz risco de
incidente e simplifica resposta a direitos do titular.

## 15. Como auditar uma decisão sem conhecer a identidade civil

Auditoria de decisão automatizada (LGPD art. 20) é compatível com
AgeKey desde que o cliente preserve a chave opaca de correlação
(`external_user_ref`) e o `jti` do token. Fluxo:

1. **Cliente recebe solicitação do titular** (ex.: "por que minha
   verificação foi negada?"). O titular se identifica perante o
   cliente como faria em qualquer outro fluxo, com os meios que o
   cliente já usa.
2. **Cliente resolve a sua chave interna → `external_user_ref`** que
   foi enviado ao AgeKey. Esse mapping é responsabilidade do cliente
   e nunca chega ao AgeKey.
3. **Cliente consulta o painel AgeKey** filtrando por
   `external_user_ref`, ou diretamente por `session_id` / `jti` se
   armazenou.
4. **Painel mostra a decisão minimizada:** `decision`, `reason_code`,
   `assurance_level`, `method`, `policy.version`, timestamps,
   `issuer_did` quando aplicável, `artifact_hash` quando aplicável.
   Nada de PII do titular.
5. **Cliente compõe a resposta** ao titular juntando o seu próprio
   contexto (qual conta, quando) com a decisão AgeKey.
6. **Para revisão humana:** o cliente pode reabrir uma sessão ou
   pedir nova verificação. AgeKey não atribui culpa por DOB porque
   AgeKey não sabe DOB. A revisão se faz na decisão e no método.

Esse modelo respeita LGPD/GDPR sem precisar centralizar identidade
civil no AgeKey, e por isso o operador AgeKey só consegue responder
direitos de titular **através do cliente** — `subprocessors-register.md`
e o DPA refletem essa cadeia.

## 16. Vocabulário — minimização, pseudonimização, unlinkability

Importante: **AgeKey NÃO é "anonimização perfeita"**. Não existe
anonimização perfeita em sistemas reais. O que AgeKey oferece é:

- **Minimização** (LGPD art. 6º, III; GDPR art. 5(1)(c)) — coletar
  apenas o necessário (sessão, decisão, hash de artefato, política,
  timestamps). DOB, documento, selfie, nome, endereço, e-mail e
  telefone do usuário final **não** são necessários e por isso são
  **proibidos por contrato e por privacy guard**.
- **Pseudonimização** (LGPD art. 13, GDPR art. 4(5)) — quando o
  cliente envia `external_user_ref`, este DEVE ser uma referência
  opaca (ex.: HMAC do user-id interno do cliente com chave que o
  AgeKey não conhece). AgeKey nunca recebe a chave nem o user-id
  bruto, então não tem como reverter.
- **Unlinkability por design** — o mesmo titular verificado em dois
  clientes AgeKey diferentes terá `external_user_ref` distintos, em
  tenants distintos, com policies distintas. Não há tabela
  consolidada de "usuários AgeKey verificados". Isso reduz
  correlação cross-tenant.

A solução **reduz identificabilidade**, mas o cliente continua sendo
o controlador da identidade civil do seu próprio usuário. Esse é o
limite honesto.

## 17. Conclusão preliminar

O tratamento é proporcional se a arquitetura de minimização for
preservada. O maior risco está em integrações com gateways e no uso
indevido de campos opacos para PII. A solução deve manter controles
técnicos, contratuais e documentação por tenant.
