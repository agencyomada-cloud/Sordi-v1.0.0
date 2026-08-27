import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { resolveInvoicePdfFontFamily, resolveCompanyPhones, formatPhone, type PDFSettings } from './invoicePdfShared';
import type { MonthlyBusinessReport } from '@/lib/database';

// Same four selectable fonts as the invoice/payslip templates (Paramètres >
// Thème de la facture PDF > Police) — the executive report matches whatever
// font the user already chose, not a separate look.
Font.register({
  family: 'Montserrat',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-.ttf' },
    { src: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf', fontWeight: 'bold' },
  ]
});
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf' },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf', fontWeight: 'bold' },
  ]
});
Font.register({
  family: 'Poppins',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrFJA.ttf' },
    { src: 'https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLCz7V1s.ttf', fontWeight: 'bold' },
  ]
});
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf' },
    { src: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf', fontWeight: 'bold' },
  ]
});
// Fixed monospace face for every monetary/numeric figure — mirrors the
// "font-mono tabular-nums" convention used on-screen throughout the app.
Font.register({
  family: 'JetBrains Mono',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ.ttf' },
    { src: 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8FqtjPQ.ttf', fontWeight: 'semibold' },
    { src: 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8L6tjPQ.ttf', fontWeight: 'bold' },
  ]
});

const MONTH_NAMES_FR = [
  'JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE',
];

/** "X XXX,XX DZD" — same convention as every other Sordi PDF. */
const formatMoney = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0,00 DZD';
  const abs = Math.abs(amount);
  const formatted = abs.toFixed(2).replace(/\./g, ',');
  const [intPart, decPart] = formatted.split(',');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${amount < 0 ? '-' : ''}${grouped},${decPart || '00'} DZD`;
};

const formatPercent = (v: number | null | undefined): string => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return `${v >= 0 ? '' : ''}${v.toFixed(1)} %`;
};

const formatDateShort = (d: string | null | undefined): string => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export interface MonthlyReportPDFProps {
  report: MonthlyBusinessReport;
  settings?: PDFSettings;
}

/**
 * "Rapport Mensuel d'Activité & Clôture" — a high-density Swiss-minimalist
 * executive report for one calendar month, built entirely from
 * get_monthly_partners_report. No underlying invoice/order/delivery entity;
 * this is a pure aggregation document, same category as CumulativesPDFDocument
 * and BulletinPaiePDFDocument.
 */
export function MonthlyReportPDF({ report, settings }: MonthlyReportPDFProps) {
  const fontFamily = resolveInvoicePdfFontFamily(settings);
  const primaryColor = settings?.primary_color || '#476CFF';
  const phones = resolveCompanyPhones(settings);
  const monthLabel = `${MONTH_NAMES_FR[report.month_num - 1] || report.month_num} ${report.year}`;
  const generatedLabel = new Date(report.generated_at).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // Strict zero-sum check for the partner table: quote-parts should sum to
  // Bénéfice Net (rounding aside) — surfaced as a small footnote line, not
  // hidden, since a real mismatch here would mean equity percentages don't
  // total 100%.
  const quotePartSum = report.partners.reduce((s, p) => s + p.quote_part_benefice, 0);
  const zeroSumDelta = report.benefice_net - quotePartSum;
  const zeroSumOk = Math.abs(zeroSumDelta) < 1;

  const styles = StyleSheet.create({
    page: {
      width: 595.28,
      height: 841.89,
      padding: 36,
      fontFamily,
      fontStyle: 'normal',
      fontSize: 8.5,
      color: '#111111',
      backgroundColor: '#ffffff',
    },

    /* ================= HEADER ================= */
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    companyBlock: { maxWidth: 300 },
    companyName: { fontSize: 13, fontFamily, fontWeight: 'bold', color: '#000000', marginBottom: 3 },
    companyLegalLine: { fontSize: 7, color: '#6b7280', lineHeight: 1.5 },
    monthBadge: {
      marginTop: 8,
      alignSelf: 'flex-start',
      backgroundColor: primaryColor,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 4,
    },
    monthBadgeText: { fontSize: 9, fontFamily, fontWeight: 'bold', color: '#ffffff', letterSpacing: 0.5 },
    reportTitleBlock: { alignItems: 'flex-end' },
    reportTitle: { fontSize: 11, fontFamily, fontWeight: 'bold', color: '#000000', letterSpacing: 0.8 },
    reportSubtitle: { fontSize: 7, color: '#9ca3af', marginTop: 3 },
    headerDivider: { height: 1.5, backgroundColor: '#111111', marginTop: 12, marginBottom: 14 },

    /* ================= SECTION HEADINGS ================= */
    sectionHeading: {
      fontSize: 8.5, fontFamily, fontWeight: 'bold', color: '#000000',
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
      borderBottomWidth: 0.75, borderBottomColor: '#111111', paddingBottom: 4,
    },
    section: { marginBottom: 16 },

    /* ================= KEY METRIC STRIP ================= */
    metricStrip: { flexDirection: 'row', borderWidth: 0.75, borderColor: '#111111', borderRadius: 4 },
    metricCell: { flex: 1, padding: 10, borderRightWidth: 0.75, borderRightColor: '#e5e7eb' },
    metricCellLast: { flex: 1, padding: 10 },
    metricLabel: { fontSize: 6.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
    metricValue: { fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 'bold', color: '#000000' },
    metricValuePositive: { color: '#047857' },
    metricValueNegative: { color: '#b91c1c' },

    /* ================= TREASURY ROW ================= */
    treasuryRow: { flexDirection: 'row', marginTop: 8, gap: 8 },
    treasuryCell: { flex: 1, borderWidth: 0.5, borderColor: '#d1d5db', borderRadius: 4, padding: 8 },
    treasuryLabel: { fontSize: 6.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
    treasuryValue: { fontSize: 9, fontFamily: 'JetBrains Mono', fontWeight: 'bold', color: '#000000' },
    treasuryNote: { fontSize: 6, color: '#9ca3af', marginTop: 8 },

    /* ================= TABLES ================= */
    table: { width: '100%' },
    tableHeaderRow: {
      flexDirection: 'row', backgroundColor: '#f8fafc',
      borderTopWidth: 0.75, borderBottomWidth: 0.75, borderColor: '#9ca3af',
      paddingVertical: 5,
    },
    tableHeaderCell: { fontSize: 6.5, fontFamily, fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3, paddingHorizontal: 4 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingVertical: 5, alignItems: 'center' },
    tableCell: { fontSize: 8, color: '#111111', paddingHorizontal: 4 },
    tableCellMono: { fontSize: 8, fontFamily: 'JetBrains Mono', color: '#111111', paddingHorizontal: 4, textAlign: 'right' },
    tableTotalsRow: {
      flexDirection: 'row', backgroundColor: '#f1f5f9',
      borderTopWidth: 0.75, borderColor: '#111111', paddingVertical: 6, marginTop: 2,
    },
    tableTotalsCell: { fontSize: 8, fontFamily, fontWeight: 'bold', color: '#000000', paddingHorizontal: 4 },
    tableTotalsCellMono: { fontSize: 8, fontFamily: 'JetBrains Mono', fontWeight: 'bold', color: '#000000', paddingHorizontal: 4, textAlign: 'right' },

    // Partner table columns
    colPartnerName: { width: '30%' },
    colPartnerPct: { width: '12%', textAlign: 'right' },
    colPartnerGross: { width: '19%' },
    colPartnerDraw: { width: '19%' },
    colPartnerNet: { width: '20%' },

    // Project table columns
    colProjName: { width: '28%' },
    colProjClient: { width: '22%' },
    colProjDeadline: { width: '15%' },
    colProjRevenue: { width: '17%' },
    colProjMargin: { width: '18%' },

    footnote: { fontSize: 6.5, color: '#9ca3af', marginTop: 6 },
    footnoteOk: { color: '#047857' },
    footnoteBad: { color: '#b91c1c' },

    /* ================= HR SUMMARY ================= */
    hrRow: { flexDirection: 'row', gap: 8 },
    hrCell: { flex: 1, borderWidth: 0.5, borderColor: '#d1d5db', borderRadius: 4, padding: 8 },
    hrLabel: { fontSize: 6.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
    hrValue: { fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 'bold', color: '#000000' },

    emptyState: { fontSize: 7.5, color: '#9ca3af', paddingVertical: 8 },

    /* ================= SIGNATURES ================= */
    signaturesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
    signatureBlock: { width: '44%' },
    signatureLine: { height: 0.75, backgroundColor: '#9ca3af', marginBottom: 4, marginTop: 36 },
    signatureLabel: { fontSize: 7, fontFamily, fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.4 },
    signatureSub: { fontSize: 6.5, color: '#9ca3af', marginTop: 2 },

    /* ================= FOOTER ================= */
    footer: { position: 'absolute', left: 36, right: 36, bottom: 24, borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 6 },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
    footerText: { fontSize: 6, color: '#9ca3af' },
    pageNumber: { fontSize: 6, color: '#9ca3af' },
  });

  return (
    <Document title={`Rapport Mensuel — ${monthLabel}`} author={settings?.company_name || 'Sordi'}>
      <Page size="A4" style={styles.page}>
        {/* ================= HEADER ================= */}
        <View style={styles.headerRow}>
          <View style={styles.companyBlock}>
            {settings?.logo_data && (
              <Image src={settings.logo_data} style={{ height: 22, maxWidth: 140, objectFit: 'contain', marginBottom: 6 }} />
            )}
            <Text style={styles.companyName}>{settings?.company_name || 'SORDI'}</Text>
            {settings?.company_address && <Text style={styles.companyLegalLine}>{settings.company_address}</Text>}
            <Text style={styles.companyLegalLine}>
              {[
                settings?.company_rc ? `RC ${settings.company_rc}` : null,
                settings?.company_nif ? `NIF ${settings.company_nif}` : null,
                settings?.company_nis ? `NIS ${settings.company_nis}` : null,
              ].filter(Boolean).join('  ·  ')}
            </Text>
            <View style={styles.monthBadge}>
              <Text style={styles.monthBadgeText}>{monthLabel}</Text>
            </View>
          </View>
          <View style={styles.reportTitleBlock}>
            <Text style={styles.reportTitle}>RAPPORT EXÉCUTIF MENSUEL</Text>
            <Text style={styles.reportSubtitle}>Activité &amp; Clôture</Text>
            <Text style={styles.reportSubtitle}>Généré le {generatedLabel}</Text>
          </View>
        </View>
        <View style={styles.headerDivider} />

        {/* ================= SECTION 1 — SYNTHÈSE FINANCIÈRE ================= */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>1. Synthèse Financière</Text>
          <View style={styles.metricStrip}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>CA Encaissé</Text>
              <Text style={styles.metricValue}>{formatMoney(report.recettes_encaissees)}</Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>CA Facturé HT</Text>
              <Text style={styles.metricValue}>{formatMoney(report.recettes_ht)}</Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Total Décaissements</Text>
              <Text style={styles.metricValue}>{formatMoney(report.charges_operationnelles + report.masse_salariale)}</Text>
            </View>
            <View style={styles.metricCellLast}>
              <Text style={styles.metricLabel}>Bénéfice Net</Text>
              <Text style={[styles.metricValue, report.benefice_net >= 0 ? styles.metricValuePositive : styles.metricValueNegative]}>
                {formatMoney(report.benefice_net)}
              </Text>
            </View>
          </View>

          <View style={styles.treasuryRow}>
            <View style={styles.treasuryCell}>
              <Text style={styles.treasuryLabel}>Charges Opérationnelles</Text>
              <Text style={styles.treasuryValue}>{formatMoney(report.charges_operationnelles)}</Text>
            </View>
            <View style={styles.treasuryCell}>
              <Text style={styles.treasuryLabel}>Masse Salariale</Text>
              <Text style={styles.treasuryValue}>{formatMoney(report.masse_salariale)}</Text>
            </View>
            <View style={styles.treasuryCell}>
              <Text style={styles.treasuryLabel}>Solde Initial (calculé)</Text>
              <Text style={styles.treasuryValue}>{formatMoney(report.solde_initial)}</Text>
            </View>
            <View style={styles.treasuryCell}>
              <Text style={styles.treasuryLabel}>Solde Final (calculé)</Text>
              <Text style={styles.treasuryValue}>{formatMoney(report.solde_final)}</Text>
            </View>
          </View>
          <Text style={styles.treasuryNote}>
            Le solde de trésorerie est une valeur calculée (cumul des encaissements moins décaissements) et non un relevé bancaire — Sordi ne dispose pas d'un module de rapprochement bancaire.
          </Text>
        </View>

        {/* ================= SECTION 2 — RÉPARTITION DES ASSOCIÉS ================= */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>2. Tableau de Répartition des Associés</Text>
          {report.partners.length === 0 ? (
            <Text style={styles.emptyState}>Aucun associé enregistré.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeaderRow} fixed>
                <Text style={[styles.tableHeaderCell, styles.colPartnerName]}>Associé</Text>
                <Text style={[styles.tableHeaderCell, styles.colPartnerPct]}>% Parts</Text>
                <Text style={[styles.tableHeaderCell, styles.colPartnerGross, { textAlign: 'right' }]}>Part Brute</Text>
                <Text style={[styles.tableHeaderCell, styles.colPartnerDraw, { textAlign: 'right' }]}>Prélèvements</Text>
                <Text style={[styles.tableHeaderCell, styles.colPartnerNet, { textAlign: 'right' }]}>Net Restant</Text>
              </View>
              {report.partners.map((p) => (
                <View key={p.id} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCell, styles.colPartnerName]}>{p.name}{p.role ? ` · ${p.role}` : ''}</Text>
                  <Text style={[styles.tableCellMono, styles.colPartnerPct]}>{p.equity_percentage.toFixed(1)} %</Text>
                  <Text style={[styles.tableCellMono, styles.colPartnerGross]}>{formatMoney(p.quote_part_benefice)}</Text>
                  <Text style={[styles.tableCellMono, styles.colPartnerDraw]}>{formatMoney(p.prelevements_du_mois)}</Text>
                  <Text style={[styles.tableCellMono, styles.colPartnerNet, { fontWeight: 'bold' }]}>{formatMoney(p.solde_net_a_verser)}</Text>
                </View>
              ))}
              <View style={styles.tableTotalsRow}>
                <Text style={[styles.tableTotalsCell, styles.colPartnerName]}>TOTAL</Text>
                <Text style={[styles.tableTotalsCellMono, styles.colPartnerPct]}>
                  {report.partners.reduce((s, p) => s + p.equity_percentage, 0).toFixed(1)} %
                </Text>
                <Text style={[styles.tableTotalsCellMono, styles.colPartnerGross]}>{formatMoney(quotePartSum)}</Text>
                <Text style={[styles.tableTotalsCellMono, styles.colPartnerDraw]}>{formatMoney(report.total_prelevements_mois)}</Text>
                <Text style={[styles.tableTotalsCellMono, styles.colPartnerNet]}>
                  {formatMoney(report.partners.reduce((s, p) => s + p.solde_net_a_verser, 0))}
                </Text>
              </View>
              <Text style={[styles.footnote, zeroSumOk ? styles.footnoteOk : styles.footnoteBad]}>
                {zeroSumOk
                  ? `✓ Vérification: somme des parts brutes = Bénéfice Net (écart ${formatMoney(zeroSumDelta)}).`
                  : `⚠ Écart de vérification: somme des parts brutes ≠ Bénéfice Net (écart ${formatMoney(zeroSumDelta)}) — les parts de capital ne totalisent probablement pas 100 %.`}
              </Text>
            </View>
          )}
        </View>

        {/* ================= SECTION 3 — RH ================= */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>3. Ressources Humaines &amp; Charges d'Équipe</Text>
          <View style={styles.hrRow}>
            <View style={styles.hrCell}>
              <Text style={styles.hrLabel}>Employés Actifs</Text>
              <Text style={styles.hrValue}>{report.employes_actifs_count}</Text>
            </View>
            <View style={styles.hrCell}>
              <Text style={styles.hrLabel}>Jours Travaillés (cumul équipe)</Text>
              <Text style={styles.hrValue}>{report.total_jours_travailles.toFixed(1)}</Text>
            </View>
            <View style={styles.hrCell}>
              <Text style={styles.hrLabel}>Salaires Versés</Text>
              <Text style={styles.hrValue}>{formatMoney(report.masse_salariale_payee)}</Text>
            </View>
            <View style={styles.hrCell}>
              <Text style={styles.hrLabel}>Salaires en Attente</Text>
              <Text style={styles.hrValue}>{formatMoney(report.masse_salariale_en_attente)}</Text>
            </View>
          </View>
        </View>

        {/* ================= SECTION 4 — PROJETS ================= */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>4. Portfolio Projets du Mois</Text>
          {report.projets_clotures.length === 0 ? (
            <Text style={styles.emptyState}>Aucun projet dont l'échéance tombe en {monthLabel.toLowerCase()}.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeaderRow} fixed>
                <Text style={[styles.tableHeaderCell, styles.colProjName]}>Projet</Text>
                <Text style={[styles.tableHeaderCell, styles.colProjClient]}>Client</Text>
                <Text style={[styles.tableHeaderCell, styles.colProjDeadline]}>Échéance</Text>
                <Text style={[styles.tableHeaderCell, styles.colProjRevenue, { textAlign: 'right' }]}>CA HT (global)</Text>
                <Text style={[styles.tableHeaderCell, styles.colProjMargin, { textAlign: 'right' }]}>Marge Nette</Text>
              </View>
              {report.projets_clotures.map((p) => (
                <View key={p.id} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCell, styles.colProjName]}>{p.name}</Text>
                  <Text style={[styles.tableCell, styles.colProjClient]}>{p.client_name}</Text>
                  <Text style={[styles.tableCellMono, styles.colProjDeadline, { textAlign: 'left' }]}>{formatDateShort(p.deadline)}</Text>
                  <Text style={[styles.tableCellMono, styles.colProjRevenue]}>{formatMoney(p.revenue_ht)}</Text>
                  <Text style={[styles.tableCellMono, styles.colProjMargin, { fontWeight: 'bold' }]}>
                    {formatMoney(p.net_margin)} ({formatPercent(p.margin_percentage)})
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.footnote}>
            La marge affichée est la marge globale (toute la durée) du projet — le schéma de données ne permet pas d'isoler la part générée durant ce seul mois.
          </Text>
        </View>

        {/* ================= SIGNATURES ================= */}
        <View style={styles.signaturesRow}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Associé Gérant</Text>
            <Text style={styles.signatureSub}>Signature &amp; date</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Associé Gérant</Text>
            <Text style={styles.signatureSub}>Signature &amp; date</Text>
          </View>
        </View>

        {/* ================= FOOTER ================= */}
        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              {settings?.company_name || 'Sordi'}{phones.length > 0 ? `  ·  ${phones.map(formatPhone).join(' / ')}` : ''}
            </Text>
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
