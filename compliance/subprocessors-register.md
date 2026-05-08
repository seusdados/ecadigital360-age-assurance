# Registro de Subprocessadores — AgeKey

> Versão: 2026-05-07.
> Atualizar a cada mudança de subprocessador, finalidade ou jurisdição.
> Lista pública para fins de transparência LGPD/GDPR.

## 1. Conceito

Subprocessador = terceiro contratado pela AgeKey (operadora) para auxiliar no tratamento de dados em nome do controlador (tenant). Cada subprocessador opera sob contrato (DPA) com cláusulas alinhadas a LGPD e GDPR.

## 2. Lista de subprocessadores ativos

### 2.1 Supabase (PostgreSQL gerenciado, Auth, Storage, Edge Functions)

| Campo | Valor |
|---|---|
| Finalidade | Banco de dados, autenticação operacional do painel admin, armazenamento privado de artefatos hashados, runtime de Edge Functions. |
| Categorias de dados tratadas | Dados técnicos minimizados conforme RIPD §4 — `tenant_id`, `session_id`, `external_user_ref` opaco, hashes de artefato, metadados de Safety, contato criptografado do *guardian* (Vault `pgsodium`). **Não** trata PII direta de usuário final. |
| Jurisdição/Região | Configurável por projeto. PROD/HML AgeKey: AWS São Paulo (`sa-east-1`) quando viável; configuração efetiva registrada em `infrastructure/`. |
| Salvaguardas | DPA Supabase; cláusulas-padrão LGPD/GDPR; isolamento por projeto (HML ≠ PROD); RLS aplicado pelo AgeKey; criptografia em repouso e em trânsito. |
| Contato | `https://supabase.com/legal/dpa` |
| Status | Ativo. |

### 2.2 Vercel (hosting do painel, site institucional, edge runtime de assets)

| Campo | Valor |
|---|---|
| Finalidade | Hospedagem de `apps/admin` (painel), site público, edge cache. |
| Categorias de dados tratadas | Logs técnicos de requisição (IP, user-agent, path), assets estáticos. **Sem** PII de usuário final em payload visível ao Vercel — payloads sensíveis trafegam direto às Edge Functions Supabase via `https`. |
| Jurisdição/Região | Edge global; preferência por região com adequação reconhecida. |
| Salvaguardas | DPA Vercel; cláusulas-padrão; logs sem PII; revisão de variáveis de ambiente em `apps/admin/`. |
| Contato | `https://vercel.com/legal/dpa` |
| Status | Ativo. |

### 2.3 GitHub (código-fonte, CI, issues)

| Campo | Valor |
|---|---|
| Finalidade | Hospedagem de código, revisão por pull request, execução de GitHub Actions (CI/CD). |
| Categorias de dados tratadas | Código-fonte, logs de build, metadados de PR, identidades de colaboradores internos. **Não** trata dados de usuário final. |
| Jurisdição/Região | EUA (Microsoft/GitHub). |
| Salvaguardas | DPA GitHub; segredos armazenados como `Actions secrets` cifrados; políticas internas vedam commit de credenciais. |
| Contato | `https://docs.github.com/en/site-policy/privacy-policies` |
| Status | Ativo. |

### 2.4 Cloudflare (CDN/DNS/proxy — quando aplicável)

| Campo | Valor |
|---|---|
| Finalidade | DNS gerenciado para `agekey.com.br`; eventual proxy/CDN; proteção contra abuso. |
| Categorias de dados tratadas | Logs de DNS, IP de origem, user-agent. Sem PII de usuário final. |
| Jurisdição/Região | Edge global. |
| Salvaguardas | DPA Cloudflare; cláusulas-padrão; logs de proxy minimizados; sem armazenamento prolongado de payloads. |
| Contato | `https://www.cloudflare.com/cloudflare-customer-dpa/` |
| Status | Ativo (configuração de DNS conforme `2c83dc2 infra(dns,proxy): finalize agekey.com.br`). |

### 2.5 Provedor OTP (relay HTTPS — R5)

| Campo | Valor |
|---|---|
| Finalidade | Entrega de OTP ao guardian via SMS/voz/e-mail durante fluxo de Parental Consent. |
| Categorias de dados tratadas | Apenas contato do **guardian** (não do menor) e o código OTP, cifrado em repouso via `pgsodium` Vault no AgeKey antes do envio. |
| Jurisdição/Região | A definir por integração. Cliente pode exigir provider específico/regional. |
| Salvaguardas | DPA com o provider; cláusulas-padrão; flag `consent.otp.real_provider` controla habilitação; `agekey.otp_relay_url` e `agekey.otp_relay_token` em GUC server-side. |
| Contato | A documentar quando o provider efetivo for selecionado. |
| Status | **Pendente** — atualmente em modo eager-fail até configuração efetiva. |

### 2.6 Issuers / gateways de elegibilidade etária (quando contratados)

| Campo | Valor |
|---|---|
| Finalidade | Quando o caso de uso exigir prova baseada em documento ou credencial verificável, o tratamento documental é delegado a *issuer* externo. |
| Categorias de dados tratadas | Dados que dependem do provider (documento, biometria) — **fora** do core do AgeKey, que recebe apenas hash + decisão. |
| Jurisdição/Região | Conforme provider. |
| Salvaguardas | DPA específico exigido por tenant; revisão pré-contratação; minimização imposta no core (Privacy Guard). |
| Contato | A registrar caso a caso. |
| Status | Pendente seleção por tenant. |

### 2.7 E-mail transacional (notificações operacionais)

| Campo | Valor |
|---|---|
| Finalidade | Notificações operacionais a admins do tenant (alertas de incidente, relatórios). |
| Categorias de dados tratadas | E-mail de pessoal **interno** do controlador. **Não** envia ao usuário final salvo regra contratual específica. |
| Jurisdição/Região | A definir por integração. |
| Salvaguardas | DPA com o provider; lista de destinatários minimizada. |
| Status | A configurar. |

## 3. Procedimento para alteração de subprocessador

1. Avaliação interna de risco (DPO).
2. Atualização deste registro com a data e versão.
3. Notificação ao(s) controlador(es) afetado(s) com antecedência razoável (preferencialmente ≥ 30 dias).
4. Direito de objeção do controlador conforme contrato.

## 4. Histórico

| Data | Mudança |
|---|---|
| 2026-04-29 | Versão inicial (tabela única). |
| 2026-05-07 | Reescrita por subprocessador com finalidade, dados, jurisdição, salvaguardas e contato. |

## 5. Referências

- [`ripd-agekey.md`](./ripd-agekey.md) §8 — Transferência internacional.
- [`data-retention-policy.md`](./data-retention-policy.md).
- LGPD art. 33–36 (transferência internacional); art. 39 (operador).
