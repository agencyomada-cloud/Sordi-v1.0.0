import { motion } from "framer-motion";
import { Clock3, ShieldCheck, Zap } from "lucide-react";

const METRICS = [
  { icon: Clock3, value: "5h+", label: "Temps gagné par semaine sur la facturation" },
  { icon: ShieldCheck, value: "100%", label: "Fiabilité hors-ligne — aucune dépendance réseau" },
  { icon: Zap, value: "0", label: "Friction d'installation — prêt en moins de 2 minutes" },
];

export function Metrics() {
  return (
    <section className="py-20 bg-white border-t border-neutral-200/80">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {METRICS.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
                className="text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-4xl font-bold tracking-tight text-neutral-900">{metric.value}</p>
                <p className="mt-2 text-sm text-neutral-500 max-w-[220px] mx-auto">{metric.label}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
