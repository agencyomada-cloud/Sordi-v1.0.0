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
            className="a4 relative bg-white text-black font-sans mx-auto border border-border/40 rounded-2xl shadow-xl print:border-none print:rounded-none print:shadow-none print:m-0 mb-8"
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
                    <h1 className="text-lg font-semibold tracking-[-0.02em] uppercase text-gray-800">
                      {docTitle}
                    </h1>
                  </div>

                  <div className="flex justify-between items-start mb-6 text-xs">
                    <div className="w-[55%] space-y-1">
                      <div className="text-gray-400 text-[10px] font-semibold tracking-wider uppercase">Destinataire</div>

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

                      <div className="space-y-0.5 pt-1 text-[11px] font-mono text-gray-500 leading-relaxed uppercase">
                        <div className="flex items-center">
                          <span className="font-semibold text-gray-700 mr-1">RC:</span>
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
                        {(invoice.clients?.nif || invoice.client_nif) && <div><span className="font-semibold text-gray-700">NIF:</span> {invoice.clients?.nif || invoice.client_nif}</div>}
                        {(invoice.clients?.ai || invoice.client_ai) && <div><span className="font-semibold text-gray-700">AI:</span> {invoice.clients?.ai || invoice.client_ai}</div>}
                        {(invoice.clients?.nis || invoice.client_nis) && <div><span className="font-semibold text-gray-700">NIS:</span> {invoice.clients?.nis || invoice.client_nis}</div>}
                        {(invoice.clients?.activite || invoice.client_activite) && <div><span className="font-semibold text-gray-700">Activité:</span> {invoice.clients?.activite || invoice.client_activite}</div>}
                        {(invoice.clients?.contact || invoice.client_contact) && <div className="mt-1"><span className="font-semibold text-gray-700">Contact:</span> {invoice.clients?.contact || invoice.client_contact}</div>}
                      </div>
                    </div>

                    <div className="w-[35%] text-xs space-y-1.5 pt-1">
                      <div className="flex justify-between items-center border-b border-gray-100 pb-0.5">
                        <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Numéro</span>
                        <Input type="text" value={invoice.invoice_number} onChange={(e) => updateInvoiceField('invoice_number', e.target.value)} className="h-5 w-32 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 font-mono tabular-nums tracking-tight font-semibold uppercase text-xs text-black" />
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-100 pb-0.5">
                        <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Date d'émission</span>
                        <DatePicker
                          value={invoice.invoice_date}
                          onChange={(v) => updateInvoiceField('invoice_date', v)}
                          showIcon={false}
                          className="h-5 w-32 border-none bg-transparent p-0 justify-end hover:bg-transparent font-mono tabular-nums tracking-tight text-xs text-black"
                        />
                      </div>
                      {!isProforma && !isCreditNote && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-0.5">
                          <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Échéance</span>
                          <DatePicker
                            value={invoice.due_date}
                            onChange={(v) => updateInvoiceField('due_date', v)}
                            showIcon={false}
                            className="h-5 w-32 border-none bg-transparent p-0 justify-end hover:bg-transparent font-mono tabular-nums tracking-tight text-xs text-black"
                          />
                        </div>
                      )}
                      {showPaymentMethod && !isProforma && !isCreditNote && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-0.5">
                          <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Mode de paiement</span>
                          <Select value={paymentMode} onValueChange={handlePaymentModeChange}>
                            <SelectTrigger className="h-5 w-auto border-none bg-transparent shadow-none focus:ring-0 text-xs px-0 font-mono tracking-tight text-black"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Espèces">Espèces</SelectItem><SelectItem value="Chèque">Chèque</SelectItem><SelectItem value="Virement bancaire">Virement bancaire</SelectItem></SelectContent>
                          </Select>
                        </div>
                      )}
                      {isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                        <div className="mt-2 text-xs font-semibold text-gray-500 text-right">
                          Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-6">
                    <table className="w-full border-collapse text-xs table-fixed">
                      <thead>
                        <tr className="border-y border-gray-300">
                          <th className="py-2 text-left w-[42%] text-[11px] font-medium tracking-wider uppercase text-gray-400">Désignation / Prestation</th>
                          <th className="py-2 text-right w-[15%] text-[11px] font-medium tracking-wider uppercase text-gray-400">P.U (HT)</th>
                          <th className="py-2 text-right w-[7%] text-[11px] font-medium tracking-wider uppercase text-gray-400">Qté</th>
                          <th className="py-2 text-center w-[16%] text-[11px] font-medium tracking-wider uppercase text-gray-400">U.M</th>
                          <th className="py-2 text-right w-[20%] text-[11px] font-medium tracking-wider uppercase text-gray-400">Total HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((item: any, relIdx: number) => {
                          const globalIdx = startIdx + relIdx;
                          const unit = item.products?.unit || item.unit || "TN";
                          return (
                            <tr key={globalIdx} className="border-b border-gray-200 group hover:bg-gray-50 relative">
                              <td className="py-2.5 font-semibold uppercase align-top">
                                {item.product_name || item.products?.name || item.name || ""}
                                {(item.product_description || item.products?.description || item.description) && (
                                  <div className="font-normal text-[10px] normal-case mt-0.5 text-gray-500">{item.product_description || item.products?.description || item.description}</div>
                                )}
                              </td>
                              <td className="py-2.5 align-top font-mono whitespace-nowrap min-w-[130px]">
                                <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => handleItemUpdate(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-6 w-full text-right bg-transparent border-none shadow-none p-0 focus-visible:ring-0 font-mono tabular-nums tracking-tight text-xs" />
                              </td>
                              <td className="py-2.5 align-top font-mono whitespace-nowrap">
                                <Input type="number" step="0.001" data-line-index={globalIdx} data-line-field="quantity" value={item.quantity} onChange={(e) => handleItemUpdate(globalIdx, 'quantity', parseFloat(e.target.value) || 0)} className="h-6 w-full text-right bg-transparent border-none shadow-none p-0 focus-visible:ring-0 font-mono tabular-nums tracking-tight text-xs" />
                              </td>
                              <td className="py-2.5 text-center align-top uppercase text-gray-500 text-[10px] leading-tight break-words">{unit}</td>
                              <td className="py-2.5 text-right align-top font-mono tabular-nums tracking-tight font-semibold relative group-hover:pr-8 whitespace-nowrap min-w-[130px]">
                                {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                                <button className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 p-1 hover:bg-red-50 rounded" onClick={() => handleDeleteItem(globalIdx)} title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                              </td>
                            </tr>
                          );
                        })}
                        {isLastPage && (
                          <tr>
                            <td colSpan={5} className="p-0">
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
                                  <Button variant="ghost" className="w-full h-8 text-xs text-gray-500 hover:text-gray-900 rounded-none bg-gray-50 border-none"><Plus className="w-4 h-4 mr-1" /> Ajouter un article</Button>
                                }
                              />
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
                        <div className="w-[42%] text-xs">
                          <div className="flex justify-between py-1.5">
                            <span className="text-gray-500">Total HT</span><span className="font-mono tabular-nums tracking-tight">{formatCurrency(subtotal)}</span>
                          </div>
                          {showTva && (
                            <div className="flex justify-between py-1.5">
                              <span className="text-gray-500">TVA (19%)</span><span className="font-mono tabular-nums tracking-tight text-gray-500">{formatCurrency(tvaAmount)}</span>
                            </div>
                          )}
                          {showTimbre && (timbre > 0 || (paymentMode?.toLowerCase().includes("espèce") && timbre !== 0)) && (
                            <div className="flex justify-between py-1.5">
                              <span className="text-gray-500">Timbre Fiscal</span><span className="font-mono tabular-nums tracking-tight text-gray-500">{formatCurrency(timbre)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center py-1.5">
                            <div className="flex items-center gap-1 text-gray-500">
                              <span>Remise</span>
                              <Select value={discountType} onValueChange={(val: any) => { setDiscountType(val); val === 'percent' ? handleDiscountRateChange(0) : handleDiscountAmountChange(0); }}>
                                <SelectTrigger className="h-5 w-auto text-[10px] p-0 px-1 border-none shadow-none"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="percent">%</SelectItem><SelectItem value="amount">DZD</SelectItem></SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center">
                              <span className="font-mono text-red-700 mr-1">-</span>
                              <Input type="number" value={discountType === 'percent' ? discountRate : discountAmount} onChange={(e) => discountType === 'percent' ? handleDiscountRateChange(parseFloat(e.target.value) || 0) : handleDiscountAmountChange(parseFloat(e.target.value) || 0)} className="h-6 w-16 text-right bg-transparent border-none p-0 focus-visible:ring-0 font-mono tabular-nums tracking-tight text-red-700" />
                            </div>
                          </div>
                          <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-gray-300">
                            <span className="text-sm font-semibold text-black">{grandTotalLabel}</span><span className="text-base font-bold font-mono tabular-nums tracking-tight text-black">{formatCurrency(netTotal)}</span>
                          </div>
                          {isTaxExempt && !isProforma && (
                            <div className="text-right text-[9px] text-gray-500 mt-1">
                              Régime d'exonération / Facturation sans TVA — Montant Net à Payer HT - TVA non applicable
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mb-4">
                        {showMontantEnLettres && (
                          <div className="mb-3">
                            <div className="text-gray-400 text-[10px] font-semibold tracking-wider uppercase">
                              {isCreditNote ? "Arrêté le présent avoir à la somme de" : "Arrêté la présente facture à la somme de"}
                            </div>
                            <div className="mt-1 font-semibold text-xs text-black uppercase tracking-tight">{numberToWords(netTotal)}</div>
                          </div>
                        )}

                        {/* Mode de paiement now lives in the top metadata block
                            alongside Date/Numéro — this row just anchors the
                            signature block to the right, same as before. */}
                        <div className="flex justify-end items-start">
                          <div className="mr-8 flex flex-col items-center gap-1">
                            {/* Signature is signed directly on top of the
                                stamp, like a real paper document — an
                                absolute overlay, not a stacked column. */}
                            {(settings?.stamp_data || settings?.signature_data) && (
                              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Cachet et Signature</div>
                            )}
                            <div
                              className="min-w-44 relative flex items-center justify-center border-none px-4 py-3"
                              style={{ height: `${Math.max(settings?.stamp_size || 64, settings?.signature_size || 64, 64) + 40}px` }}
                            >
                              {!settings?.stamp_data && !settings?.signature_data ? (
                                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Cachet et Signature</span>
                              ) : (
                                <>
                                  {settings?.stamp_data && (
                                    <img
                                      src={settings.stamp_data}
                                      alt="Cachet"
                                      style={{ height: `${settings.stamp_size || 64}px` }}
                                      className="absolute w-auto max-w-[85%] object-contain -rotate-3 opacity-90 pointer-events-none select-none"
                                    />
                                  )}
                                  {settings?.signature_data && (
                                    <img
                                      src={settings.signature_data}
                                      alt="Signature"
                                      style={{ height: `${settings.signature_size || 64}px` }}
                                      className="absolute z-10 w-auto max-w-[85%] object-contain pointer-events-none select-none mix-blend-multiply"
                                    />
                                  )}
                                </>
                              )}
                            </div>
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

                <section className="relative pt-[6mm]">
                  {(settings?.footer_logo_data || settings?.company_name) && (
                    <div className="absolute top-0 left-0 h-[8mm] w-[43mm] flex items-center">
                      {settings?.footer_logo_data ? (
                        <img src={settings.footer_logo_data} alt="Footer Logo" className="h-full w-full object-contain object-left" />
                      ) : (
                        <span className="font-extrabold text-[9pt] text-black tracking-tight uppercase">{settings.company_name}</span>
                      )}
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
