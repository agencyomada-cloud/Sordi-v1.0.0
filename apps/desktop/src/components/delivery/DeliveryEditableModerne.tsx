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

/** "Moderne" theme for bons de livraison — accent header band + rounded cards, same visual language as EditableInvoiceModerne/OrderEditableModerne. */
export function DeliveryEditableModerne({ deliveryNote, clients, products, settings, logic, readOnly = false }: Props) {
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
                    <div className="text-white text-[16pt] font-bold uppercase tracking-wide">{deliveryNote.custom_title || "BON DE LIVRAISON"}</div>
                  ) : (
                    <Input
                      value={deliveryNote.custom_title || "BON DE LIVRAISON"}
                      onChange={(e) => updateDeliveryField('custom_title', e.target.value)}
                      className="h-auto text-white text-[16pt] font-bold uppercase tracking-wide text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
                    />
                  )}
                  <div className="text-white/85 text-[8.5pt] mt-1 flex items-center justify-end gap-1">
                    N°
                    {readOnly ? <span>{deliveryNote.delivery_number}</span> : (
                      <Input value={deliveryNote.delivery_number || ""} onChange={(e) => updateDeliveryField('delivery_number', e.target.value)} className="h-5 w-24 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[8.5pt] text-white placeholder:text-white/60" />
                    )}
                    ·
                    {readOnly ? <span>{deliveryNote.delivery_date}</span> : (
                      <Input type="date" value={deliveryNote.delivery_date || ""} onChange={(e) => updateDeliveryField('delivery_date', e.target.value)} className="h-5 w-28 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[8.5pt] text-white" />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 px-[14mm] py-[9mm] flex flex-col justify-between overflow-hidden">
                <div>
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1 bg-gray-50 rounded-[10px] p-3.5">
                      <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Émetteur</div>
                      <div className="text-[10.5pt] font-bold uppercase mb-1">{settings?.company_name || ""}</div>
                      {settings?.company_address && <div className="text-[8pt] text-gray-600">{settings.company_address}</div>}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-[10px] p-3.5">
                      <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Destinataire</div>
                      {!readOnly && clients && clients.length > 0 ? (
                        <Popover open={openClientCombo} onOpenChange={setOpenClientCombo}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" role="combobox" className="h-auto border-none bg-transparent p-0 text-[10.5pt] font-bold uppercase hover:bg-gray-100 w-full flex justify-start leading-tight mb-1 rounded-none">
                              {client?.name || "Sélectionner un client..."}
                              <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
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
                        <div className="text-[10.5pt] font-bold uppercase mb-1">{client?.name || "-"}</div>
                      )}
                      {client?.address && <div className="text-[8pt] text-gray-600">{client.address}</div>}
                    </div>
                  </div>

                  {isFirstPage && (
                    <div className="flex gap-3 mb-5">
                      <div className="flex-1 bg-gray-50 rounded-[10px] p-3.5">
                        <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Détails Transport</div>
                        <div className="flex items-center gap-1.5 text-[8pt]">
                          <span className="text-gray-500 w-16 shrink-0">Chauffeur</span>
                          {readOnly ? <span>{deliveryNote.driver_name || "-"}</span> : (
                            <Input value={deliveryNote.driver_name || ""} onChange={(e) => updateDeliveryField('driver_name', e.target.value)} className="h-4 flex-1 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8pt]" placeholder="Nom du chauffeur..." />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[8pt]">
                          <span className="text-gray-500 w-16 shrink-0">Camion</span>
                          {readOnly ? <span>{deliveryNote.truck_plate || "-"}</span> : (
                            <Input value={deliveryNote.truck_plate || ""} onChange={(e) => updateDeliveryField('truck_plate', e.target.value)} className="h-4 flex-1 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8pt]" placeholder="Matricule..." />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-[10px] p-3.5">
                        <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Lieu de Livraison</div>
                        {readOnly ? <span className="text-[8pt]">{deliveryNote.delivery_location || "-"}</span> : (
                          <Input value={deliveryNote.delivery_location || ""} onChange={(e) => updateDeliveryField('delivery_location', e.target.value)} className="h-4 w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8pt]" placeholder="Lieu de livraison..." />
                        )}
                      </div>
                    </div>
                  )}

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
                              <td className="px-2.5 py-2">{item.products?.code || item.product_code || ""}</td>
                              <td className="px-2.5 py-2 font-bold">
                                {item.product_name || item.products?.name || ""}
                                {(item.product_description || item.products?.description) && (
                                  <div className="text-[7.5pt] font-normal text-gray-500">{item.product_description || item.products?.description}</div>
                                )}
                              </td>
                              <td className="px-2.5 py-2 text-right">{readOnly ? (item.quantity ?? 0).toFixed(3) : (
                                <Input type="number" step="0.001" value={item.quantity} onChange={(e) => updateItem(globalIdx, 'quantity', parseFloat(e.target.value) || 0)} className="h-5 w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8.5pt]" />
                              )}</td>
                              <td className="px-2.5 py-2 text-right">{readOnly ? formatCurrency(item.unit_price) : (
                                <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateItem(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-5 w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8.5pt]" />
                              )}</td>
                              <td className="px-2.5 py-2 text-center text-gray-500 text-[8pt]">{tvaLabel}</td>
                              <td className="px-2.5 py-2 text-right relative group-hover:pr-6">
                                {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                                {!readOnly && (
                                  <button className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 p-1" onClick={() => removeItem(globalIdx)}><Trash2 className="w-3 h-3" /></button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {isLastPage && !readOnly && products && products.length > 0 && (
                          <tr>
                            <td colSpan={6} className="p-0">
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
                  </div>

                  {isLastPage && (
                    <>
                      <div className="flex justify-end mb-5">
                        <div className="w-[46%] bg-gray-50 rounded-[10px] p-3">
                          <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">Total HT</span><span>{formatCurrency(totals.subtotal)}</span></div>
                          <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">Total TVA</span><span>{formatCurrency(totals.tva)}</span></div>
                          <div className="flex justify-between rounded-lg px-2.5 py-1.5 mt-1.5" style={{ backgroundColor: accent }}>
                            <span className="text-[9.5pt] font-bold text-white">Net à Payer</span>
                            <span className="text-[11pt] font-bold text-white">{formatCurrency(totals.total)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-5">
                        <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">Arrêté le présent bon de livraison à la somme de</div>
                        <div className="text-[8.5pt] text-gray-700 uppercase leading-relaxed">{numberToWords(totals.total)} Dinars Algériens</div>
                      </div>

                      <div className="flex gap-3 mb-5">
                        <div className="flex-1 bg-gray-50 rounded-[10px] p-3">
                          <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Notes</div>
                          {readOnly ? (
                            <p className="text-[8.5pt] text-gray-600 min-h-[32px]">{deliveryNote.notes || "-"}</p>
                          ) : (
                            <Textarea value={deliveryNote.notes || ""} onChange={(e) => updateDeliveryField('notes', e.target.value)} placeholder="Notes libres..." className="min-h-[32px] resize-none border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8.5pt] w-full" />
                          )}
                        </div>
                        <div className="flex-1 bg-red-50/60 rounded-[10px] p-3">
                          <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5 text-red-500">Réserves</div>
                          {readOnly ? (
                            <p className="text-[8.5pt] text-red-500 italic min-h-[32px]">{deliveryNote.reserves || "-"}</p>
                          ) : (
                            <Textarea value={deliveryNote.reserves || ""} onChange={(e) => updateDeliveryField('reserves', e.target.value)} placeholder="Réserves éventuelles..." className="min-h-[32px] resize-none border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[8.5pt] text-red-500 italic w-full" />
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="flex-1 bg-gray-50 rounded-[10px] p-3 h-16 flex flex-col items-center justify-center text-center">
                          <span className="text-[8.5pt] font-bold uppercase tracking-wide">Réception Client</span>
                          <span className="text-[7.5pt] text-gray-400 italic mt-1">Signature et Date</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center">
                          {settings?.stamp_data && <img src={settings.stamp_data} alt="Cachet" style={{ maxHeight: 55 }} className="object-contain mb-1" />}
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
