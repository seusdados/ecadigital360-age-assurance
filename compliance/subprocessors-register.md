# Registro de Subprocessadores - AgeKey

Este registro deve ser publicado em `agekey.com.br/legal/subprocessors`
ou em página equivalente, e atualizado a cada inclusão / remoção
de subprocessador. Clientes (controladores) devem ser notificados com
antecedência razoável para exercer direito de objeção.

## Subprocessadores ativos

| Subprocessador | Função | Dados envolvidos | Região(ões) | Base legal | Status | Observações |
|---|---|---|---|---|---|---|
| Supabase Inc. | Postgres, Auth, Storage, Edge Functions, Vault | dados técnicos minimizados (sessões, decisões, hashes, JTIs, audit_events) | a definir por projeto (US-East / EU-West / SA-East) | execução de contrato + minimização | ativo | separar projetos staging e production; service_role apenas server-side; ver `infrastructure/supabase-hardening.md` |
| Vercel Inc. | Hosting do painel admin (Next.js), site institucional, docs | logs técnicos de request, assets estáticos | Global Edge (config.) | execução de contrato | ativo | `NEXT_PUBLIC_*` revisado para nunca conter segredo; ver `infrastructure/vercel-deploy.md` |
| GitHub Inc. (Microsoft) | SCM, CI, issue tracking, Actions | código-fonte, logs de build, issues | EUA | execução de contrato | ativo | secrets em GitHub Actions com escopo mínimo; nunca commitar credenciais; signed commits recomendados |
| Provedor de e-mail transacional (a definir) | notificações para admins do tenant (não usuário final) | e-mails de admins de tenants | a definir | execução de contrato | pendente | candidatos: Resend, SES, Postmark; opt-in por tenant |
| Provedor DNS (a definir) | DNS, CAA, DNSSEC, ACME para subdomínios `agekey.com.br` | metadados de zona | global | execução de contrato | pendente | candidatos: Cloudflare, Route53; ver `infrastructure/dns/agekey-dns-plan.md` |

## Subprocessadores opcionais por tenant (gateway providers)

A inclusão de um gateway é decisão **do tenant cliente**. Quando
ativada, o gateway passa a ser subprocessador do cliente (não do
AgeKey core) para o tratamento da sessão correspondente. AgeKey só
recebe a decisão minimizada do gateway.

| Gateway | Função | Dados que o gateway recebe | Região típica | Status |
|---|---|---|---|---|
| Yoti | age estimation / document scan | depende do produto contratado pelo tenant | EU/UK | suporte planejado, sem credenciais reais |
| Veriff | document + liveness | docs + selfie no lado do Veriff | EU | suporte planejado, sem credenciais reais |
| Onfido | document + face match | docs + selfie no lado do Onfido | UK/EU/US | suporte planejado, sem credenciais reais |
| Serpro / DataValid | bases governamentais BR | a depender do contrato Serpro do tenant | BR | suporte planejado, sem credenciais reais |
| iDwall | KYC BR multi-fonte | a depender do contrato iDwall do tenant | BR | suporte planejado, sem credenciais reais |

Em todos os casos acima o adapter AgeKey é hoje um stub seguro
(`ContractOnlyGatewayProvider`) que falha com
`GatewayProviderNotConfiguredError` enquanto credenciais reais e
test vectors não estão presentes.

## Transferência internacional de dados

A inclusão de subprocessadores em jurisdições estrangeiras
(Supabase US/EU, Vercel Global Edge, GitHub US, gateways internacionais)
implica transferência internacional sob LGPD art. 33 e GDPR cap. V.
Mecanismos a depender da combinação:

- decisão de adequação (quando aplicável);
- cláusulas contratuais padrão (CCS / SCC);
- normas corporativas globais;
- consentimento específico em casos limitados.

A escolha do gateway pelo cliente pode mudar a matriz de
transferência. Nessas situações o AgeKey deve:

1. atualizar este registro,
2. notificar os clientes afetados,
3. atualizar `compliance/ripd-agekey.md` §13.

## Histórico de mudanças

| Data | Mudança | Aprovação |
|---|---|---|
| 2026-04-30 | Versão inicial | (a preencher) |

## Como solicitar uma alteração

Abrir issue no repositório `seusdados/ecadigital360-age-assurance`
com label `compliance` e descrever o subprocessador candidato:
função, dados, região, status SCC, contrato/DPA disponível.
