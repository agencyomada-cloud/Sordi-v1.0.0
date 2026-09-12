// Same placeholder number as apps/desktop's licensing.ts (SUPPORT_WHATSAPP_NUMBER)
// — kept in sync by hand since this is a separate Vite app.
const SUPPORT_WHATSAPP_NUMBER = "213000000000";

export function buildWhatsAppSupportUrl(message = "Bonjour, j'ai une question à propos de Sordi Invoicing."): string {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
