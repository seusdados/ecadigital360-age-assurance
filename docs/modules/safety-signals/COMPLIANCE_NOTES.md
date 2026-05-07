# Notas de conformidade — AgeKey Safety Signals

## LGPD (Brasil)

- **Art. 6º (princípios)**: minimização ✅ (metadata-only),
  finalidade ✅ (`risk_category` + `event_type`), prevenção ✅ (rules
  proporcionais), accountability ✅ (audit_events + payload_hash).
- **Art. 7º (bases legais)**: legítimo interesse na proteção de
  menores; processamento de dados pessoais reduzido a hashes opacos.
- **Art. 14 (criança e adolescente)**: o módulo Safety **não cria
  dados pessoais novos do menor**. Os refs hashed são derivados do
  identificador opaco que a relying party já mantinha. A liberação de
  recurso protegido continua via Core + Consent.
- **Art. 18 (direitos do titular)**: a tabela `safety_events` é
  append-only, mas os dados são pseudonimizados (HMAC); um titular que
  exercer o direito de eliminação na plataforma cliente revoga o
  identificador opaco lá, e o efeito útil dos hashes existentes é
  perdido (quebra de linkage).
- **Art. 46 (segurança)**: RLS, HMAC por-tenant, privacy guard, CHECK
  SQL.

## GDPR (UE)

- **Art. 5 (princípios)** e **Art. 25 (privacy by design)**: idem LGPD.
- **Art. 6(1)(f) (legítimo interesse)** + **Art. 8 (consentimento de
  criança)**: sinal de risco em interações com menores é
  interesse legítimo proporcional, e quando o sinal exige liberação
  posterior, o módulo Consent fornece a base legal específica.
- **Art. 22 (decisão automatizada)**: o módulo NÃO toma decisão final
  sobre o usuário de maneira não-revisável. Decisões severas (`hard_block`,
  `parental_consent_required`) sempre admitem revisão humana
  (`safety_alerts.human_review_required`).

## COPPA (EUA)

- O módulo NÃO coleta dados de menores diretamente — recebe metadados
  da plataforma cliente. Para liberar funcionalidade que dependa de
  consentimento parental verificável, integra com AgeKey Consent.

## DSA (Digital Services Act, UE)

- **Art. 14 (notice & action)**: `safety_alerts` com
  `human_review_required` mapeia para a fila de moderação humana da
  plataforma; o evento `safety.alert_created` notifica o cliente em
  webhook assinado.
- **Art. 17 (statement of reasons)**: cada alerta carrega
  `reason_codes` canônicos que o cliente pode mostrar no próprio fluxo.

## Marco Civil da Internet / ECA (Brasil)

- O módulo NÃO fornece **prova plena** para fins judiciais. Evidence
  artifacts são apenas hashes — qualquer caso real precisa de cadeia
  de custódia formalizada com a plataforma cliente, fora do AgeKey.

## Boas práticas adicionais

- **Sem LLM externa** sobre interações de menores no MVP.
- **Sem reconhecimento facial** em qualquer rodada.
- **Sem score universal** cross-tenant.
- **Sem captura de tráfego TLS** ou inspeção fora da aplicação cliente.
- **Linguagem comercial**: nunca prometer "detecção de crime", "prova
  judicial", "monitoramento total" — texto auditável em `ux-copy.md`.
