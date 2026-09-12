import { Button } from "@sordi/ui";
import { RiCheckLine as CheckIcon, RiSecurePaymentLine as BaridiMobIcon, RiBankLine as BankIcon, RiWallet3Line as CcpIcon } from "@remixicon/react";

interface PricingProps {
  onDownload: () => void;
}

const PLANS = [
  {
    name: "Essai 14 jours",
    price: "Gratuit",
    period: "",
    description: "Testez toutes les fonctionnalités sans engagement.",
    features: ["Toutes les fonctionnalités", "Factures & devis illimités", "Support par email"],
    cta: "Commencer l'essai",
    highlighted: false,
  },
  {
    name: "Licence Annuelle",
    price: "À partir de 15 000",
    period: "DA / an",
    description: "Pour les entreprises qui veulent une licence renouvelable.",
    features: ["Toutes les fonctionnalités", "Mises à jour incluses", "Support par email dédié", "1 poste de travail"],
    cta: "Choisir cette offre",
    highlighted: true,
  },
  {
    name: "Licence Définitive",
    price: "Paiement unique",
    period: "à vie",
    description: "Une seule fois, pour toujours — aucun renouvellement.",
    features: ["Toutes les fonctionnalités", "Mises à jour à vie", "Support par email prioritaire", "1 poste de travail"],
    cta: "Choisir cette offre",
    highlighted: false,
  },
];

const PAYMENT_BADGES = [
  { icon: BaridiMobIcon, label: "BaridiMob" },
  { icon: CcpIcon, label: "CCP" },
  { icon: BankIcon, label: "Virement CPA" },
];

export function Pricing({ onDownload }: PricingProps) {
  return (
    <section id="tarifs" className="py-20 bg-white border-t border-slate-200">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            Une tarification simple et transparente
          </h2>
          <p className="mt-3 text-slate-500 max-w-lg mx-auto">
            Paiement par BaridiMob/CCP ou virement CPA — aucune carte bancaire internationale requise.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl bg-white p-6 flex flex-col transition-colors shadow-sm ${
                plan.highlighted ? "border-2 border-slate-900" : "border border-slate-200 hover:border-slate-300"
              }`}
            >
              {plan.highlighted && (
                <span className="self-start rounded-full bg-slate-900 text-white text-[11px] font-medium px-2.5 py-0.5 mb-3">
                  Le plus populaire
                </span>
              )}
              <h3 className="font-semibold text-lg text-slate-900">{plan.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{plan.description}</p>
              <div className="mt-4 mb-6">
                <span className="text-2xl font-semibold text-slate-900">{plan.price}</span>
                {plan.period && <span className="text-sm text-slate-500 ml-1">{plan.period}</span>}
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckIcon className="w-4 h-4 text-slate-900 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={onDownload}
                variant={plan.highlighted ? "default" : "outline"}
                className={plan.highlighted ? "w-full" : "w-full border-slate-200 hover:bg-slate-50"}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-6">
          {PAYMENT_BADGES.map((badge) => (
            <span key={badge.label} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <badge.icon className="w-4 h-4" />
              {badge.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
