import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register Space Grotesk
Font.register({
  family: 'Space Grotesk',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUXskPMVBSSJLq2I.ttf' },
    { src: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVnskPMVBSSJLq2I.ttf', fontWeight: 'bold' },
  ]
});

export interface PayrollPDFRow {
  employee_name: string;
  month: string;
  base_salary: number;
  absence_days: number;
  primes: number;
  net_a_payer: number;
  paid: boolean;
}

export interface PayrollPDFProps {
  rows: PayrollPDFRow[];
  totalNetAPayer: number;
  periodLabel?: string;
  settings?: {
    company_name?: string;
    company_address?: string;
    company_phone?: string;
    company_phones?: string | string[];
    company_email?: string;
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

export function PayrollPDFDocument({ rows, totalNetAPayer, periodLabel, settings }: PayrollPDFProps) {
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
      width: 250,
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
      marginBottom: 94.4,
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
    colEmployee: { width: '26%' },
    colMonth: { width: '12%', textAlign: 'center' },
    colBaseSalary: { width: '15%', textAlign: 'right' },
    colAbsences: { width: '10%', textAlign: 'center' },
    colPrimes: { width: '13%', textAlign: 'right' },
    colNet: { width: '14%', textAlign: 'right' },
    colStatus: { width: '10%', textAlign: 'center' },

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
      width: 250,
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
      width: 260,
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
    <Document title="Bulletins de Paie" author={settings?.company_name || "Sordi"}>
      <Page size="A4" orientation="landscape" style={styles.page}>

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
            <Text style={styles.headerTitleText}>BULLETINS DE PAIE</Text>
          </View>
          <View style={styles.companyNameBadge}>
            <Text style={styles.companyNameText}>{settings?.company_name || "SORDI"}</Text>
          </View>
        </View>

        {/* MAIN CONTENT */}
        <View style={styles.mainContent}>
          <Text style={styles.contentTitle}>Récapitulatif des Bulletins de Paie</Text>
          {periodLabel && <Text style={styles.contentSubtitle}>Période: {periodLabel}</Text>}

          <View style={styles.table}>
            <View style={styles.tableHeaderRow} fixed>
              <Text style={[styles.tableHeaderCell, styles.colEmployee]}>Employé</Text>
              <Text style={[styles.tableHeaderCell, styles.colMonth]}>Mois</Text>
              <Text style={[styles.tableHeaderCell, styles.colBaseSalary]}>Salaire de base</Text>
              <Text style={[styles.tableHeaderCell, styles.colAbsences]}>Absences</Text>
              <Text style={[styles.tableHeaderCell, styles.colPrimes]}>Primes</Text>
              <Text style={[styles.tableHeaderCell, styles.colNet]}>Net à payer</Text>
              <Text style={[styles.tableHeaderCell, styles.colStatus]}>Statut</Text>
            </View>

            {rows.map((r, idx) => (
              <View key={idx} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tableCell, styles.colEmployee]}>{r.employee_name}</Text>
                <Text style={[styles.tableCell, styles.colMonth]}>{r.month}</Text>
                <Text style={[styles.tableCell, styles.colBaseSalary]}>{formatCurrency(r.base_salary)}</Text>
                <Text style={[styles.tableCell, styles.colAbsences]}>{r.absence_days}</Text>
                <Text style={[styles.tableCell, styles.colPrimes]}>{formatCurrency(r.primes)}</Text>
                <Text style={[styles.tableCell, styles.colNet, { fontWeight: 'bold' }]}>{formatCurrency(r.net_a_payer)}</Text>
                <Text style={[styles.tableCell, styles.colStatus]}>{r.paid ? 'Payé' : 'En attente'}</Text>
              </View>
            ))}

            <View style={styles.totalsRow} wrap={false}>
              <Text style={[styles.totalsCell, styles.colEmployee]}>TOTAL GÉNÉRAL</Text>
              <Text style={[styles.totalsCell, styles.colMonth]}>-</Text>
              <Text style={[styles.totalsCell, styles.colBaseSalary]}>-</Text>
              <Text style={[styles.totalsCell, styles.colAbsences]}>-</Text>
              <Text style={[styles.totalsCell, styles.colPrimes]}>-</Text>
              <Text style={[styles.totalsCell, styles.colNet]}>{formatCurrency(totalNetAPayer)}</Text>
              <Text style={[styles.totalsCell, styles.colStatus]}>-</Text>
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
