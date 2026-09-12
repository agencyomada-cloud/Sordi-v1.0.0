import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/database";
import { useLicenseStatus } from "@/hooks/useLicense";
import { useWorkspace } from "@/hooks/useWorkspace";

/**
 * The machine's human-readable "SRD-XXXX-XXXX-XXXX" activation code — read
 * once and cached indefinitely for the session (it's a hardware-derived
 * value, it doesn't change while the app is running). See license.rs's
 * compute_machine_id() for the actual derivation.
 */
export function getMachineId(): Promise<string> {
  return db.license.getMachineId();
}

export function useMachineId() {
  return useQuery({
    queryKey: ["licensing", "machine-id"],
    queryFn: getMachineId,
    staleTime: Infinity,
  });
}

// Soft, informational banner — NOT the real enforcement boundary. Actual
// write-access gating happens server/Rust-side via LicenseStatus.state
// (require_active_license() in license.rs); this is purely a UI countdown.
//
// LicenseStatus.expires_at now always reflects the license's REAL
// subscription boundary (apps/api's licenses.expires_at, propagated through
// the token's realExpiresAt claim — see licenseService.ts's doc comment).
// Before that fix, a paid/activated license's expires_at was read from the
// token's own cryptographic `exp`, which for any /activate or /verify call
// is a fixed 35-day rolling reverification window totally unrelated to the
// real term purchased — a customer with a license valid until 2028 saw
// "35 jours restants" forever. With the real value now flowing through,
// LicenseStatus.expires_at legitimately can be years out for a paid plan.
//
// That means expires_at existing is no longer, by itself, a reliable
// trial/paid signal (both have one) — the actual signal is how CLOSE it is.
// A trial is always <=14 days; a paid plan someone just activated is
// practically always much further out. Showing the banner is genuinely
// useful right up to a real renewal too, so the cutoff is a bit above the
// trial length rather than exactly 14 — 30 days catches "your trial is
// ending" and "your paid plan renews soon" alike, while a freshly-activated
// annual/lifetime license (hundreds of days or no expiry at all) stays
// hidden, matching what a paid customer actually expects to see.
const EXPIRY_WARNING_WINDOW_DAYS = 30;

export interface TrialStatus {
  /** True whenever the banner should show: not fully "active" at all, or
   *  active with a real expiry within EXPIRY_WARNING_WINDOW_DAYS. */
  isTrial: boolean;
  /** Days until expires_at, clamped to 0. Only meaningful/precise when the
   *  license is "active" with a real expires_at; a flat fallback otherwise
   *  (not_activated/read_only/perpetual have no expiry claim to count
   *  down from). */
  trialDaysRemaining: number;
  machineId: string | undefined;
  isLoading: boolean;
}

const FALLBACK_DAYS_REMAINING = 14;

export function useTrialStatus(): TrialStatus {
  const { data: status, isLoading: statusLoading } = useLicenseStatus();
  const { isReady } = useWorkspace();
  const { data: machineId, isLoading: machineIdLoading } = useMachineId();

  const isActive = status?.state === "active";
  const hasExpiry = isActive && !!status?.expires_at;

  let daysRemaining = FALLBACK_DAYS_REMAINING;
  if (hasExpiry) {
    const msRemaining = new Date(status!.expires_at!).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(msRemaining / 86_400_000));
  }

  // Hides for: not active at all is handled separately below (still shows,
  // with a different label — see TrialBanner); a perpetual active license
  // (no expiry); or an active license whose real expiry is comfortably far
  // out (a freshly activated paid plan).
  const isTrial = !isActive || (hasExpiry && daysRemaining <= EXPIRY_WARNING_WINDOW_DAYS);

  return {
    isTrial,
    trialDaysRemaining: daysRemaining,
    machineId,
    isLoading: statusLoading || machineIdLoading || !isReady,
  };
}

// ---------------------------------------------------------------------------
// Local Algerian payment methods — placeholders until Sordi's real
// collection details are finalized. Deliberately kept here (not hardcoded
// inline in ActivationModal.tsx) so there's exactly one place to update
// them for a real deployment.
// ---------------------------------------------------------------------------

export const BARIDIMOB_PAYMENT_INFO = {
  label: "BaridiMob / CCP",
  rip: "0079999999999999999 99",
  accountNumber: "0079999999999999",
  accountHolder: "SORDI FINANCE SARL",
};

export const CPA_BANK_PAYMENT_INFO = {
  label: "Crédit Populaire d'Algérie (CPA)",
  rib: "004 00799 0399999999999 99",
  accountHolder: "SORDI FINANCE SARL",
};

// Digits only, international format without "+" — the exact format
// wa.me expects in its URL path.
export const SUPPORT_WHATSAPP_NUMBER = "213000000000";

/** Pre-filled WhatsApp message for sending the payment receipt — company
 *  name and machine id are interpolated so support can match the payment
 *  to the right workspace/machine without back-and-forth. */
export function buildWhatsAppActivationUrl(companyName: string, machineId: string): string {
  const message = `Bonjour, je souhaite activer ma licence Sordi Invoicing pour mon entreprise ${companyName}. Mon identifiant machine est : ${machineId}`;
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
