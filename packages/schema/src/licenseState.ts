// Shared license state machine — the single source of truth for "what does
// this license mean right now", consumed by apps/api (to build a
// self-describing API response) and mirrored in Rust
// (apps/desktop/src-tauri/src/license.rs's compute_license_state, since
// Rust can't import this file directly but must produce the exact same
// values for the offline/local-verification path). Keep the two in sync by
// hand if either changes — see that Rust function's own doc comment.

export const LICENSE_STATES = [
  "UNREGISTERED",
  "TRIAL_ACTIVE",
  "TRIAL_EXPIRED",
  "PAID_ACTIVE",
  "PAID_EXPIRED",
  "REVOKED",
  "OFFLINE_GRACE",
] as const;

export type LicenseState = (typeof LICENSE_STATES)[number];

// States in which a write action (create/edit/delete an invoice, client,
// product...) is permitted. OFFLINE_GRACE is included deliberately: it
// means "the token's own security window hasn't lapsed yet, we just
// haven't reached the server in a while" — exactly the case the JWT's
// 35-day rolling reverification window exists to tolerate.
export const LICENSE_WRITABLE_STATES: ReadonlySet<LicenseState> = new Set([
  "TRIAL_ACTIVE",
  "PAID_ACTIVE",
  "OFFLINE_GRACE",
]);

export interface LicenseStateInput {
  /** The license row's own lifecycle column — "revoked" always wins over
   *  everything else, regardless of planType/expiresAt. */
  status: "active" | "expired" | "revoked";
  planType: "trial" | "annual" | "lifetime" | null;
  /** ISO string or null (a genuinely perpetual license, if ever issued
   *  without a term). */
  expiresAt: string | null;
  /** Reference point to compare expiresAt against — pass a fixed Date in
   *  tests, defaults to `new Date()` for real callers. */
  now?: Date;
}

/** Pure function: given a license row's own fields, decide its single
 *  authoritative state. No I/O, no side effects — safe to call from a
 *  request handler, a background job, or a test. */
export function computeLicenseState(input: LicenseStateInput): LicenseState {
  if (input.status === "revoked") return "REVOKED";

  if (!input.expiresAt) {
    // No term at all — only meaningful for a genuinely perpetual paid
    // license (never issued by any current flow, but the schema and this
    // function both tolerate it rather than crash).
    return input.planType && input.planType !== "trial" ? "PAID_ACTIVE" : "UNREGISTERED";
  }

  const now = input.now ?? new Date();
  const expired = new Date(input.expiresAt) <= now;
  const isTrial = input.planType === "trial";

  if (isTrial) return expired ? "TRIAL_EXPIRED" : "TRIAL_ACTIVE";
  return expired ? "PAID_EXPIRED" : "PAID_ACTIVE";
}

export interface LicenseUiDecision {
  showBanner: boolean;
  bannerMessage: string;
  blockWrites: boolean;
}

/** French, user-facing copy — the ONE place that decides what a given
 *  state means for the UI, so a banner/gate component never has to
 *  re-derive this from raw booleans. `daysRemaining` is only used by the
 *  two ACTIVE messages (a countdown makes no sense once already expired
 *  or revoked). */
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
      return {
        showBanner: true,
        bannerMessage: "Votre période d'essai est terminée",
        blockWrites: true,
      };
    case "PAID_ACTIVE": {
      // Only worth a banner when renewal is close — otherwise a paying
      // customer sees nothing, which is the whole point of paying.
      const days = daysRemaining ?? Infinity;
      if (days > 30) return { showBanner: false, bannerMessage: "", blockWrites: false };
      return {
        showBanner: true,
        bannerMessage: `Votre licence expire dans ${days} jour${days > 1 ? "s" : ""}`,
        blockWrites: false,
      };
    }
    case "PAID_EXPIRED":
      return {
        showBanner: true,
        bannerMessage: "Votre licence a expiré. Renouvelez pour continuer à créer et modifier.",
        blockWrites: true,
      };
    case "REVOKED":
      return {
        showBanner: true,
        bannerMessage: "Cette licence a été révoquée. Contactez le support.",
        blockWrites: true,
      };
    case "OFFLINE_GRACE":
      return {
        showBanner: true,
        bannerMessage: "Reconnectez-vous pour valider votre licence",
        blockWrites: false,
      };
  }
}
