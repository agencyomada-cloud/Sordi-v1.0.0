import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { computeSSRetenue, computeIRG } from '@/lib/algerianPayroll';
import { resolveInvoicePdfFontFamily, type PDFSettings } from './invoicePdfShared';

// Same four selectable fonts as the invoice templates (Paramètres > Thème de
// la facture PDF > Police), registered identically so the payslip matches
// whatever font the user already chose for invoices — not a separate look.
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

export interface BulletinPaieRun {
  month: string; // "YYYY-MM"
  base_salary: number;
  working_days_in_month: number;
  absence_days: number;
  absence_deduction: number;
  primes: number;
  avance_deduction: number;
  net_a_payer: number;
}

export interface BulletinPaieEmployee {
  name: string;
  role: string | null;
  hire_date: string | null;
  rib: string | null;
}

export interface BulletinPaiePDFProps {
  run: BulletinPaieRun;
  employee: BulletinPaieEmployee;
  /** From Tauri's getVersion() — the actual running app version, not a
   *  hardcoded string that drifts from the real build. */
  appVersion?: string;
  settings?: PDFSettings & {
    company_cnas_adherent?: string;
    payroll_prime_panier_taux?: string;
    payroll_prime_transport?: string;
  };
}

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return "0,00";
  const formatted = Math.abs(amount).toFixed(2).replace(/\./g, ',');
  const parts = formatted.split(',');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${amount < 0 ? "-" : ""}${integerPart},${parts[1] || '00'}`;
};

const MONTH_NAMES_FR = [
  'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE',
];

const formatHireDate = (d: string | null): string => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR');
};

interface GridRow {
  code: string;
  libelle: string;
  base: string;
  nombre: string;
  taux: string;
  gain: string;
  retenues: string;
}

export function BulletinPaiePDFDocument({ run, employee, appVersion, settings }: BulletinPaiePDFProps) {
  const [year, monthNum] = run.month.split('-').map(Number);
  const monthLabel = `${MONTH_NAMES_FR[monthNum - 1] || monthNum} ${year}`;
  const fontFamily = resolveInvoicePdfFontFamily(settings);

  const panierTaux = parseFloat(settings?.payroll_prime_panier_taux || '0') || 0;
  const transportMontant = parseFloat(settings?.payroll_prime_transport || '0') || 0;
  const panierGain = panierTaux > 0 ? panierTaux * run.working_days_in_month : 0;

  // ---- Rows, in the given standard's order. Codes 101/102/201/216/401/404
  // are exactly as specified; rows without a standard code (primes,
  // advances) use '-' rather than inventing one.
  const rows: GridRow[] = [
    { code: '101', libelle: 'SALAIRE DE BASE', base: formatCurrency(run.base_salary), nombre: String(run.working_days_in_month), taux: '-', gain: formatCurrency(run.base_salary), retenues: '-' },
  ];
  if (panierGain > 0) {
    rows.push({ code: '201', libelle: 'INDEMNITE DE PANIER', base: '-', nombre: String(run.working_days_in_month), taux: formatCurrency(panierTaux), gain: formatCurrency(panierGain), retenues: '-' });
  }
  if (transportMontant > 0) {
    rows.push({ code: '216', libelle: 'INDEMNITE DE TRANSPORT', base: '-', nombre: '1', taux: formatCurrency(transportMontant), gain: formatCurrency(transportMontant), retenues: '-' });
  }
  if (run.primes > 0) {
    rows.push({ code: '-', libelle: 'PRIMES', base: '-', nombre: '-', taux: '-', gain: formatCurrency(run.primes), retenues: '-' });
  }
  if (run.absence_days > 0) {
    rows.push({ code: '102', libelle: 'RETENUE ABSENCES', base: '-', nombre: String(run.absence_days), taux: '-', gain: '-', retenues: formatCurrency(run.absence_deduction) });
  }
  if (run.avance_deduction > 0) {
    rows.push({ code: '-', libelle: 'AVANCES SUR SALAIRE', base: '-', nombre: '-', taux: '-', gain: '-', retenues: formatCurrency(run.avance_deduction) });
  }

  // Cotisable base: gross cotisable elements (base + primes) MINUS the
  // absence deduction first — CNAS/IRG are withheld on what the employee
  // actually earned this month, not the theoretical full-month base. Panier/
  // transport stay excluded throughout (non-cotisable, non-imposable).
  const salaireCotisableReel = Math.max(0, run.base_salary + run.primes - run.absence_deduction);
  const ssRetenue = computeSSRetenue(salaireCotisableReel);
  const salaireImposable = Math.max(0, salaireCotisableReel - ssRetenue);
  const irgRetenue = computeIRG(salaireImposable);

  rows.push({ code: '404', libelle: 'SECURITE SOCIALE (9%)', base: formatCurrency(salaireCotisableReel), nombre: '-', taux: '9,00', gain: '-', retenues: formatCurrency(ssRetenue) });
  rows.push({ code: '401', libelle: 'I.R.G', base: formatCurrency(salaireImposable), nombre: '-', taux: '-', gain: '-', retenues: formatCurrency(irgRetenue) });

  const totalGain = run.base_salary + run.primes + panierGain + transportMontant;
  const totalRetenues = run.absence_deduction + run.avance_deduction + ssRetenue + irgRetenue;
  // This is the document's own bottom line — Total Gain minus Total
  // Retenues, computed entirely within this page (unlike run.net_a_payer,
  // which the rest of the app tracks and which does not include SS/IRG;
  // see Payroll.tsx / the calling code for why those are kept separate).
  const aPayer = totalGain - totalRetenues;

  const styles = StyleSheet.create({
    page: { padding: 24, fontFamily, fontSize: 8, color: '#000000', backgroundColor: '#ffffff' },

    // Same contain-fit convention as the invoice header logo
    // (InvoicePDFDocument.tsx), scaled to this document's compact header.
    logoRow: { height: 44, marginBottom: 10, justifyContent: 'center' },
    logoImage: { height: '100%', maxWidth: 160, objectFit: 'contain' },

    headerGrid: { flexDirection: 'row', borderWidth: 1, borderColor: '#000000', marginBottom: 10 },
    headerCol: { flex: 1, padding: 6 },
    headerColLeft: { borderRightWidth: 1, borderRightColor: '#000000' },
    headerFieldRow: { flexDirection: 'row', marginBottom: 3 },
    headerFieldLabel: { width: 100, fontSize: 7, fontFamily, fontWeight: 'bold' },
    headerFieldValue: { flex: 1, fontSize: 7 },
    companyNameText: { fontFamily, fontWeight: 'bold', fontSize: 11, marginBottom: 5 },
    docTitleText: { fontFamily, fontWeight: 'bold', fontSize: 13, letterSpacing: 1, textAlign: 'right', marginBottom: 5 },
    monthText: { fontSize: 8, fontFamily, fontWeight: 'bold', textAlign: 'right', marginBottom: 5 },

    table: { borderWidth: 1, borderColor: '#000000' },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: '#e5e5e5', borderBottomWidth: 1, borderBottomColor: '#000000', height: 20, alignItems: 'center' },
    tableHeaderCell: { fontSize: 7, fontFamily, fontWeight: 'bold', paddingHorizontal: 3, borderRightWidth: 0.5, borderRightColor: '#000000' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#9ca3af', minHeight: 16, alignItems: 'center' },
    tableCell: { fontSize: 7.5, paddingHorizontal: 3, borderRightWidth: 0.5, borderRightColor: '#e5e5e5' },
    colCode: { width: '8%' },
    colLibelle: { width: '26%' },
    colBase: { width: '15%', textAlign: 'right' },
    colNombre: { width: '13%', textAlign: 'right' },
    colTaux: { width: '12%', textAlign: 'right' },
    colGain: { width: '13%', textAlign: 'right' },
    colRetenues: { width: '13%', textAlign: 'right', borderRightWidth: 0 },

    totalsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#000000', minHeight: 20, alignItems: 'center', backgroundColor: '#f0f0f0' },
    totalsLabel: { fontSize: 7.5, fontFamily, fontWeight: 'bold', paddingHorizontal: 3, width: '62%' },
    totalsGain: { fontSize: 7.5, fontFamily, fontWeight: 'bold', width: '13%', textAlign: 'right', paddingHorizontal: 3 },
    totalsRetenues: { fontSize: 7.5, fontFamily, fontWeight: 'bold', width: '13%', textAlign: 'right', paddingHorizontal: 3, borderLeftWidth: 0.5, borderLeftColor: '#000000' },

    aPayerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderWidth: 1.5, borderColor: '#000000', backgroundColor: '#000000', padding: 8 },
    aPayerLabel: { fontSize: 11, fontFamily, fontWeight: 'bold', color: '#ffffff', letterSpacing: 0.5 },
    aPayerValue: { fontSize: 13, fontFamily, fontWeight: 'bold', color: '#ffffff' },

    // No italic — only regular + bold are registered for each of the 4
    // selectable fonts above; react-pdf can't resolve an unregistered
    // weight/style combination and throws at generation time.
    footerNote: { marginTop: 10, fontSize: 6, color: '#4b5563' },
  });

  return (
    <Document title={`Bulletin de Paie - ${employee.name} - ${run.month}`} author={settings?.company_name || 'Sordi'}>
      <Page size="A4" style={styles.page}>
        {settings?.logo_data && (
          <View style={styles.logoRow}>
            <Image src={settings.logo_data} style={styles.logoImage} />
          </View>
        )}

        {/* HEADER GRID */}
        <View style={styles.headerGrid}>
          <View style={[styles.headerCol, styles.headerColLeft]}>
            <Text style={styles.companyNameText}>{settings?.company_name}</Text>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>RC</Text>
              <Text style={styles.headerFieldValue}>{settings?.company_rc || '—'}</Text>
            </View>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>NIF</Text>
              <Text style={styles.headerFieldValue}>{settings?.company_nif || '—'}</Text>
            </View>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>Direction</Text>
              <Text style={styles.headerFieldValue}>—</Text>
            </View>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>N° Cotisant CNAS</Text>
              <Text style={styles.headerFieldValue}>{settings?.company_cnas_adherent || '—'}</Text>
            </View>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>Matricule</Text>
              <Text style={styles.headerFieldValue}>—</Text>
            </View>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>Nom & Prénom</Text>
              <Text style={styles.headerFieldValue}>{employee.name}</Text>
            </View>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>Paiement mode</Text>
              <Text style={styles.headerFieldValue}>{employee.rib ? 'Virement' : '—'}</Text>
            </View>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>N° Compte</Text>
              <Text style={styles.headerFieldValue}>{employee.rib || '—'}</Text>
            </View>
          </View>
          <View style={styles.headerCol}>
            <Text style={styles.docTitleText}>BULLETIN DE PAIE</Text>
            <Text style={styles.monthText}>MOIS DE: {monthLabel}</Text>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>Date Recrutement</Text>
              <Text style={styles.headerFieldValue}>{formatHireDate(employee.hire_date)}</Text>
            </View>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>N° SS</Text>
              <Text style={styles.headerFieldValue}>—</Text>
            </View>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>Cat/Sec/Ech</Text>
              <Text style={styles.headerFieldValue}>—</Text>
            </View>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>Fonction</Text>
              <Text style={styles.headerFieldValue}>{employee.role || '—'}</Text>
            </View>
            <View style={styles.headerFieldRow}>
              <Text style={styles.headerFieldLabel}>Situation Familiale</Text>
              <Text style={styles.headerFieldValue}>—</Text>
            </View>
          </View>
        </View>

        {/* CALCULATION GRID */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colCode]}>Code</Text>
            <Text style={[styles.tableHeaderCell, styles.colLibelle]}>Libelle</Text>
            <Text style={[styles.tableHeaderCell, styles.colBase]}>Base</Text>
            <Text style={[styles.tableHeaderCell, styles.colNombre]}>Nombre</Text>
            <Text style={[styles.tableHeaderCell, styles.colTaux]}>Taux</Text>
            <Text style={[styles.tableHeaderCell, styles.colGain]}>Gain</Text>
            <Text style={[styles.tableHeaderCell, styles.colRetenues]}>Retenues</Text>
          </View>
          {rows.map((r, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colCode]}>{r.code}</Text>
              <Text style={[styles.tableCell, styles.colLibelle]}>{r.libelle}</Text>
              <Text style={[styles.tableCell, styles.colBase]}>{r.base}</Text>
              <Text style={[styles.tableCell, styles.colNombre]}>{r.nombre}</Text>
              <Text style={[styles.tableCell, styles.colTaux]}>{r.taux}</Text>
              <Text style={[styles.tableCell, styles.colGain]}>{r.gain}</Text>
              <Text style={[styles.tableCell, styles.colRetenues]}>{r.retenues}</Text>
            </View>
          ))}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Totaux...</Text>
            <Text style={styles.totalsGain}>{formatCurrency(totalGain)}</Text>
            <Text style={styles.totalsRetenues}>{formatCurrency(totalRetenues)}</Text>
          </View>
        </View>

        {/* à PAYER */}
        <View style={styles.aPayerRow}>
          <Text style={styles.aPayerLabel}>à Payer...</Text>
          <Text style={styles.aPayerValue}>{formatCurrency(aPayer)} DA</Text>
        </View>

        <Text style={styles.footerNote}>
          IRG calculé selon le barème LF 2022 (à vérifier auprès de votre comptable). Document généré par Sordi{appVersion ? ` v${appVersion}` : ''}.
        </Text>
      </Page>
    </Document>
  );
}
