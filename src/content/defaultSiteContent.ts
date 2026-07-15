export const defaultSiteContent = {
  navbar: {
    siteName: 'Fondation Bien Aimé Cassis',
    logoUrl: '',
    donateLabel: 'Faire un don',
    donateLink: '/faire-un-don',
    links: [
      { label: 'Accueil', path: '/' },
      { label: 'À propos', path: '/a-propos' },
      { label: 'Programmes', path: '/programmes' },
      { label: 'Campagnes', path: '/campagnes' },
      { label: 'Actualités', path: '/actualites' },
      { label: 'Transparence', path: '/transparence' },
      { label: 'Contact', path: '/contact' },
    ],
  },
  footer: {
    brandTitle: 'Fondation Bien Aimé Cassis',
    description: "Offrir l'éducation, la dignité et l'espoir pour chaque enfant en Haïti.",
    contact: {
      address: "#57, Route de Dégand, Ruelle Titus Prolongée, Carrefour, Département de l'Ouest, Haïti.",
      phone: '+509 31833164',
      email: 'Cassisb621@yahoo.com',
    },
    socialLinks: [
      { label: 'Facebook', href: '#' },
      { label: 'Instagram', href: '#' },
      { label: 'Twitter', href: '#' },
      { label: 'LinkedIn', href: '#' },
    ],
    quickLinks: [
      { label: 'À propos', path: '/a-propos' },
      { label: 'Programmes', path: '/programmes' },
      { label: 'Campagnes', path: '/campagnes' },
      { label: 'Actualités', path: '/actualites' },
      { label: 'Transparence', path: '/transparence' },
    ],
    engagementLinks: [
      { label: 'Faire un don', path: '/faire-un-don' },
      { label: 'Devenir bénévole', path: '#' },
      { label: 'Partenariat', path: '#' },
      { label: 'Événements', path: '#' },
    ],
    legalLinks: [
      { label: 'Mentions légales', path: '#' },
      { label: 'Politique de confidentialité', path: '#' },
      { label: 'CGU', path: '#' },
    ],
    copyright: '© 2024 Fondation Bien Aimé Cassis. Tous droits réservés.',
  },
  home: {
    seoTitle: 'Fondation Bien Aimé Cassis - Accueil',
    seoDescription:
      "Nous aidons les enfants vulnérables d'Haïti à accéder à l'école, à une alimentation suffisante et aux ressources nécessaires à leur développement.",
    hero: {
      titlePrefix: "L'éducation, la dignité et l'espoir pour",
      titleHighlight: 'chaque enfant',
      description:
        "Nous aidons les enfants vulnérables d'Haïti à accéder à l'école, à une alimentation suffisante, aux livres, aux vêtements et aux fournitures nécessaires à leur développement.",
      primaryButtonLabel: 'Faire un don',
      primaryButtonLink: '/faire-un-don',
      secondaryButtonLabel: 'En savoir plus',
      secondaryButtonLink: '/a-propos',
      imageUrl:
        'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&h=600&fit=crop',
      imageAlt: 'Enfants apprenant en classe',
    },
    stats: [
      { value: '250', label: 'Enfants accompagnés' },
      { value: '1 200', label: 'Kits distribués' },
      { value: '35 000', label: 'Repas servis' },
      { value: '80', label: 'Bénévoles' },
    ],
    statsDisclaimer: '* Données de démonstration',
    programsSection: {
      title: 'Nos programmes',
      description:
        "Nous intervenons sur plusieurs axes pour assurer le bien-être et l'éducation des enfants.",
      items: [
        {
          title: 'Parrainage scolaire',
          description:
            'Financer les frais de scolarité, les livres et les fournitures pour les enfants défavorisés.',
        },
        {
          title: 'Programme alimentaire',
          description:
            'Offrir un repas par jour aux élèves pour favoriser leur concentration et leur santé.',
        },
        {
          title: 'Vêtements et chaussures',
          description: 'Distribuer des uniformes, des vêtements et des chaussures adaptés.',
        },
        {
          title: 'Excellence scolaire',
          description: 'Récompenser les élèves méritants avec des bourses et des encouragements.',
        },
      ],
    },
    campaignsSection: {
      title: 'Nos campagnes',
      description: 'Participez à nos collectes pour faire une différence.',
      allCampaignsLabel: 'Voir toutes les campagnes',
      allCampaignsLink: '/campagnes',
      donateLabel: 'Faire un don',
      donateLink: '/faire-un-don',
    },
    ctaSection: {
      title: 'Ensemble, nous pouvons changer des vies',
      description:
        "Chaque don, petit ou grand, contribue à offrir un avenir meilleur à un enfant en Haïti. Rejoignez-nous dans cette mission de solidarité.",
      buttonLabel: "Devenez un donateur aujourd'hui",
      buttonLink: '/faire-un-don',
    },
    trustSection: {
      title: 'Pourquoi nous faire confiance ?',
      description:
        "La transparence et l'intégrité sont au cœur de notre action. Nous nous engageons à utiliser chaque don de manière responsable et à rendre compte de nos actions.",
      imageUrl:
        'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&h=500&fit=crop',
      imageAlt: 'Équipe de la fondation',
      reportLabel: 'Voir nos rapports',
      reportLink: '/transparence',
      items: [
        '100% des dons dédiés aux programmes',
        'Rapports financiers publics',
        'Équipe locale engagée',
        'Partenariats avec des écoles vérifiées',
        'Suivi individuel des bénéficiaires',
      ],
    },
  },
  about: {
    seoTitle: 'À propos - Fondation Bien Aimé Cassis',
    seoDescription:
      "Découvrez notre mission, notre vision et nos valeurs. Nous nous engageons pour l'éducation des enfants en Haïti.",
    heroTitle: 'Notre histoire',
    heroDescription:
      "Fondée avec amour et détermination, la Fondation Bien Aimé Cassis œuvre pour un avenir meilleur pour les enfants d'Haïti.",
    storyTitle: 'Qui sommes-nous ?',
    storyImageUrl:
      'https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=600&h=500&fit=crop',
    storyImageAlt: 'Notre histoire',
    storyParagraphs: [
      "La Fondation Bien Aimé Cassis est une organisation à but non lucratif qui œuvre pour améliorer les conditions de vie des enfants défavorisés en Haïti.",
      "Depuis notre création, nous nous engageons à offrir à chaque enfant accès à l'éducation, à une alimentation saine et aux ressources essentielles nécessaires à leur développement personnel et à leur réussite scolaire.",
      "Notre équipe dévouée travaille au quotidien pour construire un avenir où chaque enfant haïtien, indépendamment de sa situation économique, a la possibilité de réaliser son plein potentiel.",
    ],
    missionTitle: 'Notre mission',
    missionDescription:
      "Améliorer les conditions de vie des enfants défavorisés en Haïti en leur donnant accès à l'éducation, à une alimentation saine et aux ressources essentielles nécessaires à leur développement personnel et à leur réussite scolaire.",
    visionTitle: 'Notre vision',
    visionDescription:
      "Construire un avenir où chaque enfant haïtien, indépendamment de sa situation économique, a la possibilité d'aller à l'école, de se nourrir convenablement et de réaliser pleinement son potentiel.",
    valuesTitle: 'Nos valeurs',
    valuesDescription: 'Les principes qui guident notre action au quotidien.',
    values: [
      { title: 'Amour', description: 'Nous agissons avec amour et compassion envers chaque enfant.' },
      { title: 'Intégrité', description: "La transparence et l'honnêteté guident toutes nos actions." },
      { title: 'Solidarité', description: "Nous croyons en la force de la communauté et de l'entraide." },
      { title: 'Excellence', description: 'Nous visons l’excellence dans tous nos programmes éducatifs.' },
    ],
    teamTitle: 'Notre équipe',
    teamDescription: 'Des personnes dévouées qui œuvrent pour le bien-être des enfants.',
    team: [
      {
        name: 'Jean Dupont',
        role: 'Président',
        imageUrl:
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
      },
      {
        name: 'Marie Laurent',
        role: 'Directrice Générale',
        imageUrl:
          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
      },
      {
        name: 'Pierre Bernard',
        role: 'Responsable Programmes',
        imageUrl:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
      },
    ],
  },
  programsPage: {
    seoTitle: 'Nos programmes - Fondation Bien Aimé Cassis',
    seoDescription:
      "Découvrez nos programmes pour soutenir l'éducation et le bien-être des enfants en Haïti : parrainage scolaire, alimentation, vêtements et plus.",
    heroTitle: 'Nos programmes',
    heroDescription:
      'Nous intervenons sur plusieurs axes pour assurer le développement holistique des enfants que nous accompagnons.',
    programs: [
      {
        title: 'Parrainage scolaire',
        description:
          "Financer les frais de scolarité des enfants issus de familles à faible revenu. Notre programme permet à des enfants de poursuivre leur éducation sans avoir à se soucier des coûts.",
        features: ['Frais de scolarité', 'Livres et fournitures', 'Uniformes', 'Suivi scolaire'],
      },
      {
        title: 'Programme alimentaire',
        description:
          'Offrir des repas ou des programmes de nutrition aux enfants vulnérables. Un enfant bien nourri apprend mieux et reste en meilleure santé.',
        features: ['Un repas par jour', 'Nutrition équilibrée', 'Suivi de la santé', 'Éducation nutritionnelle'],
      },
      {
        title: 'Vêtements et chaussures',
        description:
          'Fournir des vêtements et des chaussures aux enfants dans le besoin. Se sentir bien dans ses vêtements contribue à la confiance en soi.',
        features: ['Uniformes scolaires', 'Vêtements adaptés', 'Chaussures', 'Kits saisonniers'],
      },
      {
        title: 'Matériel pédagogique',
        description:
          "Mettre à disposition des livres et du matériel pédagogique pour soutenir l'apprentissage des enfants.",
        features: ['Livres scolaires', 'Cahiers et stylos', 'Matériel artistique', 'Équipement sportif'],
      },
      {
        title: 'Excellence scolaire',
        description:
          "Encourager l'excellence scolaire par des bourses d'études et des récompenses pour motiver les élèves.",
        features: ['Bourses de mérite', 'Récompenses', 'Mentorat', 'Ateliers'],
      },
      {
        title: 'Activités éducatives et culturelles',
        description:
          'Organiser des activités éducatives, culturelles et sportives pour le développement holistique des enfants.',
        features: ['Ateliers culturels', 'Sports', 'Excursions', 'Événements'],
      },
    ],
    impactTitle: 'Notre impact',
    impactParagraphs: [
      "Grâce à vos dons et à l'engagement de nos équipes, nous avons pu accompagner des centaines d'enfants dans leur parcours éducatif.",
      'Chaque programme est conçu pour répondre aux besoins spécifiques des communautés que nous servons, en collaboration avec les écoles et les parents.',
    ],
    impactStats: [
      { value: '250', label: 'Enfants accompagnés' },
      { value: '12', label: 'Écoles partenaires' },
      { value: '35k', label: 'Repas servis' },
      { value: '1.2k', label: 'Kits distribués' },
    ],
  },
  contactPage: {
    seoTitle: 'Contact - Fondation Bien Aimé Cassis',
    seoDescription:
      'Contactez-nous pour en savoir plus sur nos programmes, devenir partenaire ou faire un don.',
    heroTitle: 'Contactez-nous',
    heroDescription:
      "Nous serions ravis de vous entendre ! N'hésitez pas à nous contacter pour toute question.",
    infoTitle: 'Restons en contact',
    infoDescription:
      'Que ce soit pour en savoir plus sur nos programmes, devenir partenaire, faire un don ou simplement nous dire bonjour, notre équipe est là pour vous répondre.',
    formTitle: 'Envoyez-nous un message',
    submitLabel: 'Envoyer le message',
    successMessage: 'Message envoyé avec succès ! Nous vous répondrons bientôt.',
    addressLabel: 'Adresse',
    address: "#57, Route de Dégand, Ruelle Titus Prolongée, Carrefour, Département de l'Ouest, Haïti.",
    phoneLabel: 'Téléphone',
    phone: '+509 31833164',
    emailLabel: 'Email',
    email: 'Cassisb621@yahoo.com',
  },
  transparencyPage: {
    seoTitle: 'Transparence - Fondation Bien Aimé Cassis',
    seoDescription:
      'Découvrez comment nous utilisons vos dons : rapports financiers, impact et transparence totale.',
    heroTitle: 'Transparence',
    heroDescription:
      "La transparence et l'intégrité sont au cœur de notre action. Découvrez comment nous utilisons vos dons.",
    principlesTitle: 'Nos principes',
    principlesDescription: "L'impact de vos dons.",
    principles: [
      {
        title: 'Utilisation responsable des fonds',
        description: '100% des dons sont dédiés aux programmes, moins les frais administratifs limités à 10%.',
      },
      {
        title: 'Rapports réguliers',
        description: "Publication annuelle de nos rapports financiers et d'impact.",
      },
      {
        title: 'Audit indépendant',
        description: 'Nos comptes sont vérifiés annuellement par un cabinet indépendant.',
      },
      {
        title: 'Suivi des bénéficiaires',
        description: 'Suivi individuel de chaque enfant accompagné.',
      },
    ],
    allocationTitle: 'Allocation des dons',
    allocationDescription:
      'Nous nous engageons à utiliser chaque don de manière responsable et efficace. Voici comment sont alloués les fonds que nous recevons.',
    allocationItems: [
      { name: 'Programmes éducatifs', value: 65, color: '#f97316' },
      { name: 'Programme alimentaire', value: 20, color: '#fb923c' },
      { name: 'Administration', value: 10, color: '#fdba74' },
      { name: 'Collectes', value: 5, color: '#fed7aa' },
    ],
    reportsTitle: 'Nos rapports',
    reportsDescription:
      'Téléchargez nos rapports annuels pour découvrir en savoir plus sur notre impact.',
    reports: [
      { year: 2024, title: 'Rapport annuel 2024', download: '#', status: 'Disponible' },
      { year: 2023, title: 'Rapport annuel 2023', download: '#', status: 'Disponible' },
      { year: 2022, title: 'Rapport annuel 2022', download: '#', status: 'Disponible' },
    ],
    impactStats: [
      { value: '250', label: 'Enfants accompagnés' },
      { value: '35k', label: 'Repas servis' },
      { value: '1.2k', label: 'Kits distribués' },
      { value: '12', label: 'Écoles partenaires' },
    ],
    statsDisclaimer: '* Données de démonstration',
  },
  donatePage: {
    seoTitle: 'Faire un don - Fondation Bien Aimé Cassis',
    seoDescription: 'Faites un don pour aider les enfants en Haïti. Chaque contribution compte !',
    heroTitle: 'Faire un don',
    heroDescription:
      "Votre soutien permet de transformer la vie des enfants en Haïti. Chaque don, petit ou grand, compte.",
    impactTitle: 'Votre impact',
    oneTimeLabel: 'Une fois',
    monthlyLabel: 'Mensuel',
    presetAmounts: [25, 50, 100, 200, 500],
    impactRules: [
      { threshold: 25, label: 'Kit scolaire pour un enfant' },
      { threshold: 50, label: 'Uniforme, chaussures et sac scolaire' },
      { threshold: 100, label: 'Soutien alimentaire pour un enfant pendant 3 mois' },
      { threshold: 200, label: 'Parrainage scolaire complet pour un enfant pendant 6 mois' },
      { threshold: 500, label: 'Accompagnement de plusieurs enfants pendant une année' },
    ],
    donorInfoTitle: 'Vos informations',
    paymentNotice: '(Ceci est une démonstration. Aucun paiement réel ne sera effectué.)',
    paymentTitle: 'Paiement',
    successTitle: 'Merci pour votre don !',
    successDescription:
      "Votre générosité va changer la vie d'enfants en Haïti. Un email de confirmation vous a été envoyé.",
    submitLabel: 'Faire un don',
    resetLabel: 'Faire un autre don',
  },
  campaignsPage: {
    seoTitle: 'Nos campagnes - Fondation Bien Aimé Cassis',
    seoDescription:
      'Participez à nos campagnes de collecte pour aider les enfants en Haïti : rentrée scolaire, repas, kits scolaires et plus.',
    heroTitle: 'Nos campagnes',
    heroDescription:
      'Choisissez une campagne qui vous parle et contribuez à faire une différence dans la vie des enfants.',
    donateLabel: 'Faire un don',
  },
  newsPage: {
    seoTitle: 'Actualités - Fondation Bien Aimé Cassis',
    seoDescription:
      "Découvrez nos dernières actualités et l'impact de vos dons sur la vie des enfants en Haïti.",
    heroTitle: 'Actualités',
    heroDescription:
      "Suivez nos dernières nouvelles et découvrez l'impact de votre générosité.",
    readMoreLabel: 'Lire la suite',
  },
  settings: {
    defaultLanguage: 'fr',
    supportedLanguages: ['fr'],
  },
};

export type DefaultSiteContent = typeof defaultSiteContent;
