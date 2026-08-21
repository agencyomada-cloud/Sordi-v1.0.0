import { Input, Textarea, Button, Popover, PopoverContent, PopoverTrigger, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@sordi/ui";
import { RiAddLine as Plus, RiDeleteBinLine as Trash2, RiCheckLine as Check, RiExpandUpDownLine as ChevronsUpDown } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { numberToWords } from "@/lib/numberToWords";
import { getCompanyPhones, formatPhone, resolveLegalFields, resolveInvoiceHtmlFontFamily } from "@/components/invoice/invoiceHtmlShared";
import { EditableDeliveryLogic } from "./useEditableDeliveryLogic";

interface Props {
  deliveryNote: any;
  onDeliveryChange: (deliveryNote: any) => void;
  clients?: any[];
  products?: any[];
  settings: any;
  logic: EditableDeliveryLogic;
  readOnly?: boolean;
}

/** "Épuré" theme for bons de livraison — hairlines, no fill colors, same restraint as EditableInvoiceEpure/OrderEditableEpure. */
export function DeliveryEditableEpure({ deliveryNote, clients, products, settings, logic, readOnly = false }: Props) {
  const accent = settings?.primary_color || "#476CFF";
  const phones = getCompanyPhones(settings);
  const legalFields = resolveLegalFields(settings);
  const {
    pages, client, totals, openPopoverIndex, setOpenPopoverIndex, openClientCombo, setOpenClientCombo,
    formatCurrency, updateDeliveryField, updateClient, updateItem, removeItem, handleAddProduct, items,
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
                      <div className="text-[17pt] font-bold uppercase tracking-[2px]">{deliveryNote.custom_title || "BON DE LIVRAISON"}</div>
                    ) : (
                      <Input
                        value={deliveryNote.custom_title || "BON DE LIVRAISON"}
                        onChange={(e) => updateDeliveryField('custom_title', e.target.value)}
                        className="h-auto text-[17pt] font-bold uppercase tracking-[2px] text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
                      />
                    )}
                    <div className="text-[9pt] text-gray-500 mt-1 flex items-center justify-end gap-1">
                      N°
                      {readOnly ? <span>{deliveryNote.delivery_number}</span> : (
                        <Input value={deliveryNote.delivery_number || ""} onChange={(e) => updateDeliveryField('delivery_number', e.target.value)} className="h-5 w-24 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[9pt]" />
                      )}
                      ·
                      {readOnly ? <span>{deliveryNote.delivery_date}</span> : (
                        <Input type="date" value={deliveryNote.delivery_date || ""} onChange={(e) => updateDeliveryField('delivery_date', e.target.value)} className="h-5 w-28 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[9pt]" />
                      )}
                    </div>
                  </div>
                </div>
                <div className="h-[1.5px] mb-6" style={{ backgroundColor: accent }} />

                <div className="flex justify-between mb-6">
                  <div className="w-[46%]">
                    <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Émetteur</div>
                    <div className="text-[11pt] font-bold uppercase mb-0.5">{settings?.company_name || ""}</div>
                    {settings?.company_address && <div className="text-[8.5pt] text-gray-600">{settings.company_address}</div>}
                    {settings?.company_rc && <div className="text-[8.5pt] text-gray-600">RC {settings.company_rc}</div>}
                  </div>
                  <div className="w-[46%] text-right">
                    <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Destinataire</div>
                    {!readOnly && clients && clients.length > 0 ? (
                      <Popover open={openClientCombo} onOpenChange={setOpenClientCombo}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" role="combobox" className="h-auto border-none bg-transparent p-0 text-[11pt] font-bold uppercase hover:bg-gray-50 w-full flex justify-end leading-tight mb-0.5 rounded-none">
                            {client?.name || "Sélectionner un client..."}
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="end">
                          <Command>
                            <CommandInput placeholder="Rechercher un client..." />
                            <CommandList>
                              <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                              <CommandGroup>
                                {clients.map((c) => (
                                  <CommandItem key={c.id} value={c.name} onSelect={() => { updateClient(c.id); setOpenClientCombo(false); }}>
                                    <Check className={cn("mr-2 h-4 w-4", deliveryNote.client_id === c.id ? "opacity-100" : "opacity-0")} />
                                    {c.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="text-[11pt] font-bold uppercase mb-0.5">{client?.name || "-"}</div>
                    )}
                    {client?.address && <div className="text-[8.5pt] text-gray-600">{client.address}</div>}
                    {client?.rc && <div className="text-[8.5pt] text-gray-600">RC {client.rc}</div>}
                  </div>
                </div>

                {isFirstPage && (
                  <div className="flex justify-between mb-6">
                    <div className="w-[46%]">
                      <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Détails Transport</div>
                      <div className="flex items-center gap-1.5 text-[8.5pt]">
                        <span className="text-gray-500 w-16 shrink-0">Chauffeur</span>
                        {readOnly ? <span>{deliveryNote.driver_name || "-"}</span> : (
                          <Input value={deliveryNote.driver_name || ""} onChange={(e) => updateDeliveryField('driver_name', e.target.value)} className="h-5 w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8.5pt]" placeholder="Nom du chauffeur..." />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[8.5pt]">
                        <span className="text-gray-500 w-16 shrink-0">Camion</span>
                        {readOnly ? <span>{deliveryNote.truck_plate || "-"}</span> : (
                          <Input value={deliveryNote.truck_plate || ""} onChange={(e) => updateDeliveryField('truck_plate', e.target.value)} className="h-5 w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8.5pt]" placeholder="Matricule..." />
                        )}
                      </div>
                    </div>
                    <div className="w-[46%] text-right">
                      <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Lieu de Livraison</div>
                      {readOnly ? <span className="text-[8.5pt]">{deliveryNote.delivery_location || "-"}</span> : (
                        <Input value={deliveryNote.delivery_location || ""} onChange={(e) => updateDeliveryField('delivery_location', e.target.value)} className="h-5 w-full border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[8.5pt]" placeholder="Lieu de livraison..." />
                      )}
                    </div>
                  </div>
                )}

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
                          <td className="py-2">{item.products?.code || item.product_code || ""}</td>
                          <td className="py-2">
                            {item.product_name || item.products?.name || ""}
                            {(item.product_description || item.products?.description) && (
                              <div className="text-[8pt] text-gray-500 italic">{item.product_description || item.products?.description}</div>
                            )}
                          </td>
                          <td className="py-2 text-right">{readOnly ? (item.quantity ?? 0).toFixed(3) : (
                            <Input type="number" step="0.001" value={item.quantity} onChange={(e) => updateItem(globalIdx, 'quantity', parseFloat(e.target.value) || 0)} className="h-5 w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[9pt]" />
                          )}</td>
                          <td className="py-2 text-right">{readOnly ? formatCurrency(item.unit_price) : (
                            <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateItem(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-5 w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[9pt]" />
                          )}</td>
                          <td className="py-2 text-center text-gray-400 italic text-[9pt]">{tvaLabel}</td>
                          <td className="py-2 text-right relative group-hover:pr-6">
                            {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                            {!readOnly && (
                              <button className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 p-1" onClick={() => removeItem(globalIdx)}><Trash2 className="w-3 h-3" /></button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {isLastPage && !readOnly && products && products.length > 0 && (
                      <tr>
                        <td colSpan={6} className="pt-2">
                          <Popover open={openPopoverIndex === -1} onOpenChange={(open) => setOpenPopoverIndex(open ? -1 : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" className="w-full h-7 text-[8pt] text-gray-400 hover:text-gray-700 rounded-none border-none"><Plus className="w-3.5 h-3.5 mr-1" /> Ajouter un produit</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-2">
                              <div className="max-h-60 overflow-y-auto space-y-1">
                                {products.filter((p) => !items.some((it: any) => String(it.product_id || it.products?.id) === String(p.id))).map((p) => (
                                  <Button key={p.id} variant="ghost" className="w-full justify-start text-left h-auto py-2" onClick={() => handleAddProduct(p, items.length - 1)}>
                                    <div className="flex flex-col"><span className="font-medium">{p.name}</span><span className="text-xs text-gray-500">Réf: {p.code} • {formatCurrency(p.unit_price || 0)}</span></div>
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

                {isLastPage && (
                  <>
                    <div className="flex justify-end mb-6">
                      <div className="w-[46%]">
                        <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">Total HT</span><span>{formatCurrency(totals.subtotal)}</span></div>
                        <div className="flex justify-between py-1 text-[8.5pt]"><span className="text-gray-500">Total TVA</span><span>{formatCurrency(totals.tva)}</span></div>
                        <div className="flex justify-between pt-2 mt-1 border-t" style={{ borderColor: '#111111' }}>
                          <span className="text-[10pt] font-bold">Net à Payer</span>
                          <span className="text-[12pt] font-bold" style={{ color: accent }}>{formatCurrency(totals.total)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Arrêté le présent bon de livraison à la somme de</div>
                      <div className="text-[8.5pt] text-gray-700 uppercase leading-relaxed">{numberToWords(totals.total)} Dinars Algériens</div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-6">
                      <div>
                        <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Notes</div>
                        {readOnly ? (
                          <p className="text-[8.5pt] text-gray-600 min-h-[36px]">{deliveryNote.notes || "-"}</p>
                        ) : (
                          <Textarea value={deliveryNote.notes || ""} onChange={(e) => updateDeliveryField('notes', e.target.value)} placeholder="Notes libres..." className="min-h-[36px] resize-none border border-gray-200 bg-gray-50 p-2 shadow-none focus-visible:ring-1 focus-visible:ring-gray-300 text-[8.5pt] w-full" />
                        )}
                      </div>
                      <div>
                        <div className="text-[7.5pt] text-red-500 uppercase tracking-wide mb-1">Réserves</div>
                        {readOnly ? (
                          <p className="text-[8.5pt] text-red-400 italic min-h-[36px]">{deliveryNote.reserves || "-"}</p>
                        ) : (
                          <Textarea value={deliveryNote.reserves || ""} onChange={(e) => updateDeliveryField('reserves', e.target.value)} placeholder="Réserves éventuelles..." className="min-h-[36px] resize-none border border-red-100 bg-red-50/30 p-2 shadow-none focus-visible:ring-1 focus-visible:ring-red-200 text-[8.5pt] text-red-600 italic w-full" />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-4">
                      <div className="border border-gray-200 rounded p-3 h-16 flex flex-col items-center justify-center text-center">
                        <span className="text-[8.5pt] font-bold uppercase tracking-wide">Réception Client</span>
                        <span className="text-[7.5pt] text-gray-400 italic mt-1">Signature et Date</span>
                      </div>
                      <div className="flex flex-col items-center justify-center relative">
                        {settings?.stamp_data && <img src={settings.stamp_data} alt="Cachet" style={{ maxHeight: 55 }} className="object-contain mb-1" />}
                        <div className="w-full h-px bg-gray-300 mb-1" />
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
