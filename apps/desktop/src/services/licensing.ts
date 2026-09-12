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
// LicenseStatus.plan_type ("trial" | "annual" | "lifetime") is the
// authoritative signal for whether this banner should show at all — NOT a
// days-remaining guess. A trial and a freshly-activated year-long paid
// license both look identical at the token-expiry level (an active,
// unexpired token with a real, possibly-far-future expires_at), so no
// amount of day-counting can reliably tell them apart; a customer who
// activates a license valid until 2028 must never see a trial countdown,
// no matter how many days that number is. plan_type is set once at
// creation (POST /licenses/request-trial always "trial"; the admin
// dashboard's Générer une licence and Convertir en Annuel set it
// explicitly) and carried through the signed token, so the desktop app
// never has to infer it.
//
// plan_type can be missing on a token issued before this field existed
// (already written to a local license.token file on some machine) — in
// that one legacy case only, fall back to the old days-based heuristic
// (show if expiring within EXPIRY_WARNING_WINDOW_DAYS) so an existing
// install doesn't regress until its next activate/verify round-trip
// refreshes the token with the real plan_type.
const EXPIRY_WARNING_WINDOW_DAYS = 30;

export interface TrialStatus {
  /** True whenever the banner should show: not fully "active" at all, a
   *  genuine trial plan, or (legacy fallback only) an active license with
   *  no plan_type whose expiry happens to be within the warning window. */
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

  const isExplicitTrial = status?.plan_type === "trial";
  const isExplicitPaid = status?.plan_type === "annual" || status?.plan_type === "lifetime";
  // Only reached when plan_type is genuinely absent (a pre-existing token
  // that predates this field) — never overrides an explicit paid plan.
  const legacyHeuristic = !status?.plan_type && hasExpiry && daysRemaining <= EXPIRY_WARNING_WINDOW_DAYS;

  const isTrial = !isActive || isExplicitTrial || (!isExplicitPaid && legacyHeuristic);

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
