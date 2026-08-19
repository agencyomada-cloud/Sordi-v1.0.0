import {
  resolveHtmlInvoiceData,
  resolveLegalFields,
  getCompanyPhones,
  formatPhone,
  formatCurrency,
} from "./invoiceHtmlShared";

interface Props {
  invoice: any;
}

export function InvoiceReadOnlyModerne({ invoice, settings }: Props & { settings: any }) {
  const accent = settings?.primary_color || "#476CFF";
  const data = resolveHtmlInvoiceData(invoice);
  const phones = getCompanyPhones(settings);
  const legalFields = resolveLegalFields(settings);

  return (
    <div id="invoice-preview">
      {data.pages.map((pageItems, pageIndex) => {
        const isLastPage = pageIndex === data.pages.length - 1;

        return (
          <div
            key={pageIndex}
            id={`invoice-preview-page-${pageIndex + 1}`}
            className="a4 relative bg-white text-[#111827] mx-auto shadow-lg print:border-none print:shadow-none print:m-0 mb-8"
            style={{ width: '210mm', height: '297mm', boxSizing: 'border-box', overflow: 'hidden', fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center px-[14mm] py-[9mm]" style={{ backgroundColor: accent }}>
                <div>
                  {settings?.logo_data ? (
                    <div className="bg-white rounded-lg px-3 py-2 inline-block max-w-[160px]">
                      <img src={settings.logo_data} className="h-7 max-w-[136px] object-contain" alt={settings?.company_name || ""} />
                    </div>
                  ) : settings?.company_name ? (
                    <span className="text-white text-[12pt] font-bold">{settings.company_name}</span>
                  ) : null}
                </div>
                <div className="text-right">
                  <div className="text-white text-[16pt] font-bold uppercase tracking-wide">{data.docTitle}</div>
                  <div className="text-white/85 text-[8.5pt] mt-1">N° {invoice.invoice_number || "-"} · {invoice.invoice_date || "-"}</div>
                </div>
              </div>

              <div className="flex-1 px-[14mm] py-[9mm] flex flex-col justify-between overflow-hidden">
                <div>
                  <div className="flex gap-3 mb-5">
                    <div className="flex-1 bg-gray-50 rounded-[10px] p-3.5">
                      <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Destinataire</div>
                      <div className="text-[10.5pt] font-bold uppercase mb-1">{data.clientName}</div>
                      {data.clientAddress && <div className="text-[8pt] text-gray-600">{data.clientAddress}</div>}
                      {data.clientRc && <div className="text-[8pt] text-gray-600">RC {data.clientRc}</div>}
                      {data.clientNif && <div className="text-[8pt] text-gray-600">NIF {data.clientNif}</div>}
                      {data.clientAi && <div className="text-[8pt] text-gray-600">AI {data.clientAi}</div>}
                      {data.clientNis && <div className="text-[8pt] text-gray-600">NIS {data.clientNis}</div>}
                      {data.clientActivite && <div className="text-[8pt] text-gray-600">{data.clientActivite}</div>}
                      {data.clientContact && <div className="text-[8pt] text-gray-600">{data.clientContact}</div>}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-[10px] p-3.5">
                      <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Détails du document</div>
                      <div className="flex justify-between text-[8pt] mb-1"><span className="text-gray-500">Date</span><span className="font-bold">{invoice.invoice_date || "-"}</span></div>
                      <div className="flex justify-between text-[8pt] mb-1"><span className="text-gray-500">Numéro</span><span className="font-bold">{invoice.invoice_number || "-"}</span></div>
                      {!data.isProforma && !data.isCreditNote && (
                        <div className="flex justify-between text-[8pt]"><span className="text-gray-500">Paiement</span><span className="font-bold">{invoice.payment_method || "Chèque"}</span></div>
                      )}
                      {data.isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                        <div className="text-[7.5pt] text-gray-500 mt-1.5">
                          Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[10px] overflow-hidden mb-5" style={{ border: `0.75px solid ${accent}30` }}>
                    <table className="w-full text-[8.5pt]" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: `${accent}14` }}>
                          <th className="text-left px-2.5 py-1.5 text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: accent }}>Désignation</th>
                          <th className="text-right px-2.5 py-1.5 text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: accent }}>P.U</th>
                          <th className="text-right px-2.5 py-1.5 text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: accent }}>Qté</th>
                          <th className="text-center px-2.5 py-1.5 text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: accent }}>U/M</th>
                          <th className="text-right px-2.5 py-1.5 text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: accent }}>Montant</th>
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
                              <td className="px-2.5 py-2 text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                              <td className="px-2.5 py-2 text-right text-gray-600">{formattedQty}</td>
                              <td className="px-2.5 py-2 text-center text-gray-600">{unit}</td>
                              <td className="px-2.5 py-2 text-right text-gray-600">{formatCurrency((item.quantity || 0) * (item.unit_price || 0))}</td>
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
                          <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">Total HT</span><span>{formatCurrency(invoice.subtotal_ht || 0)}</span></div>
                          <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">Total TVA</span><span>{formatCurrency(invoice.tva_amount || 0)}</span></div>
                          {(invoice.timbre > 0 || (invoice.payment_method?.toLowerCase().includes("espèce") && invoice.timbre !== 0)) && (
                            <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">Droit de Timbre</span><span>{formatCurrency(invoice.timbre || 0)}</span></div>
                          )}
                          {(invoice.discount > 0 || invoice.discount_value > 0) && (
                            <div className="flex justify-between py-0.5 text-[8.5pt] text-red-700"><span>Remise</span><span>-{formatCurrency(invoice.discount || invoice.discount_value)}</span></div>
                          )}
                          <div className="flex justify-between rounded-lg px-2.5 py-1.5 mt-1.5" style={{ backgroundColor: accent }}>
                            <span className="text-[9.5pt] font-bold text-white">{data.isCreditNote ? "Net à déduire" : "Total TTC"}</span>
                            <span className="text-[11pt] font-bold text-white">{formatCurrency(invoice.total_ttc || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-5">
                        <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Arrêté la présente facture à la somme de</div>
                        <div className="text-[8.5pt] text-gray-700 uppercase leading-relaxed">{data.wordsFrench}</div>
                      </div>

                      <div className="flex justify-between items-end">
                        {!data.isProforma && !data.isCreditNote ? (
                          <div className="rounded-md px-2.5 py-1.5" style={{ backgroundColor: `${accent}14` }}>
                            <span className="text-[8pt] font-bold" style={{ color: accent }}>{invoice.payment_method || "Chèque"}</span>
                          </div>
                        ) : <div />}
                        <div className="w-[140px] flex flex-col items-center relative">
                          {settings?.stamp_data && (
                            <img src={settings.stamp_data} alt="Cachet" style={{ height: settings.stamp_size ? `${settings.stamp_size}px` : "55px" }} className="object-contain mb-1" />
                          )}
                          <div className="w-full h-px bg-gray-300 mt-6 mb-1" />
                          <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide">Cachet et signature</div>
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
                    {settings?.qr_code_data && <img src={settings.qr_code_data} alt="QR" className="w-[34px] h-[34px] mt-1 ml-auto rounded" />}
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
