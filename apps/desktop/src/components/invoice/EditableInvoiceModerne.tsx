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
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { numberToWords } from "@/lib/numberToWords";
import { getContrastTextColor } from "@/lib/colorContrast";
import { getCompanyPhones, formatPhone, resolveLegalFields, resolveInvoiceHtmlFontFamily } from "./invoiceHtmlShared";
import { ProductPickerCombobox } from "@/components/ProductPickerCombobox";
import { ClientPickerCombobox } from "./ClientPickerCombobox";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { useScaleToFitContainer } from "./scaleToFitContext";
import { EditableInvoiceLogic } from "./useEditableInvoiceLogic";
import { InvoiceLogoPlaceholder } from "./InvoiceLogoPlaceholder";

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

export function EditableInvoiceModerne({
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
  const headerTextColor = getContrastTextColor(accent);
  const phones = getCompanyPhones(settings);
  const legalFields = resolveLegalFields(settings);
  const scaleContainer = useScaleToFitContainer();
  const {
    paymentMode, discountRate, discountType, setDiscountType,
    openPopoverIndex, setOpenPopoverIndex, openClientCombo, setOpenClientCombo,
    pages, subtotal, tvaAmount, timbre, discountAmount, netTotal,
    isCreditNote, isProforma, docTitle, showTva, showTimbre, showMontantEnLettres, showPaymentMethod, grandTotalLabel, isTaxExempt,
    formatCurrency,
    updateInvoiceField, selectClient, handlePaymentModeChange,
    handleDiscountRateChange, handleDiscountAmountChange,
    handleItemUpdate, handleAddProduct, handleAddCustomItem, handleDeleteItem,
    items, moveItemUp, moveItemDown,
  } = logic;

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
            className="a4 relative bg-white dark:bg-white text-[#111827] mx-auto select-text border border-border/80 dark:border-neutral-700 shadow-sm rounded-[2px] print:border-none print:shadow-none print:m-0 mb-8"
            style={{ width: '210mm', height: '297mm', boxSizing: 'border-box', overflow: 'hidden', fontFamily: resolveInvoiceHtmlFontFamily(settings) }}
          >
            {isFirstPage && <InvoiceStatusBadge status={invoice.status} />}
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center px-[14mm] py-[9mm]" style={{ backgroundColor: accent }}>
                <div className="flex flex-col items-start gap-1.5">
                  {settings?.logo_data ? (
                    <div className="bg-white rounded-lg px-3 py-2 inline-block max-w-[188px]">
                      <img
                        src={settings.logo_data}
                        style={{ maxHeight: Number(settings?.logo_size) || 60, maxWidth: 180 }}
                        className="h-auto w-auto object-contain"
                        alt="Logo"
                      />
                    </div>
                  ) : (
                    // No logo uploaded — a minimal upload cue only, tinted
                    // for the colored band. The company's legal identity
                    // already appears in the footer's legal block, so
                    // repeating it here was just clutter.
                    <InvoiceLogoPlaceholder tone="onAccent" />
                  )}
                </div>
                <div className="text-right">
                  <div className="text-white text-[13pt] font-semibold tracking-[-0.02em] uppercase">
                    {docTitle}
                  </div>
                  <div className="text-white/75 text-[8.5pt] mt-1.5 flex items-center justify-end gap-1 font-mono tabular-nums tracking-tight">
                    N°
                    <Input type="text" value={invoice.invoice_number} onChange={(e) => updateInvoiceField('invoice_number', e.target.value)} className="h-5 w-24 border-none bg-transparent p-0 text-right shadow-none focus-visible:ring-0 font-mono tabular-nums tracking-tight text-[8.5pt] text-white placeholder:text-white/60" />
                    ·
                    <DatePicker
                      value={invoice.invoice_date}
                      onChange={(v) => updateInvoiceField('invoice_date', v)}
                      showIcon={false}
                      className="h-5 w-28 border-none bg-transparent p-0 justify-end hover:bg-transparent font-mono tabular-nums tracking-tight text-[8.5pt] text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 px-[14mm] py-[9mm] flex flex-col justify-between overflow-hidden">
                <div className="pb-[15mm]">
                  <div className="flex gap-3 mb-5">
                    <div className="flex-1 bg-gray-50 rounded-[10px] p-3.5">
                      <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Destinataire</div>
                      <ClientPickerCombobox
                        clients={clients}
                        selectedClientId={invoice.clients?.id}
                        open={openClientCombo}
                        onOpenChange={setOpenClientCombo}
                        onSelectClient={(client) => { selectClient(client); setOpenClientCombo(false); }}
                        container={scaleContainer}
                        trigger={
                          <Button variant="ghost" role="combobox" className="h-auto border-none bg-transparent p-0 text-[10.5pt] font-bold uppercase hover:bg-gray-100 w-full flex justify-start leading-tight mb-1 rounded-none">
                            {invoice.clients?.name || invoice.client_name || "Sélectionner un client..."}
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        }
                      />
                      {(invoice.clients?.address || invoice.client_address) && <div className="text-[8pt] text-gray-600 mb-1">{invoice.clients?.address || invoice.client_address}</div>}
                      <div className="font-mono text-[7.5pt] text-gray-500 leading-relaxed space-y-0.5">
                        {(invoice.clients?.rc || invoice.client_rc) && <div>RC {invoice.clients?.rc || invoice.client_rc}</div>}
                        {(invoice.clients?.nif || invoice.client_nif) && <div>NIF {invoice.clients?.nif || invoice.client_nif}</div>}
                        {(invoice.clients?.ai || invoice.client_ai) && <div>AI {invoice.clients?.ai || invoice.client_ai}</div>}
                        {(invoice.clients?.nis || invoice.client_nis) && <div>NIS {invoice.clients?.nis || invoice.client_nis}</div>}
                      </div>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-[10px] p-3.5">
                      <div className="text-[7pt] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>Détails du document</div>
                      {!isCreditNote && (
                        <div className="flex justify-between items-center text-[8pt] mb-1">
                          <span className="text-gray-500">Échéance</span>
                          <DatePicker
                            value={invoice.due_date}
                            onChange={(v) => updateInvoiceField('due_date', v)}
                            showIcon={false}
                            className="h-5 w-auto border-none bg-transparent p-0 justify-end hover:bg-transparent font-mono tabular-nums tracking-tight text-[8pt] font-semibold text-gray-700"
                          />
                        </div>
                      )}
                      {showPaymentMethod && !isCreditNote && (
                        <div className="flex justify-between items-center text-[8pt]">
                          <span className="text-gray-500">Mode de paiement</span>
                          <Select value={paymentMode} onValueChange={handlePaymentModeChange}>
                            <SelectTrigger className="h-5 w-auto border-none bg-transparent shadow-none focus:ring-0 font-mono tracking-tight text-[8pt] px-0 font-semibold"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Espèces">Espèces</SelectItem><SelectItem value="Chèque">Chèque</SelectItem><SelectItem value="Virement bancaire">Virement bancaire</SelectItem></SelectContent>
                          </Select>
                        </div>
                      )}
                      {isCreditNote && (invoice.original_invoice_id || invoice.original_invoice?.invoice_number) && (
                        <div className="text-[7.5pt] text-gray-500 mt-1.5">
                          Avoir relatif à la facture N° {invoice.original_invoice?.invoice_number || invoice.original_invoice_id}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[10px] overflow-hidden mb-4 text-[8.5pt]" style={{ border: `0.75px solid ${accent}30` }}>
                    <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ backgroundColor: accent }}>
                      <div className="flex-1 min-w-[260px] text-left text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: headerTextColor }}>Désignation / Prestation</div>
                      <div className="w-[120px] text-right text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: headerTextColor }}>P.U (HT)</div>
                      <div className="w-[70px] text-right text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: headerTextColor }}>Qté</div>
                      <div className="w-[130px] text-center text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: headerTextColor }}>U.M</div>
                      <div className="w-[130px] text-right text-[7.5pt] uppercase font-bold tracking-wide" style={{ color: headerTextColor }}>Total HT</div>
                      <div className="w-[70px]" />
                    </div>
                    {pageItems.map((item: any, relIdx: number) => {
                      const globalIdx = startIdx + relIdx;
                      const unit = item.products?.unit || item.unit || "TN";
                      return (
                        <div key={globalIdx} className={cn("flex items-start gap-2 px-2.5 py-2 group", relIdx % 2 === 1 ? "bg-gray-50/70" : "")}>
                          <div className="flex-1 min-w-[260px] font-bold pt-1 leading-6">
                            {item.product_name || item.products?.name || item.name || ""}
                            {(item.product_description || item.products?.description || item.description) && (
                              <div className="font-normal text-[7.5pt] leading-tight mt-1 text-gray-500">{item.product_description || item.products?.description || item.description}</div>
                            )}
                          </div>
                          <div className="w-[120px] font-mono pt-1">
                            <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => handleItemUpdate(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)} onKeyDown={handleLineEntryKeyDown} className="h-5 w-full text-right bg-transparent border-none shadow-none px-2 py-0 leading-6 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-sm hover:bg-zinc-50/80 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-zinc-300 transition-colors font-mono tabular-nums tracking-tight text-[8.5pt]" />
                          </div>
                          <div className="w-[70px] font-mono pt-1">
                            <Input type="number" step="0.001" data-line-index={globalIdx} data-line-field="quantity" value={item.quantity} onChange={(e) => handleItemUpdate(globalIdx, 'quantity', parseFloat(e.target.value) || 0)} onKeyDown={handleLineEntryKeyDown} className="h-5 w-full text-right bg-transparent border-none shadow-none px-2 py-0 leading-6 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-sm hover:bg-zinc-50/80 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-zinc-300 transition-colors font-mono tabular-nums tracking-tight text-[8.5pt]" />
                          </div>
                          <div className="w-[130px] text-center text-gray-500 text-[11px] uppercase leading-6 whitespace-nowrap overflow-hidden text-ellipsis px-1 pt-1" title={unit}>{unit}</div>
                          <div className="w-[130px] text-right font-mono tabular-nums tracking-tight font-semibold pt-1 leading-6 text-[8.5pt]">
                            {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                          </div>
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
                          <Button variant="ghost" className="w-full h-7 text-[8pt] text-gray-400 hover:text-gray-700 rounded-none border-none"><Plus className="w-3.5 h-3.5 mr-1" /> Ajouter un article</Button>
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
                        className="min-h-[36px] h-full resize-none rounded-[10px] border-none bg-gray-50 p-2.5 shadow-none focus-visible:ring-1 focus-visible:ring-gray-300 text-[8.5pt] w-full"
                      />
                    );
                    const totalsBox = (
                      <div className="bg-gray-50 rounded-[10px] p-3">
                        <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">Total HT</span><span className="font-mono tabular-nums tracking-tight font-semibold">{formatCurrency(subtotal)}</span></div>
                        {showTva && (
                          <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">TVA (19%)</span><span className="font-mono tabular-nums tracking-tight text-gray-500">{formatCurrency(tvaAmount)}</span></div>
                        )}
                        {showTimbre && (timbre > 0 || (paymentMode?.toLowerCase().includes("espèce") && timbre !== 0)) && (
                          <div className="flex justify-between py-0.5 text-[8.5pt]"><span className="text-gray-500">Timbre Fiscal</span><span className="font-mono tabular-nums tracking-tight text-gray-500">{formatCurrency(timbre)}</span></div>
                        )}
                        <div className="flex justify-between items-center py-0.5 text-[8.5pt]">
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
                        <div className="flex justify-between rounded-lg px-2.5 py-1.5 mt-1.5" style={{ backgroundColor: accent }}>
                          <span className="text-[9.5pt] font-bold text-white">{grandTotalLabel}</span>
                          <span className="text-[11pt] font-mono tabular-nums tracking-tight font-bold text-white">{formatCurrency(netTotal)}</span>
                        </div>
                        {isTaxExempt && !isProforma && (
                          <div className="text-right text-[7.5pt] text-gray-500 mt-1">
                            Régime d'exonération / Facturation sans TVA — Montant Net à Payer HT - TVA non applicable
                          </div>
                        )}
                      </div>
                    );

                    // Notes (page 1) and totals (last page) share one row
                    // only when they're the same page — the common
                    // single-page case. A multi-page invoice keeps them on
                    // their own separate pages, same as before.
                    if (isFirstPage && isLastPage) {
                      return (
                        <div className="flex justify-between items-start gap-5 mb-5" style={{ breakInside: 'avoid' }}>
                          <div className="w-[46%]">{notesBox}</div>
                          <div className="w-[46%]">{totalsBox}</div>
                        </div>
                      );
                    }
                    return (
                      <>
                        {isFirstPage && <div className="mb-5">{notesBox}</div>}
                        {isLastPage && <div className="flex justify-end mb-5"><div className="w-[46%]">{totalsBox}</div></div>}
                      </>
                    );
                  })()}

                  {isLastPage && (
                    <>
                      {showMontantEnLettres && (
                        <div className="mt-8 mb-5">
                          <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1">
                            {isCreditNote ? "Arrêté le présent avoir à la somme de" : "Arrêté la présente facture à la somme de"}
                          </div>
                          <div className="text-[8.5pt] text-gray-700 uppercase leading-relaxed">{numberToWords(netTotal)}</div>
                        </div>
                      )}

                      <div className={cn("flex justify-end items-end", !showMontantEnLettres && "mt-8")}>
                        <div className="flex flex-col items-center relative" style={{ minWidth: "160px" }}>
                          {(settings?.stamp_data || settings?.signature_data) && (
                            <>
                              <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide">Cachet et signature</div>
                              <div className="w-full h-px bg-gray-300 mt-1 mb-2" />
                            </>
                          )}
                          {/* No onStampSizeChange/onStampSizeCommit — stamp
                              size is controlled from the "Personnaliser"
                              drawer now, not an on-canvas hover slider. */}
                          <InteractiveStampZone
                            settings={settings}
                            stampSize={stampSize}
                            showTitle={false}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="text-xs text-zinc-400 font-mono tracking-widest text-center mt-6">{pageIndex + 1} / {pages.length}</div>
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
