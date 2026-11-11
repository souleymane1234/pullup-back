export const COMMISSION = 0.15;
export const MIN_RATE = 5000;
export const MAX_BRIEF_WORDS = 160;
export const MAX_FILE_SIZE = 9 * 1024 * 1024;
export const AUTO_VALIDATE_HOURS = 72;

export const CATS = {
  humour: 'Humour & divertissement',
  beaute: 'Mode & beauté',
  tech: 'Hi-tech & innovation',
  sport: 'Sport & bien-être',
  food: 'Food & maquis',
  actu: 'Actualités & médias',
  musique: 'Musique & danse',
  business: 'Vente & entrepreneuriat',
  societe: 'Société & lifestyle',
  jeux: 'Jeux & paris sportifs',
  amour: 'Amour & rencontres',
} as const;

export const RELATED = {
  beaute: ['societe', 'business', 'amour'],
  tech: ['jeux', 'business', 'actu'],
  humour: ['societe', 'musique', 'amour'],
  sport: ['jeux', 'societe'],
  food: ['societe', 'humour'],
  actu: ['societe', 'tech'],
  musique: ['humour', 'societe'],
  business: ['tech', 'beaute', 'actu'],
  societe: ['humour', 'beaute', 'food'],
  jeux: ['tech', 'sport', 'humour'],
  amour: ['societe', 'humour'],
} as const;

export const NET = {
  ig: { l: 'Instagram', reach: 0.3 },
  tt: { l: 'TikTok', reach: 0.42 },
  fb: { l: 'Facebook', reach: 0.16 },
  sc: { l: 'Snapchat', reach: 0.26 },
} as const;

export const OBJ = {
  notoriete: 'Notoriété',
  engagement: 'Engagement',
  trafic: 'Trafic',
  conversion: 'Conversion',
} as const;

export const AGES = ['13-17', '18-24', '25-34', '35+'] as const;

export const PAY = {
  om: 'Orange Money',
  mtn: 'MTN MoMo',
  moov: 'Moov Money',
  wave: 'Wave',
  card: 'Carte Visa / MC',
} as const;

export const WITHDRAW_OPERATORS = ['om', 'mtn', 'moov', 'wave'] as const;

export const PLANS = {
  free: {
    l: 'Découverte',
    p: 0,
    monthlyCampaigns: 3,
    fullMatching: false,
    predictions: false,
    utm: false,
    exportCsv: false,
  },
  pro: {
    l: 'Pro',
    p: 15000,
    monthlyCampaigns: 5,
    fullMatching: true,
    predictions: true,
    utm: true,
    exportCsv: false,
  },
  business: {
    l: 'Business',
    p: 75000,
    monthlyCampaigns: Infinity,
    fullMatching: true,
    predictions: true,
    utm: true,
    exportCsv: true,
  },
} as const;

export const BOOSTS = {
  pro: { l: 'Influenceur Pro', p: 5000 },
  certified: { l: 'Certifié', p: 10000 },
  analytics: { l: 'Analytics avancées', p: 15000 },
} as const;

export const CITIES = [
  'Abidjan',
  'Bouaké',
  'Yamoussoukro',
  'San-Pédro',
  'Daloa',
  'Korhogo',
] as const;
export const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
export const CONTACT_TYPES = ['Publicité', 'Partenariat', 'Dédicace'] as const;

export const RECO_BY_OBJECTIVE = {
  notoriete: 'Campagnes de notoriété',
  engagement: 'Challenges et concours',
  trafic: 'Activations digitales',
  conversion: 'Lancements de produits',
} as const;

export const HELD_STATUSES = [
  'paid',
  'accepted',
  'published',
  'dispute',
] as const;
export const REFUNDED_STATUSES = ['declined', 'cancelled', 'refunded'] as const;

export const STATUS = {
  awaiting_payment: { l: 'En attente de paiement' },
  paid: { l: "En attente de l'influenceur" },
  accepted: { l: 'Acceptée · en préparation' },
  published: { l: 'Publiée · à valider' },
  completed: { l: 'Terminée · fonds libérés' },
  dispute: { l: 'Litige en cours' },
  declined: { l: 'Refusée · remboursée' },
  cancelled: { l: 'Annulée · remboursée' },
  refunded: { l: 'Remboursée (litige)' },
} as const;

export type CatKey = keyof typeof CATS;
export type NetKey = keyof typeof NET;
export type PayKey = keyof typeof PAY;
export type PlanKey = keyof typeof PLANS;
