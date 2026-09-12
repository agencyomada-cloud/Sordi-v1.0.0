import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { MockDashboardPreview } from "./MockDashboardPreview";

export function ResultsBanner() {
  const trackRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start end", "end start"],
  });

  // Side "peek" cards drift in opposite horizontal directions as the
  // section crosses the viewport — a cheap multi-plane depth illusion,
  // GPU-accelerated (transform only, no layout properties).
  const leftX = useTransform(scrollYProgress, [0, 1], [-40, 40]);
  const rightX = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section ref={trackRef} className="py-24 overflow-hidden bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="relative flex items-center justify-center">
          {/* Left peek card */}
          <motion.div
            style={{ x: leftX }}
            className="hidden lg:block absolute left-0 -translate-x-1/3 w-56 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm opacity-70"
          >
            <p className="text-xs text-slate-500 mb-1">Clients actifs</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900">47</p>
          </motion.div>

          {/* Central stat card */}
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="text-center px-8 pt-10 pb-6">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                100% Hors-ligne <span className="text-slate-400">/</span> 0ms Latence
              </h2>
              <p className="mt-3 text-sm text-slate-500 max-w-md mx-auto">
                Aucune donnée cloud, aucune attente réseau — Sordi Finance tourne entièrement sur votre machine.
              </p>
            </div>
            <div className="border-t border-slate-200">
              <MockDashboardPreview />
            </div>
          </div>

          {/* Right peek card */}
          <motion.div
            style={{ x: rightX }}
            className="hidden lg:block absolute right-0 translate-x-1/3 w-56 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm opacity-70"
          >
            <p className="text-xs text-slate-500 mb-1">Factures générées</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900">1 284</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
