import { motion } from "framer-motion";
import { RiArrowUpSFill, RiFlashlightFill } from "@remixicon/react";

// Shared micro-UI composition rendered both by the boot splash and the
// Auth.tsx left hero panel — kept as one component so the two contexts stay
// pixel-identical and the splash-to-login handoff reads as a continuous
// scene, not two independently-drifted mockups.
//
// Laid out as a real CSS grid (two columns, card 1 spans both rows on the
// left) instead of hand-tuned absolute x/y pixel offsets — every card
// shares the same gutter and baseline instead of floating at independently
// eyeballed positions. The gentle bob is still done with framer-motion, but
// now as a small relative `y` wiggle applied on top of the grid position
// rather than the position itself.

const bobTransition = (delay: number) => ({
  opacity: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const, delay },
  scale: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const, delay },
  y: { duration: 6, repeat: Infinity, repeatType: "mirror" as const, ease: "easeInOut" as const, delay: delay + 0.3 },
});

const cardEntrance = (delay: number, bob: number) => ({
  initial: { opacity: 0, scale: 0.96, y: 0 },
  animate: { opacity: 1, scale: 1, y: [-bob, bob, -bob] },
  transition: bobTransition(delay),
});

// Card 1's embedded flow chart — six past months in a muted neutral tone,
// the seventh (current) month highlighted in Sordi coral, per spec.
const FLOW_BARS = [40, 55, 48, 62, 58, 70, 90];

interface FloatingCardCompositionProps {
  className?: string;
}

export function FloatingCardComposition({ className }: FloatingCardCompositionProps) {
  return (
    <div className={className}>
      <div className="grid h-full w-full max-w-md grid-cols-2 grid-rows-2 gap-6 mx-auto">
        {/* Card 1 — Financial Revenue & Treasury Flow Card, left column, spans both rows */}
        <motion.div className="row-span-2 flex items-stretch" {...cardEntrance(0.05, 6)}>
          <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-2xl bg-[#0E0F13] p-5 shadow-2xl">
            {/* Glassmorphic frost layer — the spec's literal
                bg-white/[0.04] backdrop-blur-xl border border-white/[0.09],
                layered over a dark backing so the white text it's designed
                for actually has contrast (this card floats on the light
                splash/panel background, not a dark app surface). */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/[0.09] bg-white/[0.04] backdrop-blur-xl" />

            <div>
              <div className="relative flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <p className="text-[8px] font-medium uppercase tracking-wider text-white/40">
                  Flux de Trésorerie &amp; Chiffre d'Affaires
                </p>
              </div>

              <div className="relative mt-3 flex items-end gap-2">
                <p className="whitespace-nowrap text-[17px] font-bold tabular-nums text-white">3 840 000,00 DZD</p>
              </div>
              <span className="relative mt-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                <RiArrowUpSFill className="h-2.5 w-2.5" />
                +16.8% ce mois
              </span>
            </div>

            {/* Embedded flow chart — muted past months, current month in coral */}
            <div className="relative flex h-14 items-end gap-1.5">
              {FLOW_BARS.map((h, i) => {
                const isCurrent = i === FLOW_BARS.length - 1;
                return (
                  <div
                    key={i}
                    className={isCurrent ? "flex-1 rounded-sm bg-[#EB3B48]" : "flex-1 rounded-sm bg-white/15"}
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Card 2 — Smart Revenue Goal Pill, top-right */}
        <motion.div className="flex items-end" {...cardEntrance(0.18, 5)}>
          <div className="relative w-full">
            {/* Offset stacked layer underneath for physical depth */}
            <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl bg-white/50 dark:bg-white/[0.03]" />
            <div className="relative flex items-center gap-3 rounded-2xl border border-black/[0.04] bg-white px-4 py-3.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] dark:border-white/[0.06] dark:bg-[#16171C]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EB3B48]/10 text-[#EB3B48]">
                <RiFlashlightFill className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Objectif Mensuel</p>
                <div className="flex items-center gap-1.5">
                  <p className="whitespace-nowrap text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">1 350 000 DZD</p>
                  <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
                    <RiArrowUpSFill className="h-2.5 w-2.5" />
                    18.5%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card 3 — Analytics Sparkline Preview, bottom-right */}
        <motion.div className="flex items-start" {...cardEntrance(0.32, 4)}>
          <div className="w-full rounded-2xl border border-black/[0.04] bg-white/90 p-3.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#16171C]/90">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Performances du mois</p>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </div>
            <svg viewBox="0 0 160 48" className="h-12 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EB3B48" stopOpacity="0.2" />
                  <stop offset="55%" stopColor="#EB3B48" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#EB3B48" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,36 C14,30 22,14 36,16 C50,18 56,38 70,34 C84,30 92,8 106,10 C120,12 128,30 142,24 C150,20 155,22 160,18 L160,48 L0,48 Z"
                fill="url(#sparkline-fill)"
              />
              <path
                d="M0,36 C14,30 22,14 36,16 C50,18 56,38 70,34 C84,30 92,8 106,10 C120,12 128,30 142,24 C150,20 155,22 160,18"
                fill="none"
                stroke="#EB3B48"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
