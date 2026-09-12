/**
 * WCAG-ish relative-luminance check for picking readable text over a solid
 * background color — used by the invoice line-item table header, which now
 * fills solid with the user's chosen accent color (see the 3 editable
 * templates) instead of just tinting it, so the label text has to adapt
 * automatically rather than assuming dark text always works.
 */
export function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.45 ? '#18181B' : '#FFFFFF';
}
