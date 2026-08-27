import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BlueprintCanvas } from "./BlueprintCanvas";
import { FloatingCardComposition } from "./FloatingCardComposition";

// Boot-time status copy — cycles once from "booting" to "ready" while the
// splash is up, giving the hairline progress bar something concrete to
// narrate instead of being a bare decorative sliver.
const STATUS_STEPS = [
  { label: "Initialisation du système local...", progress: 18 },
  { label: "Chargement des données...", progress: 62 },
  { label: "Prêt", progress: 100 },
];

interface SplashPosterProps {
  /** Total time the poster is expected to stay mounted — the status/progress
   *  sequence paces itself against this so "Prêt" lands right before the
   *  caller starts the exit transition, instead of drifting independently. */
  durationMs: number;
}

export function SplashPoster({ durationMs }: SplashPosterProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    // Spread the three status steps evenly across the splash's lifetime so
    // "Prêt" resolves right at the end rather than sitting idle.
    const stepMs = durationMs / STATUS_STEPS.length;
    const timers = STATUS_STEPS.slice(1).map((_, i) =>
      setTimeout(() => setStepIndex(i + 1), stepMs * (i + 1))
    );
    return () => timers.forEach(clearTimeout);
  }, [durationMs]);

  const step = STATUS_STEPS[stepIndex];

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      <BlueprintCanvas origin="center" />

      {/* Logo, then the card grid below it — stacked instead of overlapping,
          since the grid's cards now fill their own layout with no empty
          center to float the logo over. */}
      <div className="relative flex w-full max-w-xl flex-col items-center gap-10">
        <motion.img
          src="/brand/sordi-logo.svg"
          alt="Sordi"
          className="relative z-20 h-11 w-auto dark:invert"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1, y: [-3, 3, -3] }}
          transition={{
            opacity: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
            scale: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
            y: { duration: 6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: 0.3 },
          }}
        />

        <div className="relative h-56 w-full">
          <FloatingCardComposition className="absolute inset-0" />
        </div>
      </div>

      {/* Bottom status */}
      <div className="absolute bottom-14 flex w-56 flex-col items-center gap-2.5">
        <p className="font-mono text-[11px] tracking-tight text-slate-500 dark:text-slate-400">{step.label}</p>
        <div className="h-px w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <motion.div
            className="h-full bg-[#EB3B48]"
            initial={{ width: "0%" }}
            animate={{ width: `${step.progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}
