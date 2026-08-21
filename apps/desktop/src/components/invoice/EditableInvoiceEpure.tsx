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

export function EditableInvoiceEpure({ invoice, onInvoiceChange, clients, products, settings, logic }: Props) {
  const accent = settings?.primary_color || "#476CFF";
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
            className="a4 relative bg-white text-[#1a1a1a] mx-auto shadow-lg print:border-none print:shadow-none print:m-0 mb-8"
            style={{ width: '210mm', height: '297mm', padding: '14mm', boxSizing: 'border-box', overflow: 'hidden', fontFamily: resolveInvoiceHtmlFontFamily(settings) }}
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
                    <div className="text-[17pt] font-bold uppercase tracking-[2px]">
                      {docTitle}
                    </div>
                    <div className="text-[9pt] text-gray-500 mt-1 flex items-center justify-end gap-1">
                      N°
                      <Input type="text" value={invoice.invoice_number} onChange={(e) => updateInvoiceField('invoice_number', e.target.value)} className="h-5 w-24 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[9pt]" />
                      ·
                      <Input type="date" value={invoice.invoice_date} onChange={(e) => updateInvoiceField('invoice_date', e.target.value)} className="h-5 w-28 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[9pt]" />
                    </div>
                  </div>
                </div>
                <div className="h-[1.5px] mb-6" style={{ backgroundColor: accent }} />

                <div className="flex justify-between mb-7">
                  <div className="w-[46%]">
                    <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Destinataire</div>
                    {clients && clients.length > 0 ? (
                      <Popover open={openClientCombo} onOpenChange={setOpenClientCombo}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" role="combobox" className="h-auto border-none bg-transparent p-0 text-[11pt] font-bold uppercase hover:bg-gray-50 w-full flex justify-start leading-tight mb-0.5 rounded-none">
                            {invoice.clients?.name || invoice.client_name || "Sélectionner un client..."}
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
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
                      <div className="text-[11pt] font-bold uppercase mb-0.5">{invoice.clients?.name || invoice.client_name || ""}</div>
                    )}
                    {(invoice.clients?.address || invoice.client_address) && <div className="text-[8.5pt] text-gray-600">{invoice.clients?.address || invoice.client_address}</div>}
                    {(invoice.clients?.rc || invoice.client_rc) && <div className="text-[8.5pt] text-gray-600">RC {invoice.clients?.rc || invoice.client_rc}</div>}
                    {(invoice.clients?.nif || invoice.client_nif) && <div className="text-[8.5pt] text-gray-600">NIF {invoice.clients?.nif || invoice.client_nif}</div>}
                    {(invoice.clients?.ai || invoice.client_ai) && <div className="text-[8.5pt] text-gray-600">AI {invoice.clients?.ai || invoice.client_ai}</div>}
                    {(invoice.clients?.nis || invoice.client_nis) && <div className="text-[8.5pt] text-gray-600">NIS {invoice.clients?.nis || invoice.client_nis}</div>}
                  </div>
                  <div className="w-[46%]">
                    <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Détails</div>
                    {showPaymentMethod && !isProforma && !isCreditNote && (
                      <div className="flex justify-between items-center text-[8.5pt]">
                        <span className="text-gray-500">Paiement</span>
                        <Select value={paymentMode} onValueChange={handlePaymentModeChange}>
                          <SelectTrigger className="h-5 w-auto border-none bg-transparent shadow-none focus:ring-0 text-[8.5pt] px-0 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="Espèces">Espèces</SelectItem><SelectItem value="Chèque">Chèque</SelectItem><SelectItem value="Virement bancaire">Virement bancaire</SelectItem></SelectContent>
                        </Select>
                      </div>
                    )}
                    {isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                      <div className="text-[7.5pt] text-gray-500 mt-1 text-right">
                        Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                      </div>
                    )}
                  </div>
                </div>

                <table className="w-full text-[9pt] mb-4" style={{ borderCollapse: 'collapse' }}>
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
                    {pageItems.map((item: any, relIdx: number) => {
                      const globalIdx = startIdx + relIdx;
                      const unit = item.products?.unit || item.unit || "TN";
                      return (
                        <tr key={globalIdx} className="border-b border-gray-200 group relative">
                          <td className="py-2">{item.product_name || item.products?.name || item.name || ""}</td>
                          <td className="py-2 text-right">
                            <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => handleItemUpdate(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-5 w-full text-right bg-transparent border-none shadow-none p-0 focus-visible:ring-0 text-[9pt]" />
                          </td>
                          <td className="py-2 text-right">
                            <Input type="number" step="0.001" value={item.quantity} onChange={(e) => handleItemUpdate(globalIdx, 'quantity', parseFloat(e.target.value) || 0)} className="h-5 w-full text-right bg-transparent border-none shadow-none p-0 focus-visible:ring-0 text-[9pt]" />
                          </td>
                          <td className="py-2 text-center">{unit}</td>
                          <td className="py-2 text-right relative group-hover:pr-6">
                            {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                            <button className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 p-1" onClick={() => handleDeleteItem(globalIdx)} title="Supprimer"><Trash2 className="w-3 h-3" /></button>
                          </td>
                        </tr>
                      );
                    })}
                    {isLastPage && products && (
                      <tr>
                        <td colSpan={5} className="pt-2">
                          <Popover open={openPopoverIndex === -1} onOpenChange={(open) => setOpenPopoverIndex(open ? -1 : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" className="w-full h-7 text-[8pt] text-gray-400 hover:text-gray-700 rounded-none border-none"><Plus className="w-3.5 h-3.5 mr-1" /> Ajouter un produit</Button>
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
                  <Textarea
                    value={invoice.notes || ""}
                    onChange={(e) => updateInvoiceField('notes', e.target.value)}
                    placeholder="Ajouter des notes..."
                    className="min-h-[36px] resize-none border border-gray-200 bg-gray-50 p-2 shadow-none focus-visible:ring-1 focus-visible:ring-gray-300 text-[8.5pt] w-full mb-6"
                  />
                )}

                {isLastPage && (
                  <>
                    <div className="flex justify-end mb-6">
                      <div className="w-[46%]">
                        <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">Total HT</span><span>{formatCurrency(subtotal)}</span></div>
                        {showTva && (
                          <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">Total TVA</span><span>{formatCurrency(tvaAmount)}</span></div>
                        )}
                        {showTimbre && (timbre > 0 || (paymentMode?.toLowerCase().includes("espèce") && timbre !== 0)) && (
                          <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">Droit de Timbre</span><span>{formatCurrency(timbre)}</span></div>
                        )}
                        <div className="flex justify-between items-center py-1 text-[8.5pt]">
                          <div className="flex items-center gap-1 text-gray-500">
                            <span>Remise</span>
                            <Select value={discountType} onValueChange={(val: any) => { setDiscountType(val); val === 'percent' ? handleDiscountRateChange(0) : handleDiscountAmountChange(0); }}>
                              <SelectTrigger className="h-4 w-auto text-[8pt] p-0 px-1 border-none shadow-none"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="percent">%</SelectItem><SelectItem value="amount">DZD</SelectItem></SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center text-red-700">
                            <span className="mr-1">-</span>
                            <Input type="number" value={discountType === 'percent' ? discountRate : discountAmount} onChange={(e) => discountType === 'percent' ? handleDiscountRateChange(parseFloat(e.target.value) || 0) : handleDiscountAmountChange(parseFloat(e.target.value) || 0)} className="h-5 w-16 text-right bg-transparent border-none p-0 focus-visible:ring-0 text-[8.5pt] text-red-700" />
                          </div>
                        </div>
                        <div className="flex justify-between pt-2 mt-1 border-t" style={{ borderColor: '#111111' }}>
                          <span className="text-[10pt] font-bold">{grandTotalLabel}</span>
                          <span className="text-[12pt] font-bold" style={{ color: accent }}>{formatCurrency(netTotal)}</span>
                        </div>
                      </div>
                    </div>

                    {showMontantEnLettres && (
                      <div className="mb-6">
                        <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">
                          {isCreditNote ? "Arrêté le présent avoir à la somme de" : "Arrêté la présente facture à la somme de"}
                        </div>
                        <div className="text-[8.5pt] text-gray-700 uppercase leading-relaxed">{numberToWords(netTotal)}</div>
                      </div>
                    )}

                    <div className="flex justify-end items-end mb-4">
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
