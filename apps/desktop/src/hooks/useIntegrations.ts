import { useSettings } from "@/hooks/useSettings";

export interface IntegrationStatus {
  connected: boolean;
  /** True for integrations whose backend (OAuth app, API wiring) doesn't
   *  exist yet — surfaced as "Bientôt disponible" rather than a fake
   *  connect flow. */
  comingSoon?: boolean;
}

export interface GmailIntegrationStatus extends IntegrationStatus {
  senderEmail: string | null;
}

export interface Integrations {
  gmail: GmailIntegrationStatus;
  sheets: IntegrationStatus;
  calendar: IntegrationStatus;
}

/**
 * Derives integration status from the existing settings key-value store —
 * deliberately not a separate "integrations" blob, so the Gmail sender
 * address/App Password have exactly one source of truth (the same
 * smtp_email/smtp_app_password fields Settings > Envoi d'Emails and the
 * document email dispatch flow already read/write).
 *
 * Sheets and Calendar have no real backend behind them yet — genuine Google
 * OAuth requires a Google Cloud project with client credentials that only
 * the account owner can provision — so they're reported as comingSoon
 * rather than given a connect flow that would silently do nothing.
 */
export function useIntegrations(): Integrations {
  const { data: settings } = useSettings();
  const gmailConnected = Boolean(settings?.smtp_email && settings?.smtp_app_password);

  return {
    gmail: {
      connected: gmailConnected,
      senderEmail: gmailConnected ? settings!.smtp_email! : null,
    },
    sheets: { connected: false, comingSoon: true },
    calendar: { connected: false, comingSoon: true },
  };
}
