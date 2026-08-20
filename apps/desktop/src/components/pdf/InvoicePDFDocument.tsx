import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import {
  PDFInvoice,
  PDFSettings,
  formatCurrency,
  resolveInvoiceData,
  resolveCompanyPhones,
  formatPhone,
} from './invoicePdfShared';

Font.register({
  family: 'Space Grotesk',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUXskPMVBSSJLq2I.ttf' },
    { src: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVnskPMVBSSJLq2I.ttf', fontWeight: 'bold' },
  ]
});

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
  const data = resolveInvoiceData(invoice);
  const phones = resolveCompanyPhones(settings);

  const styles = StyleSheet.create({
    page: {
      width: 595.28,
      height: 841.89,
      padding: 0,
      fontFamily: 'Helvetica',
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
      paddingLeft: 14.17,
      paddingBottom: 14.17,
      justifyContent: 'center',
    },
    logoImage: {
      height: '100%',
      width: '100%',
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
      fontFamily: 'Space Grotesk',
      fontWeight: 'bold',
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headerBottomLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 1.28,
      backgroundColor: primaryColor,
      zIndex: 1,
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
      paddingHorizontal: 11.34,
      paddingTop: 14.17,
      paddingBottom: 5.67,
    },
    titleContainer: {
      alignItems: 'center',
      marginBottom: 14,
    },
    titleText: {
      fontSize: 15,
      fontFamily: 'Helvetica-Bold',
      color: '#1f2937',
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },

    clientMetaGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    clientBox: { width: '55%' },
    clientHeaderLabel: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: '#6b7280',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    clientName: {
      fontSize: 12,
      fontFamily: 'Helvetica-Bold',
      color: '#000000',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    clientAddress: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: '#374151',
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    clientDetailRow: {
      fontSize: 9,
      color: '#374151',
      textTransform: 'uppercase',
      marginBottom: 1,
    },
    clientDetailBold: { fontFamily: 'Helvetica-Bold' },
    metaBox: { width: '35%', paddingTop: 2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    metaLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#000000', marginRight: 6 },
    metaValue: { fontSize: 9, color: '#000000' },
    avoirNotice: {
      marginTop: 4,
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: '#374151',
      textAlign: 'right',
    },

    tableContainer: {
      width: '100%',
      borderWidth: 1,
      borderColor: '#9ca3af',
      marginBottom: 16,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: primaryColor,
      borderBottomWidth: 1,
      borderBottomColor: '#9ca3af',
      alignItems: 'center',
    },
    tableHeaderCell: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 9.5,
      color: '#ffffff',
      textTransform: 'uppercase',
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderRightWidth: 1,
      borderRightColor: 'rgba(255,255,255,0.3)',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#9ca3af',
      alignItems: 'center',
      minHeight: 22,
    },
    colDesignation: { width: '45%' },
    colPrice: { width: '15%', textAlign: 'right' },
    colQty: { width: '15%', textAlign: 'right' },
    colUnit: { width: '10%', textAlign: 'center' },
    colAmount: { width: '15%', textAlign: 'right', borderRightWidth: 0 },
    tableCellText: {
      fontSize: 9,
      color: '#000000',
      paddingVertical: 5,
      paddingHorizontal: 6,
      borderRightWidth: 1,
      borderRightColor: '#9ca3af',
    },

    totalsRightContainer: { alignItems: 'flex-end', marginBottom: 14 },
    totalsBox: { width: '42%', borderWidth: 1, borderColor: '#000000' },
    totalsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#000000',
    },
    totalsLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#000000' },
    totalsValueText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'right' },
    ttcRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: '#f9fafb',
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    ttcLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#000000' },
    ttcValueText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'right' },

    bottomBlock: { marginBottom: 12 },
    wordsTitle: { fontSize: 8, fontFamily: 'Helvetica', color: '#1f2937', textTransform: 'uppercase', marginBottom: 2 },
    wordsValue: {
      fontSize: 8.5,
      fontFamily: 'Helvetica-Bold',
      color: '#000000',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      lineHeight: 1.3,
      marginBottom: 10,
    },
    signatureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    paymentMethodText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#000000' },
    signatureBox: { alignItems: 'center', marginRight: 20 },
    signatureTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#000000', textDecoration: 'underline', marginBottom: 4 },
    stampImage: { maxHeight: 65, maxWidth: 140, objectFit: 'contain', marginTop: 2 },

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
      left: 5.67,
      right: 5.67,
      top: 9.92,
      bottom: 5.67,
      flexDirection: 'row',
    },

    legalCol: { width: 187.08, paddingLeft: 11.9, justifyContent: 'flex-end', height: '100%' },
    legalColTextWrapper: { position: 'relative' },
    legalYellowBar: { position: 'absolute', left: -11.9, top: 1.5, bottom: 1.5, width: 2.13, backgroundColor: primaryColor },
    legalRow: { flexDirection: 'row', marginBottom: 2 },
    legalLabel: { width: 80, fontSize: 7.1, fontFamily: 'Space Grotesk', fontWeight: 'bold', color: '#000000' },
    legalColon: { width: 8, fontSize: 7.1, fontFamily: 'Space Grotesk', fontWeight: 'bold', textAlign: 'center' },
    legalValue: { fontSize: 7.1, fontFamily: 'Space Grotesk', color: '#000000' },

    companyInfoCol: { width: 195.59, paddingHorizontal: 4, justifyContent: 'flex-end', paddingBottom: 2.8, height: '100%' },
    addressText: { fontSize: 7.1, fontFamily: 'Space Grotesk', fontWeight: 'bold', color: '#000000', marginBottom: 4, lineHeight: 1.3 },
    ribText: { fontSize: 7.1, fontFamily: 'Space Grotesk', color: '#000000', lineHeight: 1.3 },

    contactCol: { flex: 1, flexDirection: 'row', position: 'relative', height: '100%' },
    contactLeftBox: { width: 56.7, justifyContent: 'flex-end', height: '100%', position: 'relative' },
    footerLogoBox: { position: 'absolute', top: 0, left: 0, height: 22.7, width: 121.9, justifyContent: 'center' },
    footerLogoText: { fontSize: 9, fontFamily: 'Space Grotesk', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase' },
    sordiWatermark: { position: 'absolute', bottom: 1, left: 0, right: 0, textAlign: 'center', fontSize: 5.5, color: '#9ca3af' },
    qrBox: { width: 51, height: 51, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
    contactRightBox: { marginLeft: 7.1, flex: 1, justifyContent: 'flex-end', height: '100%' },
    contactEmailText: { fontSize: 7.1, fontFamily: 'Space Grotesk', fontWeight: 'bold', color: '#000000', lineHeight: 1.65 },
    contactDetailText: { fontSize: 7.1, fontFamily: 'Space Grotesk', color: '#000000', lineHeight: 1.65 },
  });

  return (
    <Document title={`${data.docTitle} ${data.docNumber}`} author={settings?.company_name || undefined}>
      <Page size="A4" style={styles.page}>

        <View style={styles.header} fixed>
          {settings?.logo_data && (
            <View style={styles.headerLogoContainer}>
              <Image src={settings.logo_data} style={styles.logoImage} />
            </View>
          )}
          {settings?.company_name && (
            <View style={styles.companyNameBadge}>
              <Text style={styles.companyNameText}>{settings.company_name}</Text>
            </View>
          )}
          <View style={styles.headerBottomLine} />
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
                  <Text style={styles.metaLabel}>Date:</Text>
                  <Text style={styles.metaValue}>{invoice.invoice_date || "-"}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Numéro:</Text>
                  <Text style={[styles.metaValue, { fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }]}>
                    {data.docNumber || "-"}
                  </Text>
                </View>
                {data.isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                  <Text style={styles.avoirNotice}>
                    Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.tableContainer}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.colDesignation, { textAlign: 'center' }]}>Désignation</Text>
                <Text style={[styles.tableHeaderCell, styles.colPrice, { textAlign: 'right' }]}>P.U</Text>
                <Text style={[styles.tableHeaderCell, styles.colQty, { textAlign: 'right' }]}>Quantité</Text>
                <Text style={[styles.tableHeaderCell, styles.colUnit, { textAlign: 'center' }]}>U/M</Text>
                <Text style={[styles.tableHeaderCell, styles.colAmount, { textAlign: 'right' }]}>Montant</Text>
              </View>

              {data.items.map((item, idx) => {
                const name = item.product_name || item.products?.name || "";
                const unit = item.products?.unit || item.unit || "TN";
                const quantityVal = Number(item.quantity || 0);
                const formattedQty = Number.isInteger(quantityVal) ? quantityVal.toString() : quantityVal.toFixed(2);
                const itemAmount = (item.quantity || 0) * (item.unit_price || 0);

                return (
                  <View key={idx} style={styles.tableRow}>
                    <View style={[styles.tableCellText, styles.colDesignation]}>
                      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000' }}>{name}</Text>
                    </View>
                    <Text style={[styles.tableCellText, styles.colPrice]}>{formatCurrency(item.unit_price)}</Text>
                    <Text style={[styles.tableCellText, styles.colQty]}>{formattedQty}</Text>
                    <Text style={[styles.tableCellText, styles.colUnit, { fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }]}>{unit}</Text>
                    <Text style={[styles.tableCellText, styles.colAmount]}>{formatCurrency(itemAmount)}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.totalsRightContainer}>
              <View style={styles.totalsBox}>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total HT</Text>
                  <Text style={styles.totalsValueText}>{formatCurrency(invoice.subtotal_ht || 0)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total TVA</Text>
                  <Text style={styles.totalsValueText}>{formatCurrency(invoice.tva_amount || 0)}</Text>
                </View>
                {(invoice.timbre > 0 || (invoice.payment_method?.toLowerCase().includes("espèce") && invoice.timbre !== 0)) && (
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Droit de Timbre</Text>
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
                  <Text style={styles.ttcLabel}>{data.isCreditNote ? "Net à déduire" : "Total TTC"}</Text>
                  <Text style={styles.ttcValueText}>{formatCurrency(invoice.total_ttc || 0)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.bottomBlock}>
              <Text style={styles.wordsTitle}>ARRÊTÉ LA PRÉSENTE FACTURE À LA SOMME DE :</Text>
              <Text style={styles.wordsValue}>{data.wordsFrench}</Text>

              <View style={styles.signatureRow}>
                {!data.isProforma && !data.isCreditNote && (
                  <Text style={styles.paymentMethodText}>
                    Mode de paiement: <Text style={{ fontFamily: 'Helvetica', textTransform: 'uppercase' }}>{invoice.payment_method || "Chèque"}</Text>
                  </Text>
                )}
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureTitle}>Cachet et Signature</Text>
                  {settings?.stamp_data && <Image src={settings.stamp_data} style={styles.stampImage} />}
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
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
                  <Text style={{ fontFamily: 'Space Grotesk', fontWeight: 'bold' }}>RIB:</Text>{" "}
                  {settings.company_rib}
                  {settings?.company_bank_agency ? `\n${settings.company_bank_agency}` : ""}
                </Text>
              )}
            </View>

            <View style={styles.contactCol}>
              <View style={styles.contactLeftBox}>
                {(settings?.footer_logo_data || settings?.company_name) && (
                  <View style={styles.footerLogoBox}>
                    {settings?.footer_logo_data ? (
                      <Image src={settings.footer_logo_data} style={{ height: '100%', width: '100%', objectFit: 'contain', objectPosition: 'left' }} />
                    ) : (
                      <Text style={styles.footerLogoText}>{settings?.company_name}</Text>
                    )}
                  </View>
                )}
                {settings?.qr_code_data && (
                  <View style={styles.qrBox}>
                    <Image src={settings.qr_code_data} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </View>
                )}
              </View>

              <View style={[styles.contactRightBox, { paddingLeft: 8 }]}>
                {settings?.company_email && <Text style={styles.contactEmailText}>{settings.company_email}</Text>}
                {settings?.company_website && <Text style={styles.contactDetailText}>{settings.company_website}</Text>}
                {phones.map((p, i) => (
                  <Text key={i} style={styles.contactDetailText}>{formatPhone(p)}</Text>
                ))}
              </View>
            </View>
          </View>
          {settings?.license_active === false && (
            <Text style={styles.sordiWatermark}>Created by Sordi v1.0.0 — www.sordi.app</Text>
          )}
        </View>

      </Page>
    </Document>
  );
}
