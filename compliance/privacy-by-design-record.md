# Privacy by Design Record - AgeKey

## Decisão 1 - Não criar tabela de usuários finais

Motivo: evitar transformação do produto em base de identidade.

Status: obrigatório.

## Decisão 2 - Persistir hash de artefato, não prova bruta

Motivo: preservar integridade auditável sem reter conteúdo sensível.

Status: implementado no modelo.

## Decisão 3 - Token sem idade exata

Motivo: a idade real não é necessária para decisão de acesso.

Status: obrigatório.

## Decisão 4 - External user ref opaco

Motivo: permitir correlação pelo cliente sem expor identidade ao AgeKey.

Controle adicional recomendado: helper HMAC no SDK.

## Decisão 5 - Service role apenas server-side

Motivo: proteger o banco e RLS.

Status: obrigatório.

## Decisão 6 - Fallback com assurance low

Motivo: evitar que autodeclaração satisfaça políticas de alto risco.

Status: policy engine deve reforçar.

## Decisão 7 - BBS+ sem falsa implementação

Motivo: segurança criptográfica exige test vectors e revisão.

Status: adapter contract/future.
