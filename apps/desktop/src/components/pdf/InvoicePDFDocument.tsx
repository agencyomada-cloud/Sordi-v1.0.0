import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import {
  PDFInvoice,
  PDFSettings,
  formatCurrency,
  resolveInvoiceData,
  resolveCompanyPhones,
  formatPhone,
  getDocumentSectionFlags,
  resolveInvoicePdfFontFamily,
} from './invoicePdfShared';
import { chunkItems } from '@/lib/paginationUtils';
import { getContrastTextColor } from '@/lib/colorContrast';
import { PdfStatusBadge } from './PdfStatusBadge';
import { PDF_PAGE_BASE, STANDARD_MARGIN_PT, LOGO_MAX_WIDTH_PT, resolveLogoMaxHeight, PX_TO_PT_SCALE } from '@/services/export/pdfGeometry';
import './pdfFonts';

export type { PDFInvoiceItem, PDFInvoice, PDFClient, PDFSettings } from './invoicePdfShared';

interface InvoicePDFDocumentProps {
  invoice: PDFInvoice;
  settings?: PDFSettings;
}

/**
 * "Structuré" theme — a full-width header band and a bordered pricing grid,
 * the classic official-invoice look. Legal footer fields render only when
 * configured in Settings; there is no fallback company data baked in here.
 */
