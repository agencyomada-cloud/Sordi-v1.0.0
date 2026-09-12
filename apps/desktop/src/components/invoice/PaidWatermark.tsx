// Odoo-style "PAYÉ" stamp overlay for the read-only invoice canvas — shown
// only when the invoice's real, current status is "paid" (never derived
// from any local UI state), on the first page only, positioned so it never
// collides with the header logo/badge or the client/meta block below it.
export function PaidWatermark() {
  return (
    <div
      className="absolute top-[38mm] right-[14mm] z-20 pointer-events-none select-none border-2 border-emerald-600/70 text-emerald-600/80 uppercase font-black tracking-widest px-4 py-1.5 rounded rotate-[-12deg] opacity-80"
      style={{ fontSize: "18px" }}
    >
      Payé
    </div>
  );
}
