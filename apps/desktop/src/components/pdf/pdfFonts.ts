// Centralized @react-pdf/renderer font registration — imported once, as a
// side effect, by every PDF document component (`import "./pdfFonts";`)
// instead of each one repeating its own `Font.register` calls.
//
// These used to fetch every glyph from fonts.gstatic.com at PDF-generation
// time — a real network dependency in an app whose whole premise is
// local-first/offline. The files below are the exact same four body faces
// (Montserrat, Inter, Poppins, Roboto) plus the fixed JetBrains Mono
// numeric face, bundled locally from the @fontsource packages already a
// project dependency, and resolved to a local build asset URL by Vite's
// `?url` suffix — so `Font.register` never issues an HTTP request, in dev
// or in the packaged app.
import { Font } from '@react-pdf/renderer';

import montserratRegular from '@/assets/fonts/pdf/Montserrat-Regular.woff?url';
import montserratBold from '@/assets/fonts/pdf/Montserrat-Bold.woff?url';
import interRegular from '@/assets/fonts/pdf/Inter-Regular.woff?url';
import interBold from '@/assets/fonts/pdf/Inter-Bold.woff?url';
import poppinsRegular from '@/assets/fonts/pdf/Poppins-Regular.woff?url';
import poppinsBold from '@/assets/fonts/pdf/Poppins-Bold.woff?url';
import robotoRegular from '@/assets/fonts/pdf/Roboto-Regular.woff?url';
import robotoBold from '@/assets/fonts/pdf/Roboto-Bold.woff?url';
import jetbrainsMonoRegular from '@/assets/fonts/pdf/JetBrainsMono-Regular.woff?url';
import jetbrainsMonoSemiBold from '@/assets/fonts/pdf/JetBrainsMono-SemiBold.woff?url';
import jetbrainsMonoBold from '@/assets/fonts/pdf/JetBrainsMono-Bold.woff?url';
import spaceGroteskRegular from '@/assets/fonts/pdf/SpaceGrotesk-Regular.woff?url';
import spaceGroteskBold from '@/assets/fonts/pdf/SpaceGrotesk-Bold.woff?url';

// The four selectable document fonts (Paramètres > Thème de la facture PDF >
// Police) — all registered up front; react-pdf only actually fetches the
// family a given Text style references, so registering all four here costs
// nothing beyond bookkeeping. Keep in sync with INVOICE_PDF_FONTS.
Font.register({
  family: 'Montserrat',
  fonts: [
    { src: montserratRegular },
    { src: montserratBold, fontWeight: 'bold' },
  ]
});
Font.register({
  family: 'Inter',
  fonts: [
    { src: interRegular },
    { src: interBold, fontWeight: 'bold' },
  ]
});
Font.register({
  family: 'Poppins',
  fonts: [
    { src: poppinsRegular },
    { src: poppinsBold, fontWeight: 'bold' },
  ]
});
Font.register({
  family: 'Roboto',
  fonts: [
    { src: robotoRegular },
    { src: robotoBold, fontWeight: 'bold' },
  ]
});
// Fixed monospace face for all numeric/fiscal data (unit prices, quantities,
// VAT, dates, invoice IDs, RC/NIF/AI/NIS) — not user-selectable like the
// four body fonts above, always JetBrains Mono per the Swiss-minimalist
// numeric-scale spec.
Font.register({
  family: 'JetBrains Mono',
  fonts: [
    { src: jetbrainsMonoRegular },
    { src: jetbrainsMonoSemiBold, fontWeight: 'semibold' },
    { src: jetbrainsMonoBold, fontWeight: 'bold' },
  ]
});
// Used by the payroll/paie summary PDFs (PayrollPDFDocument,
// CumulativesPDFDocument) — a distinct display face from the four
// selectable body fonts above.
Font.register({
  family: 'Space Grotesk',
  fonts: [
    { src: spaceGroteskRegular },
    { src: spaceGroteskBold, fontWeight: 'bold' },
  ]
});
