import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { resolveInvoicePdfFontFamily, resolveCompanyPhones, formatPhone, type PDFSettings } from './invoicePdfShared';
import type { MonthlyBusinessReport } from '@/lib/database';
import './pdfFonts';

const MONTH_NAMES_FR = [
  'JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE',
];

/** "X\u00A0XXX,XX\u00A0DZD" — uses non-breaking space to prevent numbers from breaking across table columns. */
const formatMoney = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0,00\u00A0DZD';
  const abs = Math.abs(amount);
  const formatted = abs.toFixed(2).replace(/\./g, ',');
  const [intPart, decPart] = formatted.split(',');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${amount < 0 ? '-' : ''}${grouped},${decPart || '00'}\u00A0DZD`;
};

const formatPercent = (v: number | null | undefined): string => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return `${v >= 0 ? '' : ''}${v.toFixed(1)}\u00A0%`;
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
 * "Rapport Mensuel d'Activité, Clôture & Répartition des Associés"
 * Upgraded Algerian formal financial document with official letterhead, partnership agreement
 * context, right-aligned formatted tables, zebra striping, and official signature sections.
 */
export function MonthlyReportPDF({ report, settings }: MonthlyReportPDFProps) {
  const fontFamily = resolveInvoicePdfFontFamily(settings);
  const primaryColor = settings?.primary_color || '#111827';
  const phones = resolveCompanyPhones(settings);
  const monthLabel = `${MONTH_NAMES_FR[report.month_num - 1] || report.month_num}\u00A0${report.year}`;
  const generatedLabel = new Date(report.generated_at).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const companyName = settings?.company_name || 'EURL OMADA AGENCY';
  const companyAddress = settings?.company_address || 'Sétif, Algérie';
  const companyRc = settings?.company_rc || '19/00-0987654B19';
  const companyNif = settings?.company_nif || '001919012345678';
  const companyNis = settings?.company_nis || '001919012345678';
  const companyAi = settings?.company_ai || '19012345678';

  const quotePartSum = report.partners.reduce((s, p) => s + p.quote_part_benefice, 0);
  const zeroSumDelta = report.benefice_net - quotePartSum;
  const zeroSumOk = Math.abs(zeroSumDelta) < 1;

  const styles = StyleSheet.create({
    page: {
      width: 595.28,
      height: 841.89,
      paddingTop: 28,
      paddingBottom: 40,
      paddingHorizontal: 32,
      fontFamily,
      fontSize: 8,
      color: '#111827',
      backgroundColor: '#ffffff',
    },

    /* ================= 1. OFFICIAL LETTERHEAD ================= */
    letterheadContainer: {
      marginBottom: 10,
      borderBottomWidth: 1.5,
      borderBottomColor: '#111827',
      paddingBottom: 10,
    },
    letterheadRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    companyCol: {
      width: '52%',
    },
    logo: {
      height: 24,
      maxWidth: 130,
      objectFit: 'contain',
      marginBottom: 4,
    },
    companyName: {
      fontSize: 12,
      fontFamily,
      fontWeight: 'bold',
      color: '#111827',
      letterSpacing: 0.3,
    },
    companySubline: {
      fontSize: 6.8,
      color: '#4B5563',
      marginTop: 1,
    },
    companyAddress: {
      fontSize: 6.8,
      color: '#4B5563',
      marginTop: 1,
    },
    companyPhone: {
      fontSize: 6.8,
      color: '#4B5563',
      marginTop: 1,
    },
    legalAndDocCol: {
      width: '46%',
      alignItems: 'flex-end',
    },
    legalBadgeBox: {
      backgroundColor: '#F9FAFB',
      borderWidth: 0.75,
      borderColor: '#E5E7EB',
      borderRadius: 4,
      paddingVertical: 4,
      paddingHorizontal: 6,
      width: '100%',
      marginBottom: 5,
    },
    legalGridRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 1.5,
    },
    legalLabel: {
      fontSize: 6.5,
      fontFamily,
      fontWeight: 'bold',
      color: '#374151',
    },
    legalValue: {
      fontSize: 6.5,
      fontFamily: 'JetBrains Mono',
      color: '#111827',
    },
    docTitleBox: {
      alignItems: 'flex-end',
      marginTop: 2,
    },
    docTitle: {
      fontSize: 10,
      fontFamily,
      fontWeight: 'bold',
      color: '#111827',
      letterSpacing: 0.5,
    },
    docPeriodBadge: {
      marginTop: 3,
      backgroundColor: primaryColor,
      paddingHorizontal: 7,
      paddingVertical: 2.5,
      borderRadius: 3,
    },
    docPeriodText: {
      fontSize: 7.5,
      fontFamily,
      fontWeight: 'bold',
      color: '#ffffff',
      letterSpacing: 0.4,
    },
    docDate: {
      fontSize: 6.2,
      color: '#6B7280',
      marginTop: 2,
    },

    /* ================= SECTION COMMON ================= */
    section: {
      marginBottom: 10,
    },
    sectionHeading: {
      fontSize: 8,
      fontFamily,
      fontWeight: 'bold',
      color: '#111827',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 5,
      borderBottomWidth: 0.75,
      borderBottomColor: '#374151',
      paddingBottom: 2.5,
    },

    /* ================= SYNTHÈSE FINANCIÈRE ================= */
    metricStrip: {
      flexDirection: 'row',
      borderWidth: 0.75,
      borderColor: '#D1D5DB',
      borderRadius: 4,
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
    },
    metricCell: {
      flex: 1,
      padding: 6,
      borderRightWidth: 0.75,
      borderRightColor: '#E5E7EB',
    },
    metricCellLast: {
      flex: 1,
      padding: 6,
    },
    metricLabel: {
      fontSize: 6,
      fontFamily,
      fontWeight: 'bold',
      color: '#4B5563',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2.5,
    },
    metricValue: {
      fontSize: 9.5,
      fontFamily: 'JetBrains Mono',
      fontWeight: 'bold',
      color: '#111827',
    },
    metricValuePositive: {
      color: '#047857',
    },
    metricValueNegative: {
      color: '#B91C1C',
    },

    treasuryRow: {
      flexDirection: 'row',
      marginTop: 4,
      gap: 5,
    },
    treasuryCell: {
      flex: 1,
      borderWidth: 0.5,
      borderColor: '#E5E7EB',
      borderRadius: 3,
      padding: 4.5,
      backgroundColor: '#FAFAFA',
    },
    treasuryLabel: {
      fontSize: 5.8,
      color: '#6B7280',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginBottom: 2,
    },
    treasuryValue: {
      fontSize: 7.5,
      fontFamily: 'JetBrains Mono',
      fontWeight: 'bold',
      color: '#1F2937',
    },
    treasuryNote: {
      fontSize: 5.5,
      color: '#9CA3AF',
      marginTop: 3,
    },

    /* ================= 2. PARTNERSHIP AGREEMENT CONTEXT ================= */
    agreementBox: {
      backgroundColor: '#F9FAFB',
      borderLeftWidth: 2.5,
      borderLeftColor: '#374151',
      borderTopWidth: 0.5,
      borderRightWidth: 0.5,
      borderBottomWidth: 0.5,
      borderColor: '#E5E7EB',
      borderRadius: 3,
      padding: 6,
      marginBottom: 10,
    },
    agreementTitle: {
      fontSize: 6.8,
      fontFamily,
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    agreementText: {
      fontSize: 6.4,
      color: '#374151',
      lineHeight: 1.35,
    },

    /* ================= 3. TABLE STYLES & READABILITY ================= */
    table: {
      width: '100%',
      borderWidth: 0.5,
      borderColor: '#E5E7EB',
      borderRadius: 3,
      overflow: 'hidden',
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: '#F3F4F6', // Light gray background for table headers
      borderBottomWidth: 0.75,
      borderBottomColor: '#D1D5DB',
      paddingVertical: 4.5,
      alignItems: 'center',
    },
    tableHeaderCell: {
      fontSize: 6.2,
      fontFamily,
      fontWeight: 'bold',
      color: '#374151',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      paddingHorizontal: 4,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: '#F3F4F6',
      paddingVertical: 4,
      alignItems: 'center',
    },
    tableCell: {
      fontSize: 7.2,
      color: '#111827',
      paddingHorizontal: 4,
    },
    tableCellMono: {
      fontSize: 7.2,
      fontFamily: 'JetBrains Mono',
      color: '#111827',
      paddingHorizontal: 4,
      textAlign: 'right', // Right-aligned numbers
    },
    tableTotalsRow: {
      flexDirection: 'row',
      backgroundColor: '#F3F4F6',
      borderTopWidth: 1,
      borderTopColor: '#111827',
      paddingVertical: 4.5,
      alignItems: 'center',
    },
    tableTotalsCell: {
      fontSize: 7.2,
      fontFamily,
      fontWeight: 'bold',
      color: '#111827',
      paddingHorizontal: 4,
    },
    tableTotalsCellMono: {
      fontSize: 7.2,
      fontFamily: 'JetBrains Mono',
      fontWeight: 'bold',
      color: '#111827',
      paddingHorizontal: 4,
      textAlign: 'right', // Right-aligned numbers
    },

    // Column widths
    colPartnerName: { width: '28%', textAlign: 'left' },
    colPartnerPct: { width: '12%', textAlign: 'right' },
    colPartnerGross: { width: '20%', textAlign: 'right' },
    colPartnerDraw: { width: '20%', textAlign: 'right' },
    colPartnerNet: { width: '20%', textAlign: 'right' },

    colProjName: { width: '28%', textAlign: 'left' },
    colProjClient: { width: '22%', textAlign: 'left' },
    colProjDeadline: { width: '16%', textAlign: 'center' },
    colProjRevenue: { width: '17%', textAlign: 'right' },
    colProjMargin: { width: '17%', textAlign: 'right' },

    footnote: {
      fontSize: 5.8,
      color: '#6B7280',
      marginTop: 3.5,
    },
    footnoteOk: { color: '#047857' },
    footnoteBad: { color: '#B91C1C' },
    emptyState: { fontSize: 7, color: '#9CA3AF', paddingVertical: 6 },

    /* ================= 4. SIGNATURES & FOOTER ================= */
    signaturesContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 14,
      marginBottom: 6,
    },
    signatureCard: {
      width: '47%',
      borderWidth: 0.75,
      borderColor: '#D1D5DB',
      borderRadius: 4,
      backgroundColor: '#FAFAFA',
      padding: 7,
    },
    signatureRoleHeader: {
      fontSize: 7.5,
      fontFamily,
      fontWeight: 'bold',
      color: '#111827',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    signaturePartnerName: {
      fontSize: 6.8,
      color: '#4B5563',
    },
    signatureBoxZone: {
      height: 44,
      borderWidth: 0.5,
      borderColor: '#E5E7EB',
      borderStyle: 'dashed',
      borderRadius: 3,
      backgroundColor: '#FFFFFF',
      marginVertical: 4,
    },
    signatureFootnote: {
      fontSize: 5.5,
      color: '#9CA3AF',
      fontStyle: 'italic',
      textAlign: 'center',
    },

    pageFooter: {
      position: 'absolute',
      left: 32,
      right: 32,
      bottom: 16,
      borderTopWidth: 0.5,
      borderTopColor: '#E5E7EB',
      paddingTop: 5,
    },
    pageFooterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    pageFooterLegal: {
      fontSize: 5.8,
      color: '#6B7280',
    },
    pageFooterNumber: {
      fontSize: 6,
      fontFamily: 'JetBrains Mono',
      color: '#6B7280',
    },
  });

  return (
    <Document title={`Rapport Mensuel des Associés — ${monthLabel}`} author={companyName}>
      <Page size="A4" style={styles.page}>
        {/* ================= 1. OFFICIAL LETTERHEAD ================= */}
        <View style={styles.letterheadContainer}>
          <View style={styles.letterheadRow}>
            {/* Left: Company Identity */}
            <View style={styles.companyCol}>
              {settings?.logo_data && (
                <Image src={settings.logo_data} style={styles.logo} />
              )}
              <Text style={styles.companyName}>{companyName}</Text>
              <Text style={styles.companySubline}>Société de Services &amp; Ingénierie Numérique</Text>
              <Text style={styles.companyAddress}>{companyAddress}</Text>
              {phones.length > 0 && (
                <Text style={styles.companyPhone}>Tél : {phones.map(formatPhone).join(' / ')}</Text>
              )}
            </View>

            {/* Right: Legal Registrations & Title */}
            <View style={styles.legalAndDocCol}>
              <View style={styles.legalBadgeBox}>
                <View style={styles.legalGridRow}>
                  <Text style={styles.legalLabel}>RC :</Text>
                  <Text style={styles.legalValue}>{companyRc}</Text>
                </View>
                <View style={styles.legalGridRow}>
                  <Text style={styles.legalLabel}>NIF :</Text>
                  <Text style={styles.legalValue}>{companyNif}</Text>
                </View>
                <View style={styles.legalGridRow}>
                  <Text style={styles.legalLabel}>NIS :</Text>
                  <Text style={styles.legalValue}>{companyNis}</Text>
                </View>
                <View style={styles.legalGridRow}>
                  <Text style={styles.legalLabel}>AI :</Text>
                  <Text style={styles.legalValue}>{companyAi}</Text>
                </View>
              </View>

              <View style={styles.docTitleBox}>
                <Text style={styles.docTitle}>RAPPORT MENSUEL DES ASSOCIÉS</Text>
                <View style={styles.docPeriodBadge}>
                  <Text style={styles.docPeriodText}>ARRÊTÉ AU : {monthLabel}</Text>
                </View>
                <Text style={styles.docDate}>Généré le {generatedLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ================= SECTION 1 — SYNTHÈSE FINANCIÈRE ================= */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>1. Synthèse Financière du Mois</Text>
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
            Solde théorique de trésorerie résultant des flux de la période (encaissements moins décaissements).
          </Text>
        </View>

        {/* ================= 2. PARTNERSHIP AGREEMENT CONTEXT ================= */}
        <View style={styles.agreementBox}>
          <Text style={styles.agreementTitle}>Cadre Conventionnel &amp; Modalités de Répartition</Text>
          <Text style={styles.agreementText}>
            Le présent rapport financier et la répartition des résultats sont arrêtés entre les associés fondateurs, 
            M. Islem Soualhia et M. Zineddine Tchier, conformément aux statuts de la société et à la convention 
            de partenariat régissant la détention du capital et la mise à disposition des infrastructures et moyens d'exploitation. 
            Les quote-parts ci-dessous sont calculées sur la base du bénéfice net de la période, déduction faite des prélèvements effectués.
          </Text>
        </View>

        {/* ================= 3. TABLEAU DE RÉPARTITION DES ASSOCIÉS ================= */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>2. Tableau de Répartition des Bénéfices</Text>
          {report.partners.length === 0 ? (
            <Text style={styles.emptyState}>Aucun associé enregistré.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeaderRow} fixed>
                <Text style={[styles.tableHeaderCell, styles.colPartnerName]}>Associé</Text>
                <Text style={[styles.tableHeaderCell, styles.colPartnerPct]}>% Parts</Text>
                <Text style={[styles.tableHeaderCell, styles.colPartnerGross]}>Part Brute</Text>
                <Text style={[styles.tableHeaderCell, styles.colPartnerDraw]}>Prélèvements</Text>
                <Text style={[styles.tableHeaderCell, styles.colPartnerNet]}>Net Restant</Text>
              </View>
              {report.partners.map((p, idx) => (
                <View
                  key={p.id}
                  style={[
                    styles.tableRow,
                    { backgroundColor: idx % 2 === 1 ? '#F9FAFB' : '#FFFFFF' } // Zebra striping
                  ]}
                  wrap={false}
                >
                  <Text style={[styles.tableCell, styles.colPartnerName]}>
                    {p.name}{p.role ? ` · ${p.role}` : ''}
                  </Text>
                  <Text style={[styles.tableCellMono, styles.colPartnerPct]}>
                    {p.equity_percentage.toFixed(1)}&nbsp;%
                  </Text>
                  <Text style={[styles.tableCellMono, styles.colPartnerGross]}>
                    {formatMoney(p.quote_part_benefice)}
                  </Text>
                  <Text style={[styles.tableCellMono, styles.colPartnerDraw]}>
                    {formatMoney(p.prelevements_du_mois)}
                  </Text>
                  <Text style={[styles.tableCellMono, styles.colPartnerNet, { fontWeight: 'bold' }]}>
                    {formatMoney(p.solde_net_a_verser)}
                  </Text>
                </View>
              ))}
              <View style={styles.tableTotalsRow}>
                <Text style={[styles.tableTotalsCell, styles.colPartnerName]}>TOTAL</Text>
                <Text style={[styles.tableTotalsCellMono, styles.colPartnerPct]}>
                  {report.partners.reduce((s, p) => s + p.equity_percentage, 0).toFixed(1)}&nbsp;%
                </Text>
                <Text style={[styles.tableTotalsCellMono, styles.colPartnerGross]}>
                  {formatMoney(quotePartSum)}
                </Text>
                <Text style={[styles.tableTotalsCellMono, styles.colPartnerDraw]}>
                  {formatMoney(report.total_prelevements_mois)}
                </Text>
                <Text style={[styles.tableTotalsCellMono, styles.colPartnerNet]}>
                  {formatMoney(report.partners.reduce((s, p) => s + p.solde_net_a_verser, 0))}
                </Text>
              </View>
            </View>
          )}
          <Text style={[styles.footnote, zeroSumOk ? styles.footnoteOk : styles.footnoteBad]}>
            {zeroSumOk
              ? `✓ Vérification de concordance : la somme des quotes-parts brutes correspond exactement au Bénéfice Net (écart : ${formatMoney(zeroSumDelta)}).`
              : `⚠ Écart de concordance : somme des quotes-parts brutes ≠ Bénéfice Net (écart : ${formatMoney(zeroSumDelta)}).`}
          </Text>
        </View>

        {/* ================= SECTION 4 — PORTFOLIO PROJETS ================= */}
        {report.projets_clotures.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>3. Portfolio Projets du Mois</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow} fixed>
                <Text style={[styles.tableHeaderCell, styles.colProjName]}>Projet</Text>
                <Text style={[styles.tableHeaderCell, styles.colProjClient]}>Client</Text>
                <Text style={[styles.tableHeaderCell, styles.colProjDeadline]}>Échéance</Text>
                <Text style={[styles.tableHeaderCell, styles.colProjRevenue]}>CA HT</Text>
                <Text style={[styles.tableHeaderCell, styles.colProjMargin]}>Marge Nette</Text>
              </View>
              {report.projets_clotures.map((p, idx) => (
                <View
                  key={p.id}
                  style={[
                    styles.tableRow,
                    { backgroundColor: idx % 2 === 1 ? '#F9FAFB' : '#FFFFFF' }
                  ]}
                  wrap={false}
                >
                  <Text style={[styles.tableCell, styles.colProjName]}>{p.name}</Text>
                  <Text style={[styles.tableCell, styles.colProjClient]}>{p.client_name}</Text>
                  <Text style={[styles.tableCellMono, styles.colProjDeadline]}>{formatDateShort(p.deadline)}</Text>
                  <Text style={[styles.tableCellMono, styles.colProjRevenue]}>{formatMoney(p.revenue_ht)}</Text>
                  <Text style={[styles.tableCellMono, styles.colProjMargin, { fontWeight: 'bold' }]}>
                    {formatMoney(p.net_margin)}&nbsp;({formatPercent(p.margin_percentage)})
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ================= 4. SIGNATURES & VALIDATION ================= */}
        <View style={styles.signaturesContainer} wrap={false}>
          <View style={styles.signatureCard}>
            <Text style={styles.signatureRoleHeader}>Signature &amp; Cachet - Gérant</Text>
            <Text style={styles.signaturePartnerName}>M. Islem Soualhia</Text>
            <View style={styles.signatureBoxZone} />
            <Text style={styles.signatureFootnote}>Mention manuscrite « Lu et approuvé »</Text>
          </View>

          <View style={styles.signatureCard}>
            <Text style={styles.signatureRoleHeader}>Signature - Associé</Text>
            <Text style={styles.signaturePartnerName}>M. Zineddine Tchier</Text>
            <View style={styles.signatureBoxZone} />
            <Text style={styles.signatureFootnote}>Mention manuscrite « Lu et approuvé »</Text>
          </View>
        </View>

        {/* ================= FOOTER ================= */}
        <View style={styles.pageFooter} fixed>
          <View style={styles.pageFooterRow}>
            <Text style={styles.pageFooterLegal}>
              {companyName}  ·  RC : {companyRc}  ·  NIF : {companyNif}  ·  NIS : {companyNis}  ·  AI : {companyAi}
            </Text>
            <Text
              style={styles.pageFooterNumber}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
