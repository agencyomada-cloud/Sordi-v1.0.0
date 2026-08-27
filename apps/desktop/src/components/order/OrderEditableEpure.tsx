import { Input, Textarea, Button, Popover, PopoverContent, PopoverTrigger, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@sordi/ui";
import { RiAddLine as Plus, RiDeleteBinLine as Trash2, RiCheckLine as Check, RiExpandUpDownLine as ChevronsUpDown } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { numberToWords } from "@/lib/numberToWords";
import { getCompanyPhones, formatPhone, resolveLegalFields, resolveInvoiceHtmlFontFamily } from "@/components/invoice/invoiceHtmlShared";
import { ProductPickerCombobox } from "@/components/ProductPickerCombobox";
import { EditableOrderLogic } from "./useEditableOrderLogic";

interface Props {
  order: any;
  onOrderChange: (order: any) => void;
  clients?: any[];
  products?: any[];
  settings: any;
  logic: EditableOrderLogic;
  readOnly?: boolean;
}

/** "Épuré" theme for bons de commande — hairlines, no fill colors, same restraint as EditableInvoiceEpure. */
export function OrderEditableEpure({ order, clients, products, settings, logic, readOnly = false }: Props) {
  const accent = settings?.primary_color || "#476CFF";
  const phones = getCompanyPhones(settings);
  const legalFields = resolveLegalFields(settings);
  const {
    items, pages, openPopoverIndex, setOpenPopoverIndex, openClientCombo, setOpenClientCombo,
    formatCurrency, updateOrderField, updateClient, updateItem, removeItem, handleAddProduct, handleAddCustomItem,
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
                    {readOnly ? (
                      <div className="text-[17pt] font-bold uppercase tracking-[2px]">{order.custom_title || "BON DE COMMANDE"}</div>
                    ) : (
                      <Input
                        value={order.custom_title || "BON DE COMMANDE"}
                        onChange={(e) => updateOrderField('custom_title', e.target.value)}
                        className="h-auto text-[17pt] font-bold uppercase tracking-[2px] text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
                      />
                    )}
                    <div className="text-[9pt] text-gray-500 mt-1 flex items-center justify-end gap-1">
                      N°
                      {readOnly ? <span>{order.order_number}</span> : (
                        <Input value={order.order_number || ""} onChange={(e) => updateOrderField('order_number', e.target.value)} className="h-5 w-24 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[9pt]" />
                      )}
                      ·
                      {readOnly ? <span>{order.order_date}</span> : (
                        <DatePicker
                          value={order.order_date}
                          onChange={(v) => updateOrderField('order_date', v)}
                          showIcon={false}
                          className="h-5 w-28 border-none bg-transparent p-0 justify-end hover:bg-transparent text-[9pt]"
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div className="h-[1.5px] mb-6" style={{ backgroundColor: accent }} />

                <div className="flex justify-between mb-7">
                  <div className="w-[46%]">
                    <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Émetteur</div>
                    <div className="text-[11pt] font-bold uppercase mb-0.5">{settings?.company_name || ""}</div>
                    {settings?.company_address && <div className="text-[8.5pt] text-gray-600">{settings.company_address}</div>}
                    {settings?.company_rc && <div className="text-[8.5pt] text-gray-600">RC {settings.company_rc}</div>}
                    {settings?.company_nif && <div className="text-[8.5pt] text-gray-600">NIF {settings.company_nif}</div>}
                  </div>
                  <div className="w-[46%] text-right">
                    <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Fournisseur</div>
                    {readOnly ? (
                      <div className="text-[11pt] font-bold uppercase mb-0.5">{order.supplier_name || "-"}</div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Input value={order.supplier_name || ""} onChange={(e) => updateOrderField('supplier_name', e.target.value)} className="h-auto border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[11pt] font-bold uppercase" placeholder="Nom du fournisseur" />
                        {clients && clients.length > 0 && (
                          <Popover open={openClientCombo} onOpenChange={setOpenClientCombo}>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"><ChevronsUpDown className="h-3.5 w-3.5 opacity-50" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="end">
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
                        {order.supplier_address && <div className="text-[8.5pt] text-gray-600">{order.supplier_address}</div>}
                        {order.supplier_rc && <div className="text-[8.5pt] text-gray-600">RC {order.supplier_rc}</div>}
                        {order.supplier_nif && <div className="text-[8.5pt] text-gray-600">NIF {order.supplier_nif}</div>}
                      </>
                    ) : (
                      <div className="space-y-0.5">
                        {[{ field: 'supplier_address', label: 'Adresse' }, { field: 'supplier_rc', label: 'RC' }, { field: 'supplier_nif', label: 'NIF' }].map(({ field, label }) => (
                          <div key={field} className="flex items-center justify-end gap-1 text-[8.5pt] text-gray-600">
                            <span>{label}</span>
                            <Input value={(order as any)[field] || ""} onChange={(e) => updateOrderField(field, e.target.value)} className="h-5 w-28 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[8.5pt]" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <table className="w-full text-[9pt] mb-4" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-t border-b" style={{ borderColor: '#111111' }}>
                      <th className="text-left py-1.5 text-[7.5pt] text-gray-500 uppercase font-normal tracking-wide">Code</th>
                      <th className="text-left py-1.5 text-[7.5pt] text-gray-500 uppercase font-normal tracking-wide">Désignation</th>
                      <th className="text-right py-1.5 text-[7.5pt] text-gray-500 uppercase font-normal tracking-wide">Qté</th>
                      <th className="text-right py-1.5 text-[7.5pt] text-gray-500 uppercase font-normal tracking-wide">P.U HT</th>
                      <th className="text-center py-1.5 text-[7.5pt] text-gray-500 uppercase font-normal tracking-wide">TVA</th>
                      <th className="text-right py-1.5 text-[7.5pt] text-gray-500 uppercase font-normal tracking-wide">Total HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((item: any, relIdx: number) => {
                      const globalIdx = startIdx + relIdx;
                      const tvaLabel = item.tva_rate === -1 ? "Exo" : (item.tva_rate === null || item.tva_rate === 0) ? "0%" : item.tva_rate === undefined ? "19%" : `${item.tva_rate}%`;
                      return (
                        <tr key={globalIdx} className="border-b border-gray-200 group relative">
                          <td className="py-2">{readOnly ? (item.product_code || "") : (
                            <Input value={item.product_code || ""} onChange={(e) => updateItem(globalIdx, 'product_code', e.target.value)} className="h-5 w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[9pt]" placeholder="Code" />
                          )}</td>
                          <td className="py-2">
                            {readOnly ? (
                              <>
                                {item.product_name || ""}
                                {item.product_description && <div className="text-[8pt] text-gray-500 italic">{item.product_description}</div>}
                              </>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <Input value={item.product_name || ""} onChange={(e) => updateItem(globalIdx, 'product_name', e.target.value)} className="h-5 w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[9pt]" placeholder="Désignation" />
                                <Input value={item.product_description || ""} onChange={(e) => updateItem(globalIdx, 'product_description', e.target.value)} className="h-4 w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8pt] italic text-gray-500" placeholder="Description..." />
                              </div>
                            )}
                          </td>
                          <td className="py-2 text-right">{readOnly ? item.quantity : (
                            <Input type="number" step="0.001" data-line-index={globalIdx} data-line-field="quantity" value={item.quantity} onChange={(e) => updateItem(globalIdx, 'quantity', parseFloat(e.target.value) || 0)} className="h-5 w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[9pt]" />
                          )}</td>
                          <td className="py-2 text-right">{readOnly ? formatCurrency(item.unit_price) : (
                            <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateItem(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-5 w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[9pt]" />
                          )}</td>
                          <td className="py-2 text-center text-gray-400 italic text-[9pt]">
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
                          <td className="py-2 text-right relative group-hover:pr-6">
                            {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                            {!readOnly && (
                              <button className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 p-1" onClick={() => removeItem(globalIdx)}><Trash2 className="w-3 h-3" /></button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {isLastPage && !readOnly && (
                      <tr>
                        <td colSpan={6} className="pt-2">
                          <ProductPickerCombobox
                            products={products}
                            excludeProductIds={items.map((it: any) => it.product_id)}
                            open={openPopoverIndex === -1}
                            onOpenChange={(open) => setOpenPopoverIndex(open ? -1 : null)}
                            onSelectProduct={(p) => handleAddProduct(p, items.length - 1)}
                            onAddCustomItem={(name) => handleAddCustomItem(name, items.length - 1)}
                            nextIndex={items.length}
                            formatCurrency={formatCurrency}
                            trigger={
                              <Button variant="ghost" className="w-full h-7 text-[8pt] text-gray-400 hover:text-gray-700 rounded-none border-none">
                                <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter un article
                              </Button>
                            }
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {isFirstPage && (
                  readOnly ? (
                    <p className="text-[8.5pt] text-gray-600 mb-6 min-h-[20px]">{order.notes || ""}</p>
                  ) : (
                    <Textarea
                      value={order.notes || ""}
                      onChange={(e) => updateOrderField('notes', e.target.value)}
                      placeholder="Ajouter des notes..."
                      className="min-h-[36px] resize-none border border-gray-200 bg-gray-50 p-2 shadow-none focus-visible:ring-1 focus-visible:ring-gray-300 text-[8.5pt] w-full mb-6"
                    />
                  )
                )}

                {isLastPage && (
                  <>
                    <div className="flex justify-end mb-6">
                      <div className="w-[46%]">
                        <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">Total HT</span><span>{formatCurrency(order.subtotal_ht || 0)}</span></div>
                        <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">Total TVA</span><span>{formatCurrency(order.tva_amount || 0)}</span></div>
                        <div className="flex justify-between pt-2 mt-1 border-t" style={{ borderColor: '#111111' }}>
                          <span className="text-[10pt] font-bold">Total TTC</span>
                          <span className="text-[12pt] font-bold" style={{ color: accent }}>{formatCurrency(order.total_ttc || 0)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Arrêté le présent bon de commande à la somme de</div>
                      <div className="text-[8.5pt] text-gray-700 uppercase leading-relaxed">{numberToWords(order.total_ttc || 0)} Dinars Algériens</div>
                    </div>

                    <div className="flex justify-end items-end mb-4">
                      <div className="w-44 flex flex-col items-center relative">
                        {(settings?.stamp_data || settings?.signature_data) && (
                          <>
                            <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide">Cachet et signature</div>
                            <div className="w-full h-px bg-gray-300 mt-1 mb-2" />
                          </>
                        )}
                        <div
                          className="w-full relative flex items-center justify-center border-none px-3 py-3"
                          style={{ height: `${Math.max(settings?.stamp_size || 56, settings?.signature_size || 56, 56) + 32}px` }}
                        >
                          {!settings?.stamp_data && !settings?.signature_data ? (
                            <span className="text-[9pt] text-gray-400 uppercase tracking-wide">Cachet et Signature</span>
                          ) : (
                            <>
                              {settings?.stamp_data && (
                                <img
                                  src={settings.stamp_data}
                                  alt="Cachet"
                                  style={{ height: `${settings.stamp_size || 56}px` }}
                                  className="absolute w-auto max-w-[85%] object-contain -rotate-3 opacity-90 pointer-events-none select-none"
                                />
                              )}
                              {settings?.signature_data && (
                                <img
                                  src={settings.signature_data}
                                  alt="Signature"
                                  style={{ height: `${settings.signature_size || 56}px` }}
                                  className="absolute z-10 w-auto max-w-[85%] object-contain pointer-events-none select-none mix-blend-multiply"
                                />
                              )}
                            </>
                          )}
                        </div>
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
