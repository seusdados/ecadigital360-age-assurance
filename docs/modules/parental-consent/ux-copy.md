# Copy UX — AgeKey Parental Consent (PT-BR)

> Linguagem direta, em português do Brasil. Nada de promessas absolutas.

## Linguagem permitida

- "consentimento parental auditável"
- "política satisfeita"
- "responsável por canal verificado"
- "prova mínima"
- "token assinado"
- "revogação de consentimento"
- "privacidade por design"
- "minimização de dados"

## Linguagem proibida

- "KYC infantil"
- "identificação civil de criança"
- "validamos documento do menor"
- "armazenamos idade real"
- "banco de responsáveis legais"
- "anonimização perfeita garantida"
- "verificação infalível"

## Tela 1 — convite ao responsável

Título: **Consentimento parental — AgeKey**

Subtítulo: Esta plataforma pediu seu consentimento como responsável legal
antes de liberar uma funcionalidade para a pessoa menor de idade que você
representa.

Bullets:
- Vamos verificar o canal por onde você recebeu este link.
- Vamos enviar um código curto que expira em 10 minutos.
- Vamos mostrar exatamente o que será permitido.
- Você pode revogar seu consentimento a qualquer momento.

CTA: "Continuar".

Microcopy de borda:
- "AgeKey nunca pede documento, foto, dados bancários ou informação de saúde."

## Tela 2 — coleta do canal

Título: **Como podemos te chamar?**

Campo: Endereço de e-mail OU número de telefone (escolha um).

Microcopy:
- "Vamos enviar um código de 6 dígitos pelo canal escolhido."
- "Seu contato fica protegido e nunca é compartilhado com a plataforma
  solicitante em texto legível."

## Tela 3 — código de verificação

Título: **Digite o código que enviamos.**

Microcopy:
- "O código expira em 10 minutos."
- "Se não chegou em 2 minutos, peça um novo." (futuro — botão de reenvio)

Erros:
- "Código incorreto. Tente novamente." (`CONSENT_OTP_INVALID`)
- "Este código expirou. Peça um novo." (`CONSENT_OTP_EXPIRED`)

## Tela 4 — texto do consentimento

Título: **Antes de aceitar, leia com atenção.**

Mostra `consent_text_versions.body_markdown` (renderizado por sanitizer
markdown — nunca HTML cru).

Checkboxes obrigatórios (todos marcados para aceitar):
- "Sou o responsável legal pela pessoa menor de idade representada."
- "Compreendi a finalidade e o escopo desta permissão."
- "Sei que posso revogar este consentimento a qualquer momento."

CTAs:
- "Aceitar e enviar"
- "Recusar"

## Tela 5 — recibo

Título: **Pronto.**

Bullets:
- "Decisão: ✅ Aprovado / ❌ Recusado / ⚠️ Em análise"
- "Recurso liberado: <resource>"
- "Validade: <data formatada>"
- "Identificador deste recibo: <consent_token_id em fonte mono>"

CTA: "Voltar para a plataforma" (usa `return_url` quando presente).

## Painel admin — labels

- "Consentimento parental"
- "Pedidos de consentimento recentes"
- "Versões de texto publicadas"
- "Decisão" / "Status" / "Risco" / "Razão" / "Solicitado" / "Expira"

Sem expor:
- contato do responsável,
- texto do contato,
- OTP digest,
- referências externas além do hash.

## Painel parental (futuro)

- "Meus consentimentos"
- "Plataforma" / "Recurso" / "Finalidade" / "Validade"
- Botão "Revogar este consentimento"
- Confirmação obrigatória antes da revogação.

## Erros visíveis ao público

| Reason code | Mensagem PT-BR |
|---|---|
| `CONSENT_NOT_GIVEN` | "Aguardando o responsável." |
| `CONSENT_GUARDIAN_NOT_VERIFIED` | "Não foi possível verificar o canal do responsável." |
| `CONSENT_OTP_INVALID` | "Código incorreto." |
| `CONSENT_OTP_EXPIRED` | "Código expirado." |
| `CONSENT_NEEDS_REVIEW` | "Esta solicitação precisa de uma análise adicional. Você receberá uma resposta em breve." |
| `CONSENT_BLOCKED_BY_POLICY` | "A política da plataforma não permite consentir este recurso para este perfil." |
| `CONSENT_REVOKED` | "Este consentimento foi revogado." |
| `CONSENT_EXPIRED` | "Este consentimento expirou." |
| `CONSENT_RESOURCE_NOT_AUTHORIZED` | "Este consentimento não autoriza este recurso." |
