# AgeKey — Pitch deck outline (12 a 15 slides)

Roteiro de pitch deck para uso em rodadas comerciais (B2B SaaS),
captação ou apresentações regulatórias. Cada slide mapeia para uma
captura real (`docs/commercial/screen-capture-shot-list.md`) ou para
um diagrama versionado em `docs/manual/diagrams/`.

> **Princípio:** sem mockup. Sem hype. Sem "100% à prova de fraude".
> Toda promessa pode ser cobrada — então a deck só promete o que o
> repositório entrega hoje, ou o que está no backlog com critério
> de aceite explícito.

---

## Slide 1 — Capa

- **Título:** "AgeKey — Age Assurance privacy-first"
- **Subtítulo:** "Decida elegibilidade etária sem coletar
  identidade civil."
- **Visual:** wordmark AgeKey + screenshot do dashboard demo (S-03).

## Slide 2 — Problema

- **Headline:** "Plataformas precisam saber se a regra etária foi
  cumprida — não precisam saber a identidade civil do usuário."
- **Pontos:**
  - regulação infantojuvenil cresce (LGPD, COPPA, OSA, EUDI ARF);
  - clientes não querem assumir custódia de DOB e documento;
  - KYC tradicional gera atrito, churn e risco de incidente.
- **Visual:** diagrama "antes (KYC pesado) vs depois (AgeKey)" —
  versionado em `docs/manual/diagrams/`.

## Slide 3 — O que é AgeKey

- **Headline:** "Infraestrutura de age assurance, white-label."
- **Pontos:**
  - cria sessão, valida prova/atestado/credencial, retorna decisão
    minimizada e token JWT;
  - multi-tenant, multi-policy, multi-method;
  - SDK Web/Mobile, widget, painel admin.
- **Visual:** diagrama de arquitetura
  (`docs/manual/diagrams/architecture.png`).

## Slide 4 — Modelo de dados (privacidade por construção)

- **Headline:** "O AgeKey core não armazena DOB, documento ou
  identidade civil."
- **Pontos:**
  - tabelas: `verification_sessions`, `verification_results`,
    `result_tokens`, `proof_artifacts`, `audit_events`,
    `billing_events`;
  - **não existe** tabela de usuários verificados;
  - `external_user_ref` é referência opaca do cliente.
- **Visual:** diagrama
  (`docs/manual/diagrams/data_model.png`).

## Slide 5 — Como funciona

- **Headline:** "Sessão → prova → decisão → token."
- **Pontos:**
  - métodos: `zkp` (predicate attestation hoje, BBS+ readiness no
    roadmap), `vc` (W3C VC / SD-JWT-VC), `gateway` (Yoti/Veriff/
    Onfido/Serpro/iDwall), `fallback` (declaração assistida com
    assurance baixo);
  - token JWT ES256 com JWKS rotativo;
  - validação online ou offline.
- **Visual:** diagrama
  (`docs/manual/diagrams/session_lifecycle.png`).

## Slide 6 — Privacy guard ao vivo

- **Headline:** "A defesa de PII é código, não política."
- **Pontos:**
  - `assertPublicPayloadHasNoPii()` é chamado antes de assinar
    token e antes de retornar resposta;
  - testes de regressão garantem que nenhum claim
    `birthdate|cpf|selfie|age|...` chegue ao cliente;
  - lista canônica em `packages/shared/src/privacy-guard.ts`.
- **Visual:** captura do teste passando (terminal) ou snippet de
  código.

## Slide 7 — Painel admin

- **Headline:** "Auditoria sem identidade civil."
- **Pontos:**
  - verifications, applications, policies, issuers, audit, billing,
    settings;
  - reveal-once para API key;
  - i18n pt-BR / en-US / es-ES.
- **Visual:** captura S-07 (verifications list) + S-08 (detail).

## Slide 8 — SDK + widget

