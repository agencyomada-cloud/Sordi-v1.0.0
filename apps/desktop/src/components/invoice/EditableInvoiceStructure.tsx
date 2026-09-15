import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, Textarea, Button } from "@sordi/ui";
import {
  RiAddLine as Plus,
  RiDeleteBinLine as Trash2,
  RiExpandUpDownLine as ChevronsUpDown,
  RiArrowUpSLine as ChevronUp,
  RiArrowDownSLine as ChevronDown,
  RiBookmarkLine as BookmarkPlus,
  RiLoader4Line as Loader2,
} from "@remixicon/react";
import { toast } from "sonner";
import { useCreateProduct } from "@/hooks/useProducts";
import { DatePicker } from "@/components/ui/date-picker";
import { numberToWords } from "@/lib/numberToWords";
import { getContrastTextColor } from "@/lib/colorContrast";
import { InvoiceLogoPlaceholder } from "./InvoiceLogoPlaceholder";
import { getCompanyPhones, formatPhone, resolveLegalFields, resolveInvoiceHtmlFontFamily } from "./invoiceHtmlShared";
import { readInvoiceBoolSetting } from "@/components/pdf/invoicePdfShared";
import { ProductPickerCombobox } from "@/components/ProductPickerCombobox";
import { ClientPickerCombobox } from "./ClientPickerCombobox";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { useScaleToFitContainer } from "./scaleToFitContext";
import { EditableInvoiceLogic } from "./useEditableInvoiceLogic";

import { InteractiveStampZone } from "./InteractiveStampZone";

interface Props {
  invoice: any;
  onInvoiceChange: (invoice: any) => void;
  clients?: any[];
  /** Bon de commande only — see EditableInvoicePreview's own doc comment. */
  suppliers?: any[];
  products?: any[];
  settings: any;
  logic: EditableInvoiceLogic;
  stampSize?: number;
  onStampSizeChange?: (size: number) => void;
  onStampSizeCommit?: (size: number) => void;
}

