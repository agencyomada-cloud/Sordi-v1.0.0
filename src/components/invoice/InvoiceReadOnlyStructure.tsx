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

export function InvoiceReadOnlyStructure({ invoice, settings }: Props & { settings: any }) {
  const primaryColor = settings?.primary_color || "#476CFF";
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
            className="a4 relative bg-white text-black font-sans mx-auto shadow-lg print:border-none print:shadow-none print:m-0 mb-8"
            style={{ width: '210mm', height: '297mm', position: 'relative', overflow: 'hidden', backgroundColor: '#ffffff' }}
          >
            <header className="absolute top-0 left-0 w-full h-[33.9mm] bg-white z-10">
              {settings?.logo_data && (
                <div className="absolute top-0 left-0 w-[50%] h-[25.7mm] pt-[5mm] pb-[5mm] pl-[5mm] pr-0 flex items-center justify-start">
                  <img src={settings.logo_data} className="block w-full h-full object-contain object-left" alt={settings?.company_name || ""} />
                </div>
              )}

              {settings?.company_name && (
                <div
                  className="absolute right-0 bottom-0 w-[71.5mm] h-[7.8mm] flex items-center justify-center px-[5mm] text-[8.5pt] font-bold leading-none whitespace-nowrap text-white z-2 tracking-wide uppercase"
                  style={{ backgroundColor: primaryColor, fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {settings.company_name}
                </div>
              )}

              <div className="absolute left-0 right-0 bottom-0 h-[0.45mm] z-1" style={{ backgroundColor: primaryColor }} />
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
                    <h1 className="text-xl font-extrabold uppercase text-gray-800 tracking-wider">{data.docTitle}</h1>
                  </div>

                  <div className="flex justify-between items-start mb-6 text-xs">
                    <div className="w-[55%] space-y-1">
                      <div className="text-gray-500 text-[11px] font-medium uppercase">Destinataire</div>
                      <div className="font-extrabold text-sm text-black uppercase">{data.clientName}</div>
                      {data.clientAddress && <div className="text-gray-700 uppercase text-[11px] font-semibold">{data.clientAddress}</div>}
                      <div className="space-y-0.5 pt-1 text-[11px] text-gray-700 uppercase">
                        {data.clientRc && <div><span className="font-bold">RC:</span> {data.clientRc}</div>}
                        {data.clientNif && <div><span className="font-bold">NIF:</span> {data.clientNif}</div>}
                        {data.clientAi && <div><span className="font-bold">AI:</span> {data.clientAi}</div>}
                        {data.clientNis && <div><span className="font-bold">NIS:</span> {data.clientNis}</div>}
                        {data.clientActivite && <div><span className="font-bold">Activité:</span> {data.clientActivite}</div>}
                        {data.clientContact && <div><span className="font-bold">Contact:</span> {data.clientContact}</div>}
                      </div>
                    </div>

                    <div className="w-[35%] text-xs pt-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-black">Date:</span>
                        <span>{invoice.invoice_date || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-black">Numéro:</span>
                        <span className="font-bold text-black uppercase">{invoice.invoice_number || "-"}</span>
                      </div>
                      {data.isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                        <div className="mt-2 text-xs font-bold text-gray-700 text-right">
                          Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-6">
                    <table className="w-full border-collapse border border-gray-300 text-xs">
                      <thead>
                        <tr style={{ backgroundColor: primaryColor }} className="text-white font-bold border-b border-gray-300">
                          <th className="border border-gray-300 p-2 text-center w-[45%] uppercase">Désignation</th>
                          <th className="border border-gray-300 p-2 text-right uppercase">P.U</th>
                          <th className="border border-gray-300 p-2 text-right uppercase">Quantité</th>
                          <th className="border border-gray-300 p-2 text-center uppercase">U/M</th>
                          <th className="border border-gray-300 p-2 text-right uppercase">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((item: any, index: number) => {
                          const unit = item.products?.unit || item.unit || "TN";
                          const quantityVal = Number(item.quantity || 0);
                          const formattedQty = Number.isInteger(quantityVal) ? quantityVal.toString() : quantityVal.toFixed(2);

                          return (
                            <tr key={index} className="border-b border-gray-300">
                              <td className="border border-gray-300 p-2 font-bold uppercase">{item.product_name || item.products?.name || ""}</td>
                              <td className="border border-gray-300 p-2 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                              <td className="border border-gray-300 p-2 text-right font-mono">{formattedQty}</td>
                              <td className="border border-gray-300 p-2 text-center uppercase font-semibold">{unit}</td>
                              <td className="border border-gray-300 p-2 text-right font-mono">{formatCurrency((item.quantity || 0) * (item.unit_price || 0))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {isLastPage && (
                    <>
                      <div className="flex justify-end mb-4">
                        <div className="w-[42%] border border-gray-300 text-xs">
                          <div className="flex justify-between p-1.5 border-b border-gray-300 font-bold">
                            <span>Total HT</span>
                            <span className="font-mono">{formatCurrency(invoice.subtotal_ht || 0)}</span>
                          </div>
                          <div className="flex justify-between p-1.5 border-b border-gray-300 font-bold">
                            <span>Total TVA</span>
                            <span className="font-mono">{formatCurrency(invoice.tva_amount || 0)}</span>
                          </div>
                          {(invoice.timbre > 0 || (invoice.payment_method?.toLowerCase().includes("espèce") && invoice.timbre !== 0)) && (
                            <div className="flex justify-between p-1.5 border-b border-gray-300 font-bold">
                              <span>Droit de Timbre</span>
                              <span className="font-mono">{formatCurrency(invoice.timbre || 0)}</span>
                            </div>
                          )}
                          {(invoice.discount > 0 || invoice.discount_value > 0) && (
                            <div className="flex justify-between p-1.5 border-b border-gray-300 text-red-700 font-bold">
                              <span>Remise</span>
                              <span className="font-mono">-{formatCurrency(invoice.discount || invoice.discount_value)}</span>
                            </div>
                          )}
                          <div className="flex justify-between p-1.5 font-bold bg-gray-50">
                            <span>{data.isCreditNote ? "Net à déduire" : "Total TTC"}</span>
                            <span className="font-mono">{formatCurrency(invoice.total_ttc || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="mb-3 text-[11px] text-gray-800">
                          ARRÊTÉ LA PRÉSENTE FACTURE À LA SOMME DE :
                          <div className="mt-1 font-extrabold text-xs text-black uppercase tracking-wide">{data.wordsFrench}</div>
                        </div>

                        <div className="flex justify-between items-start">
                          {!data.isProforma && !data.isCreditNote && (
                            <div className="text-xs text-black font-bold">
                              Mode de paiement: <span className="font-normal uppercase">{invoice.payment_method || "Chèque"}</span>
                            </div>
                          )}
                          <div className="mr-8 font-bold text-xs underline flex flex-col items-center">
                            Cachet et Signature
                            {settings?.stamp_data && (
                              <img src={settings.stamp_data} alt="Cachet" style={{ height: settings.stamp_size ? `${settings.stamp_size}px` : "70px", marginTop: '4px' }} className="object-contain" />
                            )}
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
                  {(settings?.footer_logo_data || settings?.company_name) && (
                    <div className="absolute top-0 left-0 h-[8mm] w-[43mm] flex items-center">
                      {settings?.footer_logo_data ? (
                        <img src={settings.footer_logo_data} alt="Footer Logo" className="h-full w-full object-contain object-left" />
                      ) : (
                        <span className="font-extrabold text-[9pt] text-black tracking-tight uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{settings.company_name}</span>
                      )}
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 w-full grid grid-cols-[20mm_1fr] gap-x-[2.5mm]">
                    {settings?.qr_code_data && (
                      <div className="w-[18mm] h-[18mm] flex items-center justify-center overflow-hidden">
                        <img src={settings.qr_code_data} alt="QR Code" className="w-full h-full object-contain" />
                      </div>
                    )}

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
