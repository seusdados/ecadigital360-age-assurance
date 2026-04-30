# Prompt mínimo para Claude Code

Você está trabalhando no AgeKey, repositório `seusdados/ecadigital360-age-assurance`.

Não transforme AgeKey em KYC. Não colete documento, nome, selfie, data de nascimento ou idade exata. O produto deve provar elegibilidade etária por sessão, prova, decisão e token temporário.

Leia primeiro:

1. `.claude/AGEKEY_IMPLEMENTATION_HANDOFF.md`
2. `docs/audit/current-state.md`
3. `docs/specs/agekey-token.md`
4. `docs/manual/agekey-manual.md`
5. `docs/architecture/open-source-foundation.md`

Depois implemente o que for necessário para integrar os novos contratos e testes:

- exportar novos módulos de `packages/shared` e `packages/adapter-contracts`;
- adicionar testes de privacy guard;
- validar typecheck;
- não implementar BBS+ real sem lib/test vectors;
- não implementar provider real sem credenciais e documentação oficial;
- provider sem configuração deve falhar explicitamente, nunca aprovar.

Critérios:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- nenhum payload público com PII
- documentação atualizada
