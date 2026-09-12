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

// Soft, informational trial window — NOT the real enforcement boundary.
// Actual write-access gating happens server/Rust-side via LicenseStatus.state
// (require_active_license() in license.rs); this is purely a UI countdown so
// the banner can say "N jours restants" instead of a static "vous êtes en
// essai". Anchored to the active company's own `created_at` (a real,
// already-persisted SQLite timestamp set once at onboarding) rather than a
// separate localStorage flag, which would reset the moment someone clears
// site data — using created_at means the countdown at least survives that,
// even though it's still not tamper-proof (nothing here needs to be: a
// user who edits their own local trial countdown display doesn't gain any
// actual unlicensed write access, since that's gated separately).
const TRIAL_LENGTH_DAYS = 14;

export interface TrialStatus {
  /** True whenever the license isn't fully "active" — i.e. still on the
   *  informational trial clock, whether or not that clock has run out. */
  isTrial: boolean;
  /** Clamped to 0 once the trial window has elapsed — never negative. */
  trialDaysRemaining: number;
  machineId: string | undefined;
  isLoading: boolean;
}

export function useTrialStatus(): TrialStatus {
  const { data: status, isLoading: statusLoading } = useLicenseStatus();
  const { companies, activeCompanyId, isReady } = useWorkspace();
  const { data: machineId, isLoading: machineIdLoading } = useMachineId();

  const isTrial = status?.state !== "active";

  const activeCompany = companies.find((c) => c.id === activeCompanyId);
  let trialDaysRemaining = TRIAL_LENGTH_DAYS;
  if (activeCompany?.created_at) {
    const createdAt = new Date(activeCompany.created_at).getTime();
    const daysSinceCreation = Math.floor((Date.now() - createdAt) / 86_400_000);
    trialDaysRemaining = Math.max(0, TRIAL_LENGTH_DAYS - daysSinceCreation);
  }

  return {
    isTrial,
    trialDaysRemaining,
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
  const message = `Bonjour, je souhaite activer ma licence Sordi Finance pour mon entreprise ${companyName}. Mon identifiant machine est : ${machineId}`;
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
