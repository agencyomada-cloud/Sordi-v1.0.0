import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileCheck2, LineChart, FileSignature, WifiOff, ChevronDown } from "lucide-react";

const FEATURES = [
  {
    id: "facturation",
    icon: FileCheck2,
    title: "Facturation conforme & rapide",
    description: "Générez des factures et devis conformes à la réglementation algérienne (TVA, timbre fiscal) en quelques secondes.",
  },
  {
    id: "tresorerie",
    icon: LineChart,
    title: "Suivi de trésorerie en temps réel",
    description: "Visualisez recettes, dépenses et créances en attente, mises à jour à chaque encaissement.",
  },
  {
    id: "devis",
    icon: FileSignature,
    title: "Gestion des devis & acomptes",
    description: "Transformez un devis accepté en facture d'un clic, avec suivi des acomptes versés.",
  },
  {
    id: "offline",
    icon: WifiOff,
    title: "Mode hors-ligne complet",
    description: "Travaillez sans connexion internet — vos données restent stockées localement, en toute sécurité.",
  },
] as const;

type FeatureId = (typeof FEATURES)[number]["id"];

function CashflowPreview() {
  const bars = [
    { label: "S1", value: 62 },
    { label: "S2", value: 78 },
    { label: "S3", value: 55 },
    { label: "S4", value: 90 },
  ];
  return (
    <div className="p-6">
      <p className="text-xs font-medium text-neutral-400 mb-4">Recettes hebdomadaires (DZD)</p>
      <div className="flex items-end gap-4 h-32">
        {bars.map((bar) => (
          <div key={bar.label} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full flex items-end justify-center h-24">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${bar.value}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-6 rounded-t-md bg-primary"
              />
            </div>
            <span className="text-[10px] text-neutral-400 font-medium">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoicePreview() {
  return (
    <div className="p-6 space-y-3">
      <div className="rounded-xl border border-neutral-200/80 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-neutral-900">FA-2026-0158</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Payée</span>
        </div>
        <p className="text-xl font-bold tabular-nums text-neutral-900">156 800 DA</p>
      </div>
      <div className="rounded-xl border border-neutral-200/80 p-4 opacity-60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-neutral-900">DV-2026-0034</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Devis envoyé</span>
        </div>
        <p className="text-xl font-bold tabular-nums text-neutral-900">131 765 DA</p>
      </div>
    </div>
  );
}

function OfflinePreview() {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full text-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
        <WifiOff className="w-6 h-6 text-primary" />
      </div>
      <p className="text-sm font-semibold text-neutral-900">Aucune connexion requise</p>
      <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        Moteur natif SQLite local
      </div>
    </div>
  );
}

const PREVIEWS: Record<FeatureId, React.ReactNode> = {
  facturation: <InvoicePreview />,
  tresorerie: <CashflowPreview />,
  devis: <InvoicePreview />,
  offline: <OfflinePreview />,
};

export function FeatureShowcase() {
  const [active, setActive] = useState<FeatureId>("facturation");

  return (
    <section id="demo" className="py-24 bg-neutral-50/60">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">Conçu pour aller vite</h2>
          <p className="mt-3 text-neutral-500 max-w-lg mx-auto">
            Une application qui remplace vos tableurs, sans la complexité d'un logiciel cloud.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              const isActive = active === feature.id;
              return (
                <div
                  key={feature.id}
                  className={`rounded-xl border transition-colors ${
                    isActive ? "border-primary/30 bg-white shadow-sm" : "border-transparent"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActive(feature.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isActive ? "bg-primary text-primary-foreground" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <span className={`flex-1 font-semibold text-sm ${isActive ? "text-neutral-900" : "text-neutral-600"}`}>
                      {feature.title}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ${isActive ? "rotate-180" : ""}`}
                    />
                  </button>
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-4 pl-16 text-sm text-neutral-500 leading-relaxed -mt-1">{feature.description}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-xl shadow-neutral-900/5 overflow-hidden min-h-[280px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {PREVIEWS[active]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
