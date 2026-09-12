import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { CONTRACT_SERVICE_CATALOG } from '@/lib/contractServices';
import type { ContractServiceKey } from '@/lib/database';
import './pdfFonts';

const formatMoney = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0,00 DZD';
  const abs = Math.abs(amount);
  const formatted = abs.toFixed(2).replace(/\./g, ',');
  const [intPart, decPart] = formatted.split(',');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${amount < 0 ? '-' : ''}${grouped},${decPart || '00'} DZD`;
};

const formatDateFr = (d: string | null | undefined): string => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

export interface ContractPDFParty {
  name: string;
  address: string;
  rc: string;
  nif: string;
  nis: string;
  ai: string;
  phone?: string;
  representative?: string;
  representativeTitle?: string;
}

export interface ContractPDFTranche {
  label: string;
  /** e.g. "50%", "30%" — pre-formatted since the fraction→percent mapping lives in contractServices.ts. */
  percentLabel: string;
  ref: string;
  amountTtc: number;
  condition: string;
}

export interface ContractPDFProps {
  contractRef: string;
  issueDate: string;
  omada: ContractPDFParty;
  client: ContractPDFParty;
  /** Absent when the contract has no linked project — Article 1 then omits the project box. */
  projectName?: string;
  projectDescription: string;
  selectedServices: ContractServiceKey[];
  totalHt: number;
  tvaRate: number;
  totalTva: number;
  totalTtc: number;
  paymentSplitLabel: string;
  tranches: ContractPDFTranche[];
}

/**
 * Bespoke 50/50-milestone client services contract — a fixed legal template
 * (not a themeable document like the invoice/order PDFs), so it doesn't take
 * a PDFSettings prop or a font/theme choice. Structured as flowing numbered
 * articles rather than the metric-strip/table layout of MonthlyReportPDF,
 * since this is legal prose, not a financial aggregation report.
 */
export function ContractPDFDocument({
  contractRef,
  issueDate,
  omada,
  client,
  projectName,
  projectDescription,
  selectedServices,
  totalHt,
  tvaRate,
  totalTva,
  totalTtc,
  paymentSplitLabel,
  tranches,
}: ContractPDFProps) {
  // Preserves catalog display order regardless of selection order, and
  // silently drops any unrecognized key rather than rendering a blank line.
  const services = CONTRACT_SERVICE_CATALOG.filter((s) => selectedServices.includes(s.key));

  // media_shooting and video_ads share the "Production/Video" clause,
  // web_vitrine and ecommerce share the "Web/E-commerce" clause — collapse
  // identical clause text into one Article 2 paragraph instead of repeating
  // it once per matching service.
  const technicalClauses = Array.from(new Set(services.map((s) => s.technicalClause)));
  const styles = StyleSheet.create({
    page: {
      width: 595.28,
      height: 841.89,
      paddingTop: 40,
      paddingBottom: 48,
      paddingHorizontal: 44,
      fontFamily: 'Montserrat',
      fontSize: 8.5,
      lineHeight: 1.5,
      color: '#111111',
      backgroundColor: '#ffffff',
    },

    titleBlock: { alignItems: 'center', marginBottom: 4 },
    title: { fontSize: 13, fontWeight: 'bold', letterSpacing: 0.6, textAlign: 'center' },
    subtitle: { fontSize: 9, fontWeight: 'bold', letterSpacing: 0.4, textAlign: 'center', marginTop: 3, color: '#374151' },
    ruleThick: { height: 1.5, backgroundColor: '#111111', marginTop: 10, marginBottom: 10 },
    ruleThin: { height: 0.75, backgroundColor: '#d1d5db', marginTop: 8, marginBottom: 10 },

    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    metaLabel: { fontSize: 7, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
    metaValue: { fontSize: 9, fontFamily: 'JetBrains Mono', fontWeight: 'bold', marginTop: 2 },

    intro: { fontSize: 8.5, marginBottom: 8 },

    partyBlock: { marginBottom: 10 },
    partyLabel: { fontSize: 7.5, fontWeight: 'bold', color: '#EB3B48', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
    partyName: { fontSize: 9.5, fontWeight: 'bold', marginBottom: 2 },
    partyLine: { fontSize: 8, color: '#374151', marginBottom: 1 },
    partyClosing: { fontSize: 8, color: '#6b7280', marginTop: 3 },

    articleHeading: {
      fontSize: 8.5, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.4,
      marginTop: 12, marginBottom: 5,
      borderBottomWidth: 0.75, borderBottomColor: '#111111', paddingBottom: 3,
    },
    paragraph: { fontSize: 8, marginBottom: 4, textAlign: 'justify' },
    bold: { fontWeight: 'bold' },

    projectBox: { borderWidth: 0.75, borderColor: '#d1d5db', borderRadius: 3, padding: 8, marginTop: 2, marginBottom: 4 },
    projectLabel: { fontSize: 7, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 },
    projectValue: { fontSize: 9, fontWeight: 'bold', marginTop: 2, marginBottom: 4 },

    servicesLabel: { fontSize: 7, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4, marginBottom: 4 },
    serviceRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, gap: 6 },
    serviceBullet: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#EB3B48', marginTop: 3.5 },
    serviceName: { fontSize: 8, fontWeight: 'bold' },
    serviceDeliverables: { fontSize: 7.5, color: '#6b7280' },

    clauseParagraph: { fontSize: 8, marginBottom: 6, textAlign: 'justify' },

    totalStrip: {
      flexDirection: 'row', borderWidth: 0.75, borderColor: '#111111', borderRadius: 3,
      marginTop: 4, marginBottom: 8,
    },
    totalCell: { flex: 1, padding: 7, borderRightWidth: 0.75, borderRightColor: '#e5e7eb' },
    totalCellLast: { flex: 1, padding: 7 },
    totalCellLabel: { fontSize: 6.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
    totalCellValue: { fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 'bold' },
    totalCellValueEm: { fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 'bold', color: '#EB3B48' },

    milestoneCard: {
      borderWidth: 0.75, borderColor: '#111111', borderRadius: 3,
      marginTop: 6, marginBottom: 6, overflow: 'hidden',
    },
    milestoneHeader: {
      backgroundColor: '#111111', paddingVertical: 5, paddingHorizontal: 8,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    milestoneHeaderText: { fontSize: 8, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.4 },
    milestonePctBadge: { backgroundColor: '#EB3B48', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
    milestonePctText: { fontSize: 7.5, fontWeight: 'bold', color: '#ffffff' },
    milestoneBody: { padding: 8 },
    milestoneRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    milestoneKey: { fontSize: 7.5, color: '#6b7280' },
    milestoneVal: { fontSize: 8, fontFamily: 'JetBrains Mono', fontWeight: 'bold' },
    milestoneCondition: { fontSize: 7.5, color: '#374151', marginTop: 3, textAlign: 'justify' },

    signaturesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
    signatureBlock: { width: '44%' },
    signatureLine: { height: 0.75, backgroundColor: '#9ca3af', marginBottom: 4, marginTop: 40 },
    signatureLabel: { fontSize: 7.5, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.4 },
    signatureSub: { fontSize: 6.5, color: '#9ca3af', marginTop: 2 },

    footer: { position: 'absolute', left: 44, right: 44, bottom: 24, borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 6 },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
    footerText: { fontSize: 6, color: '#9ca3af' },
  });

  const pctBadge = (pct: string) => (
    <View style={styles.milestonePctBadge}><Text style={styles.milestonePctText}>{pct}</Text></View>
  );

  return (
    <Document title={`Contrat ${contractRef}`} author={omada.name}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>CONTRAT DE PRESTATION DE SERVICES</Text>
          <Text style={styles.subtitle}>MARKETING DIGITAL, CRÉATION VISUELLE &amp; DÉVELOPPEMENT WEB</Text>
        </View>
        <View style={styles.ruleThick} />

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Référence du contrat</Text>
            <Text style={styles.metaValue}>{contractRef}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Date d'émission</Text>
            <Text style={styles.metaValue}>{formatDateFr(issueDate)}</Text>
          </View>
        </View>

        <Text style={styles.intro}>ENTRE LES SOUSSIGNÉS :</Text>

        <View style={styles.partyBlock}>
          <Text style={styles.partyLabel}>1. Le Prestataire</Text>
          <Text style={styles.partyName}>{omada.name}</Text>
          {!!omada.address && <Text style={styles.partyLine}>Siège social : {omada.address}</Text>}
          <Text style={styles.partyLine}>
            {[
              omada.rc ? `RC : ${omada.rc}` : null,
              omada.nif ? `NIF : ${omada.nif}` : null,
              omada.nis ? `NIS : ${omada.nis}` : null,
              omada.ai ? `AI : ${omada.ai}` : null,
            ].filter(Boolean).join('  |  ')}
          </Text>
          {(omada.phone || true) && (
            <Text style={styles.partyLine}>
              {omada.phone ? `Téléphone : ${omada.phone}  |  ` : ''}Email : contact@omada.agency
            </Text>
          )}
          <Text style={styles.partyLine}>Représentée par : {omada.representative || 'La Direction Générale'}</Text>
          <Text style={styles.partyClosing}>Ci-après dénommée « OMADA » ou « Le Prestataire », d'une part,</Text>
        </View>

        <Text style={styles.intro}>ET</Text>

        <View style={styles.partyBlock}>
          <Text style={styles.partyLabel}>2. Le Client</Text>
          <Text style={styles.partyName}>{client.name}</Text>
          {!!client.address && <Text style={styles.partyLine}>Adresse : {client.address}</Text>}
          <Text style={styles.partyLine}>
            {[
              client.rc ? `RC : ${client.rc}` : null,
              client.nif ? `NIF : ${client.nif}` : null,
              client.nis ? `NIS : ${client.nis}` : null,
              client.ai ? `AI : ${client.ai}` : null,
            ].filter(Boolean).join('  |  ')}
          </Text>
          {!!client.representative && (
            <Text style={styles.partyLine}>
              Représentée par : {client.representative}{client.representativeTitle ? ` (Qualité : ${client.representativeTitle})` : ''}
            </Text>
          )}
          <Text style={styles.partyClosing}>Ci-après dénommé « Le Client », d'autre part.</Text>
        </View>

        <View style={styles.ruleThin} />

        <Text style={styles.articleHeading}>Article 1 : Objet du contrat &amp; prestations sélectionnées</Text>
        <Text style={styles.paragraph}>
          Le présent contrat définit les conditions techniques, financières et juridiques selon lesquelles OMADA
          s'engage à réaliser pour le compte du Client les prestations suivantes{projectName ? ' dans le cadre du projet ci-dessous' : ''} :
        </Text>
        {(projectName || projectDescription) && (
          <View style={styles.projectBox}>
            {!!projectName && (
              <>
                <Text style={styles.projectLabel}>Intitulé</Text>
                <Text style={styles.projectValue}>« {projectName} »</Text>
              </>
            )}
            {!!projectDescription && (
              <>
                <Text style={styles.projectLabel}>Description détaillée</Text>
                <Text style={{ fontSize: 8, marginTop: 2 }}>{projectDescription}</Text>
              </>
            )}
          </View>
        )}
        <Text style={styles.servicesLabel}>Prestations retenues au titre du présent contrat</Text>
        {services.map((service) => (
          <View key={service.key} style={styles.serviceRow}>
            <View style={styles.serviceBullet} />
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceName}>{service.label}</Text>
              <Text style={styles.serviceDeliverables}>{service.deliverables.join(' • ')}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.articleHeading}>Article 2 : Clauses techniques spécifiques aux prestations</Text>
        {technicalClauses.map((clause, idx) => (
          <Text key={idx} style={styles.clauseParagraph}>{clause}</Text>
        ))}

        <Text style={styles.articleHeading}>Article 3 : Modalités financières &amp; échéancier ({paymentSplitLabel})</Text>
        <Text style={styles.paragraph}>
          Le montant global des prestations est fixé à <Text style={styles.bold}>{formatMoney(totalTtc)} TTC</Text>
          {' '}(Montant HT : {formatMoney(totalHt)} • TVA {tvaRate}% : {formatMoney(totalTva)}).
        </Text>
        <View style={styles.totalStrip}>
          <View style={styles.totalCell}>
            <Text style={styles.totalCellLabel}>Total HT</Text>
            <Text style={styles.totalCellValue}>{formatMoney(totalHt)}</Text>
          </View>
          <View style={styles.totalCell}>
            <Text style={styles.totalCellLabel}>TVA {tvaRate}%</Text>
            <Text style={styles.totalCellValue}>{formatMoney(totalTva)}</Text>
          </View>
          <View style={styles.totalCellLast}>
            <Text style={styles.totalCellLabel}>Total TTC</Text>
            <Text style={styles.totalCellValueEm}>{formatMoney(totalTtc)}</Text>
          </View>
        </View>
        <Text style={styles.paragraph}>
          {tranches.length > 1
            ? `Le règlement est scindé en ${tranches.length === 2 ? 'deux' : 'trois'} versements obligatoires :`
            : 'Le règlement s\'effectue intégralement selon les modalités suivantes :'}
        </Text>

        {tranches.map((tranche, idx) => (
          <View key={idx} style={styles.milestoneCard}>
            <View style={styles.milestoneHeader}>
              <Text style={styles.milestoneHeaderText}>{idx + 1}. {tranche.label}</Text>
              {pctBadge(tranche.percentLabel)}
            </View>
            <View style={styles.milestoneBody}>
              <View style={styles.milestoneRow}>
                <Text style={styles.milestoneKey}>Facture n°</Text>
                <Text style={styles.milestoneVal}>{tranche.ref || '—'}</Text>
              </View>
              <View style={styles.milestoneRow}>
                <Text style={styles.milestoneKey}>Montant</Text>
                <Text style={styles.milestoneVal}>{formatMoney(tranche.amountTtc)} TTC</Text>
              </View>
              <Text style={styles.milestoneCondition}>Modalité : {tranche.condition}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.articleHeading}>Article 4 : Droit d'auteur, propriété intellectuelle &amp; référence</Text>
        <Text style={styles.paragraph}>
          4.1. Conformément à la législation algérienne (Ordonnance n° 03-05), les créations, designs et codes
          sources demeurent la propriété exclusive d'OMADA jusqu'à encaissement effectif de 100% du prix convenu.
        </Text>
        <Text style={styles.paragraph}>
          4.2. OMADA se réserve le droit de citer la prestation et d'afficher les réalisations à titre de
          référence dans ses supports de communication et portfolio professionnel.
        </Text>

        <Text style={styles.articleHeading}>Article 5 : Confidentialité &amp; juridiction compétente</Text>
        <Text style={styles.paragraph}>
          Les parties s'engagent au respect de la confidentialité des données techniques et commerciales. En cas
          de litige non résolu par voie amiable, compétence exclusive est attribuée au Tribunal de commerce de
          Sétif.
        </Text>

        <Text style={[styles.paragraph, { marginTop: 10 }]}>
          Fait à Sétif, en deux (02) exemplaires originaux, le {formatDateFr(issueDate)}.
        </Text>

        <View style={styles.signaturesRow}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Pour le Client :</Text>
            <Text style={styles.signatureSub}>(Nom, Qualité &amp; Cachet)</Text>
            <View style={styles.signatureLine} />
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Pour OMADA :</Text>
            <Text style={styles.signatureSub}>(Direction Générale &amp; Cachet)</Text>
            <View style={styles.signatureLine} />
          </View>
        </View>

        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>{omada.name} — Contrat {contractRef}</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
