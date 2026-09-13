import { motion } from "framer-motion";

export type CopilotOrbState = "idle" | "analyzing" | "success";

// The exact 6 petal paths from the real Sordi icon (src-tauri/icons'
// source SVG) — not a generic "AI orb" shape invented for this feature.
// viewBox is the icon's own 24.59×24.59, so these paths need no
// transformation to line up; the whole ring's rotation pivots on the
// icon's own center, (12.295, 12.295).
const PETALS = [
  "M12.67,9.54c.1,0,.2-.02.29-.05.31-.12.67-.45.65-1.42-.01-.59-.17-1.32-.44-2.05-.44-1.16-1.26-2.52-2.15-2.52-.1,0-.2.02-.29.05-.91.34-.74,2.04-.21,3.46.44,1.16,1.26,2.52,2.15,2.52Z",
  "M9.17,9.32c-.51-.3-1.22-.54-1.98-.68-.47-.09-.92-.13-1.35-.13-1.19,0-1.91.33-2.03.94-.18.95,1.36,1.69,2.86,1.97.47.09.92.13,1.35.13,1.19,0,1.91-.33,2.03-.94.06-.32-.04-.81-.88-1.29Z",
  "M9.39,13.08c-.14-.1-.32-.15-.5-.15-.83,0-1.86,1.03-2.49,1.91-.45.63-.79,1.29-.95,1.87-.27.92,0,1.35.26,1.54.14.1.32.15.5.15.83,0,1.86-1.03,2.49-1.91.89-1.24,1.48-2.84.69-3.4Z",
  "M14.18,17.31c-.5-1.22-1.41-2.65-2.34-2.65-.11,0-.22.02-.32.06-.95.38-.71,2.19-.1,3.71.5,1.22,1.41,2.65,2.34,2.65.11,0,.22-.02.32-.06.32-.13.68-.5.63-1.52-.03-.64-.22-1.42-.54-2.19Z",
  "M19.8,13.76c-.56-.3-1.33-.54-2.16-.66-.43-.07-.85-.1-1.25-.1-1.38,0-2.24.38-2.34,1.05-.05.34.08.84.98,1.32.56.3,1.33.54,2.16.66.43.07.85.1,1.25.1,1.38,0,2.24-.38,2.34-1.05.05-.34-.08-.84-.98-1.32Z",
  "M14.88,11.91c.34.26.77.39,1.23.39.99,0,2.07-.62,2.81-1.61.53-.7.83-1.51.86-2.28.03-.83-.26-1.52-.82-1.94-.34-.26-.77-.39-1.23-.39-.99,0-2.07.62-2.81,1.61-1.14,1.53-1.16,3.38-.03,4.22Z",
];

const CENTER = "12.295px 12.295px";

interface SordiCopilotOrbProps {
  size?: number;
  state?: CopilotOrbState;
}

/**
 * The branded "living" Copilot status indicator — the actual Sordi icon
 * geometry (6 radial petals, not a generic sparkle) with three motion
 * states standing in for idle/analyzing/success, replacing the plain
 * gradient-stroked Sparkles icon that used to sit in the same spot.
 *
 * Idle is fully static — no rotation, no petal pulse — so the icon only
 * moves while actually doing something: a fast spin + per-petal "chase"
 * wave while analyzing, then a quick bloom on success before the caller
 * flips `state` back to "idle".
 *
 * Petals are a single flat fill, matching the real icon's own flat
 * white-on-scarlet style exactly — no radial gradient/shading. An earlier
 * version used one to fake a glossy 3D bead look; that was this
 * component's own invention, not something in the source asset, and read
 * as an unwanted 3D effect rather than the flat brand style used
 * everywhere else in the app. The fill is the app's own `--primary` token
 * (`hsl(var(--primary))`), not a hardcoded hex — an earlier version used a
 * literal `#E11D48`, which drifted from the real brand red used by the
 * Header's "+ Facture" CTA and other primary buttons.
 *
 * The chase wave (rather than a plain rotation) exists because six
 * identical, evenly-spaced, identically-colored petals have exact 6-fold
 * rotational symmetry — a 60° turn of the whole ring looks pixel-for-pixel
 * identical to 0°, so a plain spin wouldn't read as motion at all. Each
 * petal instead runs its own opacity pulse, staggered by index — a flat
 * "chase" circling the ring (the same motif as the iOS/macOS activity
 * spinner), which breaks the color symmetry without introducing any
 * shading, and only while analyzing.
 *
 * No center dot: an earlier version had a small white circle filling the
 * gap between the petals, which read as an unwanted solid core rather than
 * six petals radiating from open space. The center is left fully
 * transparent so the orb renders naturally over any background.
 */
export function SordiCopilotOrb({ size = 26, state = "idle" }: SordiCopilotOrbProps) {
  const isAnalyzing = state === "analyzing";
  const isSuccess = state === "success";

  return (
    <svg width={size} height={size} viewBox="0 0 24.59 24.59" className="shrink-0 overflow-visible" aria-hidden="true">
      {/* The ring — static at rest, spins while analyzing. Plain CSS
          `animate-spin` (Tailwind's built-in keyframe, duration overridden
          to 1.2s) rather than Framer Motion's `animate={{ rotate }}`: a
          numeric Framer target can fail to visibly (re)animate depending
          on what the element's rotation happened to settle at previously,
          and mixing a CSS class's `transform` with Framer's own inline
          `transform` on the SAME element is exactly the kind of conflict
          that silently drops one or the other (inline style always wins
          over a class rule) — so the success bloom below is a SEPARATE,
          nested element instead of living on this same <g>. */}
      <g
        className={isAnalyzing ? "animate-spin" : undefined}
        style={{ transformOrigin: CENTER, animationDuration: "1.2s" }}
      >
        {/* Success bloom — its own group, nested inside the rotating one,
            so Framer's inline `transform: scale(...)` here never competes
            with the parent's CSS-driven rotation. */}
        <motion.g
          style={{ transformOrigin: CENTER }}
          animate={{ scale: isSuccess ? [1, 1.35, 1] : 1 }}
          transition={isSuccess ? { duration: 0.5, ease: "easeOut" } : { duration: 0.3 }}
        >
          {PETALS.map((d, i) => (
            <motion.path
              key={i}
              d={d}
              fill="hsl(var(--primary))"
              style={{ transformOrigin: CENTER }}
              animate={{
                scale: isAnalyzing ? [1, 1.25, 1] : 1,
                opacity: isAnalyzing ? [0.4, 1, 0.4] : 1,
              }}
              // The staggered per-petal delay is what turns the analyzing
              // pulse into a "sequential wave / turbine" chase — each petal
              // starts 0.08s after the last.
              transition={{
                scale: isAnalyzing ? { duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 } : { duration: 0.3 },
                opacity: isAnalyzing ? { duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 } : { duration: 0.3 },
              }}
            />
          ))}
        </motion.g>
      </g>
    </svg>
  );
}
