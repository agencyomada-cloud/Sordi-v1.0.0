import {
  Input, Textarea, Button, Popover, PopoverContent, PopoverTrigger,
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@sordi/ui";
import { RiAddLine as Plus, RiDeleteBinLine as Trash2, RiCheckLine as Check, RiExpandUpDownLine as ChevronsUpDown } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { getCompanyPhones, formatPhone, resolveInvoiceHtmlFontFamily } from "@/components/invoice/invoiceHtmlShared";
import { ProductPickerCombobox } from "@/components/ProductPickerCombobox";
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

/**
 * The one editable Bon de Livraison layout — deliberately no epure/moderne
 * variant here (unlike invoices/orders): DeliveryNotePDFDocument.tsx isn't
 * themed either, so this is the single source that stays in lockstep with
 * it instead of three hand-maintained copies that can each drift on their
 * own. Sections and column order match the PDF exactly: header (supplier
 * block + document box), client block, N°/Réf/Désignation/Qté/P.U HT/Total
 * HT table + totals box, réserves, dual signature boxes.
 */
export function DeliveryEditableStructure({
  deliveryNote, onDeliveryChange, clients, products,
  settings, logic, readOnly = false,
}: Props) {
  const primaryColor = settings?.primary_color || "#476CFF";
  const phones = getCompanyPhones(settings);
  const {
    client, openPopoverIndex, setOpenPopoverIndex, openClientCombo, setOpenClientCombo,
    updateDeliveryField, updateClient, updateItem, removeItem, handleAddProduct, handleAddCustomItem, items, totals, formatCurrency,
  } = logic;

  return (
    <div
      id="invoice-preview"
      className="a4 relative bg-white text-black mx-auto shadow-lg print:border-none print:shadow-none print:m-0"
      style={{ width: '210mm', minHeight: '297mm', paddingTop: '21mm', paddingLeft: '14mm', paddingRight: '14mm', paddingBottom: '15mm', fontFamily: resolveInvoiceHtmlFontFamily(settings) }}
    >
      {/* HEADER — logo + full supplier details left, document box right */}
      <div className="flex justify-between items-start border-b-2 pb-2.5 mb-3.5" style={{ borderColor: primaryColor }}>
        <div className="flex-1 pr-4">
          {settings?.logo_data && (
            <img src={settings.logo_data} className="h-10 max-w-[150px] object-contain object-left mb-1.5" alt={settings?.company_name || ""} />
          )}
          <div className="font-bold text-[12pt] mb-1">{settings?.company_name}</div>
          {settings?.company_address && <div className="text-[7.5pt] text-gray-700 mb-0.5">{settings.company_address}</div>}
          {settings?.company_rc && <div className="text-[7.5pt] text-gray-700 mb-0.5">RC: {settings.company_rc}</div>}
          {settings?.company_nif && <div className="text-[7.5pt] text-gray-700 mb-0.5">NIF: {settings.company_nif}</div>}
          {settings?.company_nis && <div className="text-[7.5pt] text-gray-700 mb-0.5">NIS: {settings.company_nis}</div>}
          {settings?.company_ai && <div className="text-[7.5pt] text-gray-700 mb-0.5">Article d'Imposition: {settings.company_ai}</div>}
          {phones.map((p, i) => <div key={i} className="text-[7.5pt] text-gray-700 mb-0.5">Tél: {formatPhone(p)}</div>)}
          {settings?.company_email && <div className="text-[7.5pt] text-gray-700 mb-0.5">{settings.company_email}</div>}
        </div>
        <div className="w-[190px] border border-gray-400 rounded p-2 shrink-0">
          <div className="text-center font-bold text-[13pt] mb-1.5 uppercase" style={{ color: primaryColor, letterSpacing: 1 }}>
            Bon de Livraison
          </div>
          <div className="flex items-center mb-1 gap-1">
            <span className="font-bold text-[7.5pt] w-[85px] shrink-0">N° BL</span>
            {readOnly ? <span className="text-[7.5pt]">{deliveryNote.delivery_number}</span> : (
              <Input value={deliveryNote.delivery_number || ""} onChange={(e) => updateDeliveryField('delivery_number', e.target.value)} className="h-5 flex-1 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[7.5pt]" placeholder="N°" />
            )}
          </div>
          <div className="flex items-center mb-0 gap-1">
            <span className="font-bold text-[7.5pt] w-[85px] shrink-0">Date</span>
            {readOnly ? <span className="text-[7.5pt]">{deliveryNote.delivery_date}</span> : (
              <DatePicker
                value={deliveryNote.delivery_date}
                onChange={(v) => updateDeliveryField('delivery_date', v)}
                showIcon={false}
                className="h-5 flex-1 border-none bg-transparent p-0 hover:bg-transparent text-[7.5pt]"
              />
            )}
          </div>
        </div>
      </div>

      {/* CLIENT BLOCK */}
      <div className="border border-gray-300 rounded p-2 mb-3">
        <div className="text-[7pt] font-bold text-gray-500 tracking-wide mb-1 uppercase">Client / Raison Sociale</div>
        {!readOnly && clients && clients.length > 0 ? (
          <Popover open={openClientCombo} onOpenChange={setOpenClientCombo}>
            <PopoverTrigger asChild>
              <Button variant="ghost" role="combobox" className="h-auto border-none bg-transparent p-0 text-[10.5pt] font-bold uppercase text-black hover:bg-gray-100 w-full flex justify-start leading-tight mb-1 rounded-none">
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
          <div className="font-bold text-[10.5pt] uppercase mb-1">{client?.name || "-"}</div>
        )}
        {(client?.address || client?.city || client?.wilaya) && (
          <div className="text-[8pt] text-gray-800 mb-0.5">
            Adresse: {[client?.address, client?.city, client?.wilaya].filter(Boolean).join(', ')}
          </div>
        )}
        {(client?.nif || client?.rc) && (
          <div className="text-[8pt] text-gray-800 mb-0.5">
            {[client?.nif && `NIF: ${client.nif}`, client?.rc && `RC: ${client.rc}`].filter(Boolean).join('   /   ')}
          </div>
        )}
        {(client?.contact_person || client?.phone) && (
          <div className="text-[8pt] text-gray-800">
            {[client?.contact_person && `Contact: ${client.contact_person}`, client?.phone && `Tél: ${client.phone}`].filter(Boolean).join('   /   ')}
          </div>
        )}
      </div>

      {/* DELIVERY TABLE — identical column set/styling to the invoice table
          (EditableInvoiceStructure.tsx): border-collapse black borders, p-2
          cells, text-xs, group hover:bg-gray-50. */}
      <table className="w-full border-collapse border border-black text-xs mb-3">
        <thead>
          <tr style={{ backgroundColor: primaryColor }} className="text-white font-bold border-b border-black">
            <th className="border border-black p-2 text-center uppercase" style={{ width: '6%' }}>N°</th>
            <th className="border border-black p-2 text-center uppercase" style={{ width: '12%' }}>Réf</th>
            <th className="border border-black p-2 text-center uppercase">Désignation</th>
            <th className="border border-black p-2 text-right uppercase" style={{ width: '10%' }}>Qté</th>
            <th className="border border-black p-2 text-right uppercase" style={{ width: '14%' }}>P.U HT</th>
            <th className="border border-black p-2 text-right uppercase" style={{ width: '16%' }}>Total HT</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, idx: number) => (
            <tr key={idx} className="border-b border-black group hover:bg-gray-50 relative">
              <td className="border border-black p-2 align-top">{String(idx + 1).padStart(2, '0')}</td>
              <td className="border border-black p-2 align-top font-mono">{item.product_code || item.products?.code || ""}</td>
              <td className="border border-black p-2 align-top font-bold uppercase relative group-hover:pr-8">
                {item.product_name || item.products?.name || ""}
                {!readOnly && (
                  <button className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 p-1" onClick={() => removeItem(idx)} title="Supprimer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </td>
              <td className="border border-black p-2 align-top text-right font-mono">
                {readOnly ? item.quantity : (
                  <Input type="number" step="1" data-line-index={idx} data-line-field="quantity" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="h-auto w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs font-mono" />
                )}
              </td>
              <td className="border border-black p-2 align-top text-right font-mono">
                {readOnly ? formatCurrency(item.unit_price) : (
                  <Input type="number" step="0.01" value={item.unit_price ?? 0} onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-auto w-full text-right border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs font-mono" />
                )}
              </td>
              <td className="border border-black p-2 align-top text-right font-mono">
                {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
              </td>
            </tr>
          ))}
          {!readOnly && (
            <tr className="border border-black">
              <td colSpan={6} className="p-0">
                <ProductPickerCombobox
                  products={products}
                  excludeProductIds={items.map((it: any) => it.product_id || it.products?.id)}
                  open={openPopoverIndex === -1}
                  onOpenChange={(open) => setOpenPopoverIndex(open ? -1 : null)}
                  onSelectProduct={(p) => handleAddProduct(p, items.length - 1)}
                  onAddCustomItem={(name) => handleAddCustomItem(name, items.length - 1)}
                  nextIndex={items.length}
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

      {/* CALCULATIONS SUMMARY BOX — same box styling as the invoice total
          (EditableInvoiceStructure.tsx): w-[42%], border-black, final row
          shaded instead of bordered. */}
      <div className="flex justify-end mb-3">
        <div className="w-[42%] border border-black text-xs">
          <div className="flex justify-between p-1.5 border-b border-black font-bold">
            <span>Total HT</span>
            <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between p-1.5 border-b border-black font-bold">
            <span>TVA (19%)</span>
            <span className="font-mono">{formatCurrency(totals.tva)}</span>
          </div>
          <div className="flex justify-between p-1.5 bg-gray-50 font-bold">
            <span>Total TTC / Net à Payer</span>
            <span className="font-mono">{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* RESERVES — kept compact so it doesn't crowd the items/signature areas */}
      {(deliveryNote.reserves || !readOnly) && (
        <div className={cn("border rounded px-2 py-1.5 mb-2", deliveryNote.reserves ? "border-red-300 bg-red-50" : "border-gray-200")}>
          <div className="text-[7pt] font-bold text-red-600 mb-0.5 uppercase">Réserves</div>
          {readOnly ? (
            <p className="text-[7.5pt] text-red-700">{deliveryNote.reserves}</p>
          ) : (
            <Textarea value={deliveryNote.reserves || ""} onChange={(e) => updateDeliveryField('reserves', e.target.value)} placeholder="Réserves éventuelles (colis endommagé, quantité manquante...)..." className="min-h-[20px] resize-none border-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[7.5pt] text-red-700 w-full" />
          )}
        </div>
      )}

      {/* SIGNATURE / RECEPTION — date and name fields are live inputs now;
          "Signature et Cachet" stays a blank line, filled by hand once
          printed (an actual signature can't be typed in). */}
      <div className="flex gap-3 mt-4">
        <div className="flex-1 border border-gray-400 rounded p-3">
          <div className="text-center font-bold text-[8pt] mb-3">Pour l'Entreprise (Visa / Cachet)</div>
          <div className="mb-3">
            <div className="text-[7pt] text-gray-500 mb-1">Date d'expédition</div>
            {readOnly ? (
              <div className="border-b border-gray-300 h-3.5 text-[7.5pt]">{deliveryNote.supplier_delivered_date || ""}</div>
            ) : (
              <DatePicker
                value={deliveryNote.supplier_delivered_date}
                onChange={(v) => updateDeliveryField('supplier_delivered_date', v)}
                showIcon={false}
                className="h-3.5 w-full border-none border-b border-gray-300 rounded-none bg-transparent p-0 hover:bg-transparent text-[7.5pt]"
              />
            )}
          </div>
          <div className="mb-2">
            <div className="text-[7pt] text-gray-500 mb-1">Nom & Signature</div>
            {readOnly ? (
              <div className="border-b border-gray-300 h-3.5 text-[7.5pt]">{deliveryNote.deliverer_name || ""}</div>
            ) : (
              <Input
                value={deliveryNote.deliverer_name || ""}
                onChange={(e) => updateDeliveryField('deliverer_name', e.target.value)}
                placeholder="Nom du livreur..."
                className="h-3.5 w-full border-none border-b border-gray-300 rounded-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[7.5pt]"
              />
            )}
          </div>
          {/* Dedicated area for the company stamp (cachet) + uploaded
              signature — deliberately separate from the typed name above.
              Signature in its own upper slot, stamp in its own lower slot,
              so an opaque stamp background can never cover the signature. */}
          {/* Bounded to this fixed physical slot on the printed note (unlike
              the invoice/order Cachet et Signature block, which sizes itself
              to content) — max-h-full lets a configured size render at its
              real height and only shrinks if it wouldn't otherwise fit. */}
          <div className="border-b border-gray-300 h-20 relative flex flex-col items-center justify-center gap-1 py-1">
            {settings?.signature_data && (
              <img
                src={settings.signature_data}
                alt="Signature"
                style={{ height: `${settings.signature_size || 44}px` }}
                className="relative z-10 max-h-11 w-auto max-w-full object-contain"
              />
            )}
            {settings?.stamp_data && (
              <img
                src={settings.stamp_data}
                alt="Cachet"
                style={{ height: `${settings.stamp_size || 32}px` }}
                className="max-h-8 w-auto max-w-full object-contain opacity-90"
              />
            )}
          </div>
        </div>
        <div className="flex-1 border border-gray-400 rounded p-3">
          <div className="text-center font-bold text-[8pt] mb-3">Reçu conforme et en bon état (Client)</div>
          <div className="mb-3">
            <div className="text-[7pt] text-gray-500 mb-1">Date de réception</div>
            {readOnly ? (
              <div className="border-b border-gray-300 h-3.5 text-[7.5pt]">{deliveryNote.client_received_date || ""}</div>
            ) : (
              <DatePicker
                value={deliveryNote.client_received_date}
                onChange={(v) => updateDeliveryField('client_received_date', v)}
                showIcon={false}
                className="h-3.5 w-full border-none border-b border-gray-300 rounded-none bg-transparent p-0 hover:bg-transparent text-[7.5pt]"
              />
            )}
          </div>
          <div className="mb-3">
            <div className="text-[7pt] text-gray-500 mb-1">Nom du réceptionnaire</div>
            {readOnly ? (
              <div className="border-b border-gray-300 h-3.5 text-[7.5pt]">{deliveryNote.client_signature || ""}</div>
            ) : (
              <Input
                value={deliveryNote.client_signature || ""}
                onChange={(e) => updateDeliveryField('client_signature', e.target.value)}
                placeholder="Nom du réceptionnaire..."
                className="h-3.5 w-full border-none border-b border-gray-300 rounded-none bg-transparent p-0 shadow-none focus-visible:ring-0 text-[7.5pt]"
              />
            )}
          </div>
          <div>
            <div className="text-[7pt] text-gray-500 mb-1">Signature et Cachet</div>
            <div className="border-b border-gray-300 h-20" />
          </div>
        </div>
      </div>

      <div className="text-center text-[6.5pt] text-gray-500 mt-3">
        Les marchandises voyagent aux risques et périls du destinataire. Toute réserve doit être formulée à la réception.
      </div>
    </div>
  );
}
