import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, Textarea, Button, Popover, PopoverContent, PopoverTrigger, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@sordi/ui";
import {
  RiAddLine as Plus,
  RiDeleteBinLine as Trash2,
  RiCheckLine as Check,
  RiExpandUpDownLine as ChevronsUpDown
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { numberToWords } from "@/lib/numberToWords";
import { getCompanyPhones, formatPhone, resolveLegalFields, resolveInvoiceHtmlFontFamily } from "./invoiceHtmlShared";
import { EditableInvoiceLogic } from "./useEditableInvoiceLogic";

interface Props {
  invoice: any;
  onInvoiceChange: (invoice: any) => void;
  clients?: any[];
  products?: any[];
  settings: any;
  logic: EditableInvoiceLogic;
}

export function EditableInvoiceStructure({ invoice, onInvoiceChange, clients, products, settings, logic }: Props) {
  const primaryColor = settings?.primary_color || "#476CFF";
  const phones = getCompanyPhones(settings);
  const legalFields = resolveLegalFields(settings);
  const {
    paymentMode, discountRate, discountType, setDiscountType,
    openPopoverIndex, setOpenPopoverIndex, openClientCombo, setOpenClientCombo,
    pages, subtotal, tvaAmount, timbre, discountAmount, netTotal,
    isCreditNote, isProforma, docTitle, showTva, showTimbre, showMontantEnLettres, showPaymentMethod, grandTotalLabel,
    formatCurrency,
    updateInvoiceField, updateClient, handlePaymentModeChange,
    handleDiscountRateChange, handleDiscountAmountChange,
    handleItemUpdate, handleAddProduct, handleDeleteItem,
  } = logic;

  return (
    <div id="invoice-preview">
      {pages.map((pageItems, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === pages.length - 1;
        const startIdx = pages.slice(0, pageIndex).reduce((sum, p) => sum + p.length, 0);

        return (
          <div
            key={pageIndex}
            id={`invoice-preview-page-${pageIndex + 1}`}
            className="a4 relative bg-white text-black font-sans mx-auto shadow-lg print:border-none print:shadow-none print:m-0 mb-8"
            style={{ width: '210mm', height: '297mm', position: 'relative', overflow: 'hidden', backgroundColor: '#ffffff', fontFamily: resolveInvoiceHtmlFontFamily(settings) }}
          >
            <header className="absolute top-0 left-0 w-full h-[33.9mm] bg-white z-10">
              {settings?.logo_data && (
                <div className="absolute top-0 left-0 w-[50%] h-[25.7mm] pt-[5mm] pb-[5mm] pl-[5mm] pr-0 flex items-center justify-start">
                  <img src={settings.logo_data} className="block w-full h-full object-contain object-left" alt={settings?.company_name || ""} />
                </div>
              )}
              {settings?.company_name && (
                <div className="absolute right-0 bottom-0 w-[71.5mm] h-[7.8mm] flex items-center justify-center px-[5mm] text-[8.5pt] font-bold leading-none whitespace-nowrap text-white z-2 tracking-wide uppercase" style={{ backgroundColor: primaryColor }}>
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

              <div className="relative w-full h-full z-1 px-[8mm] pt-[5mm] pb-[5mm] flex flex-col justify-between">
                <div>
                  <div className="text-center mb-4">
                    <h1 className="text-xl font-extrabold uppercase text-gray-800 tracking-wider">
                      {docTitle}
                    </h1>
                  </div>

                  <div className="flex justify-between items-start mb-6 text-xs">
                    <div className="w-[55%] space-y-1">
                      <div className="text-gray-500 text-[11px] font-medium uppercase">Destinataire</div>

                      {clients && clients.length > 0 ? (
                        <Popover open={openClientCombo} onOpenChange={setOpenClientCombo}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" role="combobox" className="h-auto border-none bg-transparent p-0 text-sm font-bold uppercase text-black hover:bg-gray-100 w-full flex justify-start leading-tight mb-1 rounded-none">
                              {invoice.clients?.name || invoice.client_name || "Sélectionner un client..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Rechercher un client..." />
                              <CommandList>
                                <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                                <CommandGroup>
                                  {clients.map((client) => (
                                    <CommandItem key={client.id} value={client.name} onSelect={() => { updateClient(client.id, clients); setOpenClientCombo(false); }}>
                                      <Check className={cn("mr-2 h-4 w-4", invoice.clients?.id === client.id ? "opacity-100" : "opacity-0")} />
                                      {client.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="font-extrabold text-sm text-black uppercase mb-1">{invoice.clients?.name || invoice.client_name || ""}</div>
                      )}

                      {invoice.use_secondary_register && invoice.selected_secondary_address ? (
                        <div className="text-gray-700 uppercase text-[11px] font-semibold">{invoice.selected_secondary_address}</div>
                      ) : (
                        (invoice.clients?.address || invoice.client_address) && (
                          <div className="text-gray-700 uppercase text-[11px] font-semibold">{invoice.clients?.address || invoice.client_address}</div>
                        )
                      )}

                      <div className="space-y-0.5 pt-1 text-[11px] text-gray-700 uppercase">
                        <div className="flex items-center">
                          <span className="font-bold mr-1">RC:</span>
                          {invoice.clients && (invoice.clients.secondary_rc || invoice.clients.secondary_address) ? (
                            <Select
                              value={!invoice.use_secondary_register ? "principal_rc" : (invoice.selected_secondary_rc || "")}
                              onValueChange={(val) => {
                                if (val === "principal_rc") {
                                  onInvoiceChange({ ...invoice, use_secondary_register: false, selected_secondary_rc: null, selected_secondary_address: null });
                                } else {
                                  let newAddress = "";
                                  try {
                                    const parsed = JSON.parse(invoice.clients!.secondary_rc!);
                                    const branch = parsed.find((b: any) => b.rc === val);
                                    if (branch) newAddress = branch.address || "";
                                  } catch { }
                                  onInvoiceChange({ ...invoice, use_secondary_register: true, selected_secondary_rc: val, selected_secondary_address: newAddress });
                                }
                              }}
                            >
                              <SelectTrigger className="h-4 p-0 border-none bg-transparent shadow-none w-auto text-xs font-normal focus:ring-0 uppercase"><SelectValue placeholder="Sélectionner RC..." /></SelectTrigger>
                              <SelectContent align="start">
                                <SelectItem value="principal_rc" className="text-xs">{invoice.clients?.rc || "RC Principal"} (Principal)</SelectItem>
                                {(() => {
                                  try {
                                    const parsed = JSON.parse(invoice.clients!.secondary_rc!);
                                    return Array.isArray(parsed) && parsed.map((b: any, idx: number) => (
                                      <SelectItem key={idx} value={b.rc || `branch-${idx}`} className="text-xs">{b.rc || "-"} {b.address ? `(${b.address.substring(0, 15)}...)` : ""}</SelectItem>
                                    ));
                                  } catch { return null; }
                                })()}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span>{invoice.clients?.rc || invoice.client_rc || ""}</span>
                          )}
                        </div>
                        {(invoice.clients?.nif || invoice.client_nif) && <div><span className="font-bold">NIF:</span> {invoice.clients?.nif || invoice.client_nif}</div>}
                        {(invoice.clients?.ai || invoice.client_ai) && <div><span className="font-bold">AI:</span> {invoice.clients?.ai || invoice.client_ai}</div>}
                        {(invoice.clients?.nis || invoice.client_nis) && <div><span className="font-bold">NIS:</span> {invoice.clients?.nis || invoice.client_nis}</div>}
                        {(invoice.clients?.activite || invoice.client_activite) && <div><span className="font-bold">Activité:</span> {invoice.clients?.activite || invoice.client_activite}</div>}
                        {(invoice.clients?.contact || invoice.client_contact) && <div className="mt-1"><span className="font-bold">Contact:</span> {invoice.clients?.contact || invoice.client_contact}</div>}
                      </div>
                    </div>

                    <div className="w-[35%] text-xs space-y-1.5 pt-1">
                      <div className="flex justify-between items-center border-b border-gray-100 pb-0.5">
                        <span className="font-bold text-black">Date:</span>
                        <Input type="date" value={invoice.invoice_date} onChange={(e) => updateInvoiceField('invoice_date', e.target.value)} className="h-5 w-32 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-xs" />
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-100 pb-0.5">
                        <span className="font-bold text-black">Numéro:</span>
                        <Input type="text" value={invoice.invoice_number} onChange={(e) => updateInvoiceField('invoice_number', e.target.value)} className="h-5 w-32 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 font-bold uppercase text-xs" />
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
                        <tr style={{ backgroundColor: primaryColor }} className="text-white font-bold border-b border-black">
                          <th className="border border-black p-2 text-center w-[45%] uppercase">Désignation</th>
                          <th className="border border-black p-2 text-right uppercase">P.U</th>
                          <th className="border border-black p-2 text-right uppercase">Quantité</th>
                          <th className="border border-black p-2 text-center uppercase">U/M</th>
                          <th className="border border-black p-2 text-right uppercase">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((item: any, relIdx: number) => {
                          const globalIdx = startIdx + relIdx;
                          const unit = item.products?.unit || item.unit || "TN";
                          return (
                            <tr key={globalIdx} className="border-b border-black group hover:bg-gray-50 relative">
                              <td className="border border-black p-2 font-bold uppercase align-top">
                                {item.product_name || item.products?.name || item.name || ""}
                                {(item.product_description || item.products?.description || item.description) && (
                                  <div className="font-normal text-[10px] normal-case mt-0.5 text-gray-600">{item.product_description || item.products?.description || item.description}</div>
                                )}
                              </td>
                              <td className="border border-black p-2 align-top font-mono">
                                <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => handleItemUpdate(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-6 w-full text-right bg-transparent border-none shadow-none p-0 focus-visible:ring-0 font-mono font-semibold text-xs" />
                              </td>
                              <td className="border border-black p-2 align-top font-mono">
                                <Input type="number" step="0.001" value={item.quantity} onChange={(e) => handleItemUpdate(globalIdx, 'quantity', parseFloat(e.target.value) || 0)} className="h-6 w-full text-right bg-transparent border-none shadow-none p-0 focus-visible:ring-0 font-mono text-xs" />
                              </td>
                              <td className="border border-black p-2 text-center align-top uppercase font-semibold">{unit}</td>
                              <td className="border border-black p-2 text-right align-top font-mono font-bold relative group-hover:pr-8">
                                {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                                <button className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 p-1 hover:bg-red-50 rounded" onClick={() => handleDeleteItem(globalIdx)} title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                              </td>
                            </tr>
                          );
                        })}
                        {isLastPage && products && (
                          <tr className="border border-black">
                            <td colSpan={5} className="p-0">
                              <Popover open={openPopoverIndex === -1} onOpenChange={(open) => setOpenPopoverIndex(open ? -1 : null)}>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" className="w-full h-8 text-xs text-gray-500 hover:text-gray-900 rounded-none bg-gray-50 border-none"><Plus className="w-4 h-4 mr-1" /> Ajouter un produit</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-2">
                                  <div className="max-h-60 overflow-y-auto space-y-1">
                                    {products.map((p) => (
                                      <Button key={p.id} variant="ghost" className="w-full justify-start text-left h-auto py-2" onClick={() => handleAddProduct(p, logic.items.length - 1)}>
                                        <div className="flex flex-col"><span className="font-medium">{p.name}</span><span className="text-xs text-gray-500">{formatCurrency(p.unit_price || 0)}</span></div>
                                      </Button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {isFirstPage && (
                      <div className="mt-3">
                        <Textarea
                          value={invoice.notes || ""}
                          onChange={(e) => updateInvoiceField('notes', e.target.value)}
                          placeholder="Ajouter des notes..."
                          className="min-h-[40px] resize-none border border-gray-200 bg-gray-50 p-2 shadow-none focus-visible:ring-1 focus-visible:ring-gray-300 text-xs text-black font-normal w-full"
                        />
                      </div>
                    )}
                  </div>

                  {isLastPage && (
                    <>
                      <div className="flex justify-end mb-4">
                        <div className="w-[42%] border border-black text-xs">
                          <div className="flex justify-between p-1.5 border-b border-black font-bold">
                            <span>Total HT</span><span className="font-mono">{formatCurrency(subtotal)}</span>
                          </div>
                          {showTva && (
                            <div className="flex justify-between p-1.5 border-b border-black font-bold">
                              <span>Total TVA</span><span className="font-mono">{formatCurrency(tvaAmount)}</span>
                            </div>
                          )}
                          {showTimbre && (timbre > 0 || (paymentMode?.toLowerCase().includes("espèce") && timbre !== 0)) && (
                            <div className="flex justify-between p-1.5 border-b border-black font-bold">
                              <span>Droit de Timbre</span><span className="font-mono">{formatCurrency(timbre)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center p-1.5 border-b border-black">
                            <div className="flex items-center gap-1 font-bold">
                              <span>Remise</span>
                              <Select value={discountType} onValueChange={(val: any) => { setDiscountType(val); val === 'percent' ? handleDiscountRateChange(0) : handleDiscountAmountChange(0); }}>
                                <SelectTrigger className="h-5 w-auto text-[10px] p-0 px-1 border-none shadow-none"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="percent">%</SelectItem><SelectItem value="amount">DZD</SelectItem></SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center">
                              <span className="font-mono text-red-700 mr-1">-</span>
                              <Input type="number" value={discountType === 'percent' ? discountRate : discountAmount} onChange={(e) => discountType === 'percent' ? handleDiscountRateChange(parseFloat(e.target.value) || 0) : handleDiscountAmountChange(parseFloat(e.target.value) || 0)} className="h-6 w-16 text-right bg-transparent border-none p-0 focus-visible:ring-0 font-mono text-red-700 font-bold" />
                            </div>
                          </div>
                          <div className="flex justify-between p-1.5 font-bold bg-gray-50">
                            <span>{grandTotalLabel}</span><span className="font-mono">{formatCurrency(netTotal)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        {showMontantEnLettres && (
                          <div className="mb-3 text-[11px] text-gray-800">
                            {isCreditNote ? "ARRÊTÉ LE PRÉSENT AVOIR À LA SOMME DE :" : "ARRÊTÉ LA PRÉSENTE FACTURE À LA SOMME DE :"}
                            <div className="mt-1 font-extrabold text-xs text-black uppercase tracking-wide">{numberToWords(netTotal)}</div>
                          </div>
                        )}

                        <div className="flex justify-between items-start">
                          {showPaymentMethod && !isProforma && !isCreditNote && (
                            <div className="text-xs text-black font-bold flex items-center gap-2">
                              Mode de paiement:
                              <Select value={paymentMode} onValueChange={handlePaymentModeChange}>
                                <SelectTrigger className="h-5 w-auto border-none bg-transparent shadow-none focus:ring-0 text-xs px-0 font-normal"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="Espèces">Espèces</SelectItem><SelectItem value="Chèque">Chèque</SelectItem><SelectItem value="Virement bancaire">Virement bancaire</SelectItem></SelectContent>
                              </Select>
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

            <footer className="absolute left-0 bottom-0 w-full h-[33.3mm] bg-white border-t-[0.3mm] border-[#222222] z-10">
              <div className="absolute left-[5.2mm] right-[4.8mm] top-[3.5mm] bottom-[3.8mm] grid grid-cols-[66mm_69mm_1fr] gap-x-[2mm]">
                <section className="relative pl-[4.2mm] pt-[1mm]">
                  <div className="absolute left-0 top-[1mm] w-[0.75mm] h-[16mm]" style={{ backgroundColor: primaryColor }} />
                  {legalFields.map((f, i) => (
                    <div key={i} className="grid grid-cols-[28.5mm_3mm_1fr] min-h-[4.25mm] text-[7.1pt] leading-[1.15] whitespace-nowrap">
                      <span className="font-bold">{f.label}</span>
                      <span className="font-bold text-center">:</span>
                      <span>{f.value}</span>
                    </div>
                  ))}
                </section>

                <section className="pt-[1mm] text-[7.1pt] leading-[1.3]">
                  {settings?.company_address && <div className="mb-[2.8mm] font-bold">Adresse: {settings.company_address}</div>}
                  {settings?.company_rib && (
                    <div><strong>RIB:</strong> {settings.company_rib}{settings?.company_bank_agency && <><br />{settings.company_bank_agency}</>}</div>
                  )}
                </section>

                <section className="relative grid grid-cols-[20mm_1fr] gap-x-[2.5mm] pt-[6mm]">
                  {(settings?.footer_logo_data || settings?.company_name) && (
                    <div className="absolute top-0 left-0 h-[8mm] w-[43mm] flex items-center">
                      {settings?.footer_logo_data ? (
                        <img src={settings.footer_logo_data} alt="Footer Logo" className="h-full w-full object-contain object-left" />
                      ) : (
                        <span className="font-extrabold text-[9pt] text-black tracking-tight uppercase">{settings.company_name}</span>
                      )}
                    </div>
                  )}

                  {settings?.qr_code_data && (
                    <div className="w-[18mm] h-[18mm] bg-gray-50 flex items-center justify-center overflow-hidden">
                      <img src={settings.qr_code_data} alt="QR Code" className="w-full h-full object-contain" />
                    </div>
                  )}

                  <div className="pt-[0.1mm] text-[7.1pt] leading-[1.65] whitespace-nowrap">
                    {settings?.company_email && <div className="font-bold">{settings.company_email}</div>}
                    {settings?.company_website && <div>{settings.company_website}</div>}
                    {phones.map((p, i) => <div key={i}>{formatPhone(p)}</div>)}
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
