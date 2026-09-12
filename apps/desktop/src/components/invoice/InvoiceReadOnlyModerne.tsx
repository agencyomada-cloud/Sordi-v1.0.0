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

export function InvoiceReadOnlyModerne({
  invoice,
  settings,
  appearance,
  stampSize,
  onStampSizeChange,
  onStampSizeCommit,
}: Props & { settings: any; appearance: InvoiceAppearanceConfig }) {
  // Sourced from the shared resolver (same one pdfGenerator.ts consumes),
  // not re-derived independently from `settings`.
  const accent = appearance.primaryColor;
  const fontFamily = `'${appearance.fontFamily}', sans-serif`;
  const headerTextColor = getContrastTextColor(accent);
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
            className="a4 relative bg-white dark:bg-white text-[#111827] mx-auto select-text border border-border/80 dark:border-neutral-700 shadow-md rounded-[2px] print:border-none print:shadow-none print:m-0 mb-8"
            style={{ width: '210mm', height: '297mm', boxSizing: 'border-box', overflow: 'hidden', fontFamily }}
          >
            {isFirstPage && <InvoiceStatusBadge status={invoice.status} />}
            {isFirstPage && invoice.status === "paid" && <PaidWatermark />}
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center px-[14mm] py-[9mm]" style={{ backgroundColor: accent }}>
                <div className="flex flex-col items-start gap-1.5">
                  {settings?.logo_data && (
                    <div className="bg-white rounded-lg px-3 py-2 inline-block max-w-[188px]">
                      <img
                        src={settings.logo_data}
                        style={{ maxHeight: appearance.logoHeight, maxWidth: 180 }}
                        className="h-auto w-auto object-contain"
                        alt="Logo"
                      />
                    </div>
                  )}
                  {/* No logo uploaded — collapse to empty space on an
                      issued document, no upload prompt or placeholder card. */}
                </div>
                <div className="text-right">
                  <div className="text-white text-[13pt] font-semibold tracking-[-0.02em] uppercase">{data.docTitle}</div>
                  <div className="text-white/75 text-[8.5pt] mt-1.5 font-mono tabular-nums tracking-tight">N° {invoice.invoice_number || "-"} · {invoice.invoice_date || "-"}</div>
                </div>
              </div>

              <div className="flex-1 px-[14mm] py-[9mm] flex flex-col justify-between overflow-hidden">
                <div>
                  <div className="flex gap-3 mb-5">
                    <div className="flex-1 bg-gray-50 rounded-[10px] p-3.5">
                      <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Destinataire</div>
                      <div className="text-[10.5pt] font-bold uppercase mb-1">{data.clientName}</div>
                      {data.clientAddress && <div className="text-[8pt] text-gray-600 mb-1">{data.clientAddress}</div>}
                      <div className="font-mono text-[7.5pt] text-gray-500 leading-relaxed space-y-0.5">
                        {data.clientRc && <div>RC {data.clientRc}</div>}
                        {data.clientNif && <div>NIF {data.clientNif}</div>}
                        {data.clientAi && <div>AI {data.clientAi}</div>}
                        {data.clientNis && <div>NIS {data.clientNis}</div>}
                      </div>
                      {data.clientActivite && <div className="text-[8pt] text-gray-600 mt-0.5">{data.clientActivite}</div>}
                      {data.clientContact && <div className="text-[8pt] text-gray-600">{data.clientContact}</div>}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-[10px] p-3.5">
                      <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Détails du document</div>
                      <div className="flex justify-between text-[8pt] mb-1"><span className="text-gray-500">Date d'émission</span><span className="font-mono tabular-nums tracking-tight font-semibold">{invoice.invoice_date || "-"}</span></div>
                      <div className="flex justify-between text-[8pt] mb-1"><span className="text-gray-500">Numéro</span><span className="font-mono tabular-nums tracking-tight font-semibold">{invoice.invoice_number || "-"}</span></div>
                      {!data.isProforma && !data.isCreditNote && (
                        <div className="flex justify-between text-[8pt] mb-1"><span className="text-gray-500">Échéance</span><span className="font-mono tabular-nums tracking-tight font-semibold">{invoice.due_date || "-"}</span></div>
                      )}
                      {!data.isProforma && !data.isCreditNote && (
                        <div className="flex justify-between text-[8pt]"><span className="text-gray-500">Mode de paiement</span><span className="font-mono tracking-tight font-semibold">{invoice.payment_method || "Chèque"}</span></div>
                      )}
                      {data.isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                        <div className="text-[7.5pt] text-gray-500 mt-1.5">
                          Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[10px] overflow-hidden mb-5" style={{ border: `0.75px solid ${accent}30` }}>
                    <table className="w-full text-[8.5pt] table-fixed" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: accent }}>
                          <th className="text-left px-2.5 py-1.5 w-[42%] text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: headerTextColor }}>Désignation / Prestation</th>
                          <th className="text-right px-2.5 py-1.5 w-[15%] text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: headerTextColor }}>P.U (HT)</th>
                          <th className="text-right px-2.5 py-1.5 w-[7%] text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: headerTextColor }}>Qté</th>
                          <th className="text-center px-2.5 py-1.5 w-[16%] text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: headerTextColor }}>U.M</th>
                          <th className="text-right px-2.5 py-1.5 w-[20%] text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: headerTextColor }}>Total HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((item: any, index: number) => {
                          const unit = item.products?.unit || item.unit || "TN";
                          const quantityVal = Number(item.quantity || 0);
                          const formattedQty = Number.isInteger(quantityVal) ? quantityVal.toString() : quantityVal.toFixed(2);
                          return (
                            <tr key={index} className={index % 2 === 1 ? "bg-gray-50/70" : ""}>
                              <td className="px-2.5 py-2 font-bold">{item.product_name || item.products?.name || ""}</td>
                              <td className="px-2.5 py-2 text-right text-gray-600 font-mono tabular-nums tracking-tight whitespace-nowrap min-w-[130px]">{formatCurrency(item.unit_price)}</td>
                              <td className="px-2.5 py-2 text-right text-gray-600 font-mono tabular-nums tracking-tight whitespace-nowrap">{formattedQty}</td>
                              <td className="px-2.5 py-2 text-center text-gray-500 text-[7.5pt] uppercase leading-tight break-words">{unit}</td>
                              <td className="px-2.5 py-2 text-right text-gray-900 font-mono tabular-nums tracking-tight font-semibold whitespace-nowrap min-w-[130px]">{formatCurrency((item.quantity || 0) * (item.unit_price || 0))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {isLastPage && (
                    <>
                      <div className="flex justify-end mb-5">
                        <div className="w-[46%] bg-gray-50 rounded-[10px] p-3">
                          <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">Total HT</span><span className="font-mono tabular-nums tracking-tight">{formatCurrency(invoice.subtotal_ht || 0)}</span></div>
                          {invoice.tax_mode !== 'exempt' && (
                            <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">TVA (19%)</span><span className="font-mono tabular-nums tracking-tight text-gray-500">{formatCurrency(invoice.tva_amount || 0)}</span></div>
                          )}
                          {(invoice.timbre > 0 || (invoice.payment_method?.toLowerCase().includes("espèce") && invoice.timbre !== 0)) && (
                            <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">Timbre Fiscal</span><span className="font-mono tabular-nums tracking-tight text-gray-500">{formatCurrency(invoice.timbre || 0)}</span></div>
                          )}
                          {(invoice.discount > 0 || invoice.discount_value > 0) && (
                            <div className="flex justify-between py-0.5 text-[8.5pt] text-red-700"><span>Remise</span><span className="font-mono tabular-nums tracking-tight">-{formatCurrency(invoice.discount || invoice.discount_value)}</span></div>
                          )}
                          <div className="flex justify-between rounded-lg px-2.5 py-1.5 mt-1.5" style={{ backgroundColor: accent }}>
                            <span className="text-[9.5pt] font-bold text-white">{data.isCreditNote ? "Net à déduire" : "Total TTC"}</span>
                            <span className="text-[11pt] font-mono tabular-nums tracking-tight font-bold text-white">{formatCurrency(invoice.total_ttc || 0)}</span>
                          </div>
                          {invoice.tax_mode === 'exempt' && (
                            <div className="text-right text-[7.5pt] text-gray-500 mt-1">
                              Régime d'exonération / Facturation sans TVA — Montant Net à Payer HT - TVA non applicable
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mb-5">
                        <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Arrêté la présente facture à la somme de</div>
                        <div className="text-[8.5pt] text-gray-700 uppercase leading-relaxed">{data.wordsFrench}</div>
                      </div>

                      {/* Mode de paiement now lives in the "Détails du document"
                          box above alongside Date/Numéro — this row just
                          anchors the signature block to the right. */}
                      <div className="flex justify-end items-end">
                        <div className="flex flex-col items-center relative" style={{ minWidth: "160px" }}>
                          {(settings?.stamp_data || settings?.signature_data) && (
                            <>
                              <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide">Cachet et signature</div>
                              <div className="w-full h-px bg-gray-300 mt-1 mb-2" />
                            </>
                          )}
                          <InteractiveStampZone
                            settings={settings}
                            stampSize={stampSize}
                            onStampSizeChange={onStampSizeChange}
                            onStampSizeCommit={onStampSizeCommit}
                            showTitle={false}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-2 mt-2 flex justify-between" style={{ borderTop: `1.5px solid ${accent}` }}>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 max-w-[300px]">
                    {legalFields.map((f, i) => (
                      <span key={i} className="text-[6.8pt] text-gray-500"><span className="font-bold text-gray-700">{f.label}</span> {f.value}</span>
                    ))}
                    {settings?.company_address && <span className="text-[6.8pt] text-gray-500 basis-full">{settings.company_address}</span>}
                    {settings?.company_rib && <span className="text-[6.8pt] text-gray-500 basis-full">RIB {settings.company_rib}</span>}
                  </div>
                  <div className="text-right">
                    {settings?.company_email && <div className="text-[6.8pt] text-gray-500">{settings.company_email}</div>}
                    {settings?.company_website && <div className="text-[6.8pt] text-gray-500">{settings.company_website}</div>}
                    {phones.map((p, i) => <div key={i} className="text-[6.8pt] text-gray-500">{formatPhone(p)}</div>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
