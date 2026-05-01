export type FaqCategoryId =
  | 'sobre'
  | 'usuarios'
  | 'privacidade'
  | 'seguranca'
  | 'zkp-credenciais'
  | 'empresas'
  | 'integracao'
  | 'compliance'
  | 'comercial';

export interface FaqCategory {
  id: FaqCategoryId;
  label: string;
}

export interface FaqItem {
  id: string;
  category: FaqCategoryId;
  question: string;
  answer: string;
}

export const FAQ_CATEGORIES: readonly FaqCategory[] = [
  { id: 'sobre', label: 'Sobre o AgeKey' },
  { id: 'usuarios', label: 'Para usuários' },
  { id: 'privacidade', label: 'Privacidade e dados' },
  { id: 'seguranca', label: 'Segurança' },
  { id: 'zkp-credenciais', label: 'ZKP e credenciais' },
  { id: 'empresas', label: 'Para empresas' },
  { id: 'integracao', label: 'Integração técnica' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'comercial', label: 'Comercial' },
] as const;

export const FAQ_ITEMS: readonly FaqItem[] = [
  // Sobre o AgeKey
  {
    id: 'sobre-o-que-e',
    category: 'sobre',
    question: 'O que é o AgeKey?',
    answer:
      'O AgeKey é uma infraestrutura de verificação de elegibilidade etária. Ele permite que plataformas digitais saibam se um usuário atende a um requisito de idade, como 13+, 16+, 18+ ou 21+, sem necessariamente revelar identidade civil, data de nascimento completa ou documentos pessoais do usuário.',
  },
  {
    id: 'sobre-verificador-identidade',
    category: 'sobre',
    question: 'O AgeKey é um verificador de identidade?',
    answer:
      'Não. O AgeKey não foi desenhado para ser um sistema tradicional de identificação civil. O objetivo principal é verificar elegibilidade etária, não descobrir quem a pessoa é.',
  },
  {
    id: 'sobre-kyc',
    category: 'sobre',
    question: 'O AgeKey é um sistema de KYC?',
    answer:
      'Não no sentido tradicional. KYC geralmente envolve coleta e validação de identidade completa, documento, selfie, CPF, endereço e outros dados sensíveis. O AgeKey pode usar fontes confiáveis de verificação, mas transforma o resultado em uma prova mínima de idade.',
  },
  {
    id: 'sobre-prova-elegibilidade',
    category: 'sobre',
    question: 'O que significa prova de elegibilidade etária?',
    answer:
      'Significa provar que uma pessoa atende a uma regra de idade sem expor todos os dados que normalmente seriam usados para chegar a essa conclusão. Por exemplo: em vez de compartilhar a data de nascimento, o usuário pode provar apenas que é maior de 18 anos.',
  },
  {
    id: 'sobre-tipos-plataforma',
    category: 'sobre',
    question: 'Para que tipos de plataforma o AgeKey serve?',
    answer:
      'O AgeKey pode ser usado por redes sociais, edtechs, jogos, marketplaces, apps, streamings, comunidades online, publishers, plataformas de conteúdo, serviços financeiros, healthtechs e qualquer ambiente digital que precise aplicar regras etárias.',
  },
  {
    id: 'sobre-decide-acesso',
    category: 'sobre',
    question: 'O AgeKey decide se o usuário pode acessar um serviço?',
    answer:
      'Não sozinho. A plataforma cliente define sua política de acesso, como “este conteúdo exige 18+”. O AgeKey verifica se o usuário cumpre aquela regra e retorna um resultado técnico para a plataforma. A decisão final de liberar, limitar ou bloquear o acesso é da plataforma cliente.',
  },

  // Para usuários
  {
    id: 'usuarios-como-usar',
    category: 'usuarios',
    question: 'Como o usuário usa o AgeKey?',
    answer:
      'Quando uma plataforma precisa confirmar uma idade mínima, o usuário é direcionado para um fluxo simples de verificação. Esse fluxo pode ocorrer por meio de widget, página segura, carteira digital, credencial verificável ou parceiro de atestação.',
  },
  {
    id: 'usuarios-precisa-documento',
    category: 'usuarios',
    question: 'O usuário precisa enviar documento?',
    answer:
      'Nem sempre. O AgeKey foi desenhado para reduzir a necessidade de envio direto de documentos. Em alguns cenários, a prova pode vir de uma credencial digital, wallet, atestador confiável ou prova criptográfica.',
  },
  {
    id: 'usuarios-precisa-data-nascimento',
    category: 'usuarios',
    question: 'O usuário precisa informar a data de nascimento?',
    answer:
      'A lógica do AgeKey é evitar que a data de nascimento completa seja compartilhada quando a plataforma só precisa saber se o usuário cumpre uma idade mínima.',
  },
  {
    id: 'usuarios-o-que-plataforma-recebe',
    category: 'usuarios',
    question: 'O que a plataforma recebe?',
    answer:
      'A plataforma recebe apenas a resposta necessária para aplicar sua política, como aprovado, requisito etário, nível de garantia, método de verificação e prazo de expiração.',
  },
  {
    id: 'usuarios-reuso-verificacao',
    category: 'usuarios',
    question: 'O usuário pode reutilizar uma verificação?',
    answer:
      'Dependendo da política da plataforma, do tipo de prova e do prazo de validade, uma verificação pode ser reutilizada por um período limitado.',
  },
  {
    id: 'usuarios-expiracao',
    category: 'usuarios',
    question: 'O que acontece se a verificação expirar?',
    answer:
      'A plataforma pode solicitar uma nova verificação. Isso ajuda a manter segurança, validade da prova e aderência à política definida pelo cliente.',
  },
  {
    id: 'usuarios-recusa',
    category: 'usuarios',
    question: 'O usuário pode ser recusado?',
    answer:
      'Sim. O AgeKey pode retornar uma resposta de não aprovação quando o usuário não atende ao requisito etário, quando a prova é inválida, quando a credencial está expirada ou quando a fonte de confiança não é aceita.',
  },
  {
    id: 'usuarios-rastreamento',
    category: 'usuarios',
    question: 'O AgeKey rastreia o usuário entre sites?',
    answer:
      'A arquitetura do AgeKey deve evitar rastreamento desnecessário e reduzir a possibilidade de vincular a mesma pessoa em diferentes plataformas. O foco é confirmar elegibilidade etária para uma sessão ou política específica, não criar um identificador universal de navegação.',
  },

  // Privacidade e dados
  {
    id: 'privacidade-armazena-documento',
    category: 'privacidade',
    question: 'O AgeKey armazena documento do usuário?',
    answer:
      'O core do AgeKey não deve armazenar documento bruto como padrão. A proposta do produto é trabalhar com dados minimizados, provas, hashes, tokens e evidências técnicas.',
  },
  {
    id: 'privacidade-armazena-cpf',
    category: 'privacidade',
    question: 'O AgeKey armazena CPF?',
    answer:
      'O AgeKey não precisa armazenar CPF para entregar sua função principal. O objetivo é transformar fontes confiáveis de verificação em uma resposta mínima de elegibilidade etária.',
  },
  {
    id: 'privacidade-armazena-data-nascimento',
    category: 'privacidade',
    question: 'O AgeKey armazena data de nascimento?',
    answer:
      'A proposta do AgeKey é evitar armazenar data de nascimento em texto claro quando a regra exigida é apenas maior que determinada idade.',
  },
  {
    id: 'privacidade-sabe-quem-sou',
    category: 'privacidade',
    question: 'O AgeKey sabe quem eu sou?',
    answer:
      'O AgeKey pode operar sem identificar civilmente o usuário para o cliente final. Dependendo do método de verificação, algum emissor ou parceiro pode ter feito uma validação mais forte, mas o AgeKey busca reduzir o que é repassado à plataforma.',
  },
  {
    id: 'privacidade-dados-registrados',
    category: 'privacidade',
    question: 'Que dados o AgeKey registra?',
    answer:
      'O AgeKey pode registrar evidências técnicas mínimas, como identificador da sessão, política aplicada, método utilizado, resultado, horário, expiração, emissor ou atestador e hash do artefato de prova.',
  },
  {
    id: 'privacidade-vende-dados',
    category: 'privacidade',
    question: 'O AgeKey vende dados dos usuários?',
    answer:
      'Não. O AgeKey não deve ter como modelo a venda de dados pessoais. O valor do produto está em fornecer uma camada confiável de verificação etária com minimização de dados.',
  },
  {
    id: 'privacidade-anonimo',
    category: 'privacidade',
    question: 'O AgeKey é anônimo?',
    answer:
      'O AgeKey é orientado à preservação de privacidade e à minimização de dados. Em alguns fluxos, a verificação pode ocorrer sem revelar identidade civil ao cliente. Ainda assim, anonimato depende do método usado, da fonte de verificação e da integração.',
  },

  // Segurança
  {
    id: 'seguranca-fraude',
    category: 'seguranca',
    question: 'Como o AgeKey evita fraude?',
    answer:
      'O AgeKey pode usar sessões com desafio único, expiração curta, assinatura de tokens, validação de emissores, checagem de revogação, proteção contra replay e logs de auditoria.',
  },
  {
    id: 'seguranca-replay',
    category: 'seguranca',
    question: 'O que é replay attack?',
    answer:
      'Replay attack ocorre quando alguém tenta reutilizar uma prova válida em outro momento, outro usuário ou outra sessão. O AgeKey reduz esse risco usando challenge, nonce, expiração e validação de contexto.',
  },
  {
    id: 'seguranca-token-assinado',
    category: 'seguranca',
    question: 'O que é um token assinado?',
    answer:
      'É um resultado digital protegido por assinatura criptográfica. A assinatura permite que a plataforma confirme que o token foi realmente emitido pelo AgeKey e que não foi alterado.',
  },
  {
    id: 'seguranca-token-offline',
    category: 'seguranca',
    question: 'O cliente pode verificar o token sem chamar o AgeKey toda vez?',
    answer:
      'Dependendo da configuração, sim. Tokens assinados podem permitir validação offline ou online, conforme a política de segurança, expiração e revogação definida.',
  },
  {
    id: 'seguranca-criptografia',
    category: 'seguranca',
    question: 'O AgeKey usa criptografia?',
    answer:
      'Sim. A proposta técnica envolve criptografia em trânsito, assinatura de tokens, validação de provas, controle de chaves, expiração e proteção contra uso indevido.',
  },
  {
    id: 'seguranca-imune-ataques',
    category: 'seguranca',
    question: 'O AgeKey é seguro contra todos os ataques?',
    answer:
      'Nenhum sistema sério deve prometer segurança absoluta. O AgeKey foi desenhado para reduzir riscos relevantes em verificação etária, mas segurança depende de implementação, integração correta, operação, monitoramento e boas práticas do cliente.',
  },

  // ZKP e credenciais
  {
    id: 'zkp-o-que-e',
    category: 'zkp-credenciais',
    question: 'O que é ZKP?',
    answer:
      'ZKP significa Zero-Knowledge Proof, ou prova de conhecimento zero. É uma técnica criptográfica que permite provar que uma informação é verdadeira sem revelar a informação em si.',
  },
  {
    id: 'zkp-sempre-usa',
    category: 'zkp-credenciais',
    question: 'O AgeKey sempre usa ZKP?',
    answer:
      'Não necessariamente. O AgeKey pode operar em diferentes modos: prova criptográfica, credencial verificável, gateway de atestação ou fallback proporcional ao risco.',
  },
  {
    id: 'zkp-credencial-verificavel',
    category: 'zkp-credenciais',
    question: 'O que é uma credencial verificável?',
    answer:
      'É uma credencial digital emitida por uma fonte confiável e verificável criptograficamente. Ela pode conter atributos sobre o usuário, como uma prova de faixa etária ou maioridade.',
  },
  {
    id: 'zkp-selective-disclosure',
    category: 'zkp-credenciais',
    question: 'O que é selective disclosure?',
    answer:
      'Selective disclosure significa divulgação seletiva. É a capacidade de compartilhar apenas parte de uma informação, como provar maioridade sem revelar data de nascimento completa.',
  },
  {
    id: 'zkp-fonte-informacao',
    category: 'zkp-credenciais',
    question: 'De onde vem a informação confiável sobre idade?',
    answer:
      'Ela pode vir de credenciais digitais, provedores de identidade, parceiros de KYC, carteiras digitais, instituições autorizadas ou atestadores homologados pelo AgeKey.',
  },
  {
    id: 'zkp-atestador',
    category: 'zkp-credenciais',
    question: 'O que é um atestador?',
    answer:
      'É uma entidade que confirma uma informação e assina um resultado. Por exemplo: um parceiro que verificou idade por documento, base confiável ou credencial e informa ao AgeKey apenas que a pessoa cumpre determinado requisito.',
  },
  {
    id: 'zkp-emissor',
    category: 'zkp-credenciais',
    question: 'O que é um emissor?',
    answer:
      'É a entidade que emite uma credencial confiável. Pode ser uma instituição pública, uma carteira digital, um provedor de identidade, uma organização educacional ou outro participante homologado.',
  },
  {
    id: 'zkp-trust-registry',
    category: 'zkp-credenciais',
    question: 'O que é Trust Registry?',
    answer:
      'É um cadastro de emissores, atestadores, chaves públicas, credenciais aceitas e políticas de confiança. O AgeKey usa esse registro para saber quais fontes podem ser aceitas em uma verificação.',
  },

  // Para empresas
  {
    id: 'empresas-por-que-usar',
    category: 'empresas',
    question: 'Por que uma empresa deve usar o AgeKey?',
    answer:
      'Porque o AgeKey permite aplicar regras etárias com menos exposição de dados pessoais, menor risco operacional e melhor experiência para o usuário.',
  },
  {
    id: 'empresas-tipos',
    category: 'empresas',
    question: 'Que tipo de empresa pode integrar o AgeKey?',
    answer:
      'Plataformas de conteúdo, jogos, edtechs, redes sociais, marketplaces, comunidades online, aplicativos, streamings, serviços financeiros, healthtechs e plataformas reguladas.',
  },
  {
    id: 'empresas-compliance',
    category: 'empresas',
    question: 'O AgeKey ajuda em compliance?',
    answer:
      'Sim. O AgeKey ajuda a estruturar uma verificação mais proporcional, auditável e minimizada. Ainda assim, compliance depende do contexto da empresa, jurisdição, política interna e análise jurídica própria.',
  },
  {
    id: 'empresas-substitui-juridico',
    category: 'empresas',
    question: 'O AgeKey substitui o jurídico da empresa?',
    answer:
      'Não. O AgeKey é uma solução técnica e operacional. A empresa deve avaliar suas obrigações legais com assessoria jurídica e definir a política etária adequada.',
  },
  {
    id: 'empresas-niveis-garantia',
    category: 'empresas',
    question: 'A empresa pode escolher diferentes níveis de garantia?',
    answer:
      'Sim. O AgeKey pode trabalhar com níveis de garantia diferentes, como autodeclaração, atestado de terceiro, credencial verificável ou prova criptográfica.',
  },
  {
    id: 'empresas-relatorio-auditoria',
    category: 'empresas',
    question: 'A empresa recebe relatório de auditoria?',
    answer:
      'O AgeKey pode fornecer logs e evidências mínimas de verificação, como método usado, política aplicada, resultado, horário, token emitido e expiração.',
  },
  {
    id: 'empresas-mobile',
    category: 'empresas',
    question: 'O AgeKey pode ser usado em aplicativos móveis?',
    answer:
      'Sim. O AgeKey pode ser integrado em web, aplicativos móveis e fluxos server-to-server, conforme a arquitetura do cliente.',
  },

  // Integração técnica
  {
    id: 'integracao-como-integrar',
    category: 'integracao',
    question: 'Como uma empresa integra o AgeKey?',
    answer:
      'A integração pode ocorrer por API, widget web, SDK ou redirecionamento seguro. A plataforma cria uma sessão, o AgeKey verifica a política, valida a prova e retorna um token assinado.',
  },
  {
    id: 'integracao-api-retorno',
    category: 'integracao',
    question: 'O que a API do AgeKey retorna?',
    answer:
      'A API retorna um resultado mínimo, como approved, threshold, assurance_level, method, expires_at e token assinado.',
  },
  {
    id: 'integracao-webhook',
    category: 'integracao',
    question: 'O AgeKey tem webhook?',
    answer:
      'Sim. Webhooks podem notificar eventos como verificação aprovada, negada, expirada, prova revogada ou emissor não confiável.',
  },
  {
    id: 'integracao-sdk',
    category: 'integracao',
    question: 'O AgeKey tem SDK?',
    answer:
      'A arquitetura do AgeKey pode oferecer SDKs para facilitar integração web e mobile, além de exemplos de uso via API.',
  },
  {
    id: 'integracao-precisa-zkp',
    category: 'integracao',
    question: 'O cliente precisa entender ZKP para usar o AgeKey?',
    answer:
      'Não. O cliente pode usar o AgeKey por API, widget ou SDK sem lidar diretamente com criptografia avançada.',
  },
  {
    id: 'integracao-sem-wallet',
    category: 'integracao',
    question: 'O AgeKey pode funcionar sem wallet?',
    answer:
      'Sim. Wallets e credenciais verificáveis são caminhos fortes, mas o AgeKey também pode operar com gateway de atestação ou fallback.',
  },
  {
    id: 'integracao-login-proprio',
    category: 'integracao',
    question: 'O AgeKey pode funcionar com login próprio do cliente?',
    answer:
      'Sim. O AgeKey pode receber uma referência externa do usuário, como um identificador interno do cliente, sem precisar conhecer a identidade civil do usuário.',
  },

  // Compliance
  {
    id: 'compliance-lgpd',
    category: 'compliance',
    question: 'O AgeKey é compatível com LGPD?',
    answer:
      'O AgeKey foi desenhado com princípios alinhados à LGPD, como minimização de dados, finalidade, segurança e redução da exposição de informações pessoais. A conformidade final depende da configuração, dos contratos, da base legal e do tratamento realizado por todos os envolvidos.',
  },
  {
    id: 'compliance-controlador',
    category: 'compliance',
    question: 'Quem é o controlador dos dados?',
    answer:
      'Depende do fluxo e do contrato. Em muitos casos, a plataforma cliente define a finalidade da verificação e pode atuar como controladora. O AgeKey pode atuar como operador ou como controlador independente em determinados aspectos.',
  },
  {
    id: 'compliance-auditoria',
    category: 'compliance',
    question: 'O AgeKey gera evidências para auditoria?',
    answer:
      'Sim. O AgeKey pode registrar evidências mínimas que comprovam que uma verificação ocorreu, qual política foi aplicada, qual método foi usado e qual resultado foi emitido.',
  },
  {
    id: 'compliance-retencao',
    category: 'compliance',
    question: 'Por quanto tempo os dados são retidos?',
    answer:
      'A retenção deve ser configurada conforme finalidade, contrato, exigência regulatória e política de privacidade. O ideal é manter dados e evidências pelo menor tempo necessário.',
  },
  {
    id: 'compliance-risco-zero',
    category: 'compliance',
    question: 'O AgeKey elimina completamente risco regulatório?',
    answer:
      'Não. Nenhuma ferramenta elimina completamente risco regulatório. O AgeKey ajuda a reduzir risco ao oferecer uma arquitetura mais proporcional, minimizada e auditável.',
  },

  // Comercial
  {
    id: 'comercial-como-contratar',
    category: 'comercial',
    question: 'Como contratar o AgeKey?',
    answer:
      'Empresas interessadas podem entrar em contato para definir volume, tipo de integração, nível de garantia, políticas etárias e requisitos de compliance.',
  },
  {
    id: 'comercial-saas',
    category: 'comercial',
    question: 'O AgeKey é vendido como SaaS?',
    answer:
      'Sim. O modelo natural do AgeKey é SaaS B2B, com API, widget, painel, webhooks, suporte e planos conforme volume e nível de integração.',
  },
  {
    id: 'comercial-cobranca-verificacao',
    category: 'comercial',
    question: 'O AgeKey cobra por verificação?',
    answer:
      'O modelo comercial pode combinar licença mensal, franquia de verificações, cobrança por volume, planos enterprise e recursos adicionais como white-label, SLA e conectores premium.',
  },
  {
    id: 'comercial-enterprise',
    category: 'comercial',
    question: 'Existe plano enterprise?',
    answer:
      'Sim. Clientes enterprise podem exigir SLA, ambiente dedicado, regras avançadas, auditoria, relatórios, white-label, suporte prioritário e integrações específicas.',
  },
  {
    id: 'comercial-sandbox',
    category: 'comercial',
    question: 'O AgeKey pode ser testado antes da contratação?',
    answer:
      'Sim. Um ambiente de demonstração ou sandbox pode ser oferecido para validar a experiência, a API e o fluxo de integração.',
  },
] as const;

export function getCategoryLabel(id: FaqCategoryId): string {
  return FAQ_CATEGORIES.find((c) => c.id === id)?.label ?? '';
}
