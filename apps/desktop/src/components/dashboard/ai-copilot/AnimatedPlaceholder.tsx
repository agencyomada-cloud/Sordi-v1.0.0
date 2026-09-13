import { AnimatePresence, motion } from "framer-motion";

/**
 * A real HTML `placeholder` attribute can only hard-swap text — no
 * transition hook exists for it. This fakes an animated one: an
 * absolutely-positioned, pointer-events-none label that cross-fades/slides
 * on every `text` change, sitting behind the actual (visually
 * placeholder-less) input. Only rendered while the input is empty — the
 * caller is responsible for hiding it once the user types.
 */
export function AnimatedPlaceholder({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span
          key={text}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="truncate text-sm text-muted-foreground/70"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
