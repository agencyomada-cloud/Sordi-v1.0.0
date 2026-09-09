import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BlueprintCanvas } from "./BlueprintCanvas";

// Boot-time status copy — cycles once while the splash is up, giving the
// hairline progress bar something concrete to narrate.
const STATUS_STEPS = [
  { label: "Initialisation de la base locale...", progress: 22 },
  { label: "Vérification du coffre-fort...", progress: 68 },
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

      {/* Centerpiece — the brand mark alone, breathing behind a soft ambient
          glow. No preview cards, no chart snippets: just the mark. */}
      <div className="relative flex items-center justify-center">
        <div className="absolute -z-10 h-48 w-48 rounded-full bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 blur-3xl animate-pulse duration-1000" />
        <motion.img
          src="/brand/sordi-logo.svg"
          alt="Sordi"
          className="relative z-10 h-11 w-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: [0.98, 1.02, 0.98] }}
          transition={{
            opacity: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
            scale: { duration: 2.6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: 0.3 },
          }}
        />
      </div>

      {/* Precision loading indicator — an ultra-thin Apple-style progress
          track with monospace micro status feedback underneath. The track
          stays a precise 180px; the status line gets its own wider row so
          the longer status strings don't wrap. */}
      <div className="absolute bottom-16 flex flex-col items-center gap-3">
        <div className="h-[2px] w-[180px] overflow-hidden rounded-full bg-slate-200">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: `${step.progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <p className="whitespace-nowrap font-mono text-[11px] tracking-tight text-slate-400">{step.label}</p>
      </div>
    </div>
  );
}
