import { motion } from "framer-motion";
import { TrendingUp, Clock, CreditCard, FileText } from "lucide-react";

/**
 * The "fake floating interface cards" composition under the hero headline —
 * four small cards echoing real Sordi data shapes (revenue, receivables, a
 * payment method, an invoice excerpt), tilted and layered like the bento/
 * floating-UI fintech reference rather than a single flat screenshot.
 */
export function FloatingCards() {
  return (
    <div className="relative mt-16 h-[360px] sm:h-[420px] max-w-3xl mx-auto">
      {/* Central invoice excerpt — the anchor card, largest and frontmost */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[280px] sm:w-[320px] rounded-2xl border border-neutral-200/80 bg-white shadow-xl shadow-neutral-900/10 p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-neutral-900">FA-2026-0158</span>
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Payée</span>
        </div>
        <p className="text-[11px] text-neutral-400 mb-1">SARL Atlas Digital</p>
        <p className="text-2xl font-bold tabular-nums text-neutral-900 mb-4">156 800 DA</p>
        <div className="space-y-1.5 border-t border-neutral-100 pt-3">
          <div className="flex justify-between text-[11px] text-neutral-500">
            <span>Montant HT</span>
            <span className="tabular-nums text-neutral-700">131 765 DA</span>
          </div>
          <div className="flex justify-between text-[11px] text-neutral-500">
            <span>TVA (19%)</span>
            <span className="tabular-nums text-neutral-700">25 035 DA</span>
          </div>
        </div>
      </motion.div>

      {/* Revenue card — top-left, slight tilt */}
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: -8 }}
        animate={{ opacity: 1, y: 0, rotate: -6 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.25 }}
        className="absolute left-0 top-0 sm:left-4 z-10 w-[190px] rounded-2xl border border-neutral-200/80 bg-white shadow-lg shadow-neutral-900/5 p-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[11px] font-medium text-neutral-500">Chiffre d'affaires HT</span>
        </div>
        <p className="text-lg font-bold tabular-nums text-neutral-900">2 480 500 DA</p>
        <p className="text-[11px] text-emerald-600 font-medium mt-0.5">+12,4% ce mois</p>
      </motion.div>

      {/* Pending receivables card — top-right, opposite tilt */}
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: 8 }}
        animate={{ opacity: 1, y: 0, rotate: 6 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.35 }}
        className="absolute right-0 top-4 sm:right-4 z-10 w-[190px] rounded-2xl border border-neutral-200/80 bg-white shadow-lg shadow-neutral-900/5 p-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <span className="text-[11px] font-medium text-neutral-500">Créances en attente</span>
        </div>
        <p className="text-lg font-bold tabular-nums text-neutral-900">184 200 DA</p>
        <p className="text-[11px] text-neutral-400 font-medium mt-0.5">3 factures</p>
      </motion.div>

      {/* Payment card — bottom, small accent detail */}
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: -4 }}
        animate={{ opacity: 1, y: 0, rotate: -3 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.45 }}
        className="absolute left-4 bottom-0 sm:left-10 z-30 w-[150px] rounded-xl bg-neutral-900 text-white shadow-lg shadow-neutral-900/20 p-3.5"
      >
        <CreditCard className="w-4 h-4 text-primary mb-3" />
        <p className="text-[9px] text-neutral-400 tracking-widest uppercase mb-1">Licence Sordi Pro</p>
        <p className="text-xs font-mono tracking-wider">•••• 4471</p>
      </motion.div>
    </div>
  );
}
