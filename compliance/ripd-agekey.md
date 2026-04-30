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

## 14. Conclusão preliminar

O tratamento é proporcional se a arquitetura de minimização for preservada. O maior risco está em integrações com gateways e no uso indevido de campos opacos para PII. A solução deve manter controles técnicos, contratuais e documentação por tenant.
