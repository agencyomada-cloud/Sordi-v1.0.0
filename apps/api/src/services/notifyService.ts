import { Resend } from "resend";
import { env } from "../env.js";

interface LeadNotification {
  name: string;
  phone: string;
  company: string | null;
  osType: "macos" | "windows";
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const OS_LABEL: Record<LeadNotification["osType"], string> = {
  macos: "macOS",
  windows: "Windows",
};

function buildEmailHtml(lead: LeadNotification): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fafafa;">
      <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">
        <p style="font-size: 20px; margin: 0 0 16px;">🚀 Nouveau téléchargement Sordi Finance</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #6b7280;">👤 Nom</td><td style="padding: 6px 0; font-weight: 600;">${lead.name}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">📱 WhatsApp</td><td style="padding: 6px 0; font-weight: 600;">+213${lead.phone}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">🏢 Entreprise</td><td style="padding: 6px 0; font-weight: 600;">${lead.company || "—"}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">💻 OS</td><td style="padding: 6px 0; font-weight: 600;">${OS_LABEL[lead.osType]}</td></tr>
        </table>
      </div>
    </div>
  `.trim();
}

/** Fire-and-forget: a notification failure must never break the actual lead
 *  capture (the download itself always succeeds regardless). Gracefully
 *  no-ops when RESEND_API_KEY / ADMIN_NOTIFICATION_EMAIL aren't configured
 *  — most dev setups won't have a real Resend account, and the lead is
 *  still safely stored in Postgres either way (see leadsRepo.create). */
export async function notifyNewLead(lead: LeadNotification): Promise<void> {
  if (!resend || !env.ADMIN_NOTIFICATION_EMAIL) return;

  try {
    await resend.emails.send({
      from: "Sordi Finance <onboarding@resend.dev>",
      to: env.ADMIN_NOTIFICATION_EMAIL,
      subject: `🚀 Nouveau téléchargement — ${lead.name}`,
      html: buildEmailHtml(lead),
    });
  } catch {
    // Silent by design — see the doc comment above. A real failure here
    // (bad API key, Resend outage) has no user-facing surface to report to.
  }
}
