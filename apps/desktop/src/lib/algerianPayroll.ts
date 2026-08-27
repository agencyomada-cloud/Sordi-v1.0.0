/**
 * Algerian statutory payroll withholding — CNAS (SS) and IRG.
 *
 * omada-agency branch only. These are informational figures shown on the
 * Bulletin de Paie PDF; they do NOT change `payroll_runs.net_a_payer` or
 * anything else tracked by the app (a deliberate choice — see Payroll.tsx
 * and the PDF template for the reconciliation this implies).
 *
 * IMPORTANT — verify before relying on this for real compliance:
 * - The 9% CNAS employee contribution rate is a stable, well-established
 *   figure and safe to treat as correct.
 * - The IRG_BRACKETS table below is a good-faith reconstruction of the
 *   Loi de Finances 2022 monthly salary reform (which introduced the
 *   30 000 DA full exemption threshold and a smoothing zone up to
 *   42 500 DA). The exact transition-zone formula and higher bracket
 *   boundaries are the part most likely to have drifted from the current
 *   official DGI barème — have an accountant confirm the exact figures
 *   before treating this as authoritative for a real payslip.
 */

export interface IrgBracket {
  /** Upper bound of this bracket in DA, or null for "and above". */
  upTo: number | null;
  /** Marginal rate applied to the portion of income within this bracket. */
  rate: number;
}

// Loi de Finances 2022 — monthly IRG scale (best-effort reconstruction, see
// module doc comment above). Edit this table directly if the official
// barème changes; computeIRG() applies it as ordinary progressive brackets.
export const IRG_BRACKETS_LF2022: IrgBracket[] = [
  { upTo: 30000, rate: 0 },
  { upTo: 42500, rate: 0.23 },
  { upTo: 60000, rate: 0.27 },
  { upTo: 90000, rate: 0.30 },
  { upTo: 120000, rate: 0.33 },
  { upTo: null, rate: 0.35 },
];

export const CNAS_EMPLOYEE_RATE = 0.09;

/** 9% CNAS employee contribution on the cotisable salary base. */
export function computeSSRetenue(salaireDePoste: number): number {
  return Math.round(Math.max(0, salaireDePoste) * CNAS_EMPLOYEE_RATE * 100) / 100;
}

/** Progressive IRG withholding on the taxable base, bracket by bracket. */
export function computeIRG(salaireImposable: number, brackets: IrgBracket[] = IRG_BRACKETS_LF2022): number {
  let remaining = Math.max(0, salaireImposable);
  let irg = 0;
  let lowerBound = 0;
  for (const bracket of brackets) {
    const upTo = bracket.upTo ?? Infinity;
    const bandWidth = upTo - lowerBound;
    const taxableInBand = Math.min(remaining, bandWidth);
    if (taxableInBand > 0) {
      irg += taxableInBand * bracket.rate;
      remaining -= taxableInBand;
    }
    lowerBound = upTo;
    if (remaining <= 0) break;
  }
  return Math.round(irg * 100) / 100;
}
