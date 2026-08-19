import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register Space Grotesk
Font.register({
  family: 'Space Grotesk',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUXskPMVBSSJLq2I.ttf' },
    { src: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVnskPMVBSSJLq2I.ttf', fontWeight: 'bold' },
  ]
});

export interface ClientCumulativeRecord {
  client_name: string;
  total_ht: number;
  total_tva: number;
  total_timbre: number;
  total_ttc: number;
  total_quantity?: number;
  invoice_count?: number;
}

export interface CumulativesPDFProps {
  records: ClientCumulativeRecord[];
  totals: {
    total_ht: number;
    total_tva: number;
    total_timbre: number;
    total_ttc: number;
  };
  periodLabel?: string;
  settings?: {
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
    primary_color?: string;
    body_pattern_data?: string;
  };
}

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

export function CumulativesPDFDocument({ records, totals, periodLabel, settings }: CumulativesPDFProps) {
  const primaryColor = settings?.primary_color || "#FFCC00";

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
      width: 841.89, // Landscape A4
      height: 595.28,
      padding: 0,
      fontFamily: 'Helvetica',
      fontSize: 9,
      color: '#000000',
      backgroundColor: '#ffffff',
    },
    backgroundContainer: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
    },
    patternImage: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      objectFit: 'cover',
      opacity: 0.2,
    },
    
    /* ================= HEADER (33.9mm) ================= */
    header: {
      position: 'absolute',
      top: 0, left: 0,
      width: '100%',
      height: 96.1,
      backgroundColor: '#ffffff',
    },
    headerLogoContainer: {
      position: 'absolute',
      top: 0, left: 0,
      width: 250, // Stretched a bit for landscape
      height: '100%',
      justifyContent: 'center',
      paddingLeft: 22,
    },
    headerLogo: {
      maxHeight: 50,
      maxWidth: 160,
      objectFit: 'contain',
    },
    headerTitleBox: {
      position: 'absolute',
      top: 0, left: 250, right: 184,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitleText: {
      fontFamily: 'Space Grotesk',
      fontSize: 16,
      fontWeight: 'bold',
      letterSpacing: 2,
    },
    companyNameBadge: {
      position: 'absolute',
      top: 0, right: 0,
      width: 184,
      height: '100%',
      backgroundColor: primaryColor,
      justifyContent: 'center',
      paddingHorizontal: 15,
    },
    companyNameText: {
      fontSize: 11,
      fontFamily: 'Space Grotesk',
      fontWeight: 'bold',
      color: '#000000',
      textAlign: 'right',
    },
    
    /* ================= MAIN CONTENT ================= */
    mainContent: {
      marginTop: 96.1,
      marginBottom: 94.4, // Header and Footer reserved
      paddingTop: 20,
      paddingHorizontal: 30,
      minHeight: 404,
    },
    contentTitle: {
      fontSize: 14,
      fontFamily: 'Space Grotesk',
      fontWeight: 'bold',
      marginBottom: 4,
    },
    contentSubtitle: {
      fontSize: 9,
      color: '#64748b',
      marginBottom: 15,
    },

    /* ================= TABLE ================= */
    table: {
      width: '100%',
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: '#f8fafc',
      borderBottomWidth: 1,
      borderBottomColor: '#9ca3af',
      borderTopWidth: 1,
      borderTopColor: '#9ca3af',
      height: 25,
      alignItems: 'center',
    },
    tableHeaderCell: {
      fontSize: 8,
      fontFamily: 'Space Grotesk',
      fontWeight: 'bold',
      color: '#000000',
      paddingHorizontal: 4,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#d1d5db',
      minHeight: 22,
      alignItems: 'center',
    },
    tableCell: {
      fontSize: 8,
      fontFamily: 'Space Grotesk',
      color: '#000000',
      paddingHorizontal: 4,
    },
    
    /* Column Widths */
    colClient: { width: '30%' },
    colCount: { width: '10%', textAlign: 'center' },
    colHT: { width: '15%', textAlign: 'right' },
    colTVA: { width: '15%', textAlign: 'right' },
    colTimbre: { width: '15%', textAlign: 'right' },
    colTTC: { width: '15%', textAlign: 'right' },

    totalsRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#9ca3af',
      minHeight: 25,
      alignItems: 'center',
      backgroundColor: '#f1f5f9',
      marginTop: 5,
    },
    totalsCell: {
      fontSize: 8,
      fontFamily: 'Space Grotesk',
      fontWeight: 'bold',
      color: '#000000',
      paddingHorizontal: 4,
    },

    /* ================= FOOTER ================= */
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
      left: 5.67, right: 5.67,
      top: 9.92, bottom: 5.67,
      flexDirection: 'row',
    },
    legalCol: {
      width: 250, // Slightly wider for landscape
      paddingLeft: 11.9,
      justifyContent: 'flex-end',
      height: '100%',
    },
    legalColTextWrapper: { position: 'relative' },
    legalYellowBar: {
      position: 'absolute',
      left: -11.9, top: 1.5, bottom: 1.5,
      width: 2.13,
      backgroundColor: primaryColor,
    },
    legalRow: { flexDirection: 'row', marginBottom: 2 },
    legalLabel: { width: 80, fontSize: 7.1, fontFamily: 'Space Grotesk', fontWeight: 'bold', color: '#000000' },
    legalColon: { width: 8, fontSize: 7.1, fontFamily: 'Space Grotesk', fontWeight: 'bold', textAlign: 'center' },
    legalValue: { fontSize: 7.1, fontFamily: 'Space Grotesk', color: '#000000' },
    
    companyInfoCol: {
      width: 260, // Wider for landscape
      paddingHorizontal: 10,
      justifyContent: 'flex-end',
      paddingBottom: 2.8,
      height: '100%',
    },
    addressText: { fontSize: 7.1, fontFamily: 'Space Grotesk', fontWeight: 'bold', color: '#000000', marginBottom: 4, lineHeight: 1.3 },
    ribText: { fontSize: 7.1, fontFamily: 'Space Grotesk', color: '#000000', lineHeight: 1.3 },
    
    contactCol: {
      flex: 1,
      flexDirection: 'row',
      position: 'relative',
      height: '100%',
    },
    contactLeftBox: {
      width: 56.7,
      justifyContent: 'flex-end',
      height: '100%',
      position: 'relative',
    },
    footerLogoBox: {
      position: 'absolute',
      top: 0, left: 0,
      height: 22.7, width: 121.9,
      justifyContent: 'center',
    },
    qrBox: {
      width: 51, height: 51,
      alignItems: 'center', justifyContent: 'center',
      marginTop: 13,
    },
    contactRightBox: {
      marginLeft: 7.1,
      flex: 1,
      justifyContent: 'flex-end',
      height: '100%',
    },
    contactEmailText: { fontSize: 7.1, fontFamily: 'Space Grotesk', fontWeight: 'bold', color: '#000000', marginBottom: 2 },
    contactPhoneRow: { flexDirection: 'row', marginBottom: 1 },
  });

  return (
    <Document title="Cumul Ventes Clients" author={settings?.company_name || "Sordi"}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        
        {/* Background Pattern */}
        <View style={styles.backgroundContainer} fixed>
          {settings?.body_pattern_data && (
            <Image src={settings.body_pattern_data} style={styles.patternImage} />
          )}
        </View>

        {/* HEADER */}
        <View style={styles.header} fixed>
          <View style={styles.headerLogoContainer}>
            {settings?.logo_data ? (
              <Image src={settings.logo_data} style={styles.headerLogo} />
            ) : (
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 16 }}>{settings?.company_name || "SORDI"}</Text>
            )}
          </View>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitleText}>CUMUL VENTES</Text>
          </View>
          <View style={styles.companyNameBadge}>
            <Text style={styles.companyNameText}>{settings?.company_name || "SORDI"}</Text>
          </View>
        </View>

        {/* MAIN CONTENT */}
        <View style={styles.mainContent}>
          <Text style={styles.contentTitle}>État Cumulé des Ventes par Client</Text>
          {periodLabel && <Text style={styles.contentSubtitle}>Période: {periodLabel}</Text>}

          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeaderRow} fixed>
              <Text style={[styles.tableHeaderCell, styles.colClient]}>Nom Client</Text>
              <Text style={[styles.tableHeaderCell, styles.colCount]}>Nbr Fact.</Text>
              <Text style={[styles.tableHeaderCell, styles.colHT]}>Total HT</Text>
              <Text style={[styles.tableHeaderCell, styles.colTVA]}>TVA</Text>
              <Text style={[styles.tableHeaderCell, styles.colTimbre]}>Timbre</Text>
              <Text style={[styles.tableHeaderCell, styles.colTTC]}>Total TTC</Text>
            </View>

            {/* Table Body */}
            {records.map((r, idx) => (
              <View key={idx} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tableCell, styles.colClient]}>{r.client_name}</Text>
                <Text style={[styles.tableCell, styles.colCount]}>{r.invoice_count ?? '-'}</Text>
                <Text style={[styles.tableCell, styles.colHT]}>{formatCurrency(r.total_ht)}</Text>
                <Text style={[styles.tableCell, styles.colTVA]}>{formatCurrency(r.total_tva)}</Text>
                <Text style={[styles.tableCell, styles.colTimbre]}>{formatCurrency(r.total_timbre)}</Text>
                <Text style={[styles.tableCell, styles.colTTC, { fontWeight: 'bold' }]}>{formatCurrency(r.total_ttc)}</Text>
              </View>
            ))}

            {/* Totals Row */}
            <View style={styles.totalsRow} wrap={false}>
              <Text style={[styles.totalsCell, styles.colClient]}>TOTAL GÉNÉRAL</Text>
              <Text style={[styles.totalsCell, styles.colCount]}>-</Text>
              <Text style={[styles.totalsCell, styles.colHT]}>{formatCurrency(totals.total_ht)}</Text>
              <Text style={[styles.totalsCell, styles.colTVA]}>{formatCurrency(totals.total_tva)}</Text>
              <Text style={[styles.totalsCell, styles.colTimbre]}>{formatCurrency(totals.total_timbre)}</Text>
              <Text style={[styles.totalsCell, styles.colTTC]}>{formatCurrency(totals.total_ttc)}</Text>
            </View>
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <View style={styles.footerInner}>
            <View style={styles.legalCol}>
              <View style={styles.legalColTextWrapper}>
                <View style={styles.legalYellowBar} />
                <View style={styles.legalRow}>
                  <Text style={styles.legalLabel}>RC</Text><Text style={styles.legalColon}>:</Text><Text style={styles.legalValue}>{settings?.company_rc || "N/A"}</Text>
                </View>
                <View style={styles.legalRow}>
                  <Text style={styles.legalLabel}>NIF</Text><Text style={styles.legalColon}>:</Text><Text style={styles.legalValue}>{settings?.company_nif || "N/A"}</Text>
                </View>
                <View style={styles.legalRow}>
                  <Text style={styles.legalLabel}>NIS</Text><Text style={styles.legalColon}>:</Text><Text style={styles.legalValue}>{settings?.company_nis || "N/A"}</Text>
                </View>
                <View style={styles.legalRow}>
                  <Text style={styles.legalLabel}>ART. IMP</Text><Text style={styles.legalColon}>:</Text><Text style={styles.legalValue}>{settings?.company_ai || "N/A"}</Text>
                </View>
                <View style={styles.legalRow}>
                  <Text style={styles.legalLabel}>Capital Social</Text><Text style={styles.legalColon}>:</Text><Text style={styles.legalValue}>{settings?.company_capital || "N/A"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.companyInfoCol}>
              <Text style={styles.addressText}>{settings?.company_address || "ADRESSE NON DÉFINIE"}</Text>
              <Text style={styles.ribText}>RIB: {settings?.company_rib || "Non défini"}</Text>
              <Text style={styles.ribText}>{settings?.company_bank_agency || ""}</Text>
            </View>

            <View style={styles.contactCol}>
              <View style={styles.contactLeftBox}>
                <View style={styles.footerLogoBox}>
                  {settings?.footer_logo_data ? (
                    <Image src={settings.footer_logo_data} style={{ height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#b91c1c' }}>SORDI</Text>
                  )}
                </View>
                <View style={styles.qrBox}>
                  {settings?.qr_code_data ? (
                    <Image src={settings.qr_code_data} style={{ width: '100%', height: '100%' }} />
                  ) : null}
                </View>
              </View>

              <View style={styles.contactRightBox}>
                {settings?.company_email && (
                  <Text style={styles.contactEmailText}>{settings.company_email}</Text>
                )}
                {phones.map((phone, idx) => (
                  <View key={idx} style={styles.contactPhoneRow}>
                    <Text style={styles.legalValue}>{phone}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  );
}
