# Test vectors

Não usar vetores inventados para declarar produção.

## ZKP/BBS+

Incluir somente quando houver:

- issuer real;
- wallet/profile;
- proof válido;
- proof inválido;
- nonce mismatch;
- expired proof;
- revoked credential;
- predicate false;
- curve unsupported.

## Gateway

Para cada provider:

- callback válido;
- callback com assinatura inválida;
- nonce mismatch;
- decisão negada;
- provider unavailable;
- payload contendo PII que deve ser descartado.
