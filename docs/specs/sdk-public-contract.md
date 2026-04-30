# Contrato público dos SDKs AgeKey

## Princípio

SDKs AgeKey são clientes finos. Eles não processam identidade civil, não guardam documento e não calculam idade. Eles abrem sessão, conduzem o fluxo e devolvem decisão/token.

## Operações mínimas

### createSession

Cria sessão AgeKey.

### completeSession

Completa sessão com método aceito.

### verifyToken

Valida token online.

### buildVerificationUrl

Monta URL para fluxo web seguro.

## Dados proibidos no SDK

- DOB;
- documento;
- selfie;
- nome;
- CPF/RG/passaporte;
- idade exata.

## Web

Prioridade comercial: SDK Web e widget, pois viabilizam integração rápida e demo.

## Mobile

SDKs nativos devem usar Custom Tabs/Safari/ASWebAuthenticationSession ou mecanismo equivalente. Evitar WebView opaca sempre que possível.
