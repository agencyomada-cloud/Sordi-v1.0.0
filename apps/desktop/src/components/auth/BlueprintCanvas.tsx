// Shared background layer for the splash poster and the Auth.tsx login
// screen: a crisp, fixed-light Apple-minimal canvas — off-white base, a very
// faint dotted grid, and one soft ambient gradient orb. Factored out so both
// contexts render byte-identical backgrounds, which is what makes the
// splash-to-login handoff read as one continuous scene rather than a cut.
interface BlueprintCanvasProps {
  /** Where the glow/grid mask should be centered — "center" for the splash
   *  (logo sits mid-screen) and the unified login canvas alike. */
  origin?: "center" | "top-left";
}

export function BlueprintCanvas({ origin = "center" }: BlueprintCanvasProps) {
  const gradientOrigin = origin === "center" ? "center" : "top left";

  return (
    <>
      <div className="absolute inset-0 bg-[#F8FAFC]" />
      {/* Ambient gradient orb — soft blue/indigo, barely-there */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at ${gradientOrigin}, rgba(59,130,246,0.07), transparent 60%)` }}
      />
      {/* Faint plus-mark grid — opacity-[0.03], just a hint of structure */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
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
