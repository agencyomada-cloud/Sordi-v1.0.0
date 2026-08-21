import { Input, Textarea, Button, Popover, PopoverContent, PopoverTrigger, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@sordi/ui";
import { RiAddLine as Plus, RiDeleteBinLine as Trash2, RiCheckLine as Check, RiExpandUpDownLine as ChevronsUpDown } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { numberToWords } from "@/lib/numberToWords";
import { getCompanyPhones, formatPhone, resolveLegalFields, resolveInvoiceHtmlFontFamily } from "@/components/invoice/invoiceHtmlShared";
import { EditableOrderLogic } from "./useEditableOrderLogic";

interface Props {
  order: any;
  onOrderChange: (order: any) => void;
  clients?: any[];
  settings: any;
  logic: EditableOrderLogic;
  readOnly?: boolean;
}

/** "Moderne" theme for bons de commande — accent header band + rounded cards, same visual language as EditableInvoiceModerne. */
export function OrderEditableModerne({ order, clients, settings, logic, readOnly = false }: Props) {
  const accent = settings?.primary_color || "#476CFF";
  const phones = getCompanyPhones(settings);
  const legalFields = resolveLegalFields(settings);
  const {
    pages, openPopoverIndex, setOpenPopoverIndex, openClientCombo, setOpenClientCombo,
    formatCurrency, updateOrderField, updateClient, updateItem, removeItem, addItem,
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
            className="a4 relative bg-white text-[#111827] mx-auto shadow-lg print:border-none print:shadow-none print:m-0 mb-8"
            style={{ width: '210mm', height: '297mm', boxSizing: 'border-box', overflow: 'hidden', fontFamily: resolveInvoiceHtmlFontFamily(settings) }}
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
                  {readOnly ? (
                    <div className="text-white text-[16pt] font-bold uppercase tracking-wide">{order.custom_title || "BON DE COMMANDE"}</div>
                  ) : (
                    <Input
                      value={order.custom_title || "BON DE COMMANDE"}
                      onChange={(e) => updateOrderField('custom_title', e.target.value)}
                      className="h-auto text-white text-[16pt] font-bold uppercase tracking-wide text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
                    />
                  )}
                  <div className="text-white/85 text-[8.5pt] mt-1 flex items-center justify-end gap-1">
                    N°
                    {readOnly ? <span>{order.order_number}</span> : (
                      <Input value={order.order_number || ""} onChange={(e) => updateOrderField('order_number', e.target.value)} className="h-5 w-24 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[8.5pt] text-white placeholder:text-white/60" />
                    )}
                    ·
                    {readOnly ? <span>{order.order_date}</span> : (
                      <Input type="date" value={order.order_date || ""} onChange={(e) => updateOrderField('order_date', e.target.value)} className="h-5 w-28 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[8.5pt] text-white" />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 px-[14mm] py-[9mm] flex flex-col justify-between overflow-hidden">
                <div>
                  <div className="flex gap-3 mb-5">
                    <div className="flex-1 bg-gray-50 rounded-[10px] p-3.5">
                      <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Émetteur</div>
                      <div className="text-[10.5pt] font-bold uppercase mb-1">{settings?.company_name || ""}</div>
                      {settings?.company_address && <div className="text-[8pt] text-gray-600">{settings.company_address}</div>}
                      {settings?.company_rc && <div className="text-[8pt] text-gray-600">RC {settings.company_rc}</div>}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-[10px] p-3.5">
                      <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Fournisseur</div>
                      {readOnly ? (
                        <div className="text-[10.5pt] font-bold uppercase mb-1">{order.supplier_name || "-"}</div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Input value={order.supplier_name || ""} onChange={(e) => updateOrderField('supplier_name', e.target.value)} className="h-auto border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[10.5pt] font-bold uppercase" placeholder="Nom du fournisseur" />
                          {clients && clients.length > 0 && (
                            <Popover open={openClientCombo} onOpenChange={setOpenClientCombo}>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"><ChevronsUpDown className="h-3.5 w-3.5 opacity-50" /></Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Rechercher un fournisseur..." />
                                  <CommandList>
                                    <CommandEmpty>Aucun fournisseur trouvé.</CommandEmpty>
                                    <CommandGroup>
                                      {clients.map((c) => (
                                        <CommandItem key={c.id} value={c.name} onSelect={() => { updateClient(c.id, clients); setOpenClientCombo(false); }}>
                                          <Check className={cn("mr-2 h-4 w-4", order.client_id === c.id ? "opacity-100" : "opacity-0")} />
                                          {c.name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      )}
                      {readOnly ? (
                        <>
                          {order.supplier_address && <div className="text-[8pt] text-gray-600">{order.supplier_address}</div>}
                          {order.supplier_rc && <div className="text-[8pt] text-gray-600">RC {order.supplier_rc}</div>}
                          {order.supplier_nif && <div className="text-[8pt] text-gray-600">NIF {order.supplier_nif}</div>}
                        </>
                      ) : (
                        <div className="space-y-0.5 mt-0.5">
                          {[{ field: 'supplier_address', label: 'Adresse' }, { field: 'supplier_rc', label: 'RC' }, { field: 'supplier_nif', label: 'NIF' }].map(({ field, label }) => (
                            <div key={field} className="flex items-center gap-1 text-[8pt] text-gray-600">
                              <span>{label}</span>
                              <Input value={(order as any)[field] || ""} onChange={(e) => updateOrderField(field, e.target.value)} className="h-4 flex-1 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8pt]" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[10px] overflow-hidden mb-4" style={{ border: `0.75px solid ${accent}30` }}>
                    <table className="w-full text-[8.5pt]" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: `${accent}14` }}>
                          <th className="text-left px-2.5 py-1.5 text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: accent }}>Code</th>
                          <th className="text-left px-2.5 py-1.5 text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: accent }}>Désignation</th>
                          <th className="text-right px-2.5 py-1.5 text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: accent }}>Qté</th>
                          <th className="text-right px-2.5 py-1.5 text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: accent }}>P.U HT</th>
                          <th className="text-center px-2.5 py-1.5 text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: accent }}>TVA</th>
                          <th className="text-right px-2.5 py-1.5 text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: accent }}>Total HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((item: any, relIdx: number) => {
                          const globalIdx = startIdx + relIdx;
                          const tvaLabel = item.tva_rate === -1 ? "Exo" : (item.tva_rate === null || item.tva_rate === 0) ? "0%" : item.tva_rate === undefined ? "19%" : `${item.tva_rate}%`;
                          return (
                            <tr key={globalIdx} className={cn("group relative", relIdx % 2 === 1 ? "bg-gray-50/70" : "")}>
                              <td className="px-2.5 py-2">{readOnly ? (item.product_code || "") : (
                                <Input value={item.product_code || ""} onChange={(e) => updateItem(globalIdx, 'product_code', e.target.value)} className="h-5 w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8.5pt]" placeholder="Code" />
                              )}</td>
                              <td className="px-2.5 py-2 font-bold">
                                {readOnly ? (
                                  <>
                                    {item.product_name || ""}
                                    {item.product_description && <div className="text-[7.5pt] font-normal text-gray-500">{item.product_description}</div>}
                                  </>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <Input value={item.product_name || ""} onChange={(e) => updateItem(globalIdx, 'product_name', e.target.value)} className="h-5 w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8.5pt] font-bold" placeholder="Désignation" />
                                    <Input value={item.product_description || ""} onChange={(e) => updateItem(globalIdx, 'product_description', e.target.value)} className="h-4 w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[7.5pt] font-normal text-gray-500" placeholder="Description..." />
                                  </div>
                                )}
                              </td>
                              <td className="px-2.5 py-2 text-right">{readOnly ? item.quantity : (
                                <Input type="number" step="0.001" value={item.quantity} onChange={(e) => updateItem(globalIdx, 'quantity', parseFloat(e.target.value) || 0)} className="h-5 w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8.5pt]" />
                              )}</td>
                              <td className="px-2.5 py-2 text-right">{readOnly ? formatCurrency(item.unit_price) : (
                                <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateItem(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-5 w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8.5pt]" />
                              )}</td>
                              <td className="px-2.5 py-2 text-center text-gray-500 text-[8pt]">
                                {readOnly ? tvaLabel : (
                                  <Popover open={openPopoverIndex === globalIdx} onOpenChange={(open) => setOpenPopoverIndex(open ? globalIdx : null)}>
                                    <PopoverTrigger asChild><button className="hover:text-black">{tvaLabel}</button></PopoverTrigger>
                                    <PopoverContent className="w-64 p-3" align="center">
                                      <div className="grid grid-cols-2 gap-2">
                                        <Button variant="outline" size="sm" className="text-xs" onClick={() => { updateItem(globalIdx, 'tva_rate', 19); setOpenPopoverIndex(null); }}>19%</Button>
                                        <Button variant="outline" size="sm" className="text-xs" onClick={() => { updateItem(globalIdx, 'tva_rate', 9); setOpenPopoverIndex(null); }}>9%</Button>
                                        <Button variant="outline" size="sm" className="text-xs" onClick={() => { updateItem(globalIdx, 'tva_rate', 0); setOpenPopoverIndex(null); }}>0%</Button>
                                        <Button variant="outline" size="sm" className="text-xs" onClick={() => { updateItem(globalIdx, 'tva_rate', -1); setOpenPopoverIndex(null); }}>Exo</Button>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </td>
                              <td className="px-2.5 py-2 text-right relative group-hover:pr-6">
                                {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                                {!readOnly && (
                                  <button className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 p-1" onClick={() => removeItem(globalIdx)}><Trash2 className="w-3 h-3" /></button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {isLastPage && !readOnly && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <Button variant="ghost" className="w-full h-7 text-[8pt] text-gray-400 hover:text-gray-700 rounded-none border-none" onClick={addItem}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une ligne
                              </Button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {isFirstPage && (
                    readOnly ? (
                      <p className="text-[8.5pt] text-gray-600 mb-5 min-h-[20px]">{order.notes || ""}</p>
                    ) : (
                      <Textarea
                        value={order.notes || ""}
                        onChange={(e) => updateOrderField('notes', e.target.value)}
                        placeholder="Ajouter des notes..."
                        className="min-h-[36px] resize-none rounded-[10px] border-none bg-gray-50 p-2.5 shadow-none focus-visible:ring-1 focus-visible:ring-gray-300 text-[8.5pt] w-full mb-5"
                      />
                    )
                  )}

                  {isLastPage && (
                    <>
                      <div className="flex justify-end mb-5">
                        <div className="w-[46%] bg-gray-50 rounded-[10px] p-3">
                          <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">Total HT</span><span>{formatCurrency(order.subtotal_ht || 0)}</span></div>
                          <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">Total TVA</span><span>{formatCurrency(order.tva_amount || 0)}</span></div>
                          <div className="flex justify-between rounded-lg px-2.5 py-1.5 mt-1.5" style={{ backgroundColor: accent }}>
                            <span className="text-[9.5pt] font-bold text-white">Total TTC</span>
                            <span className="text-[11pt] font-bold text-white">{formatCurrency(order.total_ttc || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-5">
                        <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Arrêté le présent bon de commande à la somme de</div>
                        <div className="text-[8.5pt] text-gray-700 uppercase leading-relaxed">{numberToWords(order.total_ttc || 0)} Dinars Algériens</div>
                      </div>

                      <div className="flex justify-end items-end">
                        <div className="w-[140px] flex flex-col items-center relative">
                          {settings?.stamp_data && <img src={settings.stamp_data} alt="Cachet" style={{ maxHeight: 55 }} className="object-contain mb-1" />}
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
