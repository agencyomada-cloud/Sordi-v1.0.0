// Shared background layer for the splash poster and the Auth.tsx left hero
// panel: snow canvas, coral atmospheric glow, and a precise plus-grid —
// factored out so both contexts render byte-identical backgrounds instead of
// two hand-tuned copies that could drift apart.
interface BlueprintCanvasProps {
  /** Where the radial glow/grid mask should be centered — "center" for the
   *  splash (logo sits mid-screen), "top-left" for the hero panel (content
   *  starts near the top-left logo badge). */
  origin?: "center" | "top-left";
}

export function BlueprintCanvas({ origin = "center" }: BlueprintCanvasProps) {
  const gradientOrigin = origin === "center" ? "center" : "top left";

  return (
    <>
      <div className="absolute inset-0 bg-[#F6F8FA] dark:bg-[#0D0E12]" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at ${gradientOrigin}, rgba(235,59,72,0.10), transparent 60%)` }}
      />
      {/* Plus-mark blueprint grid — a small "+" glyph tiled at every
          intersection, not just hairlines, per spec ("micro plus-marks at
          line intersections"). Built as a repeating background-image data
          URI so it renders identically in light/dark instead of relying on
          two overlapping linear-gradients (which only draws lines, no
          crosses). */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-[0.15]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cpath d='M24 20v8M20 24h8' stroke='%2394A3B8' stroke-width='1' stroke-linecap='round'/%3E%3C/svg%3E\")",
          backgroundSize: "48px 48px",
          maskImage: `radial-gradient(ellipse at ${gradientOrigin}, black, transparent 75%)`,
          WebkitMaskImage: `radial-gradient(ellipse at ${gradientOrigin}, black, transparent 75%)`,
        }}
      />
    </>
  );
}
