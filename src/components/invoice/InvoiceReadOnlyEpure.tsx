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

export function InvoiceReadOnlyEpure({ invoice, settings }: Props & { settings: any }) {
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
            className="a4 relative bg-white text-[#1a1a1a] mx-auto shadow-lg print:border-none print:shadow-none print:m-0 mb-8"
            style={{ width: '210mm', height: '297mm', padding: '14mm', boxSizing: 'border-box', overflow: 'hidden', fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    {settings?.logo_data ? (
                      <img src={settings.logo_data} className="h-10 max-w-[160px] object-contain object-left" alt={settings?.company_name || ""} />
                    ) : settings?.company_name ? (
                      <span className="text-[12pt] font-bold tracking-wide">{settings.company_name}</span>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="text-[17pt] font-bold uppercase tracking-[2px]">{data.docTitle}</div>
                    <div className="text-[9pt] text-gray-500 mt-1">N° {invoice.invoice_number || "-"} · {invoice.invoice_date || "-"}</div>
                  </div>
                </div>
                <div className="h-[1.5px] mb-6" style={{ backgroundColor: accent }} />

                <div className="flex justify-between mb-7">
                  <div className="w-[46%]">
                    <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Destinataire</div>
                    <div className="text-[11pt] font-bold uppercase mb-0.5">{data.clientName}</div>
                    {data.clientAddress && <div className="text-[8.5pt] text-gray-600">{data.clientAddress}</div>}
                    {data.clientRc && <div className="text-[8.5pt] text-gray-600">RC {data.clientRc}</div>}
                    {data.clientNif && <div className="text-[8.5pt] text-gray-600">NIF {data.clientNif}</div>}
                    {data.clientAi && <div className="text-[8.5pt] text-gray-600">AI {data.clientAi}</div>}
                    {data.clientNis && <div className="text-[8.5pt] text-gray-600">NIS {data.clientNis}</div>}
                    {data.clientActivite && <div className="text-[8.5pt] text-gray-600">{data.clientActivite}</div>}
                    {data.clientContact && <div className="text-[8.5pt] text-gray-600">{data.clientContact}</div>}
                  </div>
                  <div className="w-[46%]">
                    <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Détails</div>
                    <div className="flex justify-between text-[8.5pt] mb-1"><span className="text-gray-500">Date</span><span className="font-bold">{invoice.invoice_date || "-"}</span></div>
                    <div className="flex justify-between text-[8.5pt] mb-1"><span className="text-gray-500">Numéro</span><span className="font-bold">{invoice.invoice_number || "-"}</span></div>
                    {!data.isProforma && !data.isCreditNote && (
                      <div className="flex justify-between text-[8.5pt]"><span className="text-gray-500">Paiement</span><span className="font-bold">{invoice.payment_method || "Chèque"}</span></div>
                    )}
                    {data.isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                      <div className="text-[7.5pt] text-gray-500 mt-1 text-right">
                        Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                      </div>
                    )}
                  </div>
                </div>

                <table className="w-full text-[9pt] mb-6" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-t border-b" style={{ borderColor: '#111111' }}>
                      <th className="text-left py-1.5 text-[7.5pt] text-gray-500 uppercase font-normal tracking-wide">Désignation</th>
                      <th className="text-right py-1.5 text-[7.5pt] text-gray-500 uppercase font-normal tracking-wide">P.U</th>
                      <th className="text-right py-1.5 text-[7.5pt] text-gray-500 uppercase font-normal tracking-wide">Qté</th>
                      <th className="text-center py-1.5 text-[7.5pt] text-gray-500 uppercase font-normal tracking-wide">U/M</th>
                      <th className="text-right py-1.5 text-[7.5pt] text-gray-500 uppercase font-normal tracking-wide">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((item: any, index: number) => {
                      const unit = item.products?.unit || item.unit || "TN";
                      const quantityVal = Number(item.quantity || 0);
                      const formattedQty = Number.isInteger(quantityVal) ? quantityVal.toString() : quantityVal.toFixed(2);
                      return (
                        <tr key={index} className="border-b border-gray-200">
                          <td className="py-2">{item.product_name || item.products?.name || ""}</td>
                          <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                          <td className="py-2 text-right">{formattedQty}</td>
                          <td className="py-2 text-center">{unit}</td>
                          <td className="py-2 text-right">{formatCurrency((item.quantity || 0) * (item.unit_price || 0))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {isLastPage && (
                  <>
                    <div className="flex justify-end mb-6">
                      <div className="w-[46%]">
                        <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">Total HT</span><span>{formatCurrency(invoice.subtotal_ht || 0)}</span></div>
                        <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">Total TVA</span><span>{formatCurrency(invoice.tva_amount || 0)}</span></div>
                        {(invoice.timbre > 0 || (invoice.payment_method?.toLowerCase().includes("espèce") && invoice.timbre !== 0)) && (
                          <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">Droit de Timbre</span><span>{formatCurrency(invoice.timbre || 0)}</span></div>
                        )}
                        {(invoice.discount > 0 || invoice.discount_value > 0) && (
                          <div className="flex justify-between py-1 text-[8.5pt] text-red-700"><span>Remise</span><span>-{formatCurrency(invoice.discount || invoice.discount_value)}</span></div>
                        )}
                        <div className="flex justify-between pt-2 mt-1 border-t" style={{ borderColor: '#111111' }}>
                          <span className="text-[10pt] font-bold">{data.isCreditNote ? "Net à déduire" : "Total TTC"}</span>
                          <span className="text-[12pt] font-bold" style={{ color: accent }}>{formatCurrency(invoice.total_ttc || 0)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Arrêté la présente facture à la somme de</div>
                      <div className="text-[8.5pt] text-gray-700 uppercase leading-relaxed">{data.wordsFrench}</div>
                    </div>

                    <div className="flex justify-between items-end mb-4">
                      {!data.isProforma && !data.isCreditNote ? (
                        <div className="text-[8.5pt] text-gray-700" />
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

              <div className="pt-2 border-t border-gray-200 flex justify-between">
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
                  {settings?.qr_code_data && <img src={settings.qr_code_data} alt="QR" className="w-[34px] h-[34px] mt-1 ml-auto" />}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
