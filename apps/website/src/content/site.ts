// Centralized public copy for the AgeKey website.
// All claims are intentionally minimization-first and never promise
// real KYC, real ZKP in production, or real third-party gateway integrations
// before they are technically validated.

export const siteCopy = {
  brand: {
    name: 'AgeKey',
    domain: 'agekey.com.br',
    tagline:
      'Age assurance com privacidade para sites, apps e plataformas digitais.',
    primaryClaim: 'Prove elegibilidade etária. Não identidade civil.',
  },

  nav: [
    { label: 'Início', href: '/' },
    { label: 'Como funciona', href: '/como-funciona' },
    { label: 'Soluções', href: '/solucoes' },
    { label: 'Privacidade', href: '/privacidade' },
    { label: 'Desenvolvedores', href: '/desenvolvedores' },
    { label: 'Compliance', href: '/compliance' },
    { label: 'Preços', href: '/precos' },
    { label: 'Contato', href: '/contato' },
  ],

  footer: {
    columns: [
      {
        title: 'Produto',
        links: [
          { label: 'Como funciona', href: '/como-funciona' },
          { label: 'Soluções', href: '/solucoes' },
          { label: 'Preços', href: '/precos' },
        ],
      },
      {
        title: 'Plataforma',
        links: [
          { label: 'Desenvolvedores', href: '/desenvolvedores' },
          { label: 'Privacidade', href: '/privacidade' },
          { label: 'Compliance', href: '/compliance' },
        ],
      },
      {
        title: 'Empresa',
        links: [
          { label: 'Contato', href: '/contato' },
          { label: 'Solicitar demo', href: '/demo' },
        ],
      },
    ],
    legal:
      'AgeKey é uma infraestrutura de age assurance privacy-first. Não é um serviço de KYC e não substitui análise jurídica.',
  },

  home: {
    hero: {
      eyebrow: 'Age assurance privacy-first',
      title:
        'Verifique elegibilidade etária sem transformar privacidade em risco.',
      subtitle:
        'AgeKey é uma infraestrutura de age assurance para sites, apps e plataformas digitais. Prove se uma pessoa atende a uma política etária — como 13+, 16+, 18+ ou 21+ — sem exigir identidade civil, data de nascimento completa ou documento pessoal no fluxo principal.',
      primaryCta: { label: 'Solicitar demonstração', href: '/demo' },
      secondaryCta: { label: 'Ver como funciona', href: '/como-funciona' },
      microcopy:
        'API, widget e SDK para integrar em experiências web e mobile. Privacy-first por design.',
    },

    problem: {
      title: 'Verificar idade não precisa virar coleta excessiva de dados.',
      body: 'Muitas plataformas precisam aplicar regras etárias para liberar recursos, conteúdos, comunidades, compras, interações ou jornadas digitais. O problema é que os métodos tradicionais frequentemente pedem mais dados do que o necessário: documento, selfie, data de nascimento completa, nome civil ou informações sensíveis que aumentam risco, fricção e responsabilidade operacional.',
      footer:
        'O AgeKey resolve esse problema com uma abordagem diferente: em vez de perguntar quem é essa pessoa, a plataforma pergunta apenas se essa pessoa atende à política etária exigida.',
      cards: [
        {
          title: 'Menos fricção',
          body: 'Fluxos simples para o usuário final, com experiência por widget, redirecionamento, SDK ou integração server-to-server.',
        },
        {
          title: 'Menos exposição de dados',
          body: 'A resposta pública contém apenas a decisão necessária: aprovado, negado ou precisa de revisão.',
        },
        {
          title: 'Mais preparo regulatório',
          body: 'Evidências minimizadas, trilhas auditáveis e políticas configuráveis por produto, cliente ou jurisdição.',
        },
        {
          title: 'Mais controle técnico',
          body: 'APIs, webhooks, tokens assinados e um core preparado para múltiplos métodos de verificação.',
        },
      ],
    },

    definition: {
      title: 'O que é o AgeKey?',
      lead: 'AgeKey é uma infraestrutura de prova de elegibilidade etária.',
      body: 'Ele permite que empresas digitais confirmem se um usuário atende a uma política etária sem receber dados civis desnecessários. Em vez de armazenar idade exata, documento ou data de nascimento, o AgeKey trabalha com resultados mínimos:',
      bullets: [
        'maior de 13',
        'maior de 16',
        'maior de 18',
        'maior de 21',
        'faixa etária permitida',
        'política etária satisfeita',
      ],
      highlight: 'AgeKey não é um KYC. É uma camada de decisão etária.',
    },

    steps: {
      title: 'Como funciona em quatro passos',
      items: [
        {
          n: '1',
          title: 'Sua plataforma cria uma sessão de verificação',
          body: 'A aplicação informa qual política etária precisa validar, por exemplo 18+.',
        },
        {
          n: '2',
          title: 'O AgeKey escolhe o melhor fluxo disponível',
          body: 'A verificação pode ocorrer por gateway, credencial, prova futura baseada em ZKP ou fallback proporcional ao risco.',
        },
        {
          n: '3',
          title: 'O usuário prova apenas o necessário',
          body: 'O fluxo busca confirmar a elegibilidade etária sem revelar identidade civil completa à plataforma.',
        },
        {
          n: '4',
          title: 'Sua plataforma recebe um resultado mínimo e assinado',
          body: 'O cliente recebe uma decisão como approved, denied ou needs_review, junto com método, nível de garantia, expiração e token assinado.',
        },
      ],
      footer:
        'O resultado é simples para o produto, mais seguro para a empresa e mais respeitoso para o usuário.',
    },

    features: {
      title:
        'Tudo que sua plataforma precisa para operar age assurance com segurança',
      items: [
        {
          title: 'API de verificação etária',
          body: 'Crie sessões, consulte status, complete verificações e valide tokens por endpoints simples.',
        },
        {
          title: 'Widget web',
          body: 'Adicione um fluxo de verificação ao seu site sem redesenhar toda a jornada do usuário.',
        },
        {
          title: 'SDK JavaScript',
          body: 'Integre o AgeKey em aplicações web modernas com TypeScript e contratos públicos consistentes.',
        },
        {
          title: 'SDKs mobile de referência',
          body: 'Estrutura para fluxos iOS e Android com abertura segura de jornada web e recebimento de resultado.',
        },
        {
          title: 'Policy Engine',
          body: 'Configure políticas como 13+, 16+, 18+, 21+ ou faixas etárias permitidas por produto, aplicação ou jurisdição.',
        },
        {
          title: 'Tokens assinados',
          body: 'Receba um resultado verificável com expiração, identificador de sessão e nível de garantia.',
        },
        {
          title: 'Webhooks',
          body: 'Automatize eventos como verificação aprovada, negada, expirada ou revogada.',
        },
        {
          title: 'Trust Registry',
          body: 'Prepare sua operação para aceitar emissores, atestadores e métodos confiáveis com governança.',
        },
        {
          title: 'Evidence Layer',
          body: 'Mantenha evidência auditável sem armazenar documentos, selfies ou data de nascimento no core.',
        },
        {
          title: 'Multi-tenant',
          body: 'Gerencie múltiplas aplicações, ambientes e clientes com segregação lógica.',
        },
      ],
    },

    modes: {
      title: 'Um core. Múltiplos caminhos de verificação.',
      lead: 'Nem toda empresa começa no mesmo nível de maturidade técnica. O AgeKey foi desenhado como uma infraestrutura modular, capaz de operar com diferentes métodos de verificação sem mudar o contrato principal de resultado.',
      items: [
        {
          title: 'Gateway Mode',
          body: 'Para empresas que precisam começar rapidamente usando atestadores externos ou provedores especializados. O AgeKey normaliza a decisão e entrega apenas o resultado mínimo.',
        },
        {
          title: 'Credential Mode',
          body: 'Preparado para credenciais verificáveis e divulgação seletiva, permitindo comprovar atributos etários sem revelar mais dados do que o necessário.',
        },
        {
          title: 'Proof Mode',
          body: 'Caminho futuro para provas criptográficas fortes, como ZKP e credenciais anônimas, sem prometer implementação real antes de bibliotecas, emissores e vetores de teste confiáveis.',
        },
        {
          title: 'Fallback proporcional',
          body: 'Para contextos de menor risco ou fases iniciais, com fricção proporcional, sinalização de risco e possibilidade de exigir prova mais forte quando necessário.',
        },
      ],
      note: 'O AgeKey evolui por método, mas mantém o mesmo princípio: a plataforma recebe uma decisão etária mínima, não uma identidade civil.',
    },

    why: {
      title: 'Por que usar AgeKey?',
      lead: 'Produtos digitais estão sendo pressionados a proteger menores, aplicar políticas etárias e demonstrar responsabilidade sem criar novas bases de dados sensíveis. O AgeKey ajuda sua empresa a responder a esse desafio com uma camada técnica desenhada para minimização, auditoria e integração rápida.',
      cards: [
        {
          title: 'Reduza risco regulatório',
          body: 'Aplique políticas etárias de forma consistente, com evidências técnicas e retenção controlada.',
        },
        {
          title: 'Proteja a privacidade do usuário',
          body: 'Evite coletar dados civis quando o que você precisa saber é apenas se uma política etária foi satisfeita.',
        },
        {
          title: 'Ganhe velocidade de integração',
          body: 'Use API, widget, SDK e webhooks para conectar o AgeKey ao seu fluxo atual.',
        },
        {
          title: 'Crie uma base escalável',
          body: 'Comece com gateway e fallback. Evolua para credenciais verificáveis e provas criptográficas quando o ecossistema estiver pronto.',
        },
        {
          title: 'Melhore confiança e reputação',
          body: 'Mostre ao mercado que sua empresa leva proteção infantojuvenil e privacidade a sério.',
        },
        {
          title: 'Evite construir tudo do zero',
          body: 'Age assurance exige arquitetura, segurança, governança, logs, tokens, retenção, auditoria e integração. O AgeKey concentra essa complexidade em uma camada especializada.',
        },
      ],
    },

    privacy: {
      title: 'Privacidade não é um detalhe. É a arquitetura.',
      body: 'O AgeKey foi desenhado para minimizar dados desde o início. O core do produto não precisa armazenar documento, selfie, biometria bruta, nome civil, data de nascimento ou idade exata para entregar a decisão pública de elegibilidade. A plataforma trabalha com provas, atestados, hashes, identificadores opacos, tokens assinados e evidências minimizadas.',
      bullets: [
        'Não armazenamos documento civil no core.',
        'Não exigimos data de nascimento completa como claim pública.',
        'Não retornamos idade exata para a plataforma cliente.',
        'Não transformamos age assurance em KYC.',
        'Não apresentamos provedores ou ZKP como reais sem validação técnica.',
        'Não entregamos payloads públicos com dados pessoais desnecessários.',
      ],
      cta: { label: 'Ver modelo de privacidade', href: '/privacidade' },
    },

    devSection: {
      title: 'Integre em dias, evolua com segurança.',
      body: 'O AgeKey oferece contratos públicos para criar sessões de verificação, validar tokens, receber webhooks e incorporar fluxos em aplicações web ou mobile.',
      requestSnippet: `const session = await agekey.verifications.createSession({
  policy: "18+",
  externalUserRef: "user_123",
  callbackUrl: "https://sua-plataforma.com/callback"
})

redirect(session.verificationUrl)`,
      responseSnippet: `{
  "approved": true,
  "policy": "18+",
  "method": "gateway",
  "assurance_level": "high",
  "expires_at": "2026-06-01T00:00:00Z"
}`,
      note: 'Claims públicas proibidas incluem data de nascimento, idade exata, nome, documento, selfie, biometria e identificadores civis.',
      primaryCta: { label: 'Ver documentação técnica', href: '/desenvolvedores' },
      secondaryCta: { label: 'Falar com engenharia', href: '/contato' },
    },

    useCases: {
      title: 'Onde o AgeKey se encaixa',
      items: [
        {
          title: 'Redes sociais e comunidades',
          body: 'Aplique políticas de acesso por idade em comunidades, recursos sociais, mensagens, perfis e áreas sensíveis.',
        },
        {
          title: 'Edtechs e ambientes educacionais',
          body: 'Proteja jornadas de alunos, responsáveis e comunidades escolares com políticas proporcionais ao contexto.',
        },
        {
          title: 'Marketplaces',
          body: 'Restrinja produtos, categorias, recursos ou transações que exigem elegibilidade etária.',
        },
        {
          title: 'Publishers e conteúdo',
          body: 'Controle acesso a conteúdos sensíveis sem criar uma base desnecessária de documentos.',
        },
        {
          title: 'Jogos e experiências interativas',
          body: 'Gerencie acesso por faixa etária, recursos sociais, compras e comunidades online.',
        },
        {
          title: 'Apps de saúde, bem-estar e serviços digitais',
          body: 'Aplique políticas etárias específicas sem expor informações pessoais além do necessário.',
        },
      ],
    },

    finalCta: {
      title: 'Pronto para aplicar age assurance sem coletar dados demais?',
      body: 'Fale com o AgeKey e veja como integrar uma camada de verificação etária privacy-first ao seu produto digital.',
      primaryCta: { label: 'Solicitar demonstração', href: '/demo' },
      secondaryCta: { label: 'Receber material técnico', href: '/contato' },
      microcopy:
        'Ideal para plataformas digitais, edtechs, marketplaces, publishers, jogos, apps e comunidades online.',
    },
  },

  howItWorks: {
    hero: {
      title:
        'Uma verificação etária simples para o usuário. Uma decisão segura para sua plataforma.',
      subtitle:
        'O AgeKey cria uma sessão de verificação, aplica a política etária definida e retorna um resultado mínimo, assinado e auditável.',
      cta: { label: 'Ver integração', href: '/desenvolvedores' },
    },
    flow: {
      title: 'Da política ao resultado',
      steps: [
        {
          n: '1',
          title: 'Defina a política',
          body: 'Escolha o requisito etário da aplicação: 13+, 16+, 18+, 21+ ou uma faixa permitida.',
        },
        {
          n: '2',
          title: 'Crie uma sessão',
          body: 'Sua aplicação chama a API do AgeKey e recebe uma URL ou fluxo de verificação.',
        },
        {
          n: '3',
          title: 'Execute a prova',
          body: 'O usuário passa pelo método adequado: gateway, credencial, prova futura ou fallback proporcional.',
        },
        {
          n: '4',
          title: 'Receba a decisão',
          body: 'A plataforma recebe apenas o necessário: aprovado, negado ou precisa de revisão.',
        },
        {
          n: '5',
          title: 'Audite sem expor identidade',
          body: 'O AgeKey registra evidências técnicas minimizadas para auditoria e governança.',
        },
      ],
    },
    response: {
      title: 'O que sua plataforma recebe',
      lead: 'A resposta pública do AgeKey é propositalmente limitada. Ela informa se a política foi satisfeita, qual método foi usado, qual o nível de garantia e até quando a decisão é válida.',
      snippet: `{
  "approved": true,
  "policy_id": "policy_18_plus",
  "threshold": "18+",
  "method": "gateway",
  "assurance_level": "high",
  "reason_code": "policy_satisfied",
  "expires_at": "2026-06-01T00:00:00Z"
}`,
      reinforce:
        'Sem nome civil. Sem documento. Sem selfie. Sem data de nascimento completa. Sem idade exata.',
    },
    methods: {
      title:
        'Métodos de verificação compatíveis com diferentes níveis de maturidade',
      lead: 'O AgeKey foi desenhado para não depender de um único método. Isso permite começar com fluxos disponíveis hoje e evoluir para credenciais e provas criptográficas à medida que o ecossistema amadurece.',
      items: [
        {
          title: 'Gateway',
          body: 'Conecta provedores externos de atestação e normaliza o resultado para o padrão AgeKey.',
        },
        {
          title: 'Credencial verificável',
          body: 'Permite validar atributos etários com divulgação seletiva quando há wallet e emissor compatíveis.',
        },
        {
          title: 'Prova criptográfica',
          body: 'Contrato preparado para ZKP e BBS+, mantendo bloqueio técnico até validação real.',
        },
        {
          title: 'Fallback',
          body: 'Fluxo proporcional para cenários iniciais, com regras claras de risco e possibilidade de revalidação.',
        },
      ],
    },
  },

  privacy: {
    hero: {
      title:
        'Age assurance com minimização de dados desde a primeira linha de arquitetura.',
      subtitle:
        'O AgeKey foi criado para responder a uma pergunta específica: a pessoa atende à política etária exigida? Não para descobrir quem ela é.',
      cta: { label: 'Entender o modelo privacy-first', href: '#nao-e-kyc' },
    },
    notKyc: {
      title: 'Por que AgeKey não é KYC',
      body: 'KYC busca identificar uma pessoa. O AgeKey busca validar uma condição: se uma política etária foi satisfeita. Essa diferença muda tudo. O AgeKey não precisa entregar nome civil, documento, selfie, biometria ou data de nascimento completa para a plataforma cliente. O resultado público é uma decisão mínima, com nível de garantia, método e validade.',
      compare: [
        {
          title: 'KYC tradicional',
          items: [
            'Identifica a pessoa.',
            'Pode exigir documento, selfie e dados civis.',
            'Gera alta responsabilidade sobre dados sensíveis.',
            'Nem sempre é proporcional para uma simples política etária.',
          ],
        },
        {
          title: 'AgeKey',
          items: [
            'Valida elegibilidade etária.',
            'Retorna apenas uma decisão mínima.',
            'Minimiza dados pessoais no payload público.',
            'Permite auditoria sem expor identidade civil.',
          ],
          highlighted: true,
        },
      ],
    },
    forbidden: {
      title: 'O que não deve aparecer em respostas públicas',
      lead: 'O AgeKey trata os seguintes campos como proibidos em payloads públicos de resultado:',
      fields: [
        'birthdate',
        'date_of_birth',
        'dob',
        'age',
        'exact_age',
        'document',
        'cpf',
        'rg',
        'passport',
        'id_number',
        'name',
        'full_name',
        'selfie',
        'face',
        'biometric',
        'raw_id',
        'civil_id',
      ],
      footer:
        'A política pode conter um threshold, como 18+, porque esse número representa a regra da plataforma — não a idade do usuário.',
    },
    storable: {
      title: 'Auditoria com o mínimo necessário',
      body: 'Para fins técnicos e de auditoria, o AgeKey pode registrar informações minimizadas como tenant, aplicação, política, horário, método usado, status, expiração, hash do artefato e identificadores opacos. O objetivo é permitir governança sem criar uma base de identidade civil.',
    },
  },

  developers: {
    hero: {
      title: 'APIs e SDKs para adicionar age assurance ao seu produto.',
      subtitle:
        'Crie sessões, execute fluxos, receba webhooks e valide tokens assinados com contratos públicos claros e sem PII desnecessária.',
      primaryCta: { label: 'Ver documentação', href: '/contato' },
      secondaryCta: { label: 'Solicitar chave de sandbox', href: '/contato' },
    },
    integration: {
      title: 'Fluxo básico de integração',
      snippet: `import { AgeKeyClient } from "@agekey/sdk-js"

const agekey = new AgeKeyClient({
  apiKey: process.env.AGEKEY_API_KEY,
  environment: "sandbox"
})

const session = await agekey.verifications.createSession({
  policy: "18+",
  externalUserRef: "user_123",
  callbackUrl: "https://app.exemplo.com/agekey/callback"
})`,
      footer:
        'A partir da sessão criada, sua aplicação pode redirecionar o usuário para o fluxo de verificação ou abrir o widget embarcado.',
    },
    endpoints: {
      title: 'Endpoints principais',
      items: [
        {
          method: 'POST',
          path: '/v1/verifications/session',
          body: 'Cria uma sessão de verificação.',
        },
        {
          method: 'GET',
          path: '/v1/verifications/session/{id}',
          body: 'Consulta o status da sessão.',
        },
        {
          method: 'POST',
          path: '/v1/verifications/session/{id}/complete',
          body: 'Completa ou confirma a verificação.',
        },
        {
          method: 'POST',
          path: '/v1/verifications/token/verify',
          body: 'Valida um token de resultado.',
        },
        {
          method: 'POST',
          path: '/v1/webhooks/test',
          body: 'Testa a entrega de eventos.',
        },
      ],
    },
    webhooks: {
      title: 'Webhooks para automatizar sua operação',
      items: [
        { name: 'verification.approved', body: 'A política etária foi satisfeita.' },
        { name: 'verification.denied', body: 'A política etária não foi satisfeita.' },
        {
          name: 'verification.needs_review',
          body: 'A verificação precisa de revisão ou método adicional.',
        },
        { name: 'verification.expired', body: 'A sessão ou token expirou.' },
        { name: 'proof.revoked', body: 'Uma prova ou atestado foi revogado.' },
        { name: 'issuer.untrusted', body: 'Um emissor deixou de ser confiável.' },
      ],
    },
    security: {
      title: 'Decisões técnicas importantes',
      body: 'O AgeKey usa tokens assinados, expiração, identificadores opacos, challenge por sessão, validação de método, minimização de payload e separação multi-tenant. Segredos de produção nunca devem ser enviados ao frontend, e chaves de serviço devem permanecer exclusivamente server-side.',
    },
  },

  solutions: {
    hero: {
      title: 'Age assurance para diferentes produtos digitais.',
      subtitle:
        'Do onboarding à liberação de conteúdo, o AgeKey ajuda sua empresa a aplicar políticas etárias com menos fricção, menos exposição de dados e mais controle técnico.',
      cta: { label: 'Encontrar minha solução', href: '/contato' },
    },
    items: [
      {
        slug: 'plataformas-digitais',
        title: 'Plataformas digitais',
        lead: 'Aplique políticas etárias sem redesenhar seu produto.',
        body: 'Controle acesso a recursos, comunidades, interações, mensagens, categorias ou conteúdos com uma camada de verificação plugável.',
      },
      {
        slug: 'edtechs',
        title: 'Edtechs',
        lead: 'Proteção infantojuvenil com privacidade e proporcionalidade.',
        body: 'Valide políticas por faixa etária em ambientes de aprendizagem, comunidades escolares, recursos interativos e jornadas com responsáveis.',
      },
      {
        slug: 'marketplaces',
        title: 'Marketplaces',
        lead: 'Restrinja produtos e categorias por elegibilidade etária.',
        body: 'Aplique regras de acesso, compra ou visualização sem criar uma base desnecessária de documentos dos usuários.',
      },
      {
        slug: 'publishers-e-conteudo',
        title: 'Publishers e conteúdo',
        lead: 'Libere conteúdo sensível com uma decisão mínima.',
        body: 'Use o AgeKey para aplicar políticas de acesso sem exigir que o usuário entregue mais dados do que o necessário.',
      },
      {
        slug: 'jogos-e-comunidades',
        title: 'Jogos e comunidades',
        lead: 'Gerencie experiências por idade com menos fricção.',
        body: 'Aplique regras para chats, comunidades, compras, recursos sociais e conteúdos classificados.',
      },
    ],
  },

  compliance: {
    hero: {
      title: 'Preparado para governança, auditoria e privacy by design.',
      subtitle:
        'AgeKey ajuda empresas a aplicar políticas etárias com evidências técnicas minimizadas, retenção controlada e separação entre elegibilidade etária e identidade civil.',
      cta: { label: 'Solicitar material de compliance', href: '/contato' },
    },
    governance: {
      title: 'O que o AgeKey ajuda a demonstrar',
      bullets: [
        'Qual política etária foi aplicada.',
        'Qual método foi utilizado.',
        'Quando a verificação ocorreu.',
        'Qual foi o resultado.',
        'Até quando o resultado é válido.',
        'Qual artefato técnico sustenta a decisão.',
        'Se houve expiração, revogação ou mudança de confiança.',
      ],
      footer:
        'Tudo isso sem exigir que o payload público carregue documento, nome civil, selfie ou data de nascimento.',
    },
    docs: {
      title: 'Documentação para apoiar sua operação',
      body: 'O AgeKey pode ser acompanhado por registros de privacy by design, política de retenção, inventário de subprocessadores, plano de resposta a incidentes, threat model e escopo de pentest.',
      note: 'Esses documentos não substituem análise jurídica própria, mas reduzem o esforço de governança e ajudam os times de produto, segurança e compliance a operar sobre uma arquitetura consistente.',
    },
  },

  pricing: {
    hero: {
      title: 'Planos para começar simples e escalar com segurança.',
      subtitle:
        'Escolha o modelo de contratação de acordo com volume, maturidade técnica, necessidade de white-label e requisitos de compliance.',
      cta: { label: 'Falar com vendas', href: '/contato' },
    },
    plans: [
      {
        name: 'Sandbox',
        tagline: 'Para testes técnicos e validação de integração.',
        price: 'Sob consulta',
        features: [
          'Ambiente sandbox',
          'API básica',
          'Widget de teste',
          'Documentação',
          'Tokens de teste',
          'Webhooks de teste',
        ],
        cta: { label: 'Solicitar sandbox', href: '/contato' },
      },
      {
        name: 'Growth',
        tagline: 'Para produtos digitais em operação.',
        price: 'Sob consulta',
        highlighted: true,
        features: [
          'Verificações mensais',
          'API e widget',
          'SDK JS',
          'Políticas configuráveis',
          'Webhooks',
          'Dashboard administrativo',
          'Logs minimizados',
          'Suporte padrão',
        ],
        cta: { label: 'Solicitar proposta', href: '/contato' },
      },
      {
        name: 'Enterprise',
        tagline:
          'Para plataformas com escala, compliance e integrações avançadas.',
        price: 'Sob consulta',
        features: [
          'Volume customizado',
          'White-label',
          'SLA',
          'Ambientes dedicados',
          'Trust registry gerenciado',
          'Relatórios de auditoria',
          'Suporte a gateways',
          'Revisão de segurança',
          'Pacote de compliance',
          'Suporte prioritário',
        ],
        cta: { label: 'Falar com especialista', href: '/contato' },
      },
    ],
    note: 'Os planos são apresentados sob consulta e ajustados conforme volume, ambiente e maturidade de integração.',
  },

  contact: {
    hero: {
      title: 'Vamos entender sua necessidade de age assurance.',
      subtitle:
        'Conte rapidamente sobre sua plataforma, política etária e volume esperado. O time AgeKey retorna com a melhor estratégia de integração.',
    },
    safety:
      'Não envie documentos pessoais, dados de usuários ou informações sensíveis neste formulário.',
    success:
      'Recebemos sua solicitação. O time AgeKey analisará o contexto da sua plataforma e retornará com uma proposta de integração.',
  },

  faq: {
    title: 'Perguntas frequentes',
    items: [
      {
        q: 'AgeKey é uma solução de KYC?',
        a: 'Não. O AgeKey não foi desenhado para identificar civilmente uma pessoa. Ele foi desenhado para verificar se uma política etária foi satisfeita.',
      },
      {
        q: 'O AgeKey armazena documento do usuário?',
        a: 'O core do AgeKey não deve armazenar documento civil bruto. A arquitetura prioriza provas, atestados, tokens, hashes e evidências minimizadas.',
      },
      {
        q: 'O AgeKey mostra a idade exata do usuário para a empresa?',
        a: 'Não. O resultado público deve indicar se a política foi satisfeita, como 18+, e não a idade exata do usuário.',
      },
      {
        q: 'O AgeKey coleta data de nascimento?',
        a: 'A proposta do AgeKey é evitar que data de nascimento completa apareça como claim pública. Quando um método externo exigir dados adicionais, o resultado entregue ao cliente continua minimizado.',
      },
      {
        q: 'O que minha aplicação recebe depois da verificação?',
        a: 'Uma decisão mínima — aprovado, negado ou precisa de revisão — acompanhada de política, método, nível de garantia, expiração e token assinado.',
      },
      {
        q: 'Quais métodos de verificação o AgeKey suporta?',
        a: 'A arquitetura prevê gateway mode, credential mode, proof mode e fallback proporcional. Integrações reais com provedores dependem de credenciais, contrato, ambiente e validação técnica.',
      },
      {
        q: 'O AgeKey já tem ZKP real em produção?',
        a: 'O AgeKey tem arquitetura preparada para provas criptográficas, mantendo bloqueio técnico até que biblioteca, emissor, wallet, auditoria e test vectors estejam disponíveis e validados.',
      },
      {
        q: 'Posso usar AgeKey só com widget?',
        a: 'Sim. O widget é o caminho mais simples para plataformas que querem começar sem criar uma jornada própria completa.',
      },
      {
        q: 'Existe integração por API?',
        a: 'Sim. O AgeKey foi desenhado com API, webhooks, tokens e SDKs para integração com produtos digitais.',
      },
      {
        q: 'Como o AgeKey ajuda compliance?',
        a: 'Ele reduz exposição de dados, mantém evidências técnicas minimizadas e separa elegibilidade etária de identidade civil.',
      },
      {
        q: 'O AgeKey substitui parecer jurídico?',
        a: 'Não. O AgeKey oferece infraestrutura técnica e documentação de apoio. Cada empresa deve avaliar suas obrigações legais específicas.',
      },
    ],
  },
} as const;
