# Instruções para o agente Gemini - Captura de imagens reais de tela

## Regra principal

Não gerar mockups. Não gerar UI fictícia. Não desenhar telas "como se fossem" AgeKey. Capturar apenas telas reais da ferramenta em ambiente local, staging ou produção.

## Ambientes possíveis

1. Local: `http://localhost:3000`
2. Staging Vercel: URL do preview/projeto
3. Produção: `https://app.agekey.com.br`
4. API docs: `https://docs.agekey.com.br`
5. Verify flow: `https://verify.agekey.com.br`

## Antes de capturar

1. Confirmar qual ambiente está ativo.
2. Entrar com usuário autorizado.
3. Usar tenant de demonstração ou staging.
4. Garantir que não aparecem segredos.
5. Se houver API key/token, ocultar antes da captura.
6. Se a tela não estiver implementada, registrar como pendente e não inventar.

## Capturas obrigatórias

### 1. Login

Objetivo: mostrar acesso institucional.

Enquadramento: tela inteira, sem barra do navegador se possível.

### 2. Dashboard

Objetivo: mostrar visão executiva.

Elementos esperados:

- total de verificações;
- aprovações;
- métodos;
- eventos recentes.

### 3. Applications/API keys

Objetivo: mostrar integração técnica.

Ocultar:

- API key;
- secrets;
- IDs sensíveis.

### 4. Policies

Objetivo: mostrar política etária.

Capturar:

- policy 13+, 16+, 18+;
- assurance level;
- métodos permitidos.

### 5. Verification session

Objetivo: mostrar sessão e status.

Capturar:

- session id parcialmente oculto;
- status;
- method;
- decision;
- reason code.

### 6. Token verify

Objetivo: mostrar validação de AgeKey Token.

Capturar:

- valid true/false;
- decision;
- expiração;
- sem PII.

### 7. Audit log

Objetivo: mostrar governança.

Capturar:

- eventos;
- timestamp;
- actor;
- sem PII.

### 8. Widget/verify flow

Objetivo: mostrar experiência do usuário.

Capturar:

- tela de início;
- consentimento;
- resultado aprovado/negado.

## Redações/blur obrigatórios

Aplicar blur em:

- e-mails;
- tokens;
- API keys;
- service keys;
- JWT completo;
- tenant IDs;
- application IDs;
- URLs internas não públicas;
- nomes pessoais.

## Formato de saída

Gerar arquivos PNG com nomes:

```txt
01-login.png
02-dashboard.png
03-applications-api.png
04-policies.png
05-verification-session.png
06-token-verify.png
07-audit-log.png
08-verify-flow-start.png
09-verify-flow-result.png
```

## Prompt operacional curto

"Capture screenshots reais da aplicação AgeKey no ambiente informado. Não gere mockups. Não invente telas. Se uma tela não existir, crie uma anotação textual de pendência. Oculte segredos e dados pessoais. Use os nomes de arquivo definidos em `docs/commercial/gemini-screen-capture-instructions.md`."
