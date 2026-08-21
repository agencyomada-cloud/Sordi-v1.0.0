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

/** "Structuré" theme for bons de commande — same header band/bordered grid/footer chrome as EditableInvoiceStructure, order-specific content (free-typed items, supplier fields, no TVA/timbre-breakdown concerns since orders never carried those). */
export function OrderEditableStructure({ order, clients, settings, logic, readOnly = false }: Props) {
  const primaryColor = settings?.primary_color || "#476CFF";
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
                  <div className="flex justify-between items-start mb-6 text-xs">
                    <div className="w-[55%] space-y-1">
                      <div className="text-gray-500 text-[11px] font-medium uppercase">Émetteur</div>
                      <div className="font-extrabold text-sm text-black uppercase mb-1">{settings?.company_name || ""}</div>
                      {settings?.company_address && <div className="text-gray-700 uppercase text-[11px] font-semibold">{settings.company_address}</div>}
                      <div className="space-y-0.5 pt-1 text-[11px] text-gray-700 uppercase">
                        {settings?.company_rc && <div><span className="font-bold">RC:</span> {settings.company_rc}</div>}
                        {settings?.company_nif && <div><span className="font-bold">NIF:</span> {settings.company_nif}</div>}
                        {settings?.company_nis && <div><span className="font-bold">NIS:</span> {settings.company_nis}</div>}
                        {settings?.company_ai && <div><span className="font-bold">AI:</span> {settings.company_ai}</div>}
                      </div>
                    </div>

                    <div className="w-[42%] text-xs space-y-1.5 pt-1 text-right">
                      <div className="text-gray-500 text-[11px] font-medium uppercase mb-1">Fournisseur</div>
                      {readOnly ? (
                        <div className="font-extrabold text-sm text-black uppercase">{order.supplier_name || "-"}</div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            value={order.supplier_name || ""}
                            onChange={(e) => updateOrderField('supplier_name', e.target.value)}
                            className="h-auto border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 font-extrabold text-sm uppercase"
                            placeholder="Nom du fournisseur"
                          />
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
                          {order.supplier_address && <div className="text-[11px] text-gray-700 uppercase">{order.supplier_address}</div>}
                          {order.supplier_rc && <div className="text-[11px] text-gray-700"><span className="font-bold">RC:</span> {order.supplier_rc}</div>}
                          {order.supplier_nif && <div className="text-[11px] text-gray-700"><span className="font-bold">NIF:</span> {order.supplier_nif}</div>}
                          {order.supplier_nis && <div className="text-[11px] text-gray-700"><span className="font-bold">NIS:</span> {order.supplier_nis}</div>}
                          {order.supplier_ai && <div className="text-[11px] text-gray-700"><span className="font-bold">AI:</span> {order.supplier_ai}</div>}
                        </>
                      ) : (
                        <div className="space-y-0.5 text-[11px] text-gray-700">
                          {[
                            { field: 'supplier_address', label: 'Adresse', placeholder: 'Adresse...' },
                            { field: 'supplier_rc', label: 'RC', placeholder: '00 B 0000000' },
                            { field: 'supplier_nif', label: 'NIF', placeholder: '000000000000000' },
                            { field: 'supplier_nis', label: 'NIS', placeholder: '000000000000000' },
                            { field: 'supplier_ai', label: 'AI', placeholder: '00000000000' },
                          ].map(({ field, label, placeholder }) => (
                            <div key={field} className="flex items-center justify-end gap-1">
                              <span className="font-bold shrink-0">{label}:</span>
                              <Input
                                value={(order as any)[field] || ""}
                                onChange={(e) => updateOrderField(field, e.target.value)}
                                className="h-auto w-32 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 text-[11px]"
                                placeholder={placeholder}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-start mb-4">
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="font-bold">Date:</span>
                        {readOnly ? <span>{order.order_date}</span> : (
                          <Input type="date" value={order.order_date || ""} onChange={(e) => updateOrderField('order_date', e.target.value)} className="h-5 w-32 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold">Numéro:</span>
                        {readOnly ? <span className="font-bold uppercase">{order.order_number}</span> : (
                          <Input value={order.order_number || ""} onChange={(e) => updateOrderField('order_number', e.target.value)} className="h-5 w-32 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 font-bold uppercase text-xs" placeholder="N°" />
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {readOnly ? (
                        <div className="text-[15px] font-bold uppercase tracking-wide text-gray-800">{order.custom_title || "BON DE COMMANDE"}</div>
                      ) : (
                        <Input
                          value={order.custom_title || "BON DE COMMANDE"}
                          onChange={(e) => updateOrderField('custom_title', e.target.value)}
                          className="h-auto text-[15px] font-bold uppercase tracking-wide text-gray-800 text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
                        />
                      )}
                    </div>
                  </div>

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
                              <td className="border border-black p-2 align-top">
                                {readOnly ? (item.product_code || "") : (
                                  <Input value={item.product_code || ""} onChange={(e) => updateItem(globalIdx, 'product_code', e.target.value)} className="h-auto w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs" placeholder="Code" />
                                )}
                              </td>
                              <td className="border border-black p-2 align-top font-bold uppercase">
                                {readOnly ? (
                                  <>
                                    {item.product_name || ""}
                                    {item.product_description && <div className="font-normal text-[10px] normal-case mt-0.5 text-gray-600">{item.product_description}</div>}
                                  </>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <Input value={item.product_name || ""} onChange={(e) => updateItem(globalIdx, 'product_name', e.target.value)} className="h-auto w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs font-bold uppercase" placeholder="Désignation" />
                                    <Input value={item.product_description || ""} onChange={(e) => updateItem(globalIdx, 'product_description', e.target.value)} className="h-auto w-full border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[10px] font-normal normal-case text-gray-600" placeholder="Description..." />
                                  </div>
                                )}
                              </td>
                              <td className="border border-black p-2 align-top text-right">
                                {readOnly ? (item.quantity ?? 0) : (
                                  <Input type="number" step="0.001" value={item.quantity} onChange={(e) => updateItem(globalIdx, 'quantity', parseFloat(e.target.value) || 0)} className="h-auto w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs" />
                                )}
                              </td>
                              <td className="border border-black p-2 align-top text-right">
                                {readOnly ? formatCurrency(item.unit_price) : (
                                  <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateItem(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-auto w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs" />
                                )}
                              </td>
                              <td className="border border-black p-2 align-top text-center text-gray-500 italic">
                                {readOnly ? tvaLabel : (
                                  <Popover open={openPopoverIndex === globalIdx} onOpenChange={(open) => setOpenPopoverIndex(open ? globalIdx : null)}>
                                    <PopoverTrigger asChild>
                                      <button className="w-full text-xs italic text-gray-500 hover:text-black">{tvaLabel}</button>
                                    </PopoverTrigger>
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
                        {isLastPage && !readOnly && (
                          <tr>
                            <td colSpan={6} className="border border-black p-0">
                              <Button variant="ghost" className="w-full h-8 text-xs text-gray-500 hover:text-gray-900 rounded-none bg-gray-50 border-none" onClick={addItem}>
                                <Plus className="w-4 h-4 mr-1" /> Ajouter une ligne
                              </Button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {isFirstPage && (
                      <div className="mt-3">
                        {readOnly ? (
                          <p className="text-xs text-gray-600 min-h-[20px]">{order.notes || ""}</p>
                        ) : (
                          <Textarea
                            value={order.notes || ""}
                            onChange={(e) => updateOrderField('notes', e.target.value)}
                            placeholder="Ajouter des notes..."
                            className="min-h-[40px] resize-none border border-gray-200 bg-gray-50 p-2 shadow-none focus-visible:ring-1 focus-visible:ring-gray-300 text-xs text-black font-normal w-full"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {isLastPage && (
                    <>
                      <div className="flex justify-end mb-4">
                        <div className="w-[42%] border border-black text-xs">
                          <div className="flex justify-between p-1.5 border-b border-black font-bold">
                            <span>Total HT</span><span className="font-mono">{formatCurrency(order.subtotal_ht || 0)}</span>
                          </div>
                          <div className="flex justify-between p-1.5 border-b border-black font-bold">
                            <span>Total TVA</span><span className="font-mono">{formatCurrency(order.tva_amount || 0)}</span>
                          </div>
                          <div className="flex justify-between p-1.5 font-bold bg-gray-50">
                            <span>Total TTC</span><span className="font-mono">{formatCurrency(order.total_ttc || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <ArreteSumBlock total={order.total_ttc || 0} label="ARRÊTÉ LE PRÉSENT BON DE COMMANDE À LA SOMME DE :" />
                        <div className="flex justify-end items-start mt-2">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-xs underline mb-1">Cachet et Signature</span>
                            {settings?.stamp_data && <img src={settings.stamp_data} alt="Cachet" style={{ maxHeight: 65, maxWidth: 140 }} className="object-contain mt-0.5" />}
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

function ArreteSumBlock({ total, label }: { total: number; label: string }) {
  return (
    <>
      <div className="text-[11px] text-gray-800">{label}</div>
      <div className="mt-1 font-extrabold text-xs text-black uppercase tracking-wide">{numberToWords(total)} Dinars Algériens</div>
    </>
  );
}