export function EditableInvoiceStructure({
  invoice,
  onInvoiceChange,
  clients,
  suppliers,
  products,
  settings,
  logic,
  stampSize,
  onStampSizeChange,
  onStampSizeCommit,
}: Props) {
  const primaryColor = settings?.primary_color || "#FF2949";
  const phones = getCompanyPhones(settings);
  const legalFields = resolveLegalFields(settings);
  const scaleContainer = useScaleToFitContainer();
  const {
    paymentMode, discountRate, discountType, setDiscountType,
    openPopoverIndex, setOpenPopoverIndex, openClientCombo, setOpenClientCombo,
    pages, subtotal, tvaAmount, timbre, discountAmount, netTotal,
    isCreditNote, isProforma, isOrder, docTitle, showTva, showTimbre, showMontantEnLettres, showPaymentMethod, showPricing, recipientLabel, recipientPlaceholder, stampLabel, grandTotalLabel, isTaxExempt, amountInWordsLabel,
    formatCurrency,
    updateInvoiceField, selectClient, handlePaymentModeChange,
    handleDiscountRateChange, handleDiscountAmountChange,
    handleItemUpdate, handleAddProduct, handleAddCustomItem, handleDeleteItem,
    items, moveItemUp, moveItemDown,
  } = logic;
  // The recipient picker's data source — a bon de commande addresses a
  // supplier, every other document type a client. Both lists share the
  // same shape (id/name/address/rc/nif/nis at minimum) so ClientPickerCombobox
  // needs no changes of its own to accept either.
  const recipientList = isOrder ? suppliers : clients;

  const createProduct = useCreateProduct();
  // Registers a custom-typed line (no product_id — not yet in the catalog)
  // using its CURRENT live values, unlike ProductPickerCombobox's own
  // "Enregistrer au catalogue" (which only fires at add-time, before a
  // price/unit has even been typed in). A generated reference code, same
  // convention as that picker, since the catalog requires one.
  const handleSaveItemToCatalog = async (item: any) => {
    const name = (item.product_name || item.products?.name || item.name || "").trim();
    if (!name || createProduct.isPending) return;
    try {
      const code = `CUSTOM-${Date.now().toString(36).toUpperCase()}`;
      await createProduct.mutateAsync({
        code,
        name,
        unit_price: item.unit_price || 0,
        unit: item.products?.unit || item.unit || undefined,
        tva_rate: item.tva_rate,
      });
      toast.success("Produit ajouté au catalogue");
    } catch {
      // useCreateProduct's mutation already toasts the error.
    }
  };

  // Enter in the price/quantity fields opens the same "Ajouter un article"
  // picker the trailing row's button does — keyboard-first multi-line entry
  // without leaving the keyboard: type price/qty, Enter, type the next
  // item's name in the picker (autofocused), select/Enter again, its
  // quantity is auto-focused (see ProductPickerCombobox's focusLineQuantity)
  // and the cycle repeats.
  const handleLineEntryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setOpenPopoverIndex(-1);
    }
  };

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
            className="a4 relative bg-white dark:bg-white text-black font-sans mx-auto select-text border border-border/80 dark:border-neutral-700 shadow-sm rounded-[2px] print:border-none print:shadow-none print:m-0 mb-8"
            style={{ width: '210mm', height: '297mm', position: 'relative', overflow: 'hidden', backgroundColor: '#ffffff', fontFamily: resolveInvoiceHtmlFontFamily(settings) }}
          >
            {isFirstPage && <InvoiceStatusBadge status={invoice.status} />}
            <header className="absolute top-0 left-0 w-full h-[33.9mm] bg-white z-10">
              <div className="absolute top-0 left-0 w-[50%] h-[25.7mm] pt-[3mm] pl-[5mm] flex flex-col items-start gap-1">
                {settings?.logo_data ? (
                  <img
                    src={settings.logo_data}
                    style={{ maxHeight: Number(settings?.logo_size) || 60, maxWidth: 180 }}
                    className="h-auto w-auto object-contain object-left"
                    alt="Logo"
                  />
                ) : (
                  // No logo uploaded — a minimal upload cue only. The
                  // company's legal identity already appears in the
                  // footer's legal block, so repeating it here (a plain
                  // "Mon Entreprise" name + RC/NIF line) was just clutter
                  // stacked under an already-obvious "add your logo" slot.
                  <InvoiceLogoPlaceholder />
                )}
              </div>
              {/* Only shown alongside a real logo — this badge IS the
                  header's one company-name display when there's no logo to
                  pair it with, so showing it there too would just repeat
                  the typographic fallback above it. */}
              {settings?.logo_data && settings?.company_name && (
                <div className="absolute right-0 bottom-0 w-[71.5mm] h-[7.8mm] flex items-center justify-center px-[5mm] text-[8.5pt] font-bold leading-none whitespace-nowrap text-white z-2 tracking-wide uppercase" style={{ backgroundColor: primaryColor }}>
                  {settings.company_name}
                </div>
              )}
            </header>

            {/* Height trimmed from the full 229.8mm (297 - 33.9 header -
                33.3 footer) down to 220mm — the reclaimed 9.8mm becomes a
                clean white buffer between main's own content (which still
                ends with its own pb-[8mm] and the page-number line) and the
                footer legal-info band's top border, instead of the two
                sitting flush against each other. */}
            <main className="absolute left-0 top-[33.9mm] w-full h-[220mm] overflow-hidden bg-white">
              {settings?.body_pattern_data && (
                <div className="absolute inset-0 w-full h-full bg-white z-0 overflow-hidden">
                  <img src={settings.body_pattern_data} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />
                </div>
              )}

              <div className="relative w-full h-full z-1 px-[8mm] pt-[5mm] pb-[15mm] flex flex-col justify-between">
                <div>
                  <div className="text-center mb-4">
                    <h1 className="text-lg font-semibold tracking-[-0.02em] uppercase text-gray-800">
                      {docTitle}
                    </h1>
                  </div>

                  <div className="flex justify-between items-start mb-6 text-xs">
                    <div className="w-[55%] space-y-1">
                      <div className="text-gray-400 text-[10px] font-semibold tracking-wider uppercase">{recipientLabel}</div>

                      <ClientPickerCombobox
                        clients={recipientList}
                        selectedClientId={invoice.clients?.id}
                        open={openClientCombo}
                        onOpenChange={setOpenClientCombo}
                        onSelectClient={(client) => { selectClient(client); setOpenClientCombo(false); }}
                        container={scaleContainer}
                        entityLabel={isOrder ? "fournisseur" : "client"}
                        trigger={
                          <Button variant="ghost" role="combobox" className="h-auto border-none bg-transparent p-0 text-sm font-bold uppercase text-black hover:bg-gray-100 w-full flex justify-start leading-tight mb-1 rounded-none">
                            {invoice.clients?.name || invoice.client_name || recipientPlaceholder}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        }
                      />

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
                      {!isCreditNote && (
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
                      {showPaymentMethod && !isCreditNote && (
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

                  <div className="mb-6 text-xs">
                    <div
                      className="flex items-center gap-2 px-2 py-2 text-[11px] font-medium tracking-wider uppercase"
                      style={{ backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) }}
                    >
                      <div className="flex-1 min-w-[260px] text-left">Désignation / Prestation</div>
                      {showPricing && <div className="w-[120px] text-right">P.U (HT)</div>}
                      <div className="w-[70px] text-right">Qté</div>
                      <div className="w-[130px] text-center">U.M</div>
                      {showPricing && <div className="w-[130px] text-right">Total HT</div>}
                      <div className="w-[70px]" />
                    </div>
                    {pageItems.map((item: any, relIdx: number) => {
                      const globalIdx = startIdx + relIdx;
                      const unit = item.products?.unit || item.unit || "TN";
                      return (
                        <div key={globalIdx} className="flex items-start gap-2 border-b border-gray-200 py-2.5 group hover:bg-gray-50">
                          <div className="flex-1 min-w-[260px] font-semibold uppercase pt-1 leading-6">
                            {item.product_name || item.products?.name || item.name || ""}
                            {(item.product_description || item.products?.description || item.description) && (
                              <div className="font-normal text-[10px] normal-case mt-1 leading-tight text-gray-500">{item.product_description || item.products?.description || item.description}</div>
                            )}
                          </div>
                          {showPricing && (
                            <div className="w-[120px] font-mono pt-1">
                              <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => handleItemUpdate(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)} onKeyDown={handleLineEntryKeyDown} className="h-6 w-full text-right bg-transparent border-none shadow-none px-2 py-0 leading-6 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-sm hover:bg-zinc-50/80 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-zinc-300 transition-colors font-mono tabular-nums tracking-tight text-xs" />
                            </div>
                          )}
                          <div className="w-[70px] font-mono pt-1">
                            <Input type="number" step="0.001" data-line-index={globalIdx} data-line-field="quantity" value={item.quantity} onChange={(e) => handleItemUpdate(globalIdx, 'quantity', parseFloat(e.target.value) || 0)} onKeyDown={handleLineEntryKeyDown} className="h-6 w-full text-right bg-transparent border-none shadow-none px-2 py-0 leading-6 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-sm hover:bg-zinc-50/80 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-zinc-300 transition-colors font-mono tabular-nums tracking-tight text-xs" />
                          </div>
                          <div className="w-[130px] text-center uppercase text-gray-500 text-[11px] leading-6 whitespace-nowrap overflow-hidden text-ellipsis px-1 pt-1" title={unit}>{unit}</div>
                          {showPricing && (
                            <div className="w-[130px] text-right font-mono tabular-nums tracking-tight font-semibold pt-1 leading-6 text-xs">
                              {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                            </div>
                          )}
                          <div className="w-[70px] flex items-center justify-end gap-0.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            {!item.product_id && (item.product_name || item.name) && (
                              <button
                                onClick={() => handleSaveItemToCatalog(item)}
                                disabled={createProduct.isPending}
                                className="rounded p-1 text-zinc-400 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-40"
                                title="Enregistrer comme nouveau produit au catalogue"
                              >
                                {createProduct.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              onClick={() => moveItemUp(globalIdx)}
                              disabled={globalIdx === 0}
                              className="rounded p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                              title="Monter"
                            ><ChevronUp className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => moveItemDown(globalIdx)}
                              disabled={globalIdx === items.length - 1}
                              className="rounded p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                              title="Descendre"
                            ><ChevronDown className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => handleDeleteItem(globalIdx)}
                              className="rounded p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Supprimer"
                            ><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      );
                    })}
                    {isLastPage && (
                      <ProductPickerCombobox
                        products={products}
                        excludeProductIds={items.map((it: any) => it.product_id)}
                        open={openPopoverIndex === -1}
                        onOpenChange={(open) => setOpenPopoverIndex(open ? -1 : null)}
                        onSelectProduct={(p) => handleAddProduct(p, items.length - 1)}
                        onAddCustomItem={(name) => handleAddCustomItem(name, items.length - 1)}
                        nextIndex={items.length}
                        formatCurrency={formatCurrency}
                        container={scaleContainer}
                        trigger={
                          <Button variant="ghost" className="w-full h-8 text-xs text-gray-500 hover:text-gray-900 rounded-none bg-gray-50 border-none"><Plus className="w-4 h-4 mr-1" /> Ajouter un article</Button>
                        }
                      />
                    )}
                  </div>

                  {(() => {
                    const notesBox = (
                      <Textarea
                        value={invoice.notes || ""}
                        onChange={(e) => updateInvoiceField('notes', e.target.value)}
                        placeholder="Ajouter des notes..."
                        className="min-h-[40px] h-full resize-none border border-gray-200 bg-gray-50 p-2 shadow-none focus-visible:ring-1 focus-visible:ring-gray-300 text-xs text-black font-normal w-full"
                      />
                    );
                    const totalsBox = (
                      <div className="text-xs">
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
                    );

                    // A bon de livraison never shows pricing/totals at all
                    // (showPricing false) — notes just get the full row
                    // width instead of sharing it with a totals column.
                    if (!showPricing) {
                      return isFirstPage && <div className="mt-3 mb-4">{notesBox}</div>;
                    }

                    // Notes (page 1) and totals (last page) share one row
                    // only when they're the same page — the common
                    // single-page case. A multi-page invoice keeps them on
                    // their own separate pages, same as before.
                    if (isFirstPage && isLastPage) {
                      return (
                        <div className="flex justify-between items-start gap-6 mb-4" style={{ breakInside: 'avoid' }}>
                          <div className="w-[42%]">{notesBox}</div>
                          <div className="w-[42%]">{totalsBox}</div>
                        </div>
                      );
                    }
                    return (
                      <>
                        {isFirstPage && <div className="mt-3 mb-4">{notesBox}</div>}
                        {isLastPage && <div className="flex justify-end mb-4"><div className="w-[42%]">{totalsBox}</div></div>}
                      </>
                    );
                  })()}

                  {isLastPage && (
                    <>
                      <div className="mt-8 mb-4">
                        {showMontantEnLettres && readInvoiceBoolSetting(settings?.show_amount_in_words, false) && (
                          <div className="mb-3">
                            <div className="text-gray-400 text-[10px] font-semibold tracking-wider uppercase">
                              {amountInWordsLabel}
                            </div>
                            <div className="mt-1 font-semibold text-xs text-black uppercase tracking-tight">{numberToWords(netTotal)}</div>
                          </div>
                        )}

                        {/* Mode de paiement now lives in the top metadata block
                            alongside Date/Numéro — this row just anchors the
                            signature block to the right, same as before. */}
                        {readInvoiceBoolSetting(settings?.show_stamp_signature, true) && (
                          <div className="flex justify-end items-start">
                            <div className="mr-8 flex flex-col items-center">
                              {/* No onStampSizeChange/onStampSizeCommit here
                                  on purpose — that's what makes
                                  InteractiveStampZone render its on-canvas
                                  hover slider. Stamp size is now a single
                                  control in the "Personnaliser" drawer
                                  ("Taille du cachet"), writing straight to
                                  settings.stamp_size like every other
                                  branding setting. */}
                              <InteractiveStampZone
                                settings={settings}
                                stampSize={stampSize}
                                showTitle={Boolean(settings?.stamp_data || settings?.signature_data)}
                                label={stampLabel}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="text-xs text-zinc-400 font-mono tracking-widest text-center mt-6">{pageIndex + 1} / {pages.length}</div>
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

                <section className="pt-[6mm]">
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
