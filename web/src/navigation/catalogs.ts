// Keep both translations beside their shared key so catalog structure is defined once.
const messages = {
  'workspace.buy': ['Buyer workspace', 'Espace acheteur'],
  'workspace.sell': ['Supplier workspace', 'Espace fournisseur'],
  'workspace.admin': ['Platform administration', 'Administration de la plateforme'],
  'workspace.records': ['Records workspace', 'Espace des dossiers'],
  'nav.my-trades': ['My trades', 'Mes transactions'],
  'nav.find-supply': ['Find supply', 'Trouver une offre'],
  'nav.sourcing-requests': ['Sourcing requests', 'Demandes d’approvisionnement'],
  'nav.my-supply': ['My supply', 'Mon offre'],
  'nav.sources': ['Sources & plots', 'Sources et parcelles'],
  'nav.documents': ['Documents & evidence', 'Documents et preuves'],
  'nav.traceability': ['Product traceability', 'Traçabilité des produits'],
  'nav.records': ['Records', 'Dossiers'],
  'nav.trade-registers': ['Trade registers', 'Registres commerciaux'],
  'nav.goods-payments': ['Goods payments', 'Paiements des marchandises'],
  'nav.fee-verification': ['Fee verification', 'Vérification des frais'],
  'nav.administration': ['Administration', 'Administration'],
  'nav.network-overview': ['Network overview', 'Vue du réseau'],
  'nav.team': ['Team & access', 'Équipe et accès'],
  'nav.help': ['Help', 'Aide'],
  'nav.help-safety': ['Help & safety', 'Aide et sécurité'],
  'nav.navigation': ['Workspace navigation', 'Navigation de l’espace'],
  'nav.workspace': ['Workspace', 'Espace de travail'],
  'nav.create-request': ['Create sourcing request', 'Créer une demande'],
  'nav.account-help': ['Account & workspace help', 'Compte et aide de l’espace'],
  'nav.awaiting-supplier': [
    'offers awaiting supplier response',
    'offres en attente du fournisseur',
  ],
  'nav.awaiting-you': ['offers awaiting your response', 'offres en attente de votre réponse'],
  'nav.admin-home': ['Platform review workspace', 'Espace de contrôle de la plateforme'],
  'nav.review-home-description': [
    'Choose a review queue or authorized record below. Open the workspace selector to switch to a trading workspace where permitted.',
    'Choisissez une file de contrôle ou un dossier autorisé. Le sélecteur permet de changer d’espace selon vos droits.',
  ],
  'nav.requests-denied': [
    'Sourcing requests require buyer access and supply-read permission.',
    'Les demandes nécessitent un accès acheteur et le droit de consulter les offres.',
  ],
  'nav.search-requests': ['Search your sourcing requests', 'Rechercher vos demandes'],
  'nav.loading-requests': ['Loading sourcing requests…', 'Chargement des demandes…'],
  'nav.requests-failed': [
    'Sourcing requests could not be loaded. No empty result is assumed.',
    'Impossible de charger les demandes. Aucun résultat vide n’est supposé.',
  ],
  'nav.retry-requests': ['Retry sourcing requests', 'Réessayer les demandes'],
  'nav.no-requests': [
    'No saved sourcing requests match this search.',
    'Aucune demande enregistrée ne correspond à cette recherche.',
  ],
  'nav.review-request': ['Review request', 'Consulter la demande'],
  'nav.find-matches': ['Find matching supply', 'Trouver des offres correspondantes'],
  'title.sourcing-requests': ['Sourcing requests', 'Demandes d’approvisionnement'],
  'description.sourcing-requests': [
    'Your saved briefs, matching supply and request status.',
    'Vos besoins enregistrés, les offres correspondantes et leur état.',
  ],
  'request-status.draft': ['Draft', 'Brouillon'],
  'request-status.open': ['Open', 'Ouverte'],
  'request-status.awarded': ['Awarded', 'Attribuée'],
  'request-status.closed': ['Closed', 'Clôturée'],
  'request-status.cancelled': ['Cancelled', 'Annulée'],
} as const satisfies Record<string, readonly [string, string]>;

type NavigationKey = keyof typeof messages;
function catalog(language: 0 | 1): Record<NavigationKey, string> {
  return Object.fromEntries(
    Object.entries(messages).map(([key, translations]) => [key, translations[language]]),
  ) as Record<NavigationKey, string>;
}

export const navigationEnglish = catalog(0);
export const navigationFrench = catalog(1);
