import { Document, Page, Text, View, StyleSheet, Image, Svg, Line, Font } from '@react-pdf/renderer';
import { numberToWords } from '@/lib/numberToWords';

Font.register({
  family: 'Space Grotesk',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUXskPMVBSSJLq2I.ttf' },
    { src: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVnskPMVBSSJLq2I.ttf', fontWeight: 'bold' },
  ]
});

export interface PDFInvoiceItem {
  id?: string;
  product_code?: string;
  product_name?: string;
  product_description?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  amount?: number;
  products?: {
    name?: string;
    description?: string;
    unit?: string;
  };
}

export interface PDFClient {
  name?: string;
  address?: string;
  city?: string;
  wilaya?: string;
  phone?: string;
  email?: string;
  rc?: string;
  nif?: string;
  nis?: string;
  ai?: string;
  activite?: string;
  contact?: string;
}

export interface PDFInvoice {
  id?: string;
  invoice_number: string;
  invoice_date: string;
  month_period?: string;
  due_date?: string;
  subtotal_ht: number;
  tva_rate: number;
  tva_amount: number;
  timbre: number;
  total_ttc: number;
  amount_paid?: number;
  balance_due?: number;
  status?: string;
  invoice_items: PDFInvoiceItem[];
  invoice_type?: string;
  original_invoice_id?: string;
  original_invoice?: {
    invoice_number?: string;
  };
  notes?: string;
  header_note?: string;
  custom_title?: string;
  delivery_number?: string;
  order_number?: string;
  clients?: PDFClient;
  client_name?: string;
  client_address?: string;
  client_rc?: string;
  client_nif?: string;
  client_nis?: string;
  client_ai?: string;
  client_activite?: string;
  use_secondary_register?: boolean;
  selected_secondary_rc?: string;
  selected_secondary_address?: string;
  discount?: number;
  discount_type?: 'percent' | 'fixed';
  discount_value?: number;
  driver_name?: string;
  driver_cni?: string;
  vehicle_number?: string;
  delivery_location?: string;
  payment_method?: string;
}

export interface PDFSettings {
  company_name?: string;
  company_address?: string;
  company_activity?: string;
  company_phone?: string;
  company_phones?: string | string[];
  company_email?: string;
  company_website?: string;
  company_nif?: string;
  company_nis?: string;
  company_rc?: string;
  company_ai?: string;
  company_capital?: string;
  company_rib?: string;
  company_bank_agency?: string;
  logo_data?: string;
  footer_logo_data?: string;
  qr_code_data?: string;
  stamp_data?: string;
  stamp_size?: number;
  primary_color?: string;
  body_pattern_data?: string;
}

interface InvoicePDFDocumentProps {
  invoice: PDFInvoice;
  settings?: PDFSettings;
}

