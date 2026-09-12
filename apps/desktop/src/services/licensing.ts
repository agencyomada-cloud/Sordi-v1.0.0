import { useQuery } from "@tanstack/react-query";
import { db, type LicenseState } from "@/lib/database";
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

// ---------------------------------------------------------------------------
// License state machine (client-side presentation layer)
//
// The actual STATE is computed exactly once, in Rust (license.rs's
// compute_status logic — see LicenseState there for the full state
// machine and why it mirrors packages/schema/src/licenseState.ts by hand).
// This file's only job is turning that state into what the UI shows: a
// banner message and whether writes should be blocked. Before this
// refactor, useTrialStatus tried to INFER the state itself from raw
// expires_at/plan_type fields, in the same file that also decided what to
// show — which is exactly how the original "35 jours restants on a paid
// license" bug happened (the inference logic and the presentation logic
// were tangled together, so a subtle bug in one silently corrupted the
// other). Centralizing state computation in Rust and keeping this file
// purely presentational is the actual fix, not just a relocation.
// ---------------------------------------------------------------------------

// Mirrors packages/schema/src/licenseState.ts's LICENSE_WRITABLE_STATES —
// exported for useLicenseGate.ts, the actual write-gating consumer.
export const LICENSE_WRITABLE_STATES: ReadonlySet<LicenseState> = new Set(["TRIAL_ACTIVE", "PAID_ACTIVE", "OFFLINE_GRACE"]);

export interface LicenseUiDecision {
  showBanner: boolean;
  bannerMessage: string;
  blockWrites: boolean;
}

/** Pure function — the ONE place that decides what a given state means for
 *  the UI. Mirrors packages/schema/src/licenseState.ts's
 *  getLicenseUiDecision() by hand (apps/desktop has no dependency on
 *  @sordi/schema — this is a Tauri app talking to Rust, not the Node API
 *  — so the two copies must be kept in sync manually, same constraint as
 *  license.rs's own LicenseState mirror). */
export function getLicenseUiDecision(state: LicenseState, daysRemaining: number | null): LicenseUiDecision {
  switch (state) {
    case "UNREGISTERED":
      return { showBanner: true, bannerMessage: "Licence non activée", blockWrites: true };
    case "TRIAL_ACTIVE": {
      const days = daysRemaining ?? 0;
      return {
        showBanner: true,
        bannerMessage: `Période d'essai : il vous reste ${days} jour${days > 1 ? "s" : ""}`,
        blockWrites: false,
      };
    }
    case "TRIAL_EXPIRED":
      return { showBanner: true, bannerMessage: "Votre période d'essai est terminée", blockWrites: true };
    // Once a license is paid and active, the banner disappears entirely —
    // no renewal countdown, no pressure. A paying customer is reassured by
    // the PRO badge in the account menu (see WorkspaceAccountMenu.tsx) and
    // the "Abonnement" section's own échéance display, not a persistent
    // top-of-screen banner. daysRemaining is intentionally unused here.
    case "PAID_ACTIVE":
      return { showBanner: false, bannerMessage: "", blockWrites: false };
    case "PAID_EXPIRED":
      return {
        showBanner: true,
        bannerMessage: "Votre licence a expiré. Renouvelez pour continuer à créer et modifier.",
        blockWrites: true,
      };
    case "REVOKED":
      return { showBanner: true, bannerMessage: "Cette licence a été révoquée. Contactez le support.", blockWrites: true };
    case "OFFLINE_GRACE":
      return { showBanner: true, bannerMessage: "Reconnectez-vous pour valider votre licence", blockWrites: false };
  }
}

export interface LicenseDecision {
  state: LicenseState;
  daysRemaining: number | null;
  /** Raw ISO expiry, straight from LicenseStatus — daysRemaining above is
   *  a rounded-up whole-day figure (fine for most UI), but a live
   *  hours/minutes countdown (TrialBanner's <72h mode) needs the actual
   *  timestamp to compute against, not a pre-rounded day count. */
  expiresAt: string | null;
  ui: LicenseUiDecision;
  lastSuccessfulVerifyAt: string | null;
  machineId: string | undefined;
  isLoading: boolean;
}

export function useLicenseDecision(): LicenseDecision {
  const { data: status, isLoading: statusLoading } = useLicenseStatus();
  const { isReady } = useWorkspace();
  const { data: machineId, isLoading: machineIdLoading } = useMachineId();

  const state: LicenseState = status?.license_state ?? "UNREGISTERED";
  const daysRemaining = status?.expires_at
    ? Math.max(0, Math.ceil((new Date(status.expires_at).getTime() - Date.now()) / 86_400_000))
    : null;

  return {
    state,
    daysRemaining,
    expiresAt: status?.expires_at ?? null,
    ui: getLicenseUiDecision(state, daysRemaining),
    lastSuccessfulVerifyAt: status?.last_successful_verify_at ?? null,
    machineId,
    isLoading: statusLoading || machineIdLoading || !isReady,
  };
}

/** @deprecated Use useLicenseDecision() directly — kept only so any
 *  not-yet-migrated call site keeps compiling. `isTrial` now means
 *  "the banner should show" (any non-writable state OR an active plan
 *  approaching renewal), matching the new ui.showBanner exactly. */
export interface TrialStatus {
  isTrial: boolean;
  trialDaysRemaining: number;
  machineId: string | undefined;
  isLoading: boolean;
}

export function useTrialStatus(): TrialStatus {
  const decision = useLicenseDecision();
  return {
    isTrial: decision.ui.showBanner,
    trialDaysRemaining: decision.daysRemaining ?? 14,
    machineId: decision.machineId,
    isLoading: decision.isLoading,
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

/** General "Support & Assistance" entry point (account menu, expired-trial
 *  banner's "Débloquer l'accès") — deliberately neutral wording, unlike
 *  buildWhatsAppActivationUrl above which assumes the visitor is already
 *  mid-activation with a machine id in hand. */
export function buildWhatsAppSupportUrl(companyName?: string): string {
  const message = companyName
    ? `Bonjour, j'ai besoin d'aide concernant mon compte Sordi Invoicing (${companyName}).`
    : "Bonjour, j'ai besoin d'aide concernant mon compte Sordi Invoicing.";
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
