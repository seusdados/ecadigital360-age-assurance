# CLAUDE.md — Memória persistente do projeto AgeKey

Este arquivo é lido pelo Claude Code em toda sessão. Mudanças aqui valem para todas as conversas futuras.

## Regras de comunicação com o usuário

**O usuário deste projeto é leigo em jargão técnico.** Aplicar TODAS as regras abaixo em toda mensagem:

1. **Nunca usar siglas / IDs internos / códigos** sem explicar antes em linguagem natural.
   - ❌ "AK-P0-04 cobre o gate"
   - ✅ "Os testes que verificam isolamento entre clientes (AK-P0-04 no backlog) já bloqueiam o merge se algo regredir."
2. **Nunca usar abreviações de domínio sem expandir** na primeira menção da resposta:
   - JWT → "token assinado (JWT)"
   - JWKS → "lista pública de chaves de assinatura (JWKS)"
   - RLS → "regras de isolamento por cliente no banco (RLS)"
   - CI → "automação de testes a cada push (CI)"
   - DNS / SPF / DKIM / DMARC / CAA / HSTS / SSRF / PII / DPA / RPO / RTO / PITR → todas devem ter uma frase em português antes da sigla.
3. **Não usar `AK-P0-XX` / `AK-P1-XX`** como rótulo principal em texto explicativo. Quando precisar referenciar, descrever o que é primeiro:
   - ❌ "Falta AK-P0-09"
   - ✅ "Falta o exercício de simulação de incidente crítico (item AK-P0-09 do backlog)"
4. **Não citar nomes de arquivos ou caminhos sem contexto** quando estiver explicando o que falta:
   - ❌ "Atualizar `infrastructure/dns/agekey-dns-plan.md`"
   - ✅ "Atualizar o plano de DNS (arquivo `infrastructure/dns/agekey-dns-plan.md`)"
5. **Tabelas com siglas pesadas** só são aceitas se cada sigla tiver legenda no texto antes da tabela.
6. **Confirmar entendimento antes de mergulhar em detalhes técnicos** quando o usuário fizer pergunta aberta tipo "o que falta".
7. **Linguagem padrão: português do Brasil**, tom direto e objetivo.

## Regras técnicas do projeto

1. Sem criptografia falsa, SDKs validados ou provider real sem DPA assinada.
2. Não comitar `SUPABASE_SERVICE_ROLE_KEY`, secrets reais, ou qualquer credencial de produção.
3. Testes RLS cross-tenant e fuzz do privacy-guard são gates obrigatórios no CI.
4. Estilo de commit: `tipo(escopo): mensagem` (ver `git log --oneline | head -10`).
5. Não quebrar lint, typecheck, vitest, deno test ou build.
6. PRs criados via Claude SEMPRE como draft inicialmente; só vira "ready for review" depois que CI ficar verde.
7. Antes de pushear, rodar `pnpm typecheck && pnpm --filter @agekey/admin build` localmente quando aplicável.

## Estrutura do repositório

- `apps/admin/` — painel Next.js que os clientes usam para gerenciar
- `packages/shared/` — código TypeScript compartilhado (schemas, helpers)
- `packages/adapter-contracts/` — contratos dos adapters de verificação
- `packages/sdk-js/` — SDK JavaScript público
- `packages/widget/` — widget embutível
- `supabase/functions/` — funções backend (Edge Functions em Deno)
- `supabase/migrations/` — migrações do banco
- `infrastructure/` — documentos de infraestrutura
- `compliance/` — documentos de conformidade legal/LGPD
- `security/pentest/` — escopo e templates de pentest
- `docs/implementation/pending-work-backlog.md` — backlog priorizado
