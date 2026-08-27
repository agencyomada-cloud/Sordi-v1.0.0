import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { formatCurrency, resolveInvoicePdfFontFamily, type PDFSettings } from './invoicePdfShared';

// Same four selectable fonts as the invoice templates — the delivery note
// follows whatever font the user already picked for invoices.
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

export interface DeliveryNotePDFItem {
  product_code?: string | null;
  product_name?: string | null;
  product_description?: string | null;
  quantity: number;
  unit_price?: number | null;
  /** Percent, e.g. 19. Defaults to 19 when unset — same convention as the
   *  invoice module (EditableInvoiceStructure/useEditableInvoiceLogic). */
  tva_rate?: number | null;
}

export interface DeliveryNotePDFClient {
  name: string;
  address?: string | null;
  city?: string | null;
  wilaya?: string | null;
  phone?: string | null;
  email?: string | null;
  nif?: string | null;
  rc?: string | null;
  contact_person?: string | null;
}

export interface DeliveryNotePDFData {
  delivery_number: string;
  delivery_date: string;
  truck_plate?: string | null;
  driver_name?: string | null;
  deliverer_name?: string | null;
  transporter_name?: string | null;
  delivery_location?: string | null;
  reserves?: string | null;
  supplier_delivered_date?: string | null;
  client_received_date?: string | null;
  /** Name of the person who received the goods on the client's side —
   *  stored in the delivery_notes.client_signature column (a plain text
   *  field despite the name; there's no dedicated "receiver name" column). */
  receiver_name?: string | null;
  client: DeliveryNotePDFClient;
  items: DeliveryNotePDFItem[];
}

export interface DeliveryNotePDFProps {
  data: DeliveryNotePDFData;
  appVersion?: string;
  settings?: PDFSettings;
}

const formatDate = (d: string | null | undefined): string => {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-FR');
};

