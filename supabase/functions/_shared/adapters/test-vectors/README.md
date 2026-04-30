# BBS+ / BLS12-381 production readiness

Este diretório não deve conter uma implementação falsa de BBS+. Para habilitar BBS+ em produção, exigir:

1. biblioteca criptográfica mantida;
2. build WASM/JS compatível com Deno Edge ou serviço dedicado;
3. test vectors;
4. issuer real;
5. wallet/profile compatível;
6. verificação de nonce/challenge;
7. testes negativos;
8. revisão criptográfica externa;
9. documentação de limitações;
10. razão de aceite de risco.

Enquanto isso, o adapter ZKP deve continuar respondendo `ZKP_CURVE_UNSUPPORTED` para formatos BBS+.
