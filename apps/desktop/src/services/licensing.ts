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
// LicenseStatus has no field distinguishing a self-service 14-day trial
// (POST /licenses/request-trial) from a paid annual license — both come
// back as state: "active" with a real expires_at claim from the signed
// token, since a trial is just a license row with a short term. The one
// real signal available is expires_at itself: a genuinely perpetual/
// lifetime license has none (activate_offline's manually-issued tokens
// can omit it, or a future lifetime plan may sign one with no exp claim),
// while every trial AND every term-limited paid plan (annual, etc.) has
// one. So: show the countdown for ANY active license that has an expiry
// at all — a paying annual customer sees "334 jours restants" same as a
// trial user sees "14 jours restants", both true and both useful — and
// hide it ONLY for state !== "active" (show a different call-to-activate
// in that case, handled by TrialBanner directly) or for an active license
// with genuinely no expires_at (perpetual).
export interface TrialStatus {
  /** True whenever the banner should show: not fully "active" at all, or
   *  active with a real expires_at (any term length) to count down. */
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

  // Perpetual (active, no expiry at all) is the only case that hides the
  // banner outright — every other case either isn't active yet or is on
  // a real countdown.
  const isTrial = !isActive || hasExpiry;

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
