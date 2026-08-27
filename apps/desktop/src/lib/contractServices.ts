import type { ContractServiceKey, ContractPaymentSplit } from "@/lib/database";

export interface ContractServiceDefinition {
  key: ContractServiceKey;
  label: string;
  /** Short deliverable list shown as the Article 1 scope line for this service. */
  deliverables: string[];
  /** Article 2 technical clause specific to this service — Algerian-law-aware wording. */
  technicalClause: string;
}

/**
 * The six service lines Omada contracts against, in the fixed display order
 * used everywhere (badge selector, Article 1 listing, Article 2 clause
 * ordering) — not alphabetical, deliberately matches the order the business
 * quotes services in.
 */
export const CONTRACT_SERVICE_CATALOG: ContractServiceDefinition[] = [
  {
    key: "branding",
    label: "Branding & Identité Visuelle",
    deliverables: ["Logo vectoriel", "Charte graphique", "Packaging"],
    technicalClause:
      "Cession des droits d'exploitation commerciale du logo sous condition suspensive de paiement intégral. " +
      "Deux (02) pistes graphiques initiales et deux (02) cycles de révisions inclus.",
  },
  {
    key: "web_vitrine",
    label: "Site Web Vitrine & Corporate",
    deliverables: ["Design UI/UX", "Intégration responsive", "SEO"],
    technicalClause:
      "Garantie technique et correction des anomalies de soixante (60) jours après mise en production. " +
      "Transmission du code source et des accès administrateur après encaissement du solde.",
  },
  {
    key: "ecommerce",
    label: "Plateforme E-Commerce & Web App",
    deliverables: ["Catalogue", "Passerelle de livraison/Paiement"],
    technicalClause:
      "Garantie technique et correction des anomalies de soixante (60) jours après mise en production. " +
      "Transmission du code source et des accès administrateur après encaissement du solde.",
  },
  {
    key: "marketing",
    label: "Marketing Digital & Gestion Réseaux Sociaux",
    deliverables: ["Stratégie", "Calendrier", "SMM"],
    technicalClause:
      "Prestation soumise à une obligation de moyens. Les budgets d'achat publicitaire (Meta/Google Ads) " +
      "sont à la charge exclusive du Client et dissociés des honoraires de gestion.",
  },
  {
    key: "media_shooting",
    label: "Production Média & Shooting Produits",
    deliverables: ["Packshots HD", "Retouches", "Détourage"],
    technicalClause:
      "Droit d'utilisation commerciale des supports finaux. Toute modification de brief après validation " +
      "du planning de shooting fera l'objet d'une tarification complémentaire.",
  },
  {
    key: "video_ads",
    label: "Vidéo Publicitaire & Motion Design",
    deliverables: ["Scénario", "Tournage", "Montage", "Voix-off"],
    technicalClause:
      "Droit d'utilisation commerciale des supports finaux. Toute modification de brief après validation " +
      "du scénario/tournage fera l'objet d'une tarification complémentaire.",
  },
];

export function getContractService(key: ContractServiceKey): ContractServiceDefinition | undefined {
  return CONTRACT_SERVICE_CATALOG.find((s) => s.key === key);
}

export interface ContractPaymentTranche {
  /** "acompte" (first/only), "tranche_2" (middle, 3-tranche split only), or "solde" (last). */
  role: "acompte" | "tranche_2" | "solde";
  label: string;
  /** Fraction of total_amount_ttc, e.g. 0.5 for 50%. */
  fraction: number;
  /** Article 3 condition text for this milestone. */
  condition: string;
}

export interface ContractPaymentSplitDefinition {
  key: ContractPaymentSplit;
  label: string;
  tranches: ContractPaymentTranche[];
}

export const CONTRACT_PAYMENT_SPLITS: ContractPaymentSplitDefinition[] = [
  {
    key: "50_50",
    label: "50% / 50%",
    tranches: [
      {
        role: "acompte",
        label: "Acompte de démarrage",
        fraction: 0.5,
        condition: "Exigible à la signature pour engagement des équipes et validation du rétroplanning.",
      },
      {
        role: "solde",
        label: "Solde de clôture",
        fraction: 0.5,
        condition: "Exigible préalablement à la livraison définitive des livrables HD, codes sources et mise en ligne.",
      },
    ],
  },
  {
    key: "100",
    label: "100% — Paiement unique / Comptant",
    tranches: [
      {
        role: "acompte",
        label: "Paiement unique",
        fraction: 1,
        condition: "Exigible intégralement à la signature du présent contrat.",
      },
    ],
  },
  {
    key: "30_40_30",
    label: "3 tranches — 30% / 40% / 30%",
    tranches: [
      {
        role: "acompte",
        label: "Acompte de démarrage",
        fraction: 0.3,
        condition: "Exigible à la signature pour engagement des équipes et validation du rétroplanning.",
      },
      {
        role: "tranche_2",
        label: "Tranche intermédiaire",
        fraction: 0.4,
        condition: "Exigible à mi-parcours, à la validation de l'étape intermédiaire du projet.",
      },
      {
        role: "solde",
        label: "Solde de clôture",
        fraction: 0.3,
        condition: "Exigible préalablement à la livraison définitive des livrables HD, codes sources et mise en ligne.",
      },
    ],
  },
];

export function getPaymentSplit(key: ContractPaymentSplit): ContractPaymentSplitDefinition {
  return CONTRACT_PAYMENT_SPLITS.find((s) => s.key === key) ?? CONTRACT_PAYMENT_SPLITS[0];
}
