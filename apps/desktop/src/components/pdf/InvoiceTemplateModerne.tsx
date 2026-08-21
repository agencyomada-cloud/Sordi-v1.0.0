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

// The four selectable document fonts (Paramètres > Thème de la facture PDF >
// Police) — all registered up front; react-pdf only actually fetches the
// family a given Text style references, so registering all four here costs
// nothing beyond bookkeeping. Keep in sync with INVOICE_PDF_FONTS.
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

interface InvoiceTemplateModerneProps {
  invoice: PDFInvoice;
  settings?: PDFSettings;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.substring(0, 2), 16) || 0;
  const g = parseInt(full.substring(2, 4), 16) || 0;
  const b = parseInt(full.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * "Moderne" theme — a solid accent header band, rounded card blocks, and a
 * zebra-striped table. Uses the same legally-required Algerian invoice
 * fields as the other two themes, just with SaaS-style visual language.
 */
export function InvoiceTemplateModerne({ invoice, settings }: InvoiceTemplateModerneProps) {
  const accent = settings?.primary_color || "#476CFF";
  const accentSoft = hexToRgba(accent, 0.08);
  const accentBorder = hexToRgba(accent, 0.18);
  const fontFamily = resolveInvoicePdfFontFamily(settings);
  const data = resolveInvoiceData(invoice);
  const flags = getDocumentSectionFlags(data);
  const phones = resolveCompanyPhones(settings);

  const styles = StyleSheet.create({
    page: { width: 595.28, height: 841.89, padding: 0, fontFamily, fontSize: 9, color: '#111827', backgroundColor: '#ffffff' },

    headerBand: { backgroundColor: accent, paddingHorizontal: 40, paddingVertical: 26, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logoChip: { backgroundColor: '#ffffff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 160 },
    logoImage: { height: 28, maxWidth: 136, objectFit: 'contain' },
    companyNameWhite: { fontSize: 12, fontFamily, fontWeight: 'bold', color: '#ffffff', letterSpacing: 0.3 },
    headerRight: { alignItems: 'flex-end' },
    docTitle: { fontSize: 17, fontFamily, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1.2 },
    docNumber: { fontSize: 8.5, color: 'rgba(255,255,255,0.85)', marginTop: 3 },

    body: { padding: 40, paddingTop: 26 },

    cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    card: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 10, padding: 14 },
    cardLabel: { fontSize: 7, color: accent, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily, fontWeight: 'bold', marginBottom: 6 },
    clientName: { fontSize: 10.5, fontFamily, fontWeight: 'bold', color: '#111827', textTransform: 'uppercase', marginBottom: 3 },
    plainLine: { fontSize: 8, color: '#4b5563', marginBottom: 1.5, lineHeight: 1.3 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    metaRowLabel: { fontSize: 8, color: '#6b7280' },
    metaRowValue: { fontSize: 8.5, fontFamily, fontWeight: 'bold', color: '#111827' },
    avoirNotice: { fontSize: 7.5, color: '#6b7280', marginTop: 6 },

    tableWrap: { borderRadius: 10, overflow: 'hidden', borderWidth: 0.75, borderColor: accentBorder, marginBottom: 18 },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: accentSoft, paddingVertical: 7, paddingHorizontal: 10 },
    tableHeaderCell: { fontSize: 7.5, color: accent, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily, fontWeight: 'bold' },
    tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
    tableRowAlt: { backgroundColor: '#fafafa' },
    colDesignation: { width: '45%' },
    colPrice: { width: '15%', textAlign: 'right' },
    colQty: { width: '13%', textAlign: 'right' },
    colUnit: { width: '12%', textAlign: 'center' },
    colAmount: { width: '15%', textAlign: 'right' },
    itemName: { fontSize: 9, color: '#111827', fontFamily, fontWeight: 'bold' },
    cellText: { fontSize: 8.5, color: '#374151' },

    totalsContainer: { alignItems: 'flex-end', marginBottom: 22 },
    totalsBox: { width: '46%', backgroundColor: '#f9fafb', borderRadius: 10, padding: 12 },
    totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    totalsLabel: { fontSize: 8.5, color: '#6b7280' },
    totalsValue: { fontSize: 8.5, color: '#111827' },
    ttcRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: accent, borderRadius: 7, paddingVertical: 7, paddingHorizontal: 10, marginTop: 6 },
    ttcLabel: { fontSize: 9.5, fontFamily, fontWeight: 'bold', color: '#ffffff' },
    ttcValue: { fontSize: 11, fontFamily, fontWeight: 'bold', color: '#ffffff' },

    wordsBlock: { marginBottom: 22 },
    wordsLabel: { fontSize: 7.5, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
    wordsValue: { fontSize: 8.5, color: '#374151', lineHeight: 1.4, textTransform: 'uppercase' },

    signRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 30 },
    paymentBadge: { backgroundColor: accentSoft, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
    paymentText: { fontSize: 8, color: accent, fontFamily, fontWeight: 'bold' },
    signBox: { alignItems: 'center', width: 140 },
    signLine: { width: '100%', height: 0.75, backgroundColor: '#d1d5db', marginTop: 28, marginBottom: 4 },
    signLabel: { fontSize: 7.5, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 },
    stampImage: { maxHeight: 55, maxWidth: 120, objectFit: 'contain', position: 'absolute', top: -8 },

    footer: { position: 'absolute', left: 40, right: 40, bottom: 26, paddingTop: 10, borderTopWidth: 1.5, borderColor: accent },
    footerGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    footerCol: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, maxWidth: 300 },
    footerItem: { fontSize: 6.8, color: '#6b7280' },
    footerItemStrong: { fontFamily, fontWeight: 'bold', color: '#374151' },
    footerContact: { alignItems: 'flex-end' },
    footerContactText: { fontSize: 6.8, color: '#6b7280', marginBottom: 1 },
    sordiWatermark: { position: 'absolute', left: 40, right: 40, bottom: 6, textAlign: 'center', fontSize: 6, color: '#9ca3af' },
    qrImage: { width: 34, height: 34, marginTop: 4, borderRadius: 4 },
  });

  const legalItems: { label: string; value?: string }[] = [
    { label: 'RC', value: settings?.company_rc },
    { label: 'NIF', value: settings?.company_nif },
    { label: 'AI', value: settings?.company_ai },
    { label: 'NIS', value: settings?.company_nis },
    { label: 'Capital', value: settings?.company_capital },
  ].filter(l => l.value);

  return (
    <Document title={`${data.docTitle} ${data.docNumber}`} author={settings?.company_name || undefined}>
      <Page size="A4" style={styles.page}>

        <View style={styles.headerBand} fixed>
          <View>
            {settings?.logo_data ? (
              <View style={styles.logoChip}>
                <Image src={settings.logo_data} style={styles.logoImage} />
              </View>
            ) : settings?.company_name ? (
              <Text style={styles.companyNameWhite}>{settings.company_name}</Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>{data.docTitle}</Text>
            <Text style={styles.docNumber}>N° {data.docNumber} · {invoice.invoice_date || "-"}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.cardsRow}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Destinataire</Text>
              <Text style={styles.clientName}>{data.clientName}</Text>
              {data.clientAddress !== "" && <Text style={styles.plainLine}>{data.clientAddress}</Text>}
              {data.clientRc !== "" && <Text style={styles.plainLine}>RC {data.clientRc}</Text>}
              {data.clientNif !== "" && <Text style={styles.plainLine}>NIF {data.clientNif}</Text>}
              {data.clientAi !== "" && <Text style={styles.plainLine}>AI {data.clientAi}</Text>}
              {data.clientNis !== "" && <Text style={styles.plainLine}>NIS {data.clientNis}</Text>}
              {data.clientActivite !== "" && <Text style={styles.plainLine}>{data.clientActivite}</Text>}
              {data.clientContact !== "" && <Text style={styles.plainLine}>{data.clientContact}</Text>}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Détails du document</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaRowLabel}>Date</Text>
                <Text style={styles.metaRowValue}>{invoice.invoice_date || "-"}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaRowLabel}>Numéro</Text>
                <Text style={styles.metaRowValue}>{data.docNumber || "-"}</Text>
              </View>
              {flags.showPaymentMethod && !data.isProforma && !data.isCreditNote && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaRowLabel}>Paiement</Text>
                  <Text style={styles.metaRowValue}>{invoice.payment_method || "Chèque"}</Text>
                </View>
              )}
              {data.isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                <Text style={styles.avoirNotice}>
                  Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.tableWrap}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.colDesignation]}>Désignation</Text>
              <Text style={[styles.tableHeaderCell, styles.colPrice]}>P.U</Text>
              <Text style={[styles.tableHeaderCell, styles.colQty]}>Qté</Text>
              <Text style={[styles.tableHeaderCell, styles.colUnit]}>U/M</Text>
              <Text style={[styles.tableHeaderCell, styles.colAmount]}>Montant</Text>
            </View>

            {data.items.map((item, idx) => {
              const name = item.product_name || item.products?.name || "";
              const unit = item.products?.unit || item.unit || "TN";
              const quantityVal = Number(item.quantity || 0);
              const formattedQty = Number.isInteger(quantityVal) ? quantityVal.toString() : quantityVal.toFixed(2);
              const itemAmount = (item.quantity || 0) * (item.unit_price || 0);

              return (
                <View key={idx} style={idx % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}>
                  <Text style={[styles.itemName, styles.colDesignation]}>{name}</Text>
                  <Text style={[styles.cellText, styles.colPrice]}>{formatCurrency(item.unit_price)}</Text>
                  <Text style={[styles.cellText, styles.colQty]}>{formattedQty}</Text>
                  <Text style={[styles.cellText, styles.colUnit]}>{unit}</Text>
                  <Text style={[styles.cellText, styles.colAmount]}>{formatCurrency(itemAmount)}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.totalsContainer}>
            <View style={styles.totalsBox}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Total HT</Text>
                <Text style={styles.totalsValue}>{formatCurrency(invoice.subtotal_ht || 0)}</Text>
              </View>
              {flags.showTva && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total TVA</Text>
                  <Text style={styles.totalsValue}>{formatCurrency(invoice.tva_amount || 0)}</Text>
                </View>
              )}
              {flags.showTimbre && (invoice.timbre > 0 || (invoice.payment_method?.toLowerCase().includes("espèce") && invoice.timbre !== 0)) && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Droit de Timbre</Text>
                  <Text style={styles.totalsValue}>{formatCurrency(invoice.timbre || 0)}</Text>
                </View>
              )}
              {((invoice.discount || 0) > 0 || (invoice.discount_value || 0) > 0) && (
                <View style={styles.totalsRow}>
                  <Text style={[styles.totalsLabel, { color: '#b91c1c' }]}>Remise</Text>
                  <Text style={[styles.totalsValue, { color: '#b91c1c' }]}>-{formatCurrency(invoice.discount || invoice.discount_value)}</Text>
                </View>
              )}
              <View style={styles.ttcRow}>
                <Text style={styles.ttcLabel}>{flags.grandTotalLabel}</Text>
                <Text style={styles.ttcValue}>{formatCurrency(invoice.total_ttc || 0)}</Text>
              </View>
            </View>
          </View>

          {flags.showMontantEnLettres && (
            <View style={styles.wordsBlock}>
              <Text style={styles.wordsLabel}>Arrêté la présente facture à la somme de</Text>
              <Text style={styles.wordsValue}>{data.wordsFrench}</Text>
            </View>
          )}

          <View style={styles.signRow}>
            {flags.showPaymentMethod && !data.isProforma && !data.isCreditNote ? (
              <View style={styles.paymentBadge}>
                <Text style={styles.paymentText}>{invoice.payment_method || "Chèque"}</Text>
              </View>
            ) : <View />}
            <View style={styles.signBox}>
              {settings?.stamp_data && <Image src={settings.stamp_data} style={styles.stampImage} />}
              <View style={styles.signLine} />
              <Text style={styles.signLabel}>Cachet et signature</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <View style={styles.footerGrid}>
            <View>
              <View style={styles.footerCol}>
                {legalItems.map((l, i) => (
                  <Text key={i} style={styles.footerItem}>
                    <Text style={styles.footerItemStrong}>{l.label}</Text> {l.value}
                  </Text>
                ))}
              </View>
              {settings?.company_address && <Text style={[styles.footerItem, { marginTop: 4 }]}>{settings.company_address}</Text>}
              {settings?.company_rib && <Text style={[styles.footerItem, { marginTop: 2 }]}>RIB {settings.company_rib}</Text>}
            </View>

            <View style={styles.footerContact}>
              {settings?.company_email && <Text style={styles.footerContactText}>{settings.company_email}</Text>}
              {settings?.company_website && <Text style={styles.footerContactText}>{settings.company_website}</Text>}
              {phones.map((p, i) => (
                <Text key={i} style={styles.footerContactText}>{formatPhone(p)}</Text>
              ))}
              {settings?.qr_code_data && <Image src={settings.qr_code_data} style={styles.qrImage} />}
            </View>
          </View>
        </View>
        {settings?.license_active === false && (
          <Text style={styles.sordiWatermark} fixed>Created by Sordi v1.0.1 — www.sordi.app</Text>
        )}

      </Page>
    </Document>
  );
}
