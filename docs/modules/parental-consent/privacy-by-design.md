# Privacidade por design — AgeKey Parental Consent

## Princípios aplicados

1. **Minimização** — só o necessário para a decisão.
2. **Purpose binding** — `purpose_codes` e `data_categories` são enumerados
   e assinados no token; "consentimento genérico" é proibido.
3. **Reversibilidade controlada** — revogação imutável a qualquer momento.
4. **Transparência** — `consent_text_hash` no token vincula o aceite à
   versão exata do texto, e a versão é versionada e publicada.
5. **Defesa em profundidade** — Zod strict + privacy guard + CHECK SQL.
6. **Não-correlatabilidade** — chave HMAC por-tenant impede que um vazamento
   permita correlação cross-tenant.

## Mapeamento LGPD (Brasil)

| Art. | Como o módulo atende |
|---|---|
| Art. 7º, I (consentimento livre, informado, inequívoco) | Texto versionado + flags de declaração obrigatórias + canal verificável |
| Art. 8º, §6º (consentimento revogável) | `parental_consent_revocations` + endpoint público de revogação |
| Art. 14 (criança e adolescente) | Pré-requisito explícito de canal do responsável + assurance proporcional ao risco |
| Art. 18 (titular tem direito a confirmação, acesso, anonimização, eliminação) | Painel admin tenant-side + endpoint de revogação |
| Art. 46 (segurança) | RLS + HMAC por-tenant + privacy guard + CHECK constraints |
| Art. 50 (boas práticas) | Append-only em revocations, audit_events, retention class regulatory |

## Mapeamento GDPR (UE)

- **Art. 6 + Art. 8**: lawful basis = consentimento parental quando aplicável.
- **Art. 7**: prova de consentimento (consent_text_hash + proof_hash).
- **Art. 13/14**: textos versionados com finalidade, categoria, retenção.
- **Art. 17**: direito ao apagamento via revogação (apaga utilidade do token,
  não os registros de auditoria, que são lawful por Art. 6(c) /
  obrigação legal).
- **Art. 25 (privacy by design)**: minimização e proteção desde a engine.

## Mapeamento COPPA (EUA)

- Verifiable Parental Consent: o módulo NÃO oferece "knowledge-based
  authentication" pleno. Em risco alto, `assurance_level=high` exige
  método mais forte (gateway homologado ou SSO escolar) — gated por
  `AGEKEY_CONSENT_GATEWAY_PROVIDERS_ENABLED`.

## Dados que NÃO são coletados

- Não há coluna para nome do responsável.
- Não há coluna para nome do menor.
- Não há coluna para idade exata. (`risk_tier` é derivado da policy do
  tenant, não da idade do menor.)
- Não há coluna para foto, selfie, biometria.
- Não há coluna para documento.
- Não há coluna para endereço.

## Dados que SÃO coletados (e como são protegidos)

| Dado | Proteção |
|---|---|
| `external_user_ref` (opaco do RP) | Detect PII na borda; HMAC antes de persistir; armazenado em texto **apenas** se o RP enviou um valor opaco que passou no detect |
| Contato do responsável (email/telefone) | Hash HMAC + ciphertext opcional (key da Vault); NUNCA em token/webhook/log |
| OTP | Apenas digest HMAC; nunca em log; expira em 10min |
| `consent_text` (markdown) | Em `consent_text_versions.body_markdown`; o token guarda só o hash |
| `client_ip`, `user_agent` | Coletados para risk scoring; passa pelo privacy guard antes de virarem JSON em log |

## Direitos do responsável

- **Acessar** o consentimento que concedeu — futuramente via painel
  parental.
- **Revogar** — `POST /v1/parental-consent/:consent_token_id/revoke`.
- **Receber recibo** — `consent_text_hash + proof_hash + iat + exp` no
  token, recuperáveis via verify endpoint.
