import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { getInvoiceStatusConfig } from '@/lib/invoiceStatus';
import type { StatusBadgeTone } from '@sordi/ui';

// Same 5-tone palette as packages/ui's StatusBadge / the interactive
// editor's InvoiceStatusBadge — react-pdf can't consume Tailwind classes,
// so these are the literal hex equivalents of bg-*-50/text-*-700/
// border-*-200 for each tone.
const TONE_COLORS: Record<StatusBadgeTone, { bg: string; text: string; border: string; dot: string }> = {
  success: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', dot: '#10b981' },
  warning: { bg: '#fffbeb', text: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  error: { bg: '#fff1f2', text: '#be123c', border: '#fecdd3', dot: '#f43f5e' },
  neutral: { bg: '#f4f4f5', text: '#3f3f46', border: '#e4e4e7', dot: '#a1a1aa' },
  info: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 8.5,
    right: 8.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 0.75,
  },
  dot: { width: 4.25, height: 4.25, borderRadius: 2.125 },
  label: { fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
});

/**
 * PDF equivalent of InvoiceStatusBadge.tsx (the interactive editor canvas's
 * corner status indicator) — same source of truth (getInvoiceStatusConfig),
 * same corner placement, so a paid invoice's exported PDF carries the same
 * "• PAYÉE" indicator the on-screen canvas already showed instead of the
 * export silently dropping it.
 */
export function PdfStatusBadge({ status }: { status: string | null | undefined }) {
  const { label, variant } = getInvoiceStatusConfig(status);
  const colors = TONE_COLORS[variant];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: colors.dot }]} />
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}
