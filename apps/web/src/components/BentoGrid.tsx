import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiExchangeDollarLine as CashflowIcon,
  RiFileDownloadLine as PdfIcon,
  RiDatabase2Line as VaultIcon,
  RiFileEditLine as QuoteIcon,
  RiTruckLine as DeliveryIcon,
  RiFileTextLine as InvoiceIcon,
} from "@remixicon/react";

type Period = "mois" | "trimestre";

const CASHFLOW_DATA: Record<Period, { label: string; recettes: number; depenses: number }[]> = {
  mois: [
    { label: "S1", recettes: 62, depenses: 38 },
    { label: "S2", recettes: 78, depenses: 42 },
    { label: "S3", recettes: 55, depenses: 30 },
    { label: "S4", recettes: 90, depenses: 48 },
  ],
  trimestre: [
    { label: "Jul", recettes: 70, depenses: 45 },
    { label: "Aoû", recettes: 85, depenses: 50 },
    { label: "Sep", recettes: 95, depenses: 40 },
  ],
};

const CASHFLOW_TOTAL: Record<Period, string> = {
  mois: "1 240 500 DA",
  trimestre: "3 685 000 DA",
};

function CashflowCard() {
  const [period, setPeriod] = useState<Period>("mois");
  const data = CASHFLOW_DATA[period];

  return (
    <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
            <CashflowIcon className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Trésorerie & Encaissements en Temps Réel</h3>
            <p className="text-xs text-slate-500">Recettes vs Dépenses (DZD)</p>
          </div>
        </div>
        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
          {(["mois", "trimestre"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                period === p ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {p === "mois" ? "Ce mois-ci" : "Ce trimestre"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-6 h-32">
        {data.map((bar) => (
          <div key={bar.label} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full flex items-end justify-center gap-1.5 h-24">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${bar.recettes}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-3.5 rounded-t-sm bg-rose-500"
              />
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${bar.depenses}%` }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
                className="w-3.5 rounded-t-sm bg-slate-300"
              />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{bar.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            Recettes
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" />
            Dépenses
          </span>
        </div>
        <span className="text-xs text-slate-500">
          Total encaissé : <span className="font-semibold text-slate-900">{CASHFLOW_TOTAL[period]}</span>
        </span>
      </div>
    </div>
  );
}

const RECEIVABLES_ROWS = [
  { client: "SARL Atlas Digital", amount: "156 800 DA", status: "En retard" as const },
  { client: "EURL Nomad Solutions", amount: "89 400 DA", status: "Réglé" as const },
  { client: "SARL Kahina Trading", amount: "212 300 DA", status: "En retard" as const },
];

const RECEIVABLES_STATUS_STYLE: Record<string, string> = {
  "En retard": "bg-rose-50 text-rose-600 border-rose-200",
  "Réglé": "bg-slate-100 text-slate-600 border-slate-200",
};

function ReceivablesCard() {
  const [generated, setGenerated] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-300">
      <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center mb-4">
        <PdfIcon className="w-5 h-5 text-rose-600" />
      </div>
      <h3 className="font-semibold text-slate-900 mb-1">Suivi des Créances & Délais</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-4">Ne perdez plus jamais le fil de vos impayés.</p>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 mb-4">
        {RECEIVABLES_ROWS.map((row) => (
          <div key={row.client} className="flex items-center justify-between text-sm">
            <span className="text-slate-700 truncate">{row.client}</span>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="font-medium tabular-nums text-slate-900">{row.amount}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${RECEIVABLES_STATUS_STYLE[row.status]}`}>
                {row.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setGenerated(true)}
        disabled={generated}
        className={`w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-semibold transition-colors ${
          generated ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-slate-900 text-white hover:bg-slate-800"
        }`}
      >
        <PdfIcon className="w-4 h-4" />
        {generated ? "Relevé généré !" : "Générer relevé de compte (PDF)"}
      </button>
    </div>
  );
}

function LocalSecurityCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-300">
      <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center mb-4">
        <VaultIcon className="w-5 h-5 text-rose-600" />
      </div>
      <h3 className="font-semibold text-slate-900 mb-1">Moteur 100% Hors-ligne & Sécurité Locale</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-5">
        Aucun serveur cloud tiers. Vos données restent chiffrées, localement.
      </p>

      <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
        </span>
        0.0 ms • Moteur natif SQLite/Tauri
      </div>
    </div>
  );
}

type DocType = "devis" | "livraison" | "facture";

const TVA_RATE = 0.19;
const TIMBRE_FISCAL = 500;

const DOC_STEPS: { id: DocType; label: string; icon: React.ElementType; title: string; ref: string; ht: number; hasTimbre: boolean }[] = [
  { id: "devis", label: "Devis", icon: QuoteIcon, title: "Devis", ref: "DV-2026-0034", ht: 131765, hasTimbre: false },
  { id: "livraison", label: "Bon de Livraison", icon: DeliveryIcon, title: "Bon de livraison", ref: "BL-2026-0034", ht: 131765, hasTimbre: false },
  { id: "facture", label: "Facture", icon: InvoiceIcon, title: "Facture", ref: "FA-2026-0158", ht: 131765, hasTimbre: true },
];

function formatDA(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR")} DA`;
}

function DocumentSwitcherCard() {
  const [active, setActive] = useState<DocType>("devis");
  const activeStep = DOC_STEPS.find((s) => s.id === active)!;
  const ActiveIcon = activeStep.icon;

  const tva = activeStep.ht * TVA_RATE;
  const timbre = activeStep.hasTimbre ? TIMBRE_FISCAL : 0;
  const ttc = activeStep.ht + tva + timbre;

  return (
    <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-300">
      <h3 className="font-semibold text-slate-900 mb-1">Édition Directe de Documents</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-5">
        Un même document, transformé à chaque étape — sans ressaisie.
      </p>

      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 mb-5">
        {DOC_STEPS.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setActive(step.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active === step.id ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {step.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                <ActiveIcon className="w-4 h-4 text-slate-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{activeStep.title}</p>
                <p className="text-[11px] font-mono text-slate-400">{activeStep.ref}</p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Montant HT</span>
              <span className="font-medium tabular-nums text-slate-900">{formatDA(activeStep.ht)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">TVA (19%)</span>
              <span className="font-medium tabular-nums text-slate-900">{formatDA(tva)}</span>
            </div>
            {activeStep.hasTimbre && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Timbre fiscal</span>
                <span className="font-medium tabular-nums text-slate-900">{formatDA(TIMBRE_FISCAL)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
              <span className="text-sm font-semibold text-slate-900">Total TTC</span>
              <span className="text-sm font-bold tabular-nums text-slate-900">{formatDA(ttc)}</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function BentoGrid() {
  return (
    <section id="fonctionnalites" className="py-24 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            Tout ce dont vous avez besoin
          </h2>
          <p className="mt-3 text-slate-500 max-w-lg mx-auto">
            Sordi Finance remplace vos tableurs et vos outils dispersés par une seule application, rapide et fiable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CashflowCard />
          <ReceivablesCard />
          <LocalSecurityCard />
          <DocumentSwitcherCard />
        </div>
      </div>
    </section>
  );
}