- **Headline:** "Embed em horas. Native em dias."
- **Pontos:**
  - `@agekey/sdk-js` (browser + server, Node/Deno/Bun/Edge);
  - `@agekey/widget` (Web Component + React wrapper, iframe
    sandbox com origin allowlist);
  - SDKs iOS/Android como reference implementation
    (validar em Xcode/Android Studio antes de release).
- **Visual:** captura S-13 (widget demo) + snippet React.

## Slide 9 — Integrações de gateway

- **Headline:** "Adapter contract antes de integração real."
- **Pontos:**
  - framework plugável: `GatewayProviderRegistry`;
  - stubs seguros para Yoti/Veriff/Onfido/Serpro/iDwall — falham
    com `GatewayProviderNotConfiguredError` até credenciais reais;
  - resposta normalizada SEM PII para o core.
- **Visual:** trecho do código + fluxograma
  (`docs/manual/diagrams/architecture.png` recortado).

## Slide 10 — Compliance e governança

- **Headline:** "Privacy by design, RIPD pronta, subprocessadores
  publicados."
- **Pontos:**
  - RIPD/DPIA versionada (`compliance/ripd-agekey.md`);
  - registro de subprocessadores
    (`compliance/subprocessors-register.md`);
  - retention policy + incident response playbook;
  - severidade de pentest e go-live blockers documentados.
- **Visual:** lista compacta dos arquivos.

## Slide 11 — Roadmap honesto

- **Headline:** "O que entregamos hoje × o que vem em sequência."
- **Pontos:**
  - **Hoje (P0/P1):** core, SDK Web, widget, painel admin,
    predicate attestation, gateway adapter genérico, RIPD,
    pentest pack, go-live checklist.
  - **Próximo (P2):** providers reais (Yoti/Veriff/Onfido/Serpro/
    iDwall) com credenciais; SD-JWT-VC; OpenID4VP request builder.
  - **Médio prazo (P3):** BBS+/ZKP real após audit + test vectors;
    SDKs iOS/Android validados; multi-region.
- **Visual:** matriz P0/P1/P2/P3.

## Slide 12 — Mercado e pricing

- **Headline:** "Pagamento por evento de decisão concluído."
- **Pontos:**
  - tiers por volume mensal de `verification_results`;
  - methods premium (gateway/ZKP) com adicional;
  - tier free para evaluation com ceiling;
  - white-label como add-on.
- **Visual:** tabela de pricing (vinculada à pricing page real).

## Slide 13 — Por que agora

- **Headline:** "Janela regulatória + janela tecnológica."
- **Pontos:**
  - LGPD, COPPA, UK OSA, EUDI ARF demandam age assurance privacy-
    preserving;
  - wallets (EUDI, gov.br) e SD-JWT-VC tornam VC viável em massa;
  - zero-knowledge sai do laboratório com BBS+ / draft IRTF.

## Slide 14 — Próximos passos

- **Headline:** "Como integrar em 2 semanas."
- **Pontos:**
  - week 1: tenant + applications + policies + smoke test em
    staging;
  - week 2: integração SDK no app real, validação token, webhooks;
  - go-live com pentest + DPO sign-off.
- **Visual:** timeline simples.

## Slide 15 — Equipe + contato

- **Headline:** "Quem está construindo + como falar com a gente."
- **Pontos:**
  - equipe atual + advisors + DPO;
  - contato comercial (`comercial@agekey.com.br`),
  - contato técnico (`security@agekey.com.br`),
  - repositório (privado),
  - status page (`status.agekey.com.br`).

---

## Decks derivados

- **Deck regulatório (8 slides):** S2, S4, S6, S10, S11
  expandidos. Foco em compliance + DPIA.
- **Deck técnico (15-20 slides):** acrescenta diagramas em mais
  detalhe (Edge Functions, RLS, key rotation, JWKS).
- **Deck investimento (10 slides):** S2, S3, S11, S12, S13.

Cada variante deve ser revisada por @product e por @security antes
de uso externo. Não use placeholder de slide ("lorem ipsum") em
material entregue ao cliente.
