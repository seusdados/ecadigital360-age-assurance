# AgeKey — Product Language Guide

This guide defines the public-facing vocabulary AgeKey uses across the
admin panel, SDK docs, marketing site, sales decks and customer
communication. It exists so we don't accidentally rebrand AgeKey as
KYC, or imply that AgeKey holds civil identity it does not hold.

> **Hard rule:** every change to a label, button, page heading, or
> public claim must pass this guide. When in doubt, prefer
> understatement to overstatement. The product wins by being correct.

## 1. Tom institucional

- **Direto, técnico, honesto.** Sem hype.
- **Privacidade primeiro.** Toda comunicação deve refletir que o
  AgeKey é uma infraestrutura de elegibilidade etária, não de
  identificação civil.
- **Aceitar limites visíveis.** Quando algo é reference
  implementation, dizer reference. Quando algo é roadmap, dizer
  roadmap. Quando algo depende de credenciais reais do cliente,
  dizer.
- **Sem "AI-powered", sem "magic", sem "100% à prova de fraude".**
  Riscos residuais existem; o produto reduz risco, não elimina.

## 2. Termos preferidos vs. termos a evitar

| Evitar | Preferir | Por quê |
|---|---|---|
| "verificar identidade" | "verificar elegibilidade etária" | AgeKey não verifica identidade civil. |
| "verificação de idade" | "prova de elegibilidade etária" / "age assurance" | termo técnico mais preciso e alinhado com NIST 800-63 / EUDI. |
| "saber a idade do usuário" | "atender à política etária" / "satisfazer threshold" | AgeKey não revela idade exata. |
| "documento validado" | "prova/atestado validado" / "credential/JWS verificado" | "documento" implica RG/CPF; o AgeKey core não recebe documento. |
| "KYC" | "age assurance" / "policy enforcement" | KYC é processo distinto e mais invasivo. |
| "onboarding do usuário" | "onboarding do tenant" / "primeiros passos do cliente" | "usuário" no AgeKey é o titular verificado, não a integração. |
| "anonimização" (sozinho) | "minimização" / "pseudonimização" / "redução de identificabilidade" | anonimização perfeita não existe; usar termo técnico correto. |
| "100% privado" / "criptografado por padrão" (sem qualificador) | "minimização por contrato" / "ES256 + JWKS" / "RLS + service-role server-only" | claims técnicos exigem qualificador. |
| "ZKP real" hoje | "predicate attestation (JWS)" + "BBS+ contract-ready (não habilitado)" | falsa cripto = risco regulatório. |
| "provider Yoti integrado" hoje | "provider Yoti com adapter contract; credenciais reais pendentes" | integração só "está pronta" quando há test vectors + creds. |
| "compliant com LGPD" | "minimização compatível com LGPD; controlador é o cliente" | compliance é ato do controlador, não do operador apenas. |
| "scaneie seu documento" | "envie sua prova de elegibilidade etária" / "use sua wallet" | UI do widget nunca pede documento ao núcleo AgeKey. |
| "tire uma selfie" | (não aplicável; AgeKey não pede selfie) | apenas providers de gateway lidam com selfie no lado deles. |

## 3. Termos proibidos em UI pública

Estes termos NÃO devem aparecer em:

- labels do painel admin,
- copy do widget,
- response messages do SDK,
- mensagens de erro mostradas ao usuário final,
- documentação pública,
- material comercial.

Lista:

- `data de nascimento` / `birthdate` / `dob` / `nascimento`
- `idade exata` / `exact age`
- `documento`, `CPF`, `RG`, `passaporte`, `id_number`, `civil_id`
- `nome completo` / `full_name`
- `selfie`, `face`, `biometria` (exceto se estritamente referente a
  um gateway externo, com qualificador "no provider")
- `endereço`, `address`, `CEP`

Exceção controlada: `age_threshold` é permitido (descreve a
política, não o titular).

## 4. Claims comerciais seguros (whitelist)

Você pode dizer:

- "AgeKey é uma infraestrutura de age assurance privacy-first."
- "AgeKey emite uma decisão minimizada — não armazena documento,
  data de nascimento, idade exata ou identidade civil."
- "AgeKey é multi-tenant e white-label, com adapters plugáveis
  para fluxo Wallet/VC, gateway provider e fallback assistido."
- "Tokens AgeKey são JWT ES256 com JWKS rotativo."
- "AgeKey cumpre o princípio de minimização da LGPD."
- "Adapter contract para BBS+ está pronto; o verifier é habilitado
  somente após test vectors validados e auditoria criptográfica."
- "Reduzimos a superfície de tratamento LGPD do cliente."

Você NÃO pode dizer:

- "AgeKey está em compliance com LGPD" (sem o qualificador
  "controlador é o cliente").
- "AgeKey valida documento sem armazenar" (núcleo AgeKey não
  valida documento; quem valida é o gateway, do lado do gateway).
- "Anonimização total" / "100% à prova de fraude" / "ZKP em
  produção" (até cumprir checklist).

## 5. Mensagens de erro padrão (proposta)

| Cenário | Mensagem ao usuário | Comentário |
|---|---|---|
| `decision=denied` por ausência de prova | "Não foi possível concluir a verificação. Tente novamente ou use outro método." | NUNCA dizer "sua idade é X" ou "seu documento foi rejeitado". |
| `decision=needs_review` | "Sua verificação precisa de uma revisão manual. Acompanhe pelo status da sessão." | sem expor motivo civil. |
| Sessão expirada | "Esta sessão de verificação expirou. Inicie uma nova." | gerar nova session_id. |
| Token revogado | "Sua sessão de verificação foi revogada. Faça uma nova verificação para continuar." | sem expor motivo. |

## 6. Convenções do painel admin

- Páginas: `Verifications`, `Applications`, `Policies`, `Issuers`,
  `Audit`, `Billing`, `Settings`. **Nunca** `Users` (não temos
  tabela de usuários finais).
- Em listas, mostrar `external_user_ref` mascarado (apenas hash
  prefix se for hash, ou primeiros 6 chars se for opaco). Nunca
  mostrar como link clicável que sugira "ver perfil do usuário".
- Em detalhe de sessão, mostrar `decision`, `reason_code`,
  `assurance_level`, `method`, `policy.version`, timestamps,
  `issuer_did`, `artifact_hash`. Nunca mostrar `birthdate`,
  `document`, `selfie`, `name`.
- Em audit, registrar quem fez o que, sobre qual `session_id` /
  `jti` / `policy_id` / `application_id`. Nunca registrar PII do
  titular.

## 7. Como propor mudanças neste guia

1. Abrir PR alterando este arquivo.
2. Marcar @product e @security como reviewers.
3. Justificar o porquê (regulatório, comercial, técnico).
4. Atualizar admin/SDK/site se a mudança for de termo público.
5. Não mergear sem assinatura de pelo menos um dos dois reviewers.
