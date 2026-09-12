/** Same wa.me link convention as apps/desktop/src/services/licensing.ts's
 *  buildWhatsAppActivationUrl — a bare number (no "+", no spaces) as stored
 *  in devices.phoneNumber, opened with an optional pre-filled message. */
export function buildWhatsAppLink(phoneNumber: string, message?: string): string {
  const digitsOnly = phoneNumber.replace(/[^0-9]/g, "");
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digitsOnly}${query}`;
}