export function InvoicePDFDocument({ invoice, settings }: InvoicePDFDocumentProps) {
  const primaryColor = settings?.primary_color || "#476CFF";
  const headerTextColor = getContrastTextColor(primaryColor);
  const fontFamily = resolveInvoicePdfFontFamily(settings);
  const data = resolveInvoiceData(invoice);
  const flags = getDocumentSectionFlags(data);
  const phones = resolveCompanyPhones(settings);
  const rawSize = Math.max(80, Math.min(400, Number(invoice?.stamp_size || settings?.stamp_size || 180)));
  // 1:1-ish px->pt scale of the "Taille" slider, capped only at a page-safe
  // ceiling — the previous 90-180/135 clamp saturated by ~half the slider's
  // range (80-400), making the control look broken above that point.
  const stampWidth = Math.min(200, Math.round(rawSize * PX_TO_PT_SCALE));
  const stampHeight = Math.min(220, Math.round(stampWidth * 1.17));
  const mainStampUrl = settings?.stamp_data || settings?.signature_data || "";
  const hasBoth = Boolean(settings?.stamp_data && settings?.signature_data);
  // This theme's header/main/footer bands are absolutely positioned to fill
  // exactly one page (96.1 + 651.4 + 94.4 = 841.89pt) with no native
  // pagination, so an invoice with enough line items to overflow that
  // 651.4pt main band used to render past it and get silently painted over
  // by the opaque footer. Chunking items across multiple explicit <Page>s
  // (same ITEMS_PER_PAGE/ITEMS_PER_LAST_PAGE budget the live preview's own
  // pagination already uses) guarantees every line item lands on some page
  // instead of being clipped — each page reproduces the same header/main/
  // footer bands unchanged; only the item chunk and the last-page-only
  // notes/totals/signature block vary per page.
  const pages = chunkItems(data.items);

  const styles = StyleSheet.create({
    page: {
      ...PDF_PAGE_BASE,
      padding: 0,
      fontFamily,
      fontSize: 9,
      color: '#000000',
      backgroundColor: '#ffffff',
    },
    backgroundContainer: {
      position: 'absolute',
      top: 96.1,
      left: 0,
      right: 0,
      bottom: 94.4,
    },
    patternImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      objectFit: 'cover',
      opacity: 0.2,
    },

    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: 96.1,
      backgroundColor: '#ffffff',
    },
    headerLogoContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '50%',
      height: 72.85,
      paddingTop: 14.17,
      // Synced to the page's 52pt (~18.5mm) executive print margin, so the
      // logo/company-name block's left edge lands exactly on the same
      // vertical grid line as the client block, table, and legal text below.
      paddingLeft: STANDARD_MARGIN_PT,
      paddingBottom: 14.17,
      justifyContent: 'center',
    },
    logoImage: {
      maxHeight: resolveLogoMaxHeight(settings),
      maxWidth: LOGO_MAX_WIDTH_PT,
      objectFit: 'contain',
    },
    companyNameBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 202.68,
      height: 22.1,
      backgroundColor: primaryColor,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14.17,
      zIndex: 2,
    },
    companyNameText: {
      fontSize: 8.5,
      fontFamily,
      fontWeight: 'bold',
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    main: {
      position: 'absolute',
      left: 0,
      top: 96.1,
      width: '100%',
      height: 651.4,
      backgroundColor: '#ffffff',
    },
    mainContent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      // 52pt (~18.5mm) — an executive-grade print margin, the single left/
      // right grid line every section (client block, table, totals, legal
      // amount, signature box) aligns to via this shared container.
      paddingHorizontal: STANDARD_MARGIN_PT,
      paddingTop: 14.17,
      // Bumped from 5.67 (~2mm) — same "footer content was crammed against
      // the band edge" fix already applied to the interactive editor canvas.
      paddingBottom: 17,
    },
    titleContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    titleText: {
      fontSize: 13,
      fontFamily, fontWeight: 'bold',
      color: '#1f2937',
      textTransform: 'uppercase',
      letterSpacing: -0.3,
    },

    clientMetaGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    clientBox: { width: '55%' },
    clientHeaderLabel: {
      fontSize: 7.5,
      fontFamily, fontWeight: 'bold',
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    clientName: {
      fontSize: 12,
      fontFamily, fontWeight: 'bold',
      color: '#000000',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    clientAddress: {
      fontSize: 9,
      fontFamily, fontWeight: 'bold',
      color: '#374151',
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    clientDetailRow: {
      fontFamily: 'JetBrains Mono',
      fontSize: 8.5,
      color: '#6b7280',
      textTransform: 'uppercase',
      marginBottom: 1.5,
      lineHeight: 1.4,
    },
    clientDetailBold: { fontFamily, fontWeight: 'bold', color: '#374151' },
    metaBox: { width: '35%', paddingTop: 2 },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
      paddingBottom: 2,
      borderBottomWidth: 0.5,
      borderBottomColor: '#f3f4f6',
    },
    metaLabel: { fontFamily, fontSize: 7.5, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 },
    metaValue: { fontFamily: 'JetBrains Mono', fontSize: 9, color: '#000000' },
    avoirNotice: {
      marginTop: 4,
      fontSize: 8,
      fontFamily, fontWeight: 'bold',
      color: '#6b7280',
      textAlign: 'right',
    },

    tableContainer: {
      width: '100%',
      marginBottom: 18,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: primaryColor,
      alignItems: 'center',
    },
    tableHeaderCell: {
      fontFamily,
      fontSize: 7.5,
      color: headerTextColor,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(0,0,0,0.08)',
      alignItems: 'flex-start',
      minHeight: 22,
    },
    colDesignation: { width: '42%' },
    colPrice: { width: '15%', textAlign: 'right' },
    colQty: { width: '9%', textAlign: 'right' },
    colUnit: { width: '16%', textAlign: 'center' },
    colAmount: { width: '18%', textAlign: 'right' },
    tableCellText: {
      fontSize: 9,
      color: '#000000',
      paddingVertical: 6,
      paddingHorizontal: 10,
    },

    // Notes + totals share one row (notesRow) so they read as a single
    // balanced line instead of notes sitting full-width above the totals.
    notesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    notesBlock: { width: '42%', padding: 8, borderWidth: 0.75, borderColor: '#e5e7eb' },
    notesLabel: { fontFamily, fontSize: 7.5, fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
    notesText: { fontSize: 8.5, color: '#374151', lineHeight: 1.4 },

    totalsRightContainer: { alignItems: 'flex-end', marginBottom: 14 },
    totalsRightColumn: { alignItems: 'flex-end' },
    // Fixed pt width, not a percentage — see the other two themes for why:
    // a % here only holds up if every ancestor's own width matches the
    // page's full content width, which the notes+totals flex row doesn't
    // guarantee. 230pt is generous for "1 190 000.00 DZD" at this size.
    totalsBox: { width: 230 },
    totalsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    totalsLabel: { fontSize: 8, fontFamily, color: '#6b7280', flexShrink: 0 },
    totalsValueText: { fontFamily: 'JetBrains Mono', fontSize: 8, color: '#000000', textAlign: 'right', flexShrink: 0 },
    ttcRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 8,
      marginTop: 3,
      borderTopWidth: 1,
      borderTopColor: '#000000',
    },
    ttcLabel: { fontSize: 10, fontFamily, fontWeight: 'bold', color: '#000000', flexShrink: 0 },
    ttcValueText: { fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 'bold', color: '#000000', textAlign: 'right', flexShrink: 0 },

    bottomBlock: { marginBottom: 12 },
    wordsTitle: { fontSize: 7.5, fontFamily, fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
    wordsValue: {
      fontSize: 8.5,
      fontFamily, fontWeight: 'bold',
      color: '#000000',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      lineHeight: 1.3,
      marginBottom: 10,
    },
    signatureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    // The signature is signed directly on top of the stamp, like a real
    // paper document — both images are absolutely centered in a fixed-size
    // box instead of stacked in a column.
    signatureBox: {
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 20,
      minWidth: 130,
      paddingHorizontal: 12,
      position: 'relative',
    },
    signatureBoxEmpty: { alignItems: 'center', justifyContent: 'center' },
    // Only applied to the outer box when no stamp/signature image was
    // uploaded — a real stamp image fills styles.signatureBox exactly at
    // its own dynamic dimensions (bound to settings.stamp_size), so a
    // border there would frame the company's actual stamp like a
    // placeholder. This dashed frame + fixed 140x75 footprint exists only
    // to give the empty "Cachet et Signature" slot visible definition.
    signatureBoxEmptyFrame: { borderWidth: 1, borderColor: '#D1D5DB', borderStyle: 'dashed' },
    signatureBoxLabel: { fontSize: 8, fontFamily, fontWeight: 'bold', color: '#000000', textDecoration: 'underline', marginBottom: 4 },
    signatureBoxPlaceholder: { fontSize: 7, fontFamily, color: '#9ca3af', textTransform: 'uppercase' },
    stampImage: { position: 'absolute', objectFit: 'contain', opacity: 0.85, transform: 'rotate(-2deg)' },
    signatureImage: { position: 'absolute', objectFit: 'contain' },
    // Legal accounting pagination ("1 / 1", "1 / 2") — docked to the fixed
    // footer band's top edge, directly under its horizontal rule, instead
    // of sitting in-flow after the stamp block: an in-flow page number on a
    // short, single-item invoice used to float awkwardly in the middle of
    // the empty page instead of anchoring to the true page bottom.
    pageNumber: { position: 'absolute', top: 3, left: 0, right: 0, fontSize: 7.5, fontFamily: 'Courier', color: '#a1a1aa', letterSpacing: 1, textAlign: 'center' },

    footer: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      width: '100%',
      height: 94.4,
      backgroundColor: '#ffffff',
      borderTopWidth: 0.85,
      borderTopColor: '#222222',
    },
    footerInner: {
      position: 'absolute',
      // Synced to the page's 52pt (~18.5mm) executive print margin — the
      // same left/right grid line every other section aligns to.
      left: STANDARD_MARGIN_PT,
      right: STANDARD_MARGIN_PT,
      top: 9.92,
      bottom: 5.67,
      flexDirection: 'row',
    },

    // Column widths scaled down proportionally to fit the footer's now-52pt
    // margins while keeping the same balance between the legal/company/
    // contact columns.
    legalCol: { width: 158, paddingLeft: 11.9, justifyContent: 'flex-end', height: '100%' },
    legalColTextWrapper: { position: 'relative' },
    legalYellowBar: { position: 'absolute', left: -11.9, top: 1.5, bottom: 1.5, width: 2.13, backgroundColor: primaryColor },
    legalRow: { flexDirection: 'row', marginBottom: 2 },
    legalLabel: { width: 71, fontSize: 7.1, fontFamily, fontWeight: 'bold', color: '#000000' },
    legalColon: { width: 8, fontSize: 7.1, fontFamily, fontWeight: 'bold', textAlign: 'center' },
    legalValue: { fontSize: 7.1, fontFamily, color: '#000000' },

    companyInfoCol: { width: 164, paddingHorizontal: 4, justifyContent: 'flex-end', paddingBottom: 2.8, height: '100%' },
    addressText: { fontSize: 7.1, fontFamily, fontWeight: 'bold', color: '#000000', marginBottom: 4, lineHeight: 1.3 },
    ribText: { fontSize: 7.1, fontFamily, color: '#000000', lineHeight: 1.3 },

    contactCol: { flex: 1, position: 'relative', height: '100%' },
    sordiWatermark: { position: 'absolute', bottom: 1, left: 0, right: 0, textAlign: 'center', fontSize: 5.5, color: '#9ca3af' },
    contactRightBox: { flex: 1, justifyContent: 'flex-end', height: '100%' },
    contactEmailText: { fontSize: 7.1, fontFamily, fontWeight: 'bold', color: '#000000', lineHeight: 1.65 },
    contactDetailText: { fontSize: 7.1, fontFamily, color: '#000000', lineHeight: 1.65 },
  });

  return (
    <Document title={`${data.docTitle} ${data.docNumber}`} author={settings?.company_name || undefined}>
      {pages.map((pageItems, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === pages.length - 1;
        return (
      <Page key={pageIndex} size="A4" style={styles.page}>

        {isFirstPage && <PdfStatusBadge status={invoice.status} />}

        <View style={styles.header} fixed>
          <View style={styles.headerLogoContainer}>
            {/* No logo uploaded — collapse to empty space on the issued
                PDF, not a placeholder box or a repeated company-name line
                (the legal footer block already carries that). */}
            {settings?.logo_data && (
              <Image src={settings.logo_data} style={styles.logoImage} />
            )}
          </View>
          {/* Only shown alongside a real logo — this badge IS the header's
              one company-name display when there's no logo to pair it
              with, so showing it there too would just repeat the
              typographic fallback above it. */}
          {settings?.logo_data && settings?.company_name && (
            <View style={styles.companyNameBadge}>
              <Text style={styles.companyNameText}>{settings.company_name}</Text>
            </View>
          )}
        </View>

        <View style={styles.main}>
          {settings?.body_pattern_data && (
            <View style={styles.backgroundContainer} fixed>
              <Image src={settings.body_pattern_data} style={styles.patternImage} />
            </View>
          )}

          <View style={styles.mainContent}>
            <View style={styles.titleContainer}>
              <Text style={styles.titleText}>{data.docTitle}</Text>
            </View>

            <View style={styles.clientMetaGrid}>
              <View style={styles.clientBox}>
                <Text style={styles.clientHeaderLabel}>DESTINATAIRE</Text>
                <Text style={styles.clientName}>{data.clientName}</Text>
                {data.clientAddress !== "" && <Text style={styles.clientAddress}>{data.clientAddress}</Text>}
                {data.clientRc !== "" && (
                  <Text style={styles.clientDetailRow}><Text style={styles.clientDetailBold}>RC:</Text> {data.clientRc}</Text>
                )}
                {data.clientNif !== "" && (
                  <Text style={styles.clientDetailRow}><Text style={styles.clientDetailBold}>NIF:</Text> {data.clientNif}</Text>
                )}
                {data.clientAi !== "" && (
                  <Text style={styles.clientDetailRow}><Text style={styles.clientDetailBold}>AI:</Text> {data.clientAi}</Text>
                )}
                {data.clientNis !== "" && (
                  <Text style={styles.clientDetailRow}><Text style={styles.clientDetailBold}>NIS:</Text> {data.clientNis}</Text>
                )}
                {data.clientActivite !== "" && (
                  <Text style={styles.clientDetailRow}><Text style={styles.clientDetailBold}>Activité:</Text> {data.clientActivite}</Text>
                )}
                {data.clientContact !== "" && (
                  <Text style={styles.clientDetailRow}><Text style={styles.clientDetailBold}>Contact:</Text> {data.clientContact}</Text>
                )}
              </View>

              <View style={styles.metaBox}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Date d'émission</Text>
                  <Text style={styles.metaValue}>{invoice.invoice_date || "-"}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Numéro</Text>
                  <Text style={[styles.metaValue, { fontWeight: 'bold', textTransform: 'uppercase' }]}>
                    {data.docNumber || "-"}
                  </Text>
                </View>
                {!data.isCreditNote && invoice.due_date && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Échéance</Text>
                    <Text style={styles.metaValue}>{invoice.due_date}</Text>
                  </View>
                )}
                {flags.showPaymentMethod && !data.isCreditNote && (
                  <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.metaLabel}>Mode de paiement</Text>
                    <Text style={[styles.metaValue, { textTransform: 'uppercase' }]}>{invoice.payment_method || "Chèque"}</Text>
                  </View>
                )}
                {data.isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                  <Text style={styles.avoirNotice}>
                    Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.tableContainer}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.colDesignation, { textAlign: 'left' }]}>Désignation / Prestation</Text>
                <Text style={[styles.tableHeaderCell, styles.colPrice, { textAlign: 'right' }]}>P.U (HT)</Text>
                <Text style={[styles.tableHeaderCell, styles.colQty, { textAlign: 'right' }]}>Qté</Text>
                <Text style={[styles.tableHeaderCell, styles.colUnit, { textAlign: 'center' }]}>U.M</Text>
                <Text style={[styles.tableHeaderCell, styles.colAmount, { textAlign: 'right' }]}>Total HT</Text>
              </View>

              {pageItems.map((item, idx) => {
                const name = item.product_name || item.products?.name || "";
                const unit = item.products?.unit || item.unit || "TN";
                const quantityVal = Number(item.quantity || 0);
                const formattedQty = Number.isInteger(quantityVal) ? quantityVal.toString() : quantityVal.toFixed(2);
                const itemAmount = (item.quantity || 0) * (item.unit_price || 0);

                return (
                  <View key={idx} style={styles.tableRow}>
                    <View style={[styles.tableCellText, styles.colDesignation]}>
                      <Text style={{ fontSize: 9, fontFamily, fontWeight: 'bold', textTransform: 'uppercase', color: '#000000' }}>{name}</Text>
                    </View>
                    <Text style={[styles.tableCellText, styles.colPrice, { fontFamily: 'JetBrains Mono' }]}>{formatCurrency(item.unit_price)}</Text>
                    <Text style={[styles.tableCellText, styles.colQty, { fontFamily: 'JetBrains Mono' }]}>{formattedQty}</Text>
                    <Text style={[styles.tableCellText, styles.colUnit, { color: '#6b7280', fontSize: 8, textTransform: 'uppercase' }]}>{unit}</Text>
                    <Text style={[styles.tableCellText, styles.colAmount, { fontFamily: 'JetBrains Mono', fontWeight: 'bold' }]}>{formatCurrency(itemAmount)}</Text>
                  </View>
                );
              })}
            </View>

            {isLastPage && (() => {
              const hasNotes = invoice.notes && invoice.notes.trim() !== "";
              const totalsContent = (
                <>
                  <View style={styles.totalsBox}>
                    <View style={styles.totalsRow}>
                      <Text style={styles.totalsLabel}>Total HT</Text>
                      <Text style={styles.totalsValueText}>{formatCurrency(invoice.subtotal_ht || 0)}</Text>
                    </View>
                    {flags.showTva && (
                      <View style={styles.totalsRow}>
                        <Text style={styles.totalsLabel}>TVA (19%)</Text>
                        <Text style={styles.totalsValueText}>{formatCurrency(invoice.tva_amount || 0)}</Text>
                      </View>
                    )}
                    {flags.showTimbre && (invoice.timbre > 0 || (invoice.payment_method?.toLowerCase().includes("espèce") && invoice.timbre !== 0)) && (
                      <View style={styles.totalsRow}>
                        <Text style={styles.totalsLabel}>Timbre Fiscal</Text>
                        <Text style={styles.totalsValueText}>{formatCurrency(invoice.timbre || 0)}</Text>
                      </View>
                    )}
                    {((invoice.discount || 0) > 0 || (invoice.discount_value || 0) > 0) && (
                      <View style={styles.totalsRow}>
                        <Text style={[styles.totalsLabel, { color: '#b91c1c' }]}>Remise</Text>
                        <Text style={[styles.totalsValueText, { color: '#b91c1c' }]}>-{formatCurrency(invoice.discount || invoice.discount_value)}</Text>
                      </View>
                    )}
                    <View style={styles.ttcRow}>
                      <Text style={styles.ttcLabel}>{flags.grandTotalLabel}</Text>
                      <Text style={styles.ttcValueText}>{formatCurrency(invoice.total_ttc || 0)}</Text>
                    </View>
                  </View>
                  {flags.taxExemptionLegend && (
                    <Text style={{ marginTop: 6, fontSize: 7.5, color: '#6b7280', textAlign: 'right', maxWidth: 220 }}>
                      {flags.taxExemptionLegend}
                    </Text>
                  )}
                </>
              );

              if (hasNotes) {
                return (
                  <View style={styles.notesRow} wrap={false}>
                    <View style={styles.notesBlock}>
                      <Text style={styles.notesLabel}>Notes</Text>
                      <Text style={styles.notesText}>{invoice.notes}</Text>
                    </View>
                    <View style={styles.totalsRightColumn}>
                      {totalsContent}
                    </View>
                  </View>
                );
              }

              return (
                <View style={styles.totalsRightContainer}>
                  {totalsContent}
                </View>
              );
            })()}

            {isLastPage && (
            <View style={styles.bottomBlock}>
              {/* Bottom row: Words on the left, Stamp on the right side-by-side */}
              <View style={[styles.signatureRow, { justifyContent: 'space-between', alignItems: 'flex-end' }]} wrap={false}>
                {flags.showMontantEnLettres ? (
                  // width (not maxWidth) so the amount always gets the full
                  // 62% column instead of shrink-wrapping to its own text —
                  // a narrow maxWidth was forcing long French amounts like
                  // "...ALGÉRIENS..." to hyphen-break mid-word.
                  <View style={{ width: '62%', paddingRight: 16 }}>
                    <Text style={styles.wordsTitle}>Arrêté la présente facture à la somme de</Text>
                    <Text style={styles.wordsValue}>{data.wordsFrench}</Text>
                  </View>
                ) : (
                  <View />
                )}
                <View style={{ alignItems: 'center' }}>
                  {mainStampUrl && (
                    <Text style={[styles.signatureBoxLabel, { textAlign: 'center' }]}>Cachet et Signature</Text>
                  )}
                  <View
                    style={
                      mainStampUrl
                        ? [styles.signatureBox, { width: stampWidth, minWidth: stampWidth, height: stampHeight }]
                        : [styles.signatureBox, styles.signatureBoxEmptyFrame, { width: 140, minWidth: 140, height: 75 }]
                    }
                  >
                    {!mainStampUrl ? (
                      <View style={styles.signatureBoxEmpty}>
                        <Text style={styles.signatureBoxPlaceholder}>Cachet et Signature</Text>
                      </View>
                    ) : hasBoth ? (
                      <>
                        <Image
                          src={settings!.stamp_data!}
                          style={{
                            width: stampWidth,
                            height: stampHeight,
                            objectFit: 'contain',
                            opacity: 0.88,
                            transform: 'rotate(-2deg)',
                          }}
                        />
                        <Image
                          src={settings!.signature_data!}
                          style={{
                            position: 'absolute',
                            width: Math.round(stampWidth * 0.85),
                            height: Math.round(stampHeight * 0.65),
                            objectFit: 'contain',
                          }}
                        />
                      </>
                    ) : (
                      <Image
                        src={mainStampUrl}
                        style={{
                          width: stampWidth,
                          height: stampHeight,
                          objectFit: 'contain',
                          opacity: 0.88,
                          transform: 'rotate(-2deg)',
                        }}
                      />
                    )}
                  </View>
                </View>
              </View>
            </View>
            )}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.pageNumber}>{pageIndex + 1} / {pages.length}</Text>
          <View style={styles.footerInner}>
            <View style={styles.legalCol}>
              <View style={styles.legalColTextWrapper}>
                <View style={styles.legalYellowBar} />
                {settings?.company_rc && (
                  <View style={styles.legalRow}>
                    <Text style={styles.legalLabel}>N° Reg. Commerce</Text>
                    <Text style={styles.legalColon}>:</Text>
                    <Text style={styles.legalValue}>{settings.company_rc}</Text>
                  </View>
                )}
                {settings?.company_nif && (
                  <View style={styles.legalRow}>
                    <Text style={styles.legalLabel}>NIF</Text>
                    <Text style={styles.legalColon}>:</Text>
                    <Text style={styles.legalValue}>{settings.company_nif}</Text>
                  </View>
                )}
                {settings?.company_ai && (
                  <View style={styles.legalRow}>
                    <Text style={styles.legalLabel}>Articl. Imposition</Text>
                    <Text style={styles.legalColon}>:</Text>
                    <Text style={styles.legalValue}>{settings.company_ai}</Text>
                  </View>
                )}
                {settings?.company_nis && (
                  <View style={styles.legalRow}>
                    <Text style={styles.legalLabel}>NIS</Text>
                    <Text style={styles.legalColon}>:</Text>
                    <Text style={styles.legalValue}>{settings.company_nis}</Text>
                  </View>
                )}
                {settings?.company_capital && (
                  <View style={styles.legalRow}>
                    <Text style={styles.legalLabel}>Capital Social</Text>
                    <Text style={styles.legalColon}>:</Text>
                    <Text style={styles.legalValue}>{settings.company_capital}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.companyInfoCol}>
              {settings?.company_address && <Text style={styles.addressText}>Adresse: {settings.company_address}</Text>}
              {settings?.company_rib && (
                <Text style={styles.ribText}>
                  <Text style={{ fontFamily, fontWeight: 'bold' }}>RIB:</Text>{" "}
                  {settings.company_rib}
                  {settings?.company_bank_agency ? `\n${settings.company_bank_agency}` : ""}
                </Text>
              )}
            </View>

            <View style={styles.contactCol}>
              <View style={styles.contactRightBox}>
                {settings?.company_email && <Text style={styles.contactEmailText}>{settings.company_email}</Text>}
                {settings?.company_website && <Text style={styles.contactDetailText}>{settings.company_website}</Text>}
                {phones.map((p, i) => (
                  <Text key={i} style={styles.contactDetailText}>{formatPhone(p)}</Text>
                ))}
              </View>
            </View>
          </View>
          {settings?.license_active === false && (
            <Text style={styles.sordiWatermark}>Created by Sordi v1.0.1 — www.sordi.app</Text>
          )}
        </View>

      </Page>
        );
      })}
    </Document>
  );
}
