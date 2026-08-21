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

interface InvoiceTemplateEpureProps {
  invoice: PDFInvoice;
  settings?: PDFSettings;
}

/**
 * "Épuré" theme — hairlines instead of boxes, no fill colors except a single
 * thin accent rule, generous whitespace. All legally-required Algerian
 * invoice fields are still present, just rendered with a lighter hand.
 */
export function InvoiceTemplateEpure({ invoice, settings }: InvoiceTemplateEpureProps) {
  const accent = settings?.primary_color || "#476CFF";
  const fontFamily = resolveInvoicePdfFontFamily(settings);
  const data = resolveInvoiceData(invoice);
  const flags = getDocumentSectionFlags(data);
  const phones = resolveCompanyPhones(settings);

  const styles = StyleSheet.create({
    page: {
      width: 595.28,
      height: 841.89,
      padding: 42,
      fontFamily,
      fontSize: 9,
      color: '#1a1a1a',
      backgroundColor: '#ffffff',
    },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
    logoImage: { height: 40, maxWidth: 160, objectFit: 'contain' },
    companyName: { fontSize: 12, fontFamily, fontWeight: 'bold', letterSpacing: 0.5, color: '#111111' },
    headerRight: { alignItems: 'flex-end' },
    docTitle: { fontSize: 18, fontFamily, fontWeight: 'bold', letterSpacing: 2, color: '#111111', textTransform: 'uppercase' },
    docNumber: { fontSize: 9, color: '#6b7280', marginTop: 3 },

    accentRule: { height: 1.5, backgroundColor: accent, marginBottom: 24 },

    metaGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
    metaBlock: { width: '46%' },
    metaLabel: { fontSize: 7.5, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
    clientName: { fontSize: 11, fontFamily, fontWeight: 'bold', color: '#111111', textTransform: 'uppercase', marginBottom: 2 },
    plainLine: { fontSize: 8.5, color: '#374151', marginBottom: 1.5, lineHeight: 1.3 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    metaRowLabel: { fontSize: 8.5, color: '#6b7280' },
    metaRowValue: { fontSize: 8.5, fontFamily, fontWeight: 'bold', color: '#111111' },
    avoirNotice: { fontSize: 7.5, color: '#6b7280', marginTop: 4, textAlign: 'right' },

    table: { marginBottom: 22 },
    tableHeaderRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#111111',
      paddingVertical: 6,
    },
    tableHeaderCell: { fontSize: 7.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.75, borderColor: '#e5e7eb', paddingVertical: 8, alignItems: 'center' },
    colDesignation: { width: '46%' },
    colPrice: { width: '15%', textAlign: 'right' },
    colQty: { width: '13%', textAlign: 'right' },
    colUnit: { width: '11%', textAlign: 'center' },
    colAmount: { width: '15%', textAlign: 'right' },
    itemName: { fontSize: 9, color: '#111111' },
    cellText: { fontSize: 9, color: '#111111' },

    totalsContainer: { alignItems: 'flex-end', marginBottom: 24 },
    totalsBox: { width: '46%' },
    totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    totalsLabel: { fontSize: 8.5, color: '#6b7280' },
    totalsValue: { fontSize: 8.5, color: '#111111' },
    ttcRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderColor: '#111111' },
    ttcLabel: { fontSize: 10, fontFamily, fontWeight: 'bold', color: '#111111' },
    ttcValue: { fontSize: 12, fontFamily, fontWeight: 'bold', color: accent },

    wordsBlock: { marginBottom: 26 },
    wordsLabel: { fontSize: 7.5, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
    wordsValue: { fontSize: 8.5, color: '#374151', lineHeight: 1.4, textTransform: 'uppercase' },

    signRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 },
    paymentText: { fontSize: 8.5, color: '#374151' },
    signBox: { alignItems: 'center', width: 140 },
    signLine: { width: '100%', height: 0.75, backgroundColor: '#d1d5db', marginTop: 30, marginBottom: 4 },
    signLabel: { fontSize: 7.5, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
    stampImage: { maxHeight: 55, maxWidth: 120, objectFit: 'contain', position: 'absolute', top: -10 },

    footer: { position: 'absolute', left: 42, right: 42, bottom: 32, paddingTop: 10, borderTopWidth: 0.75, borderColor: '#e5e7eb' },
    footerGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    footerCol: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    footerItem: { fontSize: 6.8, color: '#6b7280' },
    footerItemStrong: { fontFamily, fontWeight: 'bold', color: '#374151' },
    footerContact: { alignItems: 'flex-end' },
    footerContactText: { fontSize: 6.8, color: '#6b7280', marginBottom: 1 },
    sordiWatermark: { position: 'absolute', left: 42, right: 42, bottom: 8, textAlign: 'center', fontSize: 6, color: '#9ca3af' },
    qrImage: { width: 34, height: 34, marginTop: 4 },
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

        <View style={styles.header}>
          <View>
            {settings?.logo_data ? (
              <Image src={settings.logo_data} style={styles.logoImage} />
            ) : settings?.company_name ? (
              <Text style={styles.companyName}>{settings.company_name}</Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>{data.docTitle}</Text>
            <Text style={styles.docNumber}>N° {data.docNumber} · {invoice.invoice_date || "-"}</Text>
          </View>
        </View>
        <View style={styles.accentRule} />

        <View style={styles.metaGrid}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Destinataire</Text>
            <Text style={styles.clientName}>{data.clientName}</Text>
            {data.clientAddress !== "" && <Text style={styles.plainLine}>{data.clientAddress}</Text>}
            {data.clientRc !== "" && <Text style={styles.plainLine}>RC {data.clientRc}</Text>}
            {data.clientNif !== "" && <Text style={styles.plainLine}>NIF {data.clientNif}</Text>}
            {data.clientAi !== "" && <Text style={styles.plainLine}>AI {data.clientAi}</Text>}
            {data.clientNis !== "" && <Text style={styles.plainLine}>NIS {data.clientNis}</Text>}
            {data.clientActivite !== "" && <Text style={styles.plainLine}>{data.clientActivite}</Text>}
            {data.clientContact !== "" && <Text style={styles.plainLine}>{data.clientContact}</Text>}
          </View>

          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Détails</Text>
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

        <View style={styles.table}>
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
              <View key={idx} style={styles.tableRow}>
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
          <Text style={styles.paymentText} />
          <View style={styles.signBox}>
            {settings?.stamp_data && <Image src={settings.stamp_data} style={styles.stampImage} />}
            <View style={styles.signLine} />
            <Text style={styles.signLabel}>Cachet et signature</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <View style={styles.footerGrid}>
            <View style={{ maxWidth: 300 }}>
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
