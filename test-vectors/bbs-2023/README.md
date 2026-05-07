# BBS+ test vectors — placeholder

Este diretório está reservado para test vectors oficiais do BBS+ que devem ser baixados de:

1. **IRTF CFRG draft `draft-irtf-cfrg-bbs-signatures`** — appendix com test vectors em formato JSON. Capturar commit hash exato do draft.
2. **W3C Data Integrity BBS Cryptosuite** — test vectors do W3C VC working group.

## Critério para inclusão

- Origem documentada (URL + commit hash + data).
- Licença compatível (geralmente IETF Trust License).
- Cobre happy path + casos de falha.
- Reproduzível com a biblioteca escolhida em `docs/specs/agekey-proof-mode.md` §3.1.

## NÃO incluir test vectors fabricados

Test vectors gerados localmente sem origem oficial **não** podem ser usados como gate de aprovação para produção. Sempre derivar de fonte oficial.

Quando a rodada de implementação real chegar, este README é substituído pelos test vectors com `index.json` apontando para os arquivos.
