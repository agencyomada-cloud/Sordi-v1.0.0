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

/** "Structuré" theme for bons de livraison — same header band/bordered grid/footer chrome as EditableInvoiceStructure/OrderEditableStructure. */
export function DeliveryEditableStructure({ deliveryNote, clients, products, settings, logic, readOnly = false }: Props) {
  const primaryColor = settings?.primary_color || "#476CFF";
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
                  <div className="flex justify-between items-start mb-4 text-xs">
                    <div className="w-[55%] space-y-1">
                      <div className="text-gray-500 text-[11px] font-medium uppercase">Émetteur</div>
                      <div className="font-extrabold text-sm text-black uppercase mb-1">{settings?.company_name || ""}</div>
                      {settings?.company_address && <div className="text-gray-700 uppercase text-[11px] font-semibold">{settings.company_address}</div>}
                      <div className="space-y-0.5 pt-1 text-[11px] text-gray-700 uppercase">
                        {settings?.company_rc && <div><span className="font-bold">RC:</span> {settings.company_rc}</div>}
                        {settings?.company_nif && <div><span className="font-bold">NIF:</span> {settings.company_nif}</div>}
                      </div>
                    </div>

                    <div className="w-[42%] text-xs space-y-1.5 pt-1 text-right">
                      <div className="text-gray-500 text-[11px] font-medium uppercase mb-1">Destinataire</div>
                      {!readOnly && clients && clients.length > 0 ? (
                        <Popover open={openClientCombo} onOpenChange={setOpenClientCombo}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" role="combobox" className="h-auto border-none bg-transparent p-0 text-sm font-bold uppercase text-black hover:bg-gray-100 w-full flex justify-end leading-tight mb-1 rounded-none">
                              {client?.name || "Sélectionner un client..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                        <div className="font-extrabold text-sm text-black uppercase mb-1">{client?.name || "-"}</div>
                      )}
                      {client?.address && <div className="text-[11px] text-gray-700 uppercase">{client.address}</div>}
                      {client?.rc && <div className="text-[11px] text-gray-700"><span className="font-bold">RC:</span> {client.rc}</div>}
                      {client?.nif && <div className="text-[11px] text-gray-700"><span className="font-bold">NIF:</span> {client.nif}</div>}
                    </div>
                  </div>

                  <div className="flex justify-between items-start mb-4">
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="font-bold">Date:</span>
                        {readOnly ? <span>{deliveryNote.delivery_date}</span> : (
                          <Input type="date" value={deliveryNote.delivery_date || ""} onChange={(e) => updateDeliveryField('delivery_date', e.target.value)} className="h-5 w-32 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold">Numéro:</span>
                        {readOnly ? <span className="font-bold uppercase">{deliveryNote.delivery_number}</span> : (
                          <Input value={deliveryNote.delivery_number || ""} onChange={(e) => updateDeliveryField('delivery_number', e.target.value)} className="h-5 w-32 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 font-bold uppercase text-xs" placeholder="N°" />
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {readOnly ? (
                        <div className="text-[15px] font-bold uppercase tracking-wide text-gray-800">{deliveryNote.custom_title || "BON DE LIVRAISON"}</div>
                      ) : (
                        <Input
                          value={deliveryNote.custom_title || "BON DE LIVRAISON"}
                          onChange={(e) => updateDeliveryField('custom_title', e.target.value)}
                          className="h-auto text-[15px] font-bold uppercase tracking-wide text-gray-800 text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
                        />
                      )}
                    </div>
                  </div>

                  {isFirstPage && (
                    <div className="grid grid-cols-2 gap-8 mb-4 text-xs">
                      <div className="space-y-0.5">
                        <div className="text-gray-500 text-[11px] font-medium uppercase mb-1">Détails Transport</div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold w-16 shrink-0">Chauffeur:</span>
                          {readOnly ? <span>{deliveryNote.driver_name || "-"}</span> : (
                            <Input value={deliveryNote.driver_name || ""} onChange={(e) => updateDeliveryField('driver_name', e.target.value)} className="h-5 w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs" placeholder="Nom du chauffeur..." />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold w-16 shrink-0">Camion:</span>
                          {readOnly ? <span>{deliveryNote.truck_plate || "-"}</span> : (
                            <Input value={deliveryNote.truck_plate || ""} onChange={(e) => updateDeliveryField('truck_plate', e.target.value)} className="h-5 w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs" placeholder="Matricule..." />
                          )}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-gray-500 text-[11px] font-medium uppercase mb-1">Lieu de Livraison</div>
                        {readOnly ? <span className="text-xs">{deliveryNote.delivery_location || "-"}</span> : (
                          <Input value={deliveryNote.delivery_location || ""} onChange={(e) => updateDeliveryField('delivery_location', e.target.value)} className="h-5 w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs" placeholder="Lieu de livraison..." />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <table className="w-full border-collapse border border-black text-xs">
                      <thead>
                        <tr style={{ backgroundColor: primaryColor }} className="text-white font-bold border-b border-black">
                          <th className="border border-black p-2 text-left uppercase" style={{ width: '15%' }}>Code</th>
                          <th className="border border-black p-2 text-left uppercase">Désignation</th>
                          <th className="border border-black p-2 text-right uppercase" style={{ width: '12%' }}>Qté</th>
                          <th className="border border-black p-2 text-right uppercase" style={{ width: '15%' }}>P.U HT</th>
                          <th className="border border-black p-2 text-center uppercase" style={{ width: '10%' }}>TVA</th>
                          <th className="border border-black p-2 text-right uppercase" style={{ width: '15%' }}>Total HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((item: any, relIdx: number) => {
                          const globalIdx = startIdx + relIdx;
                          const tvaLabel = item.tva_rate === -1 ? "Exo" : (item.tva_rate === null || item.tva_rate === 0) ? "0%" : item.tva_rate === undefined ? "19%" : `${item.tva_rate}%`;
                          return (
                            <tr key={globalIdx} className="border-b border-black group relative">
                              <td className="border border-black p-2 align-top">{item.products?.code || item.product_code || ""}</td>
                              <td className="border border-black p-2 align-top font-bold uppercase">
                                {item.product_name || item.products?.name || ""}
                                {(item.product_description || item.products?.description) && (
                                  <div className="font-normal text-[10px] normal-case mt-0.5 text-gray-600">{item.product_description || item.products?.description}</div>
                                )}
                              </td>
                              <td className="border border-black p-2 align-top text-right">
                                {readOnly ? (item.quantity ?? 0).toFixed(3) : (
                                  <Input type="number" step="0.001" value={item.quantity} onChange={(e) => updateItem(globalIdx, 'quantity', parseFloat(e.target.value) || 0)} className="h-auto w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs" />
                                )}
                              </td>
                              <td className="border border-black p-2 align-top text-right">
                                {readOnly ? formatCurrency(item.unit_price) : (
                                  <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateItem(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-auto w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs" />
                                )}
                              </td>
                              <td className="border border-black p-2 align-top text-center text-gray-500 italic">{tvaLabel}</td>
                              <td className="border border-black p-2 align-top text-right font-bold relative group-hover:pr-8">
                                {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                                {!readOnly && (
                                  <button className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 p-1" onClick={() => removeItem(globalIdx)} title="Supprimer">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {isLastPage && !readOnly && products && products.length > 0 && (
                          <tr>
                            <td colSpan={6} className="border border-black p-0">
                              <Popover open={openPopoverIndex === -1} onOpenChange={(open) => setOpenPopoverIndex(open ? -1 : null)}>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" className="w-full h-8 text-xs text-gray-500 hover:text-gray-900 rounded-none bg-gray-50 border-none"><Plus className="w-4 h-4 mr-1" /> Ajouter un produit</Button>
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
                      <div className="flex justify-end mb-4">
                        <div className="w-[42%] border border-black text-xs">
                          <div className="flex justify-between p-1.5 border-b border-black font-bold">
                            <span>Total HT</span><span className="font-mono">{formatCurrency(totals.subtotal)}</span>
                          </div>
                          <div className="flex justify-between p-1.5 border-b border-black font-bold">
                            <span>Total TVA</span><span className="font-mono">{formatCurrency(totals.tva)}</span>
                          </div>
                          <div className="flex justify-between p-1.5 font-bold bg-gray-50">
                            <span>Net à Payer</span><span className="font-mono">{formatCurrency(totals.total)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-[11px] text-gray-800">ARRÊTÉ LE PRÉSENT BON DE LIVRAISON À LA SOMME DE :</div>
                        <div className="mt-1 font-extrabold text-xs text-black uppercase tracking-wide">{numberToWords(totals.total)} Dinars Algériens</div>
                      </div>

                      <div className="grid grid-cols-2 gap-8 mb-4 text-xs">
                        <div>
                          <div className="font-bold uppercase text-[11px] mb-1">Notes</div>
                          {readOnly ? (
                            <p className="text-gray-600 min-h-[36px]">{deliveryNote.notes || "-"}</p>
                          ) : (
                            <Textarea value={deliveryNote.notes || ""} onChange={(e) => updateDeliveryField('notes', e.target.value)} placeholder="Notes libres..." className="min-h-[36px] resize-none border border-gray-200 bg-gray-50 p-2 shadow-none focus-visible:ring-1 focus-visible:ring-gray-300 text-xs w-full" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold uppercase text-[11px] mb-1 text-red-600">Réserves</div>
                          {readOnly ? (
                            <p className="text-red-400 italic min-h-[36px]">{deliveryNote.reserves || "-"}</p>
                          ) : (
                            <Textarea value={deliveryNote.reserves || ""} onChange={(e) => updateDeliveryField('reserves', e.target.value)} placeholder="Réserves éventuelles..." className="min-h-[36px] resize-none border border-red-100 bg-red-50/30 p-2 shadow-none focus-visible:ring-1 focus-visible:ring-red-200 text-xs text-red-600 italic w-full" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div className="border border-gray-200 rounded p-3 h-20 flex flex-col items-center justify-center text-center">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-black">Réception Client</span>
                          <span className="text-[9px] text-gray-400 italic mt-1">Signature et Date</span>
                        </div>
                        <div className="flex flex-col items-center">
                          {settings?.stamp_data && <img src={settings.stamp_data} alt="Cachet" style={{ maxHeight: 65, maxWidth: 140 }} className="object-contain" />}
                          <span className="font-bold text-xs underline mt-1">Cachet et Signature</span>
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
                  {settings?.company_rib && <div><strong>RIB:</strong> {settings.company_rib}{settings?.company_bank_agency && <><br />{settings.company_bank_agency}</>}</div>}
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
