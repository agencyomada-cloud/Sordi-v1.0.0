import { motion } from "framer-motion";
import {
  RiFileEditLine as QuoteIcon,
  RiFileTextLine as InvoiceIcon,
  RiFileDownloadLine as PdfIcon,
  RiWalletLine as PaymentIcon,
} from "@remixicon/react";

const STEPS = [
  {
    icon: QuoteIcon,
    step: "01",
    title: "Créez un devis",
    description: "Ajoutez vos produits ou services, la TVA se calcule automatiquement.",
  },
  {
    icon: InvoiceIcon,
    step: "02",
    title: "Transformez en facture",
    description: "Un clic suffit pour convertir un devis accepté en facture conforme.",
  },
  {
    icon: PdfIcon,
    step: "03",
    title: "Exportez en PDF certifié",
    description: "Générez un document conforme, prêt à envoyer par email ou à imprimer.",
  },
  {
    icon: PaymentIcon,
    step: "04",
    title: "Enregistrez l'encaissement",
    description: "Marquez la facture payée et suivez votre trésorerie en temps réel.",
  },
];

export function WorkflowSteps() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            De la première idée à l'encaissement
          </h2>
          <p className="mt-3 text-slate-500 max-w-lg mx-auto">
            Un flux de travail pensé pour aller vite, du devis jusqu'au paiement.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
                whileHover={{ y: -6 }}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-slate-700" />
                  </div>
                  <span className="text-xs font-mono text-slate-400">{item.step}</span>
                </div>
                <h3 className="font-semibold mb-1.5 text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
