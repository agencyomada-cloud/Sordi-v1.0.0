import {
  resolveHtmlInvoiceData,
  resolveLegalFields,
  getCompanyPhones,
  formatPhone,
  formatCurrency,
} from "./invoiceHtmlShared";
import { InteractiveStampZone } from "./InteractiveStampZone";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { PaidWatermark } from "./PaidWatermark";
import { getContrastTextColor } from "@/lib/colorContrast";
import type { InvoiceAppearanceConfig } from "@/components/pdf/invoiceAppearance";

interface Props {
  invoice: any;
  stampSize?: number;
  onStampSizeChange?: (size: number) => void;
  onStampSizeCommit?: (size: number) => void;
}

export function InvoiceReadOnlyStructure({
  invoice,
  settings,
  appearance,
  stampSize,
  onStampSizeChange,
  onStampSizeCommit,
}: Props & { settings: any; appearance: InvoiceAppearanceConfig }) {
  // Sourced from the shared resolver (same one pdfGenerator.ts consumes),
  // not re-derived independently from `settings` — the whole point of
  // that resolver is that this canvas, the editor, and the exported PDF
  // can never quietly disagree on what "the invoice's color" is.
  const primaryColor = appearance.primaryColor;
  const fontFamily = `'${appearance.fontFamily}', sans-serif`;
  const data = resolveHtmlInvoiceData(invoice);
  const phones = getCompanyPhones(settings);
  const legalFields = resolveLegalFields(settings);

  return (
    <div id="invoice-preview">
      {data.pages.map((pageItems, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === data.pages.length - 1;

        return (
          <div
            key={pageIndex}
            id={`invoice-preview-page-${pageIndex + 1}`}
            className="a4 relative bg-white dark:bg-white text-black font-sans mx-auto select-text border border-border/80 dark:border-neutral-700 shadow-md rounded-[2px] print:border-none print:shadow-none print:m-0 mb-8"
            style={{ width: '210mm', height: '297mm', position: 'relative', overflow: 'hidden', backgroundColor: '#ffffff', fontFamily }}
          >
            {isFirstPage && <InvoiceStatusBadge status={invoice.status} />}
            {isFirstPage && invoice.status === "paid" && <PaidWatermark />}
            <header className="absolute top-0 left-0 w-full h-[33.9mm] bg-white z-10">
              <div className="absolute top-0 left-0 w-[50%] h-[25.7mm] pt-[3mm] pl-[5mm] flex flex-col items-start gap-1">
                {settings?.logo_data && (
                  <img
                    src={settings.logo_data}
                    style={{ maxHeight: appearance.logoHeight, maxWidth: 180 }}
                    className="h-auto w-auto object-contain object-left"
                    alt="Logo"
                  />
                )}
                {/* No logo uploaded — collapse to empty space. This is a
                    finished, issued document; an "Ajoutez votre logo"
                    upload prompt or a dashed placeholder box has no
                    business rendering on it. */}
              </div>

              {/* Only shown alongside a real logo — this badge IS the
                  header's one company-name display when there's no logo to
                  pair it with, so showing it there too would just repeat
                  the typographic fallback above it. */}
              {settings?.logo_data && settings?.company_name && (
                <div
                  className="absolute right-0 bottom-0 w-[71.5mm] h-[7.8mm] flex items-center justify-center px-[5mm] text-[8.5pt] font-bold leading-none whitespace-nowrap text-white z-2 tracking-wide uppercase"
                  style={{ backgroundColor: primaryColor }}
                >
                  {settings.company_name}
                </div>
              )}
            </header>

            <main className="absolute left-0 top-[33.9mm] w-full h-[229.8mm] overflow-hidden bg-white">
              {settings?.body_pattern_data && (
                <div className="absolute inset-0 w-full h-full bg-white z-0 overflow-hidden">
                  <img src={settings.body_pattern_data} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />
                </div>
              )}

              <div className="relative w-full h-full z-1 px-[4mm] pt-[5mm] pb-[2mm] flex flex-col justify-between">
                <div>
                  <div className="text-center mb-4">
                    <h1 className="text-lg font-semibold tracking-[-0.02em] uppercase text-gray-800">{data.docTitle}</h1>
                  </div>

                  <div className="flex justify-between items-start mb-6 text-xs">
                    <div className="w-[55%] space-y-1">
                      <div className="text-gray-400 text-[10px] font-semibold tracking-wider uppercase">Destinataire</div>
                      <div className="font-extrabold text-sm text-black uppercase">{data.clientName}</div>
                      {data.clientAddress && <div className="text-gray-700 uppercase text-[11px] font-semibold">{data.clientAddress}</div>}
                      <div className="space-y-0.5 pt-1 text-[11px] font-mono text-gray-500 leading-relaxed uppercase">
                        {data.clientRc && <div><span className="font-semibold text-gray-700">RC:</span> {data.clientRc}</div>}
                        {data.clientNif && <div><span className="font-semibold text-gray-700">NIF:</span> {data.clientNif}</div>}
                        {data.clientAi && <div><span className="font-semibold text-gray-700">AI:</span> {data.clientAi}</div>}
                        {data.clientNis && <div><span className="font-semibold text-gray-700">NIS:</span> {data.clientNis}</div>}
                        {data.clientActivite && <div><span className="font-semibold text-gray-700">Activité:</span> {data.clientActivite}</div>}
                        {data.clientContact && <div><span className="font-semibold text-gray-700">Contact:</span> {data.clientContact}</div>}
                      </div>
                    </div>

                    <div className="w-[35%] text-xs space-y-1.5 pt-1">
                      <div className="flex justify-between items-center border-b border-gray-100 pb-0.5">
                        <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Numéro</span>
                        <span className="font-mono tabular-nums tracking-tight font-semibold uppercase text-black">{invoice.invoice_number || "-"}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-100 pb-0.5">
                        <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Date d'émission</span>
                        <span className="font-mono tabular-nums tracking-tight text-black">{invoice.invoice_date || "-"}</span>
                      </div>
                      {!data.isProforma && !data.isCreditNote && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-0.5">
                          <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Échéance</span>
                          <span className="font-mono tabular-nums tracking-tight text-black">{invoice.due_date || "-"}</span>
                        </div>
                      )}
                      {!data.isProforma && !data.isCreditNote && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-0.5">
                          <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Mode de paiement</span>
                          <span className="font-mono tracking-tight uppercase text-black">{invoice.payment_method || "Chèque"}</span>
                        </div>
                      )}
                      {data.isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                        <div className="mt-2 text-xs font-semibold text-gray-500 text-right">
                          Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-6">
                    <table className="w-full border-collapse text-xs table-fixed">
                      <thead>
                        <tr style={{ backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) }}>
                          <th className="py-2 px-2 text-left w-[42%] text-[11px] font-medium tracking-wider uppercase">Désignation / Prestation</th>
                          <th className="py-2 px-2 text-right w-[15%] text-[11px] font-medium tracking-wider uppercase">P.U (HT)</th>
                          <th className="py-2 px-2 text-right w-[7%] text-[11px] font-medium tracking-wider uppercase">Qté</th>
                          <th className="py-2 px-2 text-center w-[16%] text-[11px] font-medium tracking-wider uppercase">U.M</th>
                          <th className="py-2 px-2 text-right w-[20%] text-[11px] font-medium tracking-wider uppercase">Total HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((item: any, index: number) => {
                          const unit = item.products?.unit || item.unit || "TN";
                          const quantityVal = Number(item.quantity || 0);
                          const formattedQty = Number.isInteger(quantityVal) ? quantityVal.toString() : quantityVal.toFixed(2);

                          return (
                            <tr key={index} className="border-b border-gray-200">
                              <td className="py-2.5 font-semibold uppercase align-top">{item.product_name || item.products?.name || ""}</td>
                              <td className="py-2.5 text-right align-top font-mono tabular-nums tracking-tight whitespace-nowrap min-w-[130px]">{formatCurrency(item.unit_price)}</td>
                              <td className="py-2.5 text-right align-top font-mono tabular-nums tracking-tight whitespace-nowrap">{formattedQty}</td>
                              <td className="py-2.5 text-center align-top uppercase text-gray-500 text-[10px] leading-tight break-words">{unit}</td>
                              <td className="py-2.5 text-right align-top font-mono tabular-nums tracking-tight font-semibold whitespace-nowrap min-w-[130px]">{formatCurrency((item.quantity || 0) * (item.unit_price || 0))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {isLastPage && (
                    <>
                      <div className="flex justify-end mb-4">
                        <div className="w-[42%] text-xs">
                          <div className="flex justify-between py-1.5">
                            <span className="text-gray-500">Total HT</span>
                            <span className="font-mono tabular-nums tracking-tight">{formatCurrency(invoice.subtotal_ht || 0)}</span>
                          </div>
                          {invoice.tax_mode !== 'exempt' && (
                            <div className="flex justify-between py-1.5">
                              <span className="text-gray-500">TVA (19%)</span>
                              <span className="font-mono tabular-nums tracking-tight text-gray-500">{formatCurrency(invoice.tva_amount || 0)}</span>
                            </div>
                          )}
                          {(invoice.timbre > 0 || (invoice.payment_method?.toLowerCase().includes("espèce") && invoice.timbre !== 0)) && (
                            <div className="flex justify-between py-1.5">
                              <span className="text-gray-500">Timbre Fiscal</span>
                              <span className="font-mono tabular-nums tracking-tight text-gray-500">{formatCurrency(invoice.timbre || 0)}</span>
                            </div>
                          )}
                          {(invoice.discount > 0 || invoice.discount_value > 0) && (
                            <div className="flex justify-between py-1.5 text-red-700">
                              <span>Remise</span>
                              <span className="font-mono tabular-nums tracking-tight">-{formatCurrency(invoice.discount || invoice.discount_value)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-gray-300">
                            <span className="text-sm font-semibold text-black">{data.isCreditNote ? "Net à déduire" : "Total TTC"}</span>
                            <span className="text-base font-bold font-mono tabular-nums tracking-tight text-black">{formatCurrency(invoice.total_ttc || 0)}</span>
                          </div>
                          {invoice.tax_mode === 'exempt' && (
                            <div className="text-right text-[9px] text-gray-500 mt-1">
                              Régime d'exonération / Facturation sans TVA — Montant Net à Payer HT - TVA non applicable
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="mb-3">
                          <div className="text-gray-400 text-[10px] font-semibold tracking-wider uppercase">Arrêté la présente facture à la somme de</div>
                          <div className="mt-1 font-semibold text-xs text-black uppercase tracking-tight">{data.wordsFrench}</div>
                        </div>

                        <div className="flex justify-end items-start">
                          <div className="mr-8 flex flex-col items-center">
                            <InteractiveStampZone
                              settings={settings}
                              stampSize={stampSize}
                              onStampSizeChange={onStampSizeChange}
                              onStampSizeCommit={onStampSizeCommit}
                              showTitle={Boolean(settings?.stamp_data || settings?.signature_data)}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="text-center font-bold text-xs">{pageIndex + 1}</div>
              </div>
            </main>

            <footer className="absolute left-0 bottom-0 w-full h-[33.3mm] bg-white border-t-[0.3mm] border-[#222222] z-10" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <div className="absolute left-[2mm] right-[2mm] top-[3.5mm] bottom-[2mm] grid grid-cols-[66mm_69mm_1fr] gap-x-[2mm]">
                <section className="flex flex-col justify-end h-full">
                  <div className="relative pl-[4.2mm]">
                    <div className="absolute left-0 top-[0.5mm] bottom-[0.5mm] w-[0.75mm]" style={{ backgroundColor: primaryColor }} />
                    {legalFields.map((f, i) => (
                      <div key={i} className="grid grid-cols-[28.5mm_3mm_1fr] min-h-[4.25mm] text-[7.1pt] leading-[1.15] whitespace-nowrap">
                        <span className="font-bold">{f.label}</span>
                        <span className="font-bold text-center">:</span>
                        <span>{f.value}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="text-[7.1pt] leading-[1.3] h-full flex flex-col justify-end pb-[1mm]">
                  {settings?.company_address && <div className="mb-[2.8mm] font-bold">Adresse: {settings.company_address}</div>}
                  {settings?.company_rib && (
                    <div>
                      <strong>RIB:</strong> {settings.company_rib}
                      {settings?.company_bank_agency && <><br />{settings.company_bank_agency}</>}
                    </div>
                  )}
                </section>

                <section className="relative h-full">
                  <div className="absolute bottom-0 left-0 w-full">
                    <div className="pt-[0.1mm] text-[7.1pt] leading-[1.65] whitespace-nowrap flex flex-col justify-end">
                      {settings?.company_email && <div className="font-bold">{settings.company_email}</div>}
                      {settings?.company_website && <div>{settings.company_website}</div>}
                      {phones.map((p, i) => <div key={i}>{formatPhone(p)}</div>)}
                    </div>
                  </div>
                </section>
              </div>
            </footer>
          </div>
        );
      })}
    </div>
  );
}
