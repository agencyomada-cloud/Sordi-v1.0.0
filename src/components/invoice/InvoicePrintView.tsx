import { numberToWords } from "@/lib/numberToWords";
import { useSettings } from "@/hooks/useSettings";
import { chunkItems } from "@/lib/paginationUtils";

interface InvoicePrintViewProps {
  invoice: any;
}

export function InvoicePrintView({ invoice }: InvoicePrintViewProps) {
  const { data: settings } = useSettings();

  const primaryColor = settings?.primary_color || "#FFCC00";

  const formatCurrency = (amount: number | null) => {
    if (!amount && amount !== 0) return "0.00 DZD";
    const formatted = Math.abs(amount).toFixed(2).replace(/\./g, ',');
    const parts = formatted.split(',');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '00';
    const integerWithSpaces = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const sign = amount < 0 ? "-" : "";
    return `${sign}${integerWithSpaces}.${decimalPart} DZD`;
  };

  const isCreditNote = invoice.invoice_type === "credit_note";
  const isProforma = invoice.invoice_type === "proforma";

  const getCompanyPhones = (): string[] => {
    if (!settings?.company_phones && !settings?.company_phone) return [];
    if (settings?.company_phones) {
      if (Array.isArray(settings.company_phones)) return settings.company_phones;
      try {
        const parsed = JSON.parse(settings.company_phones);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        return settings.company_phones.split(/[\n,;]/).map((p: string) => p.trim()).filter(Boolean);
      }
    }
    if (settings?.company_phone) {
      return settings.company_phone.split(/[\n,;]/).map((p: string) => p.trim()).filter(Boolean);
    }
    return [];
  };

  const items = invoice.invoice_items || [];
  const pages = chunkItems(items);

  const getDocTitle = () => {
    if (invoice.custom_title) return invoice.custom_title;
    if (isCreditNote) return "FACTURE D'AVOIR";
    if (isProforma) return "FACTURE PROFORMA";
    return "FACTURE";
  };

  const clientName = invoice.clients?.name || invoice.client_name || "";
  const clientAddress = invoice.use_secondary_register && invoice.selected_secondary_address 
    ? invoice.selected_secondary_address 
    : (invoice.clients?.address || invoice.client_address || "");
  const clientRc = invoice.use_secondary_register && invoice.selected_secondary_rc 
    ? invoice.selected_secondary_rc 
    : (invoice.clients?.rc || invoice.client_rc || "");
  const clientNif = invoice.clients?.nif || invoice.client_nif || "";
  const clientAi = invoice.clients?.ai || invoice.client_ai || "";
  const clientNis = invoice.clients?.nis || invoice.client_nis || "";
  const clientActivite = invoice.clients?.activite || invoice.client_activite || null;
  const clientContact = invoice.clients?.contact || invoice.client_contact || null;

  return (
    <div id="invoice-print-view" className="print:m-0 print:p-0">
      {pages.map((pageItems, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === pages.length - 1;
        const phones = getCompanyPhones();

        return (
          <div
            key={pageIndex}
            className="a4 relative bg-white text-black font-sans mx-auto shadow-lg print:border-none print:shadow-none print:m-0 mb-8"
            style={{
              width: '210mm',
              height: '297mm',
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
              pageBreakAfter: isLastPage ? 'auto' : 'always'
            }}
          >
            {/* HEADER */}
            <header className="absolute top-0 left-0 w-full h-[33.9mm] bg-white z-10">
              <div className="absolute top-0 left-0 w-[50%] h-[25.7mm] pt-[5mm] pb-[5mm] pl-[5mm] pr-0 flex items-center justify-start">
                <img
                  src={settings?.logo_data || "https://i.ibb.co/ymXXbRW8/Layer-1.png"}
                  className="block w-full h-full object-contain object-left"
                  alt={settings?.company_name || "Mobino Adjal Concassage"}
                />
              </div>

              <div
                className="absolute right-0 bottom-0 w-[71.5mm] h-[7.8mm] flex items-center justify-center px-[5mm] text-[8.5pt] font-bold leading-none whitespace-nowrap text-black z-2 tracking-wide uppercase"
                style={{ backgroundColor: primaryColor }}
              >
                {settings?.company_name || "SARL MOBINO ADJAL CONCASSAGE"}
              </div>

              <div
                className="absolute left-0 right-0 bottom-0 h-[0.45mm] z-1"
                style={{ backgroundColor: primaryColor }}
              />
            </header>

            {/* MAIN BODY */}
            <main className="absolute left-0 top-[33.9mm] w-full h-[229.8mm] overflow-hidden bg-white">
              <div className="absolute inset-0 w-full h-full bg-white z-0 overflow-hidden">
                {settings?.body_pattern_data ? (
                  <img
                    src={settings.body_pattern_data}
                    alt="Pattern"
                    className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
                  />
                ) : (
                  <div
                    className="absolute -right-[8mm] -bottom-[2mm] w-[92mm] h-[160mm] opacity-20 pointer-events-none"
                    style={{
                      background: `repeating-linear-gradient(45deg, transparent 0, transparent 13mm, ${primaryColor} 13mm, ${primaryColor} 13.35mm, transparent 13.35mm, transparent 26mm)`
                    }}
                  />
                )}
              </div>

              <div className="relative w-full h-full z-1 px-[8mm] pt-[5mm] pb-[5mm] flex flex-col justify-between">
                <div>
                  <div className="text-center mb-4">
                    <h1 className="text-xl font-extrabold uppercase text-gray-800 tracking-wider">
                      {getDocTitle()}
                    </h1>
                  </div>

                  <div className="flex justify-between items-start mb-6 text-xs">
                    <div className="w-[55%] space-y-1">
                      <div className="text-gray-500 text-[11px] font-medium uppercase">Destinataire</div>
                      <div className="font-extrabold text-sm text-black uppercase">{clientName}</div>
                      {clientAddress && <div className="text-gray-700 uppercase text-[11px] font-semibold">{clientAddress}</div>}
                      
                      <div className="space-y-0.5 pt-1 text-[11px] text-gray-700 uppercase">
                        {clientRc && <div><span className="font-bold">RC:</span> {clientRc}</div>}
                        {clientNif && <div><span className="font-bold">NIF:</span> {clientNif}</div>}
                        {clientAi && <div><span className="font-bold">AI:</span> {clientAi}</div>}
                        {clientNis && <div><span className="font-bold">NIS:</span> {clientNis}</div>}
                        {clientActivite && <div><span className="font-bold">Activité:</span> {clientActivite}</div>}
                        {clientContact && <div><span className="font-bold">Contact:</span> {clientContact}</div>}
                      </div>
                    </div>

                    <div className="w-[35%] text-xs space-y-1.5 pt-1">
                      <div className="flex justify-between border-b border-gray-100 pb-0.5">
                        <span className="font-bold text-black">Date:</span>
                        <span>{invoice.invoice_date || "-"}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 pb-0.5">
                        <span className="font-bold text-black">Numéro:</span>
                        <span className="font-bold text-black uppercase">{invoice.invoice_number || "-"}</span>
                      </div>
                      {isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                        <div className="mt-2 text-xs font-bold text-gray-700 text-right">
                          Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-6">
                    <table className="w-full border-collapse border border-black text-xs">
                      <thead>
                        <tr style={{ backgroundColor: primaryColor }} className="text-black font-bold border-b border-black">
                          <th className="border border-black p-2 text-center w-[45%] uppercase">Désignation</th>
                          <th className="border border-black p-2 text-right uppercase">P.U</th>
                          <th className="border border-black p-2 text-right uppercase">Quantité</th>
                          <th className="border border-black p-2 text-center uppercase">U/M</th>
                          <th className="border border-black p-2 text-right uppercase">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((item: any, index: number) => {
                          const unit = item.products?.unit || item.unit || "TN";
                          const quantityVal = Number(item.quantity || 0);
                          const formattedQty = Number.isInteger(quantityVal)
                            ? quantityVal.toString()
                            : quantityVal.toFixed(2);

                          return (
                            <tr key={index} className="border-b border-black">
                              <td className="border border-black p-2 font-bold uppercase">
                                {item.product_name || item.products?.name || ""}
                                {(item.product_description || item.products?.description || item.description) && (
                                  <div className="font-normal text-[10px] normal-case mt-0.5 text-gray-600">{item.product_description || item.products?.description || item.description}</div>
                                )}
                              </td>
                              <td className="border border-black p-2 text-right font-mono">
                                {formatCurrency(item.unit_price)}
                              </td>
                              <td className="border border-black p-2 text-right font-mono">
                                {formattedQty}
                              </td>
                              <td className="border border-black p-2 text-center uppercase font-semibold">
                                {unit}
                              </td>
                              <td className="border border-black p-2 text-right font-mono">
                                {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {isLastPage && (
                    <>
                      <div className="flex justify-end mb-4">
                        <div className="w-[42%] border border-black text-xs">
                          <div className="flex justify-between p-1.5 border-b border-black font-bold">
                            <span>Total HT</span>
                            <span className="font-mono">{formatCurrency(invoice.subtotal_ht || 0)}</span>
                          </div>
                          <div className="flex justify-between p-1.5 border-b border-black font-bold">
                            <span>Total TVA</span>
                            <span className="font-mono">{formatCurrency(invoice.tva_amount || 0)}</span>
                          </div>
                          {(invoice.timbre > 0 || (invoice.payment_method?.toLowerCase().includes("espèce") && invoice.timbre !== 0)) && (
                            <div className="flex justify-between p-1.5 border-b border-black font-bold">
                              <span>Droit de Timbre</span>
                              <span className="font-mono">{formatCurrency(invoice.timbre || 0)}</span>
                            </div>
                          )}
                          {(invoice.discount > 0 || invoice.discount_value > 0) && (
                            <div className="flex justify-between p-1.5 border-b border-black text-red-700 font-bold">
                              <span>Remise</span>
                              <span className="font-mono">-{formatCurrency(invoice.discount || invoice.discount_value)}</span>
                            </div>
                          )}
                          <div className="flex justify-between p-1.5 font-bold bg-gray-50">
                            <span>{isCreditNote ? "Net à déduire" : "Total TTC"}</span>
                            <span className="font-mono">{formatCurrency(invoice.total_ttc || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="mb-3 text-[11px] text-gray-800">
                          ARRÊTÉ LA PRÉSENTE FACTURE À LA SOMME DE :
                          <div className="mt-1 font-extrabold text-xs text-black uppercase tracking-wide">
                            {numberToWords(invoice.total_ttc || 0)}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-start">
                          {!isProforma && !isCreditNote && (
                            <div className="text-xs text-black font-bold">
                              Mode de paiement: <span className="font-normal uppercase">{invoice.payment_method || "Chèque"}</span>
                            </div>
                          )}
                          <div className="mr-8 font-bold text-xs underline flex flex-col items-center">
                            Cachet et Signature
                            {settings?.stamp_data && (
                              <img
                                src={settings.stamp_data}
                                alt="Cachet"
                                style={{ height: settings.stamp_size ? `${settings.stamp_size}px` : "70px", marginTop: '4px' }}
                                className="object-contain"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="text-center font-bold text-xs">
                  {pageIndex + 1}
                </div>
              </div>
            </main>

            {/* FOOTER */}
            <footer className="absolute left-0 bottom-0 w-full h-[33.3mm] bg-white border-t-[0.3mm] border-[#222222] z-10">
              <div className="absolute left-[5.2mm] right-[4.8mm] top-[3.5mm] bottom-[3.8mm] grid grid-cols-[66mm_69mm_1fr] gap-x-[2mm]">
                <section className="relative pl-[4.2mm] pt-[1mm]">
                  <div
                    className="absolute left-0 top-[1mm] w-[0.75mm] h-[16mm]"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <div className="grid grid-cols-[28.5mm_3mm_1fr] min-h-[4.25mm] text-[7.1pt] leading-[1.15] whitespace-nowrap">
                    <span className="font-bold">N° Reg. Commerce</span>
                    <span className="font-bold text-center">:</span>
                    <span>{settings?.company_rc || "04 B 0085776"}</span>
                  </div>
                  <div className="grid grid-cols-[28.5mm_3mm_1fr] min-h-[4.25mm] text-[7.1pt] leading-[1.15] whitespace-nowrap">
                    <span className="font-bold">NIF</span>
                    <span className="font-bold text-center">:</span>
                    <span>{settings?.company_nif || "000419008577618"}</span>
                  </div>
                  <div className="grid grid-cols-[28.5mm_3mm_1fr] min-h-[4.25mm] text-[7.1pt] leading-[1.15] whitespace-nowrap">
                    <span className="font-bold">Articl. Imposition</span>
                    <span className="font-bold text-center">:</span>
                    <span>{settings?.company_ai || "19060412832"}</span>
                  </div>
                  <div className="grid grid-cols-[28.5mm_3mm_1fr] min-h-[4.25mm] text-[7.1pt] leading-[1.15] whitespace-nowrap">
                    <span className="font-bold">NIS</span>
                    <span className="font-bold text-center">:</span>
                    <span>{settings?.company_nis || "000419060730849"}</span>
                  </div>
                  <div className="grid grid-cols-[28.5mm_3mm_1fr] min-h-[4.25mm] text-[7.1pt] leading-[1.15] whitespace-nowrap">
                    <span className="font-bold">Capital Social</span>
                    <span className="font-bold text-center">:</span>
                    <span>{settings?.company_capital || "50 000 000DA"}</span>
                  </div>
                </section>

                <section className="pt-[1mm] text-[7.1pt] leading-[1.3]">
                  <div className="mb-[2.8mm] font-bold">
                    Adresse: {settings?.company_address || "Bp N°61, Kef Erand, Ain-Roua, 19310 Sétif - Algérie"}
                  </div>
                  <div>
                    <strong>RIB:</strong> {settings?.company_rib || "004.00364.400.000.4811.36 CPA SETIF"}<br />
                    {settings?.company_bank_agency || "Agence 364 CPA BD CHELIHI KOUIDER, 19000 SETIF ALGERIE"}
                  </div>
                </section>

                <section className="relative grid grid-cols-[20mm_1fr] gap-x-[2.5mm] pt-[6mm]">
                  {settings?.footer_logo_data ? (
                    <div className="absolute top-0 left-0 h-[8mm] w-[43mm] flex items-center">
                      <img src={settings.footer_logo_data} alt="Footer Logo" className="h-full w-full object-contain object-left" />
                    </div>
                  ) : (
                    <div className="absolute top-0 left-0 h-[8mm] flex items-center font-extrabold text-[9pt] text-red-700 tracking-tighter uppercase">
                      MOBINO <span className="font-normal text-[7pt] text-gray-700 ml-1">GROUP</span>
                    </div>
                  )}

                  <div className="w-[18mm] h-[18mm] bg-gray-50 border-[0.3mm] border-dashed border-gray-400 flex items-center justify-center text-gray-500 font-bold text-[7pt] overflow-hidden">
                    {settings?.qr_code_data ? (
                      <img src={settings.qr_code_data} alt="QR Code" className="w-full h-full object-contain" />
                    ) : (
                      "QR"
                    )}
                  </div>

                  <div className="pt-[0.1mm] text-[7.1pt] leading-[1.65] whitespace-nowrap">
                    <div className="font-bold">{settings?.company_email || "contact@mobinodajal.com"}</div>
                    <div>{settings?.company_website || "www.mobinodajal.com"}</div>
                    {phones.length > 0 ? (
                      phones.map((p, i) => <div key={i}>(+213) {p.replace(/^0/, '')}</div>)
                    ) : (
                      <>
                        <div>(+213) 669 951 620</div>
                        <div>(+213) 770 311 560</div>
                      </>
                    )}
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
