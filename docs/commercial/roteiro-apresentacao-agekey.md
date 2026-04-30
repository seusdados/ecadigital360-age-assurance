# Roteirização da apresentação institucional/comercial - AgeKey

## Objetivo da apresentação

Vender AgeKey como infraestrutura de elegibilidade etária com privacidade. A narrativa deve afastar o produto de KYC, biometria compulsória e coleta excessiva de dados.

Duração sugerida: 12 a 18 minutos.

Público-alvo:

- edtechs;
- plataformas de conteúdo;
- redes sociais;
- marketplaces;
- jogos;
- publishers;
- empresas com obrigação de proteção infantojuvenil;
- consultorias e escritórios que atendem clientes regulados.

## Slide 1 - Abertura

Título: "AgeKey: verificação etária sem exposição de identidade"

Mensagem: plataformas digitais precisam saber se uma regra etária foi satisfeita, mas não deveriam precisar conhecer o documento ou a data de nascimento do usuário.

Fala sugerida: "O AgeKey nasceu para resolver uma tensão que vai crescer: proteger crianças e adolescentes sem transformar cada acesso digital em um processo invasivo de identificação."

Imagem real de tela: landing ou dashboard inicial do AgeKey já implantado.

Instrução para Gemini: capturar tela real do domínio ou preview Vercel. Não gerar mockup. Se a tela ainda não existir, registrar "tela indisponível" e não inventar interface.

## Slide 2 - O problema

Título: "O mercado está preso entre risco regulatório e coleta excessiva"

Pontos:

- leis e políticas de plataforma exigem controle etário;
- soluções tradicionais pedem documento, selfie ou dados demais;
- UX ruim derruba conversão;
- retenção de dados aumenta risco LGPD/GDPR;
- auditoria é fraca quando tudo vira processo manual.

Fala: "A maioria das soluções resolve um problema criando outro: reduz risco de idade e aumenta risco de privacidade."

Imagem real: tela de fluxo AgeKey mostrando consentimento/minimização, se implementada.

## Slide 3 - A tese

Título: "Não precisamos saber quem a pessoa é. Precisamos saber se a regra foi satisfeita."

Mensagem-chave:

- AgeKey valida elegibilidade, não identidade;
- o cliente recebe decisão mínima;
- o usuário não expõe dados civis;
- o token expira.

Imagem: tela real de token verify ou resposta JSON no painel/docs.

## Slide 4 - Como funciona

Título: "Sessão, prova, decisão, chave"

Fluxo:

1. cliente cria sessão;
2. AgeKey gera nonce;
3. usuário prova elegibilidade;
4. AgeKey valida;
5. cliente recebe AgeKey Token.

Imagem: diagrama do manual ou tela real da seção de verificação.

## Slide 5 - Métodos suportados

Título: "Quatro caminhos, uma decisão minimizada"

Métodos:

- Gateway;
- Verifiable Credential;
- Predicate/ZKP-ready;
- Fallback controlado.

Fala: "A arquitetura não prende o cliente em um único fornecedor. O AgeKey orquestra métodos de prova conforme risco, jurisdição e maturidade técnica."

Imagem: tela real de policy mostrando métodos permitidos.

## Slide 6 - Privacidade por desenho

Título: "O que não armazenamos é tão importante quanto o que armazenamos"

Não armazenar:

- documento;
- data de nascimento;
- selfie;
- nome civil;
- idade exata.

Armazenar:

- sessão;
- hash de artefato;
- decisão;
- JTI;
- evidência mínima.

Imagem: tela real do audit log sem PII.

## Slide 7 - Para o usuário final

Título: "Menos fricção, mais confiança"

Mensagem:

- o usuário compartilha apenas o necessário;
- fluxo curto;
- linguagem clara;
- prova temporária.

Imagem: tela real do verify flow.

## Slide 8 - Para o cliente

Título: "Integração simples"

Mostrar:

- API key;
- create session;
- complete session;
- verify token;
- webhooks.

Imagem: tela real da documentação/endpoint ou API settings.

## Slide 9 - Segurança e governança

Título: "Construído para auditoria"

Pontos:

- RLS;
- nonce anti-replay;
- JWKS;
- key rotation;
- webhook signature;
- audit events;
- retention;
- pentest readiness.

Imagem: tela real de settings/API ou logs.

## Slide 10 - Casos de uso

Título: "Onde AgeKey entra"

Setores:

- edtech;
- redes sociais;
- streaming;
- jogos;
- marketplaces;
- comunidades;
- conteúdo adulto;
- plataformas governamentais.

Fala: "Quanto maior o risco de exposição indevida de menores, maior o valor de uma camada de elegibilidade sem coleta invasiva."

## Slide 11 - Modelo comercial

Título: "SaaS B2B licenciável"

Planos sugeridos:

- Starter: API + widget + fallback/gateway;
- Business: webhooks, trust policies, relatórios;
- Enterprise: SLA, white-label, compliance pack, integrações dedicadas.

Imagem: tela real de billing/usage, se disponível.

## Slide 12 - Diferencial

Título: "AgeKey não é mais um KYC"

Comparativo:

| Solução tradicional | AgeKey |
|---|---|
| coleta documento | prova política |
| armazena PII | armazena evidência mínima |
| vendor lock-in | adapter architecture |
| UX pesada | métodos graduais |
| risco de base sensível | minimização |

## Slide 13 - Roadmap

Título: "Pronto para evoluir com o ecossistema"

Roadmap:

- SDK Web/widget;
- providers gateway;
- SDKs iOS/Android;
- VC/SD-JWT;
- OpenID4VP;
- BBS+ quando validado;
- trust registry gerenciado.

## Slide 14 - Fechamento

Título: "AgeKey: a chave de idade sem a chave da identidade"

Call to action:

- piloto de 30 dias;
- integração em sandbox;
- avaliação de risco por policy;
- demonstração técnica com API.

Fala final: "AgeKey entrega a prova que a plataforma precisa, sem exigir os dados que ela não deveria guardar."

## Instruções gerais para imagens reais

O agente visual deve capturar screenshots reais da aplicação implantada. Não criar mockups. Não inventar dados. Quando necessário, usar o tenant dev/staging e dados técnicos mínimos. Aplicar blur em API keys, tokens, e-mails, URLs internas sensíveis e IDs de tenant quando exibidos.