export function DeliveryNotePDFDocument({ data, appVersion, settings }: DeliveryNotePDFProps) {
  const primaryColor = settings?.primary_color || '#476CFF';
  const fontFamily = resolveInvoicePdfFontFamily(settings);

  const getCompanyPhones = (): string[] => {
    if (!settings?.company_phones && !settings?.company_phone) return [];
    if (settings?.company_phones) {
      if (Array.isArray(settings.company_phones)) return settings.company_phones;
      try {
        const parsed = JSON.parse(settings.company_phones);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return settings.company_phones.split(/[\n,;]/).map((p) => p.trim()).filter(Boolean);
      }
    }
    if (settings?.company_phone) return settings.company_phone.split(/[\n,;]/).map((p) => p.trim()).filter(Boolean);
    return [];
  };

  const hasTransportInfo = !!(data.truck_plate || data.driver_name || data.transporter_name || data.delivery_location);

  // Same calculation convention as the invoice module: tva_rate undefined
  // defaults to 19%, so a delivery line entered without an explicit rate
  // still totals the same way an invoice line would.
  const totalHT = data.items.reduce((sum, i) => sum + i.quantity * (i.unit_price || 0), 0);
  const totalTVA = data.items.reduce((sum, i) => {
    const amount = i.quantity * (i.unit_price || 0);
    const rate = i.tva_rate === undefined || i.tva_rate === null ? 19 : i.tva_rate;
    return sum + (rate > 0 ? amount * (rate / 100) : 0);
  }, 0);
  const totalTTC = totalHT + totalTVA;

  const expeditionDate = formatDate(data.supplier_delivered_date);
  const receptionDate = formatDate(data.client_received_date);

  const styles = StyleSheet.create({
    // Extra top padding (vs. the 32pt on every other edge) — the logo and
    // header text were sitting flush against the page edge and getting
    // visually cropped there.
    page: { flexDirection: 'column', paddingTop: 60, paddingHorizontal: 32, paddingBottom: 32, fontFamily, fontSize: 8.5, color: '#000000', backgroundColor: '#ffffff' },

    header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1.5, borderBottomColor: primaryColor, paddingBottom: 10, marginBottom: 14 },
    headerLeft: { flex: 1, paddingRight: 12 },
    headerRight: { width: 190 },
    logo: { height: 40, maxWidth: 150, objectFit: 'contain', marginBottom: 6 },
    companyName: { fontFamily, fontWeight: 'bold', fontSize: 12, marginBottom: 3 },
    companyLine: { fontSize: 7.5, color: '#374151', marginBottom: 1.5, lineHeight: 1.3 },

    titleBox: { borderWidth: 1, borderColor: '#9ca3af', borderRadius: 3, padding: 8 },
    docTitle: { fontFamily, fontWeight: 'bold', fontSize: 13, color: primaryColor, letterSpacing: 1, marginBottom: 6, textAlign: 'center' },
    titleFieldRow: { flexDirection: 'row', marginBottom: 3 },
    titleFieldLabel: { fontSize: 7.5, fontFamily, fontWeight: 'bold', width: 60 },
    titleFieldValue: { fontSize: 7.5, flex: 1 },

    clientBlock: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 3, padding: 8, marginBottom: 10 },
    clientBlockLabel: { fontSize: 7, fontFamily, fontWeight: 'bold', color: '#6b7280', letterSpacing: 0.5, marginBottom: 4 },
    clientName: { fontSize: 10.5, fontFamily, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 3 },
    clientLine: { fontSize: 8, color: '#1f2937', marginBottom: 2 },

    transportStrip: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 3, padding: 6, marginBottom: 10 },
    transportItem: { flexDirection: 'row', marginRight: 16, marginBottom: 2 },
    transportLabel: { fontSize: 7, fontFamily, fontWeight: 'bold', marginRight: 3, color: '#374151' },
    transportValue: { fontSize: 7, color: '#374151' },

    // Matches InvoicePDFDocument's table palette exactly: #9ca3af borders,
    // uppercase white header text on the accent color, same padding rhythm.
    table: { width: '100%', borderWidth: 1, borderColor: '#9ca3af' },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: primaryColor, borderBottomWidth: 1, borderBottomColor: '#9ca3af', alignItems: 'center' },
    tableHeaderCell: { fontFamily, fontWeight: 'bold', fontSize: 7, color: '#ffffff', textTransform: 'uppercase', paddingVertical: 6, paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.3)' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#9ca3af', alignItems: 'center', minHeight: 20 },
    tableCell: { fontSize: 7.5, paddingVertical: 5, paddingHorizontal: 4 },
    colNum: { width: '6%' },
    colRef: { width: '12%' },
    colDesignation: { width: '42%' },
    colQte: { width: '10%', textAlign: 'right' },
    colPU: { width: '14%', textAlign: 'right' },
    colTotal: { width: '16%', textAlign: 'right', borderRightWidth: 0 },

    totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
    totalsBox: { width: '42%', borderWidth: 1, borderColor: '#9ca3af' },
    totalsRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 5, borderBottomWidth: 1, borderBottomColor: '#9ca3af' },
    totalsRowFinal: { flexDirection: 'row', justifyContent: 'space-between', padding: 5, backgroundColor: '#f1f5f9' },
    totalsLabel: { fontSize: 8, fontFamily, fontWeight: 'bold' },
    totalsValue: { fontSize: 8, fontFamily, fontWeight: 'bold' },

    reservesBox: { marginTop: 10, padding: 6, borderWidth: 1, borderColor: '#dc2626', borderRadius: 3, backgroundColor: '#fef2f2' },
    reservesLabel: { fontSize: 7, fontFamily, fontWeight: 'bold', color: '#dc2626', marginBottom: 2 },
    reservesText: { fontSize: 7.5, color: '#7f1d1d' },

    // Pushed to the page bottom by the flexGrow spacer above it, regardless
    // of how few table rows there are.
    signatureRow: { flexDirection: 'row', gap: 12 },
    signatureBox: { flex: 1, borderWidth: 1, borderColor: '#9ca3af', borderRadius: 3, padding: 12 },
    signatureTitle: { fontSize: 8, fontFamily, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    sigField: { marginBottom: 12 },
    sigFieldLabel: { fontSize: 7, color: '#6b7280', marginBottom: 3 },
    // "Modern" blank field — a subtle solid bottom border to sign/write
    // against, not a row of underscore characters.
    sigFieldLine: { borderBottomWidth: 0.75, borderBottomColor: '#d1d5db', minHeight: 14 },
    sigFieldValue: { fontSize: 8, color: '#111827' },
    // Generous area for the uploaded company stamp (cachet) + signature —
    // deliberately much taller than sigFieldLine. Bounded to this fixed
    // physical slot on the printed note (unlike the invoice/order Cachet et
    // Signature block, which sizes itself to content) — each image still
    // renders at its real configured height and only clips if it wouldn't
    // otherwise fit. Signature always stacks above the stamp so an opaque
    // stamp background can never cover it.
    sigStampArea: { borderBottomWidth: 0.75, borderBottomColor: '#d1d5db', minHeight: 56, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4 },
    sigStampSignatureImage: { maxWidth: 100, maxHeight: 34, objectFit: 'contain' },
    sigStampStampImage: { maxWidth: 90, maxHeight: 24, objectFit: 'contain', opacity: 0.9 },

    disclaimer: { marginTop: 12, fontSize: 6.5, color: '#6b7280', textAlign: 'center' },
    footerNote: { marginTop: 4, fontSize: 6, color: '#9ca3af', textAlign: 'center' },
  });

  return (
    <Document title={`Bon de Livraison ${data.delivery_number}`} author={settings?.company_name || 'Sordi'}>
      <Page size="A4" style={styles.page}>
        {/* HEADER — logo + full supplier details left, document title box right */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {settings?.logo_data && <Image src={settings.logo_data} style={styles.logo} />}
            <Text style={styles.companyName}>{settings?.company_name}</Text>
            {settings?.company_address && <Text style={styles.companyLine}>{settings.company_address}</Text>}
            {settings?.company_rc && <Text style={styles.companyLine}>RC: {settings.company_rc}</Text>}
            {settings?.company_nif && <Text style={styles.companyLine}>NIF: {settings.company_nif}</Text>}
            {settings?.company_nis && <Text style={styles.companyLine}>NIS: {settings.company_nis}</Text>}
            {settings?.company_ai && <Text style={styles.companyLine}>Article d'Imposition: {settings.company_ai}</Text>}
            {getCompanyPhones().map((p, i) => <Text key={i} style={styles.companyLine}>Tél: {p}</Text>)}
            {settings?.company_email && <Text style={styles.companyLine}>{settings.company_email}</Text>}
          </View>
          <View style={styles.headerRight}>
            <View style={styles.titleBox}>
              <Text style={styles.docTitle}>BON DE LIVRAISON</Text>
              <View style={styles.titleFieldRow}>
                <Text style={styles.titleFieldLabel}>N° BL</Text>
                <Text style={styles.titleFieldValue}>{data.delivery_number}</Text>
              </View>
              <View style={styles.titleFieldRow}>
                <Text style={styles.titleFieldLabel}>Date</Text>
                <Text style={styles.titleFieldValue}>{formatDate(data.delivery_date) || '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* CLIENT BLOCK */}
        <View style={styles.clientBlock}>
          <Text style={styles.clientBlockLabel}>CLIENT / RAISON SOCIALE</Text>
          <Text style={styles.clientName}>{data.client.name}</Text>
          {(data.client.address || data.client.city || data.client.wilaya) && (
            <Text style={styles.clientLine}>
              Adresse: {[data.client.address, data.client.city, data.client.wilaya].filter(Boolean).join(', ')}
            </Text>
          )}
          {(data.client.nif || data.client.rc) && (
            <Text style={styles.clientLine}>
              {[data.client.nif && `NIF: ${data.client.nif}`, data.client.rc && `RC: ${data.client.rc}`].filter(Boolean).join('   /   ')}
            </Text>
          )}
          {(data.client.contact_person || data.client.phone) && (
            <Text style={styles.clientLine}>
              {[data.client.contact_person && `Contact: ${data.client.contact_person}`, data.client.phone && `Tél: ${data.client.phone}`].filter(Boolean).join('   /   ')}
            </Text>
          )}
        </View>

        {/* TRANSPORT STRIP — only when at least one field is set */}
        {hasTransportInfo && (
          <View style={styles.transportStrip}>
            {data.driver_name && (
              <View style={styles.transportItem}>
                <Text style={styles.transportLabel}>Chauffeur:</Text>
                <Text style={styles.transportValue}>{data.driver_name}</Text>
              </View>
            )}
            {data.truck_plate && (
              <View style={styles.transportItem}>
                <Text style={styles.transportLabel}>Camion:</Text>
                <Text style={styles.transportValue}>{data.truck_plate}</Text>
              </View>
            )}
            {data.transporter_name && (
              <View style={styles.transportItem}>
                <Text style={styles.transportLabel}>Transporteur:</Text>
                <Text style={styles.transportValue}>{data.transporter_name}</Text>
              </View>
            )}
            {data.delivery_location && (
              <View style={styles.transportItem}>
                <Text style={styles.transportLabel}>Lieu de livraison:</Text>
                <Text style={styles.transportValue}>{data.delivery_location}</Text>
              </View>
            )}
          </View>
        )}

        {/* DELIVERY TABLE — same column set as the invoice line-item table */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colNum]}>N°</Text>
            <Text style={[styles.tableHeaderCell, styles.colRef]}>Réf</Text>
            <Text style={[styles.tableHeaderCell, styles.colDesignation]}>Désignation</Text>
            <Text style={[styles.tableHeaderCell, styles.colQte]}>Qté</Text>
            <Text style={[styles.tableHeaderCell, styles.colPU]}>P.U HT</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total HT</Text>
          </View>
          {data.items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colNum]}>{String(idx + 1).padStart(2, '0')}</Text>
              <Text style={[styles.tableCell, styles.colRef]}>{item.product_code || '-'}</Text>
              <Text style={[styles.tableCell, styles.colDesignation]}>{item.product_name || item.product_description || '-'}</Text>
              <Text style={[styles.tableCell, styles.colQte]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.colPU]}>{formatCurrency(item.unit_price)}</Text>
              <Text style={[styles.tableCell, styles.colTotal]}>{formatCurrency(item.quantity * (item.unit_price || 0))}</Text>
            </View>
          ))}
        </View>

        {/* TOTALS — Total HT / TVA / Total TTC, same box styling as the invoice */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Total HT</Text>
              <Text style={styles.totalsValue}>{formatCurrency(totalHT)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>TVA (19%)</Text>
              <Text style={styles.totalsValue}>{formatCurrency(totalTVA)}</Text>
            </View>
            <View style={styles.totalsRowFinal}>
              <Text style={styles.totalsLabel}>Total TTC / Net à Payer</Text>
              <Text style={styles.totalsValue}>{formatCurrency(totalTTC)}</Text>
            </View>
          </View>
        </View>

        {/* RESERVES — shown prominently when recorded */}
        {data.reserves && (
          <View style={styles.reservesBox}>
            <Text style={styles.reservesLabel}>RÉSERVES</Text>
            <Text style={styles.reservesText}>{data.reserves}</Text>
          </View>
        )}

        {/* Spacer — fills whatever vertical space is left so the signature
            boxes always sit at the bottom of the page, short BL or long. */}
        <View style={{ flexGrow: 1 }} />

        {/* SIGNATURE / RECEPTION */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>Pour l'Entreprise (Visa / Cachet)</Text>
            <View style={styles.sigField}>
              <Text style={styles.sigFieldLabel}>Date d'expédition</Text>
              <View style={styles.sigFieldLine}>
                {expeditionDate && <Text style={styles.sigFieldValue}>{expeditionDate}</Text>}
              </View>
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigFieldLabel}>Nom & Signature</Text>
              <View style={styles.sigFieldLine}>
                {data.deliverer_name && <Text style={styles.sigFieldValue}>{data.deliverer_name}</Text>}
              </View>
            </View>
            <View style={styles.sigField}>
              <View style={styles.sigStampArea}>
                {settings?.signature_data && (
                  <Image src={settings.signature_data} style={[styles.sigStampSignatureImage, { height: Math.min(settings.signature_size || 30, 34) }]} />
                )}
                {settings?.stamp_data && (
                  <Image src={settings.stamp_data} style={[styles.sigStampStampImage, { height: Math.min(settings.stamp_size || 22, 24) }]} />
                )}
              </View>
            </View>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>Reçu conforme et en bon état (Client)</Text>
            <View style={styles.sigField}>
              <Text style={styles.sigFieldLabel}>Date de réception</Text>
              <View style={styles.sigFieldLine}>
                {receptionDate && <Text style={styles.sigFieldValue}>{receptionDate}</Text>}
              </View>
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigFieldLabel}>Nom du réceptionnaire</Text>
              <View style={styles.sigFieldLine}>
                {data.receiver_name && <Text style={styles.sigFieldValue}>{data.receiver_name}</Text>}
              </View>
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigFieldLabel}>Signature et Cachet</Text>
              <View style={styles.sigStampArea} />
            </View>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          Les marchandises voyagent aux risques et périls du destinataire. Toute réserve doit être formulée à la réception.
        </Text>
        <Text style={styles.footerNote}>
          Document généré par Sordi{appVersion ? ` v${appVersion}` : ''}
        </Text>
      </Page>
    </Document>
  );
}