// Format currency exactly as in InvoicePreview: 839 200,00 DZD
const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return "0.00 DZD";
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toFixed(2).replace(/\./g, ',');
  const parts = formatted.split(',');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decimalPart = parts[1] || '00';
  const sign = amount < 0 ? "-" : "";
  return `${sign}${integerPart}.${decimalPart} DZD`;
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export function InvoicePDFDocument({ invoice, settings }: InvoicePDFDocumentProps) {
  const primaryColor = settings?.primary_color || "#FFCC00";

  const isCreditNote = invoice.invoice_type === 'credit_note';
  const isProforma = invoice.invoice_type === 'proforma';
  const isDelivery = invoice.invoice_type === 'delivery_note' || !!invoice.delivery_number;
  const isOrder = invoice.invoice_type === 'order' || !!invoice.order_number;

  const getDocTitle = (): string => {
    if (invoice.custom_title) return invoice.custom_title;
    if (isCreditNote) return "FACTURE D'AVOIR";
    if (isProforma) return "FACTURE PROFORMA";
    if (isDelivery) return "BON DE LIVRAISON";
    if (isOrder) return "BON DE COMMANDE";
    return "FACTURE";
  };

  const getDocNumber = (): string => {
    if (isDelivery) return invoice.delivery_number || invoice.invoice_number;
    if (isOrder) return invoice.order_number || invoice.invoice_number;
    return invoice.invoice_number;
  };

  const clientName = invoice.clients?.name || invoice.client_name || "";
  const clientAddress = invoice.use_secondary_register && invoice.selected_secondary_address
    ? invoice.selected_secondary_address
    : (invoice.clients?.address || invoice.client_address || "");
  const clientRc = invoice.use_secondary_register && invoice.selected_secondary_rc
    ? invoice.selected_secondary_rc
    : (invoice.clients?.rc || invoice.client_rc || "");
  const clientNif = invoice.clients?.nif || invoice.client_nif || "";
  const clientNis = invoice.clients?.nis || invoice.client_nis || "";
  const clientAi = invoice.clients?.ai || invoice.client_ai || "";
  const clientActivite = invoice.clients?.activite || invoice.client_activite || "";
  const clientContact = invoice.clients?.contact || "";

  const items = invoice.invoice_items || [];
  const wordsFrench = numberToWords(invoice.total_ttc || 0);

  const getCompanyPhones = (): string[] => {
    if (!settings?.company_phones && !settings?.company_phone) return [];
    if (settings?.company_phones) {
      if (Array.isArray(settings.company_phones)) return settings.company_phones;
      try {
        const parsed = JSON.parse(settings.company_phones);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return settings.company_phones.split(/[\n,;]/).map(p => p.trim()).filter(Boolean);
      }
    }
    if (settings?.company_phone) {
      return settings.company_phone.split(/[\n,;]/).map(p => p.trim()).filter(Boolean);
    }
    return [];
  };

  const phones = getCompanyPhones();

  const styles = StyleSheet.create({
    page: {
      width: 595.28, // 210mm
      height: 841.89, // 297mm
      padding: 0,
      fontFamily: 'Helvetica',
      fontSize: 9,
      color: '#000000',
      backgroundColor: '#ffffff',
    },
    backgroundContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
    patternSvgContainer: {
      position: 'absolute',
      bottom: -5,
      right: -22,
      width: 260.7, // 92mm
      height: 453.5, // 160mm
      opacity: 0.2,
    },

    /* ================= HEADER (Exact 33.9mm = 96.1 pt) ================= */
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
      height: 72.85, // 25.7mm
      paddingTop: 14.17, // 5mm
      paddingLeft: 14.17, // 5mm
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
      width: 202.68, // 71.5mm
      height: 22.1, // 7.8mm
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
      color: '#000000',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headerBottomLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 1.28, // 0.45mm
      backgroundColor: primaryColor,
      zIndex: 1,
    },

    /* ================= MAIN BODY (Exact 229.8mm = 651.4 pt) ================= */
    main: {
      position: 'absolute',
      left: 0,
      top: 96.1, // 33.9mm
      width: '100%',
      height: 651.4, // 229.8mm
      backgroundColor: '#ffffff',
    },
    mainContent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 11.34, // 4mm
      paddingTop: 14.17, // 5mm
      paddingBottom: 5.67, // 2mm
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

    /* Client Info & Meta Details Grid */
    clientMetaGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    clientBox: {
      width: '55%',
    },
    clientHeaderLabel: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: '#6b7280',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    clientName: {
      fontSize: 12, // increased from 10.5
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
    clientDetailBold: {
      fontFamily: 'Helvetica-Bold',
    },
    metaBox: {
      width: '35%',
      paddingTop: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    metaLabel: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 9,
      color: '#000000',
      marginRight: 6,
    },
    metaValue: {
      fontSize: 9,
      color: '#000000',
    },
    avoirNotice: {
      marginTop: 4,
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: '#374151',
      textAlign: 'right',
    },

    /* 5-Column Table (100% Solid Black Grid matching InvoicePreview) */
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
      borderBottomStyle: 'solid',
      alignItems: 'center',
    },
    tableHeaderCell: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 9.5, // increased from 8.5
      color: '#000000',
      textTransform: 'uppercase',
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderRightWidth: 1,
      borderRightColor: '#9ca3af',
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
      fontSize: 9, // increased from 8
      color: '#000000',
      paddingVertical: 5,
      paddingHorizontal: 6,
      borderRightWidth: 1,
      borderRightColor: '#9ca3af',
    },
    productDescText: {
      fontSize: 7,
      color: '#4b5563',
      fontFamily: 'Helvetica',
      marginTop: 1,
      textTransform: 'none',
    },

    /* Totals & Words Container */
    totalsRightContainer: {
      alignItems: 'flex-end',
      marginBottom: 14,
    },
    totalsBox: {
      width: '42%',
      borderWidth: 1,
      borderColor: '#000000',
    },
    totalsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#000000',
    },
    totalsLabel: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: '#000000',
    },
    totalsValueText: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: '#000000',
      textAlign: 'right',
    },
    ttcRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: '#f9fafb',
      paddingVertical: 4,
      paddingHorizontal: 6,
    },

    /* Words & Signatures Block */
    bottomBlock: {
      marginBottom: 12,
    },
    wordsTitle: {
      fontSize: 8,
      fontFamily: 'Helvetica',
      color: '#1f2937',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    wordsValue: {
      fontSize: 8.5,
      fontFamily: 'Helvetica-Bold',
      color: '#000000',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      lineHeight: 1.3,
      marginBottom: 10,
    },
    signatureRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    paymentMethodText: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: '#000000',
    },
    signatureBox: {
      alignItems: 'center',
      marginRight: 20,
    },
    signatureTitle: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: '#000000',
      textDecoration: 'underline',
      marginBottom: 4,
    },
    stampImage: {
      maxHeight: 65,
      maxWidth: 140,
      objectFit: 'contain',
      marginTop: 2,
    },

    /* ================= FOOTER (Exact 33.3mm = 94.4 pt) ================= */
    footer: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      width: '100%',
      height: 94.4, // 33.3mm
      backgroundColor: '#ffffff',
      borderTopWidth: 0.85, // 0.3mm
      borderTopColor: '#222222',
    },
    footerInner: {
      position: 'absolute',
      left: 5.67, // 2mm
      right: 5.67, // 2mm
      top: 9.92, // 3.5mm
      bottom: 5.67, // 2mm
      flexDirection: 'row',
    },

    /* Col 1: Legal Information (66mm = 187.08 pt) */
    legalCol: {
      width: 187.08,
      paddingLeft: 11.9, // 4.2mm
      justifyContent: 'flex-end',
      height: '100%',
    },
    legalColTextWrapper: {
      position: 'relative',
    },
    legalYellowBar: {
      position: 'absolute',
      left: -11.9,
      top: 1.5,
      bottom: 1.5,
      width: 2.13, // 0.75mm
      backgroundColor: primaryColor,
    },
    legalRow: {
      flexDirection: 'row',
      marginBottom: 2,
    },
    legalLabel: {
      width: 80,
      fontSize: 7.1,
      fontFamily: 'Space Grotesk',
      fontWeight: 'bold',
      color: '#000000',
    },
    legalColon: {
      width: 8,
      fontSize: 7.1,
      fontFamily: 'Space Grotesk',
      fontWeight: 'bold',
      textAlign: 'center',
    },
    legalValue: {
      fontSize: 7.1,
      fontFamily: 'Space Grotesk',
      color: '#000000',
    },

    /* Col 2: Company Info / Bank (69mm = 195.59 pt) */
    companyInfoCol: {
      width: 195.59,
      paddingHorizontal: 4,
      justifyContent: 'flex-end',
      paddingBottom: 2.8,
      height: '100%',
    },
    addressText: {
      fontSize: 7.1,
      fontFamily: 'Space Grotesk',
      fontWeight: 'bold',
      color: '#000000',
      marginBottom: 4,
      lineHeight: 1.3,
    },
    ribText: {
      fontSize: 7.1,
      fontFamily: 'Space Grotesk',
      color: '#000000',
      lineHeight: 1.3,
    },

    /* Col 3: Brand / QR / Contact Column (1fr) */
    contactCol: {
      flex: 1,
      flexDirection: 'row',
      position: 'relative',
      height: '100%',
    },
    contactLeftBox: {
      width: 56.7, // 20mm
      justifyContent: 'flex-end',
      height: '100%',
      position: 'relative',
    },
    footerLogoBox: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: 22.7, // 8mm
      width: 121.9, // 43mm
      justifyContent: 'center',
    },
    footerLogoText: {
      fontSize: 10,
      fontFamily: 'Space Grotesk',
      fontWeight: 'bold',
      color: '#b91c1c', // text-red-700
      textTransform: 'uppercase',
      letterSpacing: -0.5,
    },
    footerLogoSubtext: {
      fontSize: 8,
      fontFamily: 'Space Grotesk',
      color: '#374151',
    },
    qrBox: {
      width: 51, // 18mm
      height: 51, // 18mm
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 13,
    },
    qrText: {
      fontSize: 7,
      fontFamily: 'Space Grotesk',
      fontWeight: 'bold',
      color: '#6b7280',
    },
    contactRightBox: {
      marginLeft: 7.1, // 2.5mm
      flex: 1,
      justifyContent: 'flex-end',
      height: '100%',
    },
    contactEmailText: {
      fontSize: 7.1,
      fontFamily: 'Space Grotesk',
      fontWeight: 'bold',
      color: '#000000',
      lineHeight: 1.65,
    },
    contactDetailText: {
      fontSize: 7.1,
      fontFamily: 'Space Grotesk',
      color: '#000000',
      lineHeight: 1.65,
    },
  });

  return (
    <Document title={`${getDocTitle()} ${getDocNumber()}`} author={settings?.company_name || "SARL MOBINO ADJAL CONCASSAGE"}>
      <Page size="A4" style={styles.page}>
        
        {/* =======================================================
             HEADER (33.9mm)
        ======================================================== */}
        <View style={styles.header} fixed>
          <View style={styles.headerLogoContainer}>
            <Image
              src={settings?.logo_data || "https://i.ibb.co/ymXXbRW8/Layer-1.png"}
              style={styles.logoImage}
            />
          </View>

          <View style={styles.companyNameBadge}>
            <Text style={styles.companyNameText}>
              {settings?.company_name || "SARL MOBINO ADJAL CONCASSAGE"}
            </Text>
          </View>

          <View style={styles.headerBottomLine} />
      </View>

      {/* =======================================================
           MAIN BODY (229.8mm)
      ======================================================== */}
      <View style={styles.main}>
        {/* Background Pattern (rendered first inside main, so it stays in background) */}
        <View style={styles.backgroundContainer} fixed>
          {settings?.body_pattern_data ? (
            <Image src={settings.body_pattern_data} style={styles.patternImage} />
          ) : (
            <View style={styles.patternSvgContainer}>
              {/* Fallback diagonal lines mimicking repeating-linear-gradient(45deg, ...) */}
              <Svg viewBox="0 0 260 450" width="100%" height="100%">
                {[...Array(30)].map((_, i) => (
                  <Line
                    key={i}
                    x1={-100 + i * 36.85}
                    y1={0}
                    x2={-100 + i * 36.85 + 450}
                    y2={450}
                    stroke={primaryColor}
                    strokeWidth="1"
                  />
                ))}
              </Svg>
            </View>
          )}
        </View>

        {/* Foreground Content */}
        <View style={styles.mainContent}>

          {/* DOCUMENT TITLE */}
          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>{getDocTitle()}</Text>
          </View>

          {/* CLIENT & META DETAILS GRID */}
          <View style={styles.clientMetaGrid}>
            {/* Destinataire (Client Block) */}
            <View style={styles.clientBox}>
              <Text style={styles.clientHeaderLabel}>DESTINATAIRE</Text>
              <Text style={styles.clientName}>{clientName}</Text>
              {clientAddress !== "" && <Text style={styles.clientAddress}>{clientAddress}</Text>}
              
              {clientRc !== "" && (
                <Text style={styles.clientDetailRow}>
                  <Text style={styles.clientDetailBold}>RC:</Text> {clientRc}
                </Text>
              )}
              {clientNif !== "" && (
                <Text style={styles.clientDetailRow}>
                  <Text style={styles.clientDetailBold}>NIF:</Text> {clientNif}
                </Text>
              )}
              {clientAi !== "" && (
                <Text style={styles.clientDetailRow}>
                  <Text style={styles.clientDetailBold}>AI:</Text> {clientAi}
                </Text>
              )}
              {clientNis !== "" && (
                <Text style={styles.clientDetailRow}>
                  <Text style={styles.clientDetailBold}>NIS:</Text> {clientNis}
                </Text>
              )}
              {clientActivite !== "" && (
                <Text style={styles.clientDetailRow}>
                  <Text style={styles.clientDetailBold}>Activité:</Text> {clientActivite}
                </Text>
              )}
              {clientContact !== "" && (
                <Text style={styles.clientDetailRow}>
                  <Text style={styles.clientDetailBold}>Contact:</Text> {clientContact}
                </Text>
              )}
            </View>

            {/* Document Meta */}
            <View style={styles.metaBox}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date:</Text>
                <Text style={styles.metaValue}>{invoice.invoice_date || "-"}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Numéro:</Text>
                <Text style={[styles.metaValue, { fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }]}>
                  {getDocNumber() || "-"}
                </Text>
              </View>

              {isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                <Text style={styles.avoirNotice}>
                  Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                </Text>
              )}
            </View>
          </View>

          {/* 5-COLUMN TABLE (100% IDENTICAL TO INVOICEPREVIEW GRID) */}
          <View style={styles.tableContainer}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.colDesignation, { textAlign: 'center' }]}>Désignation</Text>
              <Text style={[styles.tableHeaderCell, styles.colPrice, { textAlign: 'right' }]}>P.U</Text>
              <Text style={[styles.tableHeaderCell, styles.colQty, { textAlign: 'right' }]}>Quantité</Text>
              <Text style={[styles.tableHeaderCell, styles.colUnit, { textAlign: 'center' }]}>U/M</Text>
              <Text style={[styles.tableHeaderCell, styles.colAmount, { textAlign: 'right' }]}>Montant</Text>
            </View>

            {items.map((item, idx) => {
              const name = item.product_name || item.products?.name || "";
              const desc = item.product_description || item.products?.description || "";
              const unit = item.products?.unit || item.unit || "TN";
              const quantityVal = Number(item.quantity || 0);
              const formattedQty = Number.isInteger(quantityVal)
                ? quantityVal.toString()
                : quantityVal.toFixed(2);
              const itemAmount = (item.quantity || 0) * (item.unit_price || 0);

              return (
                <View key={idx} style={[styles.tableRow, { borderBottomColor: '#9ca3af' }]}>
                  <View style={[styles.tableCellText, styles.colDesignation, { paddingHorizontal: 6, borderRightWidth: 1, borderRightColor: '#9ca3af' }]}>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000' }}>
                      {name}
                    </Text>
                  </View>

                  <Text style={[styles.tableCellText, styles.colPrice]}>{formatCurrency(item.unit_price)}</Text>
                  <Text style={[styles.tableCellText, styles.colQty]}>{formattedQty}</Text>
                  <Text style={[styles.tableCellText, styles.colUnit, { fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }]}>{unit}</Text>
                  <Text style={[styles.tableCellText, styles.colAmount]}>{formatCurrency(itemAmount)}</Text>
                </View>
              );
            })}
          </View>

          {/* TOTALS BLOCK (RIGHT ALIGNED) */}
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
                  <Text style={[styles.totalsValueText, { color: '#b91c1c' }]}>
                    -{formatCurrency(invoice.discount || invoice.discount_value)}
                  </Text>
                </View>
              )}

              <View style={styles.ttcRow}>
                <Text style={styles.ttcLabel}>{isCreditNote ? "Net à déduire" : "Total TTC"}</Text>
                <Text style={styles.ttcValueText}>{formatCurrency(invoice.total_ttc || 0)}</Text>
              </View>
            </View>
          </View>

          {/* FRENCH WORDS & SIGNATURES BLOCK */}
          <View style={styles.bottomBlock}>
            <Text style={styles.wordsTitle}>ARRÊTÉ LA PRÉSENTE FACTURE À LA SOMME DE :</Text>
            <Text style={styles.wordsValue}>{wordsFrench}</Text>

            <View style={styles.signatureRow}>
              {!isProforma && !isCreditNote && (
                <Text style={styles.paymentMethodText}>
                  Mode de paiement: <Text style={{ fontFamily: 'Helvetica', textTransform: 'uppercase' }}>{invoice.payment_method || "Chèque"}</Text>
                </Text>
              )}

              <View style={styles.signatureBox}>
                <Text style={styles.signatureTitle}>Cachet et Signature</Text>
                {settings?.stamp_data && (
                  <Image src={settings.stamp_data} style={styles.stampImage} />
                )}
              </View>
            </View>
          </View>

        </View>
      </View>

        {/* =======================================================
             FOOTER (Exact 33.3mm = 94.4 pt)
        ======================================================== */}
        <View style={styles.footer} fixed>
          <View style={styles.footerInner}>

            {/* Col 1: Legal Information */}
            <View style={styles.legalCol}>
              <View style={styles.legalColTextWrapper}>
                <View style={styles.legalYellowBar} />
  
                <View style={styles.legalRow}>
                  <Text style={styles.legalLabel}>N° Reg. Commerce</Text>
                  <Text style={styles.legalColon}>:</Text>
                  <Text style={styles.legalValue}>{settings?.company_rc || "04 B 0085776"}</Text>
                </View>
  
                <View style={styles.legalRow}>
                  <Text style={styles.legalLabel}>NIF</Text>
                  <Text style={styles.legalColon}>:</Text>
                  <Text style={styles.legalValue}>{settings?.company_nif || "000419008577618"}</Text>
                </View>
  
                <View style={styles.legalRow}>
                  <Text style={styles.legalLabel}>Articl. Imposition</Text>
                  <Text style={styles.legalColon}>:</Text>
                  <Text style={styles.legalValue}>{settings?.company_ai || "19060412832"}</Text>
                </View>
  
                <View style={styles.legalRow}>
                  <Text style={styles.legalLabel}>NIS</Text>
                  <Text style={styles.legalColon}>:</Text>
                  <Text style={styles.legalValue}>{settings?.company_nis || "000419060730849"}</Text>
                </View>
  
                <View style={styles.legalRow}>
                  <Text style={styles.legalLabel}>Capital Social</Text>
                  <Text style={styles.legalColon}>:</Text>
                  <Text style={styles.legalValue}>{settings?.company_capital || "50 000 000DA"}</Text>
                </View>
              </View>
            </View>

            {/* Col 2: Company Info / Bank */}
            <View style={styles.companyInfoCol}>
              <Text style={styles.addressText}>
                Adresse: {settings?.company_address || "Bp N°61, Kef Erand, Ain-Roua, 19310 Sétif - Algérie"}
              </Text>
              <Text style={styles.ribText}>
                <Text style={{ fontFamily: 'Space Grotesk', fontWeight: 'bold' }}>RIB:</Text>{" "}
                {settings?.company_rib || "004.00364.400.000.4811.36 CPA SETIF"}{"\n"}
                {settings?.company_bank_agency || "Agence 364 CPA BD CHELIHI KOUIDER, 19000 SETIF ALGERIE"}
              </Text>
            </View>

            {/* Col 3: Brand / QR / Contact Column */}
            <View style={styles.contactCol}>
              <View style={styles.contactLeftBox}>
                {/* Footer Logo */}
                <View style={styles.footerLogoBox}>
                  {settings?.footer_logo_data ? (
                    <Image src={settings.footer_logo_data} style={{ height: '100%', width: '100%', objectFit: 'contain', objectPosition: 'left' }} />
                  ) : (
                    <Text style={styles.footerLogoText}>
                      MOBINO <Text style={styles.footerLogoSubtext}>GROUP</Text>
                    </Text>
                  )}
                </View>

                {/* QR Code Placeholder / Image */}
                <View style={styles.qrBox}>
                  {settings?.qr_code_data ? (
                    <Image src={settings.qr_code_data} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <Text style={styles.qrText}>QR</Text>
                  )}
                </View>
              </View>

              {/* Contact Information */}
              <View style={[styles.contactRightBox, { paddingLeft: 8 }]}>
                <Text style={styles.contactEmailText}>{settings?.company_email || "contact@mobinodajal.com"}</Text>
                <Text style={styles.contactDetailText}>{settings?.company_website || "www.mobinodajal.com"}</Text>
                {phones.length > 0 ? (
                  phones.map((p, i) => (
                    <Text key={i} style={styles.contactDetailText}>
                      {p.startsWith("(+") ? p : `(+213) ${p.replace(/^0/, '')}`}
                    </Text>
                  ))
                ) : (
                  <>
                    <Text style={styles.contactDetailText}>(+213) 669 951 620</Text>
                    <Text style={styles.contactDetailText}>(+213) 770 311 560</Text>
                  </>
                )}
              </View>
            </View>

          </View>
        </View>

      </Page>
    </Document>
  );
}
