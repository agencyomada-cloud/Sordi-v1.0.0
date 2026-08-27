/**
 * Display logic for the client "Aperçu" section and the clients-list status
 * badge. Raw numbers come from get_client_overview_stats (Rust); everything
 * here — status priority order, frequency bucket thresholds, "not enough
 * data" fallbacks — lives in one place so both pages read the same rules.
 */
import type { ClientOverviewStats } from "./database";
import type { StatusBadgeTone } from "@sordi/ui";

export type ClientStatusKey = "en_retard" | "a_surveiller" | "nouveau" | "bon_payeur";

export interface ClientStatus {
  key: ClientStatusKey;
  label: string;
  tone: StatusBadgeTone;
}

const STATUS_STYLES: Record<ClientStatusKey, { label: string; tone: StatusBadgeTone }> = {
  en_retard: { label: "En retard", tone: "error" },
  a_surveiller: { label: "À surveiller", tone: "warning" },
  nouveau: { label: "Nouveau", tone: "neutral" },
  bon_payeur: { label: "Bon payeur", tone: "success" },
};

// Client.payment_terms_days is optional; falls back to a conventional 30-day
// term wherever it's missing, both here and in has_overdue_unpaid (Rust
// side) — kept in sync so "overdue" and "delay blown out" agree on terms.
const DEFAULT_PAYMENT_TERMS_DAYS = 30;

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface PaymentDelayResult {
  days: number | undefined;
  display: string;
}

/** Metric 3 — Délai de paiement moyen, over the last 10 fully-paid invoices. */
export function computeAveragePaymentDelay(stats: ClientOverviewStats): PaymentDelayResult {
  const delays = stats.recent_payment_delays_days.slice(0, 10);
  if (delays.length < 3) {
    return { days: undefined, display: "Pas assez de données" };
  }
  const days = average(delays)!;
  return { days, display: `${Math.round(days)} jours` };
}

export type PurchaseFrequencyLabel = "Hebdomadaire" | "Mensuelle" | "Trimestrielle" | "Occasionnelle" | "Trop tôt pour évaluer";

export interface PurchaseFrequencyResult {
  avgDays: number | undefined;
  label: PurchaseFrequencyLabel;
  /** "tous les X jours (Label)", or just the label when there's not enough data. */
  display: string;
}

/** Metric 4 — Fréquence d'achat, over the last 6 invoices. */
export function computePurchaseFrequency(stats: ClientOverviewStats): PurchaseFrequencyResult {
  if (stats.invoice_count < 3) {
    return { avgDays: undefined, label: "Trop tôt pour évaluer", display: "Trop tôt pour évaluer" };
  }
  const avgDays = average(stats.recent_purchase_gaps_days.slice(0, 6));
  if (avgDays === undefined) {
    return { avgDays: undefined, label: "Trop tôt pour évaluer", display: "Trop tôt pour évaluer" };
  }
  let label: PurchaseFrequencyLabel;
  if (avgDays <= 10) label = "Hebdomadaire";
  else if (avgDays <= 35) label = "Mensuelle";
  else if (avgDays <= 100) label = "Trimestrielle";
  else label = "Occasionnelle";
  const rounded = Math.round(avgDays);
  return { avgDays, label, display: `tous les ${rounded} jour${rounded === 1 ? "" : "s"} (${label})` };
}

/**
 * Metric 5 — Statut, first match wins:
 *   a. an unpaid/partial invoice past invoice_date + payment_terms_days
 *   b. last-3-paid delay > 1.5x payment terms, OR quiet for 2x the purchase
 *      frequency average
 *   c. fewer than 3 invoices total
 *   d. otherwise
 */
export function computeClientStatus(stats: ClientOverviewStats, now: Date = new Date()): ClientStatus {
  if (stats.has_overdue_unpaid) {
    return { key: "en_retard", ...STATUS_STYLES.en_retard };
  }

  const terms = stats.payment_terms_days ?? DEFAULT_PAYMENT_TERMS_DAYS;
  const avgLast3Delay = average(stats.recent_payment_delays_days.slice(0, 3));
  const delayBlownOut = avgLast3Delay !== undefined && avgLast3Delay > terms * 1.5;

  const frequency = computePurchaseFrequency(stats);
  let goneQuiet = false;
  if (frequency.avgDays !== undefined && stats.last_invoice_date) {
    const daysSinceLast = (now.getTime() - new Date(stats.last_invoice_date).getTime()) / 86_400_000;
    goneQuiet = daysSinceLast > frequency.avgDays * 2;
  }

  if (delayBlownOut || goneQuiet) {
    return { key: "a_surveiller", ...STATUS_STYLES.a_surveiller };
  }

  if (stats.invoice_count < 3) {
    return { key: "nouveau", ...STATUS_STYLES.nouveau };
  }

  return { key: "bon_payeur", ...STATUS_STYLES.bon_payeur };
}
