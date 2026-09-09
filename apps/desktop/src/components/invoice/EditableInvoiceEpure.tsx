import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, Textarea, Button, Popover, PopoverContent, PopoverTrigger, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@sordi/ui";
import {
  RiAddLine as Plus,
  RiDeleteBinLine as Trash2,
  RiCheckLine as Check,
  RiExpandUpDownLine as ChevronsUpDown
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { numberToWords } from "@/lib/numberToWords";
import { getCompanyPhones, formatPhone, resolveLegalFields, resolveInvoiceHtmlFontFamily } from "./invoiceHtmlShared";
import { ProductPickerCombobox } from "@/components/ProductPickerCombobox";
import { EditableInvoiceLogic } from "./useEditableInvoiceLogic";

import { InteractiveStampZone } from "./InteractiveStampZone";

interface Props {
  invoice: any;
  onInvoiceChange: (invoice: any) => void;
  clients?: any[];
  products?: any[];
  settings: any;
  logic: EditableInvoiceLogic;
  stampSize?: number;
  onStampSizeChange?: (size: number) => void;
  onStampSizeCommit?: (size: number) => void;
}

export function EditableInvoiceEpure({
  invoice,
  onInvoiceChange,
  clients,
  products,
  settings,
  logic,
  stampSize,
  onStampSizeChange,
  onStampSizeCommit,
}: Props) {
  const accent = settings?.primary_color || "#476CFF";
  const phones = getCompanyPhones(settings);
  const legalFields = resolveLegalFields(settings);
  const {
    paymentMode, discountRate, discountType, setDiscountType,
    openPopoverIndex, setOpenPopoverIndex, openClientCombo, setOpenClientCombo,
    pages, subtotal, tvaAmount, timbre, discountAmount, netTotal,
    isCreditNote, isProforma, docTitle, showTva, showTimbre, showMontantEnLettres, showPaymentMethod, grandTotalLabel, isTaxExempt,
    formatCurrency,
    updateInvoiceField, updateClient, handlePaymentModeChange,
    handleDiscountRateChange, handleDiscountAmountChange,
    handleItemUpdate, handleAddProduct, handleAddCustomItem, handleDeleteItem,
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
            className="a4 relative bg-white text-[#1a1a1a] mx-auto border border-border/40 rounded-2xl shadow-xl print:border-none print:rounded-none print:shadow-none print:m-0 mb-8"
            style={{ width: '210mm', height: '297mm', padding: '14mm', boxSizing: 'border-box', overflow: 'hidden', fontFamily: resolveInvoiceHtmlFontFamily(settings) }}
          >
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col items-start gap-1">
                    {settings?.logo_data && (
                      <img src={settings.logo_data} className="h-10 w-auto max-w-[160px] object-contain object-left" alt="Logo" />
                    )}
                    <span className="text-xs font-semibold tracking-wide text-slate-800 uppercase">
                      {settings?.legal_name || settings?.company_name || "EURL OMADA AGENCY"}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-[13pt] font-semibold tracking-[-0.02em] uppercase">
                      {docTitle}
                    </div>
                    <div className="text-[9pt] text-gray-400 mt-1.5 flex items-center justify-end gap-1 font-mono tabular-nums tracking-tight">
                      N°
                      <Input type="text" value={invoice.invoice_number} onChange={(e) => updateInvoiceField('invoice_number', e.target.value)} className="h-5 w-24 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 font-mono tabular-nums tracking-tight text-[9pt] text-gray-700" />
                      ·
                      <DatePicker
                        value={invoice.invoice_date}
                        onChange={(v) => updateInvoiceField('invoice_date', v)}
                        showIcon={false}
                        className="h-5 w-28 border-none bg-transparent p-0 justify-end hover:bg-transparent font-mono tabular-nums tracking-tight text-[9pt] text-gray-700"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mb-7">
                  <div className="w-[46%]">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Destinataire</div>
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
                    {(invoice.clients?.address || invoice.client_address) && <div className="text-[8.5pt] text-gray-600 mb-1">{invoice.clients?.address || invoice.client_address}</div>}
                    <div className="font-mono text-xs text-gray-500 leading-relaxed space-y-0.5">
                      {(invoice.clients?.rc || invoice.client_rc) && <div>RC {invoice.clients?.rc || invoice.client_rc}</div>}
                      {(invoice.clients?.nif || invoice.client_nif) && <div>NIF {invoice.clients?.nif || invoice.client_nif}</div>}
                      {(invoice.clients?.ai || invoice.client_ai) && <div>AI {invoice.clients?.ai || invoice.client_ai}</div>}
                      {(invoice.clients?.nis || invoice.client_nis) && <div>NIS {invoice.clients?.nis || invoice.client_nis}</div>}
                    </div>
                  </div>
                  <div className="w-[46%]">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Détails</div>
                    {!isCreditNote && (
                      <div className="flex justify-between items-center text-[8.5pt] mb-1">
                        <span className="text-gray-500">Échéance</span>
                        <DatePicker
                          value={invoice.due_date}
                          onChange={(v) => updateInvoiceField('due_date', v)}
                          showIcon={false}
                          className="h-5 w-auto border-none bg-transparent p-0 justify-end hover:bg-transparent font-mono tabular-nums tracking-tight text-[8.5pt] font-semibold text-gray-700"
                        />
                      </div>
                    )}
                    {showPaymentMethod && !isCreditNote && (
                      <div className="flex justify-between items-center text-[8.5pt]">
                        <span className="text-gray-500">Mode de paiement</span>
                        <Select value={paymentMode} onValueChange={handlePaymentModeChange}>
                          <SelectTrigger className="h-5 w-auto border-none bg-transparent shadow-none focus:ring-0 font-mono tracking-tight text-[8.5pt] px-0 font-semibold"><SelectValue /></SelectTrigger>
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

                <table className="w-full text-[9pt] mb-4 table-fixed" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-y border-gray-300">
                      <th className="text-left py-2 w-[42%] text-[11px] font-medium text-gray-400 uppercase tracking-wider">Désignation / Prestation</th>
                      <th className="text-right py-2 w-[15%] text-[11px] font-medium text-gray-400 uppercase tracking-wider">P.U (HT)</th>
                      <th className="text-right py-2 w-[7%] text-[11px] font-medium text-gray-400 uppercase tracking-wider">Qté</th>
                      <th className="text-center py-2 w-[16%] text-[11px] font-medium text-gray-400 uppercase tracking-wider">U.M</th>
                      <th className="text-right py-2 w-[20%] text-[11px] font-medium text-gray-400 uppercase tracking-wider">Total HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((item: any, relIdx: number) => {
                      const globalIdx = startIdx + relIdx;
                      const unit = item.products?.unit || item.unit || "TN";
                      return (
                        <tr key={globalIdx} className="border-b border-gray-200 group relative">
                          <td className="py-2.5">{item.product_name || item.products?.name || item.name || ""}</td>
                          <td className="py-2.5 text-right font-mono whitespace-nowrap min-w-[130px]">
                            <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => handleItemUpdate(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-5 w-full text-right bg-transparent border-none shadow-none p-0 focus-visible:ring-0 font-mono tabular-nums tracking-tight text-[9pt]" />
                          </td>
                          <td className="py-2.5 text-right font-mono whitespace-nowrap">
                            <Input type="number" step="0.001" data-line-index={globalIdx} data-line-field="quantity" value={item.quantity} onChange={(e) => handleItemUpdate(globalIdx, 'quantity', parseFloat(e.target.value) || 0)} className="h-5 w-full text-right bg-transparent border-none shadow-none p-0 focus-visible:ring-0 font-mono tabular-nums tracking-tight text-[9pt]" />
                          </td>
                          <td className="py-2.5 text-center text-gray-500 text-[8pt] uppercase leading-tight break-words">{unit}</td>
                          <td className="py-2.5 text-right relative group-hover:pr-6 font-mono tabular-nums tracking-tight font-semibold whitespace-nowrap min-w-[130px]">
                            {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                            <button className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 p-1" onClick={() => handleDeleteItem(globalIdx)} title="Supprimer"><Trash2 className="w-3 h-3" /></button>
                          </td>
                        </tr>
                      );
                    })}
                    {isLastPage && (
                      <tr>
                        <td colSpan={5} className="pt-2">
                          <ProductPickerCombobox
                            products={products}
                            excludeProductIds={logic.items.map((it: any) => it.product_id)}
                            open={openPopoverIndex === -1}
                            onOpenChange={(open) => setOpenPopoverIndex(open ? -1 : null)}
                            onSelectProduct={(p) => handleAddProduct(p, logic.items.length - 1)}
                            onAddCustomItem={(name) => handleAddCustomItem(name, logic.items.length - 1)}
                            nextIndex={logic.items.length}
                            formatCurrency={formatCurrency}
                            trigger={
                              <Button variant="ghost" className="w-full h-7 text-[8pt] text-gray-400 hover:text-gray-700 rounded-none border-none"><Plus className="w-3.5 h-3.5 mr-1" /> Ajouter un article</Button>
                            }
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {(() => {
                  const notesBox = (
                    <Textarea
                      value={invoice.notes || ""}
                      onChange={(e) => updateInvoiceField('notes', e.target.value)}
                      placeholder="Ajouter des notes..."
                      className="min-h-[36px] resize-none rounded-none border-0 border-l-2 border-gray-200 bg-gray-50 p-2.5 shadow-none focus-visible:ring-1 focus-visible:ring-gray-300 text-[8.5pt] w-full"
                    />
                  );
                  const totalsBox = (
                    <div className="w-full">
                      <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">Total HT</span><span className="font-mono tabular-nums tracking-tight">{formatCurrency(subtotal)}</span></div>
                      {showTva && (
                        <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">TVA (19%)</span><span className="font-mono tabular-nums tracking-tight text-gray-500">{formatCurrency(tvaAmount)}</span></div>
                      )}
                      {showTimbre && (timbre > 0 || (paymentMode?.toLowerCase().includes("espèce") && timbre !== 0)) && (
                        <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">Timbre Fiscal</span><span className="font-mono tabular-nums tracking-tight text-gray-500">{formatCurrency(timbre)}</span></div>
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
                          <Input type="number" value={discountType === 'percent' ? discountRate : discountAmount} onChange={(e) => discountType === 'percent' ? handleDiscountRateChange(parseFloat(e.target.value) || 0) : handleDiscountAmountChange(parseFloat(e.target.value) || 0)} className="h-5 w-16 text-right bg-transparent border-none p-0 focus-visible:ring-0 text-[8.5pt] font-mono tabular-nums tracking-tight font-semibold text-red-700" />
                        </div>
                      </div>
                      <div className="flex justify-between pt-2 mt-1 border-t" style={{ borderColor: '#111111' }}>
                        <span className="text-[10pt] font-bold">{grandTotalLabel}</span>
                        <span className="text-[12pt] font-mono tabular-nums tracking-tight font-bold" style={{ color: accent }}>{formatCurrency(netTotal)}</span>
                      </div>
                      {isTaxExempt && !isProforma && (
                        <div className="text-right text-[7.5pt] text-gray-500 mt-1">
                          Régime d'exonération / Facturation sans TVA — Montant Net à Payer HT - TVA non applicable
                        </div>
                      )}
                    </div>
                  );

                  // Notes (page 1) and totals (last page) share one row only
                  // when they're the same page — the overwhelmingly common
                  // single-page case. A multi-page invoice can't put them
                  // side by side since they render on physically different
                  // pages, so each keeps its own previous standalone slot.
                  if (isFirstPage && isLastPage) {
                    return (
                      <div className="flex justify-between items-start gap-6 mb-6" style={{ breakInside: 'avoid' }}>
                        <div className="w-[46%]">{notesBox}</div>
                        <div className="w-[46%]">{totalsBox}</div>
                      </div>
                    );
                  }
                  return (
                    <>
                      {isFirstPage && <div className="mb-6">{notesBox}</div>}
                      {isLastPage && <div className="flex justify-end mb-6"><div className="w-[46%]">{totalsBox}</div></div>}
                    </>
                  );
                })()}

                {isLastPage && (
                  <>
                    {showMontantEnLettres && (
                      <div className="mb-6">
                        <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">
                          {isCreditNote ? "Arrêté le présent avoir à la somme de" : "Arrêté la présente facture à la somme de"}
                        </div>
                        <div className="text-[8.5pt] text-gray-700 uppercase leading-relaxed">{numberToWords(netTotal)}</div>
                      </div>
                    )}

                    <div className="flex justify-end items-end mb-4">
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
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
