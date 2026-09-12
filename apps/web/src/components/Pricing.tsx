import { Check, Wallet, Landmark, ShieldCheck } from "lucide-react";

interface PricingProps {
  onDownload: () => void;
}

const PLANS = [
  {
    name: "Essai gratuit",
    price: "0 DA",
    period: "14 jours",
    description: "Testez toutes les fonctionnalités sans engagement.",
    features: ["Toutes les fonctionnalités", "Factures & devis illimités", "Support par email"],
    cta: "Commencer l'essai",
    highlighted: false,
  },
  {
    name: "Forfait Annuel",
    price: "15 000 DA",
    period: "/ an",
    description: "Pour les entreprises qui veulent une licence renouvelable.",
    features: ["Toutes les fonctionnalités", "Mises à jour incluses", "Support par email dédié", "1 poste de travail"],
    cta: "Choisir cette offre",
    highlighted: true,
  },
  {
    name: "Forfait Illimité",
    price: "Paiement unique",
    period: "à vie",
    description: "Une seule fois, pour toujours — aucun renouvellement.",
    features: ["Toutes les fonctionnalités", "Mises à jour à vie", "Support par email prioritaire", "1 poste de travail"],
    cta: "Choisir cette offre",
    highlighted: false,
  },
];

const PAYMENT_BADGES = [
  { icon: Wallet, label: "BaridiMob" },
  { icon: ShieldCheck, label: "CCP" },
  { icon: Landmark, label: "Virement CPA" },
];

export function Pricing({ onDownload }: PricingProps) {
  return (
    <section id="tarifs" className="py-24 bg-white border-t border-neutral-200/80">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">
            Une tarification simple et transparente
          </h2>
          <p className="mt-3 text-neutral-500 max-w-lg mx-auto">
            Paiement par BaridiMob/CCP ou virement CPA — aucune carte bancaire internationale requise.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl bg-white p-6 flex flex-col transition-colors ${
                plan.highlighted
                  ? "border-2 border-primary shadow-xl shadow-primary/10"
                  : "border border-neutral-200/80 hover:border-neutral-300"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold px-3 py-1 shadow-sm">
                  Populaire
                </span>
              )}
              <h3 className="font-semibold text-lg text-neutral-900">{plan.name}</h3>
              <p className="text-sm text-neutral-500 mt-1">{plan.description}</p>
              <div className="mt-4 mb-6">
                <span className="text-2xl font-bold text-neutral-900">{plan.price}</span>
                {plan.period && <span className="text-sm text-neutral-500 ml-1">{plan.period}</span>}
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-neutral-700">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onDownload}
                className={`w-full h-11 rounded-full text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                    : "border border-neutral-200/80 text-neutral-900 hover:bg-neutral-50"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-6">
          {PAYMENT_BADGES.map((badge) => (
            <span key={badge.label} className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <badge.icon className="w-4 h-4" />
              {badge.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
