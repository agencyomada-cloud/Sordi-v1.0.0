import { useState, useEffect } from "react";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button, Popover, PopoverContent, PopoverTrigger, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@sordi/ui";
import { useSettings } from "@/hooks/useSettings";
import { 
    RiAddLine as Plus, 
    RiDeleteBinLine as Trash2, 
    RiCheckLine as Check, 
    RiExpandUpDownLine as ChevronsUpDown 
} from "@remixicon/react";
import { chunkItems } from "@/lib/paginationUtils";
import { numberToWords } from "@/lib/numberToWords";
import { cn } from "@/lib/utils";

interface DeliveryEditablePreviewProps {
    deliveryNote: any;
    onDeliveryChange: (deliveryNote: any) => void;
    clients?: any[];
    products?: any[];
    readOnly?: boolean;
}

export function DeliveryEditablePreview({ deliveryNote, onDeliveryChange, clients, products, readOnly = false }: DeliveryEditablePreviewProps) {
    const { data: settings } = useSettings();

    const formatCurrency = (amount: number | null) => {
        if (!amount) return "0,00 DA";
        const formatted = amount.toFixed(2).replace(/\./g, ',');
        const parts = formatted.split(',');
        const integerPart = parts[0];
        const decimalPart = parts[1] || '00';
        const integerWithSpaces = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return `${integerWithSpaces},${decimalPart} DA`;
    };

    const updateDeliveryField = (field: string, value: any) => {
        onDeliveryChange({
            ...deliveryNote,
            [field]: value
        });
    };

    const updateClient = (clientId: string) => {
        updateDeliveryField('client_id', clientId);
    };

    // --- Item Management --- //

    const [newProductId, setNewProductId] = useState("");
    const [newProductQuantity, setNewProductQuantity] = useState(0);
    const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);
    const [openClientCombo, setOpenClientCombo] = useState(false);

    const updateItem = (index: number, field: string, value: any) => {
        const updatedItems = [...(deliveryNote.items || [])];
        if (updatedItems[index]) {
            updatedItems[index] = { ...updatedItems[index], [field]: value };
            updateDeliveryField('items', updatedItems);
        }
    };

    const removeItem = (index: number) => {
        const updatedItems = [...(deliveryNote.items || [])];
        updatedItems.splice(index, 1);
        updateDeliveryField('items', updatedItems);
    };

    const handleAddProduct = (product: any, index: number) => {
        const newItems = [...(deliveryNote.items || [])];
        const newItem = {
            product_id: product.id,
            product_code: product.code,
            product_name: product.name,
            quantity: 1,
            unit_price: product.unit_price || 0,
            tva_rate: product.tva_rate !== undefined ? product.tva_rate : 19,
            product_description: product.description,
            products: product
        };

        // Insert after current index or at end
        if (index >= 0) {
            newItems.splice(index + 1, 0, newItem);
        } else {
            newItems.push(newItem);
        }

        updateDeliveryField('items', newItems);
        setOpenPopoverIndex(null);
    };

    const primaryColor = settings?.primary_color || "#FFCC00";
    const logoBgColor = settings?.logo_bg_color || "#000000";
    const logoTextColor = settings?.logo_text_color || "#FFFFFF";

    const companyName = settings?.company_name || "";
    const parts = companyName.split(' ');
    const companyMain = parts[0] || "";

    // Use clients prop if available, otherwise fallback to embedded clients object (for read-only view)
    const client = clients?.find(c => c.id === deliveryNote.client_id) || deliveryNote.clients;
    const items = deliveryNote.items || [];
    const pages = chunkItems(items);

    // Calculate totals for display
    const calculateTotals = () => {
        let subtotal = 0;
        let totalTva = 0;

        items.forEach((item: any) => {
            const amount = (item.quantity || 0) * (item.unit_price || 0);
            subtotal += amount;

            const tvaRate = item.tva_rate === undefined ? 19.0 : item.tva_rate;
            if (tvaRate && tvaRate > 0) {
                totalTva += amount * (tvaRate / 100);
            }
        });

        return {
            subtotal,
            tva: totalTva,
            total: subtotal + totalTva
        };
    };

    const totals = calculateTotals();

    const getExtraInfoDisplay = () => {
        if (!settings?.company_extra_info) return "";
        try {
            if (settings.company_extra_info.startsWith('[')) {
                const list = JSON.parse(settings.company_extra_info);
                return Array.isArray(list) ? list.filter(Boolean).join(" - ") : settings.company_extra_info;
            }
            return settings.company_extra_info;
        } catch (e) {
            return settings.company_extra_info;
        }
    };

    const contactParts = [
        settings?.company_phone ? `Téléphone: ${settings.company_phone}` : null,
        getExtraInfoDisplay(),
        settings?.company_email ? settings.company_email : null,
    ].filter(Boolean);
    const contactLine = contactParts.join(" - ");

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
                        className="bg-white text-black relative transition-transform duration-200 flex flex-col mb-8 last:mb-0"
                        style={{
                            width: '210mm',
                            height: '297mm',
                            margin: '0 auto',
                            position: 'relative',
                            pageBreakAfter: isLastPage ? 'auto' : 'always',
                            overflow: 'hidden',
                            border: '1px solid #e5e7eb',
                            fontFamily: '"Helvetica Now Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
                        }}
                    >
                        {/* Content wrapper */}
                        <div className="flex flex-col flex-1 bg-white overflow-hidden relative">

                            {/* Page Number Indicator */}
                            <div className="absolute top-4 right-4 text-[12px] text-gray-300 font-mono">
                                Page {pageIndex + 1} / {pages.length}
                            </div>

                            {/* Main Content Area */}
                            <div className="px-[60px] pt-[60px] flex-1 pb-[80px]">
                                {/* Header Row */}
                                <div className="grid grid-cols-[1fr_350px] items-start mb-2 gap-4">
                                    {/* Logo Area */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-3">
                                            {settings?.logo_data && (
                                                <img
                                                    src={settings.logo_data}
                                                    alt="Logo"
                                                    style={{
                                                        height: settings.logo_size ? `${settings.logo_size}px` : "64px",
                                                        maxWidth: 'none'
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Document Title & Dates Group */}
                                    <div className="text-right flex flex-col items-end w-[350px] ml-auto text-black space-y-0.5">
                                        {readOnly ? (
                                            <h2 className="text-[18px] font-extrabold uppercase leading-tight">
                                                {deliveryNote.custom_title || "BON DE LIVRAISON"}
                                            </h2>
                                        ) : (
                                            <Input
                                                type="text"
                                                value={deliveryNote.custom_title || "BON DE LIVRAISON"}
                                                onChange={(e) => updateDeliveryField('custom_title', e.target.value)}
                                                className="text-[18px] font-extrabold text-black uppercase tracking-tight text-right w-full bg-transparent border-none focus:ring-0 p-0 shadow-none h-auto shrink-0 leading-tight"
                                            />
                                        )}

                                        <div className="text-[16px] font-bold leading-tight flex items-center justify-end gap-1">
                                            <span>Bon N:</span>
                                            {readOnly ? (
                                                <span>{deliveryNote.delivery_number}</span>
                                            ) : (
                                                <Input
                                                    type="text"
                                                    value={deliveryNote.delivery_number || ""}
                                                    onChange={(e) => updateDeliveryField('delivery_number', e.target.value)}
                                                    className="font-bold text-[16px] w-24 text-right bg-transparent border-none focus:ring-0 p-0 shadow-none h-auto shrink-0"
                                                    placeholder="N°"
                                                />
                                            )}
                                        </div>

                                        <div className="text-[16px] font-bold leading-tight">Date De Livraison</div>
                                        <div className="text-[16px] font-normal leading-tight">
                                            {readOnly ? (
                                                deliveryNote.delivery_date
                                            ) : (
                                                <Input
                                                    type="date"
                                                    value={deliveryNote.delivery_date}
                                                    onChange={(e) => updateDeliveryField('delivery_date', e.target.value)}
                                                    className="text-[16px] text-black bg-transparent border-none focus:ring-0 p-0 text-right w-32 h-auto shadow-none leading-tight"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Emetteur & Adresse a Section */}
                                <div className="grid grid-cols-2 gap-8 mb-2 mt-4">
                                    {/* Emetteur Column */}
                                    <div className="flex flex-col">
                                        <div className="text-[16px] space-y-0 text-black">
                                            <p className="text-[16px] font-bold mb-0 uppercase leading-tight">{settings?.company_name || ""}</p>
                                            {settings?.company_address && <p className="leading-tight"><span className="font-bold">Adresse :</span> {settings.company_address}</p>}
                                            {settings?.company_rc && <p className="leading-tight"><span className="font-bold">RC :</span> {settings.company_rc}</p>}
                                            {settings?.company_nif && <p className="leading-tight"><span className="font-bold">NIF :</span> {settings.company_nif}</p>}
                                            {settings?.company_nis && <p className="leading-tight"><span className="font-bold">NIS :</span> {settings.company_nis}</p>}
                                            {settings?.company_ai && <p className="leading-tight"><span className="font-bold">AI :</span> {settings.company_ai}</p>}
                                        </div>
                                    </div>

                                    {/* Adresse a Column - EDITABLE */}
                                    <div className="flex flex-col text-right items-end">
                                        <div className="text-[16px] space-y-0 text-black w-full flex flex-col items-end">
                                            {!readOnly && clients && clients.length > 0 ? (
                                                <Popover open={openClientCombo} onOpenChange={setOpenClientCombo}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            role="combobox"
                                                            aria-expanded={openClientCombo}
                                                            className="h-auto border-none bg-transparent p-0 text-[16px] font-bold text-black mb-0 uppercase hover:bg-gray-100 transition-colors w-full flex justify-end items-center leading-tight"
                                                        >
                                                            {client?.name ? client.name : "SÉLECTIONNER UN CLIENT"}
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
                                                                        <CommandItem
                                                                            key={c.id}
                                                                            value={c.name}
                                                                            onSelect={() => {
                                                                                updateClient(c.id);
                                                                                setOpenClientCombo(false);
                                                                            }}
                                                                        >
                                                                            <Check
                                                                                className={cn(
                                                                                    "mr-2 h-4 w-4",
                                                                                    deliveryNote.client_id === c.id ? "opacity-100" : "opacity-0"
                                                                                )}
                                                                            />
                                                                            {c.name}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <p className="text-[16px] font-bold mb-0 uppercase leading-tight">{client?.name || "-"}</p>
                                            )}
                                            {client?.address && <p className="leading-tight"><span className="font-bold">Adresse :</span> {client.address}</p>}
                                            {client?.rc && <p className="leading-tight"><span className="font-bold">RC :</span> {client.rc}</p>}
                                            {client?.nif && <p className="leading-tight"><span className="font-bold">NIF :</span> {client.nif}</p>}
                                            {client?.nis && <p className="leading-tight"><span className="font-bold">NIS :</span> {client.nis}</p>}
                                            {client?.ai && <p className="leading-tight"><span className="font-bold">AI :</span> {client.ai}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Transport Information Box */}
                                {isFirstPage && (
                                    <div className="mt-4 mb-2">
                                        <div className="grid grid-cols-2 gap-8 text-black">
                                            <div className="space-y-0.5">
                                                <p className="text-[16px] font-bold text-black uppercase tracking-wider mb-1">Détails Transport</p>
                                                <div className="text-[16px] flex items-center gap-2">
                                                    <span className="font-bold w-24">Chauffeur:</span>
                                                    {readOnly ? (
                                                        <span>{deliveryNote.driver_name || "-"}</span>
                                                    ) : (
                                                        <Input
                                                            value={deliveryNote.driver_name || ""}
                                                            onChange={(e) => updateDeliveryField('driver_name', e.target.value)}
                                                            className="h-auto text-[16px] bg-transparent border-none p-0 focus-visible:ring-0 font-medium w-full leading-tight"
                                                            placeholder="Nom du chauffeur..."
                                                        />
                                                    )}
                                                </div>
                                                <div className="text-[16px] flex items-center gap-2">
                                                    <span className="font-bold w-24">Camion:</span>
                                                    {readOnly ? (
                                                        <span>{deliveryNote.truck_plate || "-"}</span>
                                                    ) : (
                                                        <Input
                                                            value={deliveryNote.truck_plate || ""}
                                                            onChange={(e) => updateDeliveryField('truck_plate', e.target.value)}
                                                            className="h-auto text-[16px] bg-transparent border-none p-0 focus-visible:ring-0 font-medium w-full leading-tight"
                                                            placeholder="Matricule..."
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-[16px] font-bold text-black uppercase tracking-wider mb-1">Lieu de Livraison</p>
                                                {readOnly ? (
                                                    <p className="text-[16px]">{deliveryNote.delivery_location || "-"}</p>
                                                ) : (
                                                    <Input
                                                        value={deliveryNote.delivery_location || ""}
                                                        onChange={(e) => updateDeliveryField('delivery_location', e.target.value)}
                                                        className="h-auto text-[16px] bg-transparent border-none p-0 focus-visible:ring-0 font-medium w-full leading-tight"
                                                        placeholder="Lieu de livraison..."
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Items Table */}
                                <div className="mt-6 relative">
                                    {/* Full-width colored bar overlay */}
                                    <div
                                        className="absolute -left-[60px] -right-[60px] top-0 h-[37px] pointer-events-none"
                                        style={{ backgroundColor: primaryColor }}
                                    />
                                    <table className="w-full text-[16px] relative z-10" style={{ tableLayout: 'fixed' }}>
                                        <thead>
                                            <tr className="h-[37px]">
                                                <th className="text-left py-2 font-bold text-white uppercase text-[16px] tracking-wider" style={{ width: '80px' }}>CODE</th>
                                                <th className="text-left py-2 font-bold text-white uppercase text-[16px] tracking-wider">DÉSIGNATION</th>
                                                <th className="text-right py-2 font-bold text-white uppercase text-[16px] tracking-wider" style={{ width: '80px' }}>QTÉ</th>
                                                <th className="text-right py-2 font-bold text-white uppercase text-[16px] tracking-wider" style={{ width: '110px' }}>P.U HT</th>
                                                <th className="text-center py-2 font-bold text-white uppercase text-[16px] tracking-wider" style={{ width: '60px' }}>TVA</th>
                                                <th className="text-right py-2 font-bold text-white uppercase text-[16px] tracking-wider" style={{ width: '120px' }}>TOTAL HT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageItems.map((item: any, relIdx: number) => {
                                                const globalIdx = startIdx + relIdx;
                                                const tvaLabel = item.tva_rate === -1 ? "Exo" :
                                                    (item.tva_rate === null || item.tva_rate === 0) ? "0%" :
                                                        item.tva_rate === undefined ? "19%" :
                                                            `${item.tva_rate}%`;

                                                return (
                                                    <tr key={globalIdx} className="border-b border-gray-100 group">
                                                        <td className="py-2 text-[16px] font-normal text-black align-top">{item.products?.code || item.product_code || ""}</td>
                                                        <td className="py-2 text-[16px] text-black align-top">
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="font-normal leading-tight">{item.product_name || item.products?.name || ""}</div>
                                                                {(item.product_description || item.products?.description || item.description) && (
                                                                    <div className="text-[12px] text-gray-700 italic leading-normal">
                                                                        {item.product_description || item.products?.description || item.description}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 text-right">
                                                            {readOnly ? (
                                                                <span className="text-[16px] font-normal p-1 block">{(item.quantity || 0).toFixed(3)}</span>
                                                            ) : (
                                                                <Input
                                                                    type="number"
                                                                    step="0.001"
                                                                    value={item.quantity}
                                                                    onChange={(e) => updateItem(globalIdx, 'quantity', parseFloat(e.target.value) || 0)}
                                                                    className="h-auto w-full text-right text-[16px] font-normal p-1 border-none bg-transparent shadow-none hover:bg-gray-50 focus-visible:ring-0"
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="py-2 text-right">
                                                            {readOnly ? (
                                                                <span className="text-[16px] p-1 block">{formatCurrency(item.unit_price)}</span>
                                                            ) : (
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={item.unit_price}
                                                                    onChange={(e) => updateItem(globalIdx, 'unit_price', parseFloat(e.target.value) || 0)}
                                                                    className="h-auto w-full text-right text-[16px] p-1 border-none bg-transparent shadow-none hover:bg-gray-50 focus-visible:ring-0"
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="py-2 text-center text-[16px] text-gray-500 italic font-normal">
                                                            {tvaLabel}
                                                        </td>
                                                        <td className="py-2 text-right text-[16px] font-normal text-black relative group-hover:pr-8 transition-all">
                                                            {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                                                            {!readOnly && (
                                                                <button
                                                                    className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                                                                    onClick={() => removeItem(globalIdx)}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Add Product Row */}
                                            {isLastPage && !readOnly && products && products.length > 0 && (
                                                <tr className="border-t border-gray-200">
                                                    <td colSpan={6} className="py-2">
                                                        <Popover open={openPopoverIndex === -1} onOpenChange={(open) => setOpenPopoverIndex(open ? -1 : null)}>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="w-full h-8 text-[12px] text-gray-400 hover:text-black hover:bg-gray-50 border border-dashed border-gray-200"
                                                                >
                                                                    <Plus className="w-4 h-4 mr-1" />
                                                                    AJOUTER UN PRODUIT
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-80 p-2" align="center">
                                                                <div className="space-y-1 max-h-60 overflow-y-auto font-sans">
                                                                    {products.filter(product => !items.some((item: any) => {
                                                                        const itemProductId = item.product_id || item.products?.id;
                                                                        return String(itemProductId) === String(product.id);
                                                                    })).map((product) => (
                                                                        <Button
                                                                            key={product.id}
                                                                            variant="ghost"
                                                                            className="w-full justify-start text-left h-auto py-2 hover:bg-primary/5"
                                                                            onClick={() => handleAddProduct(product, items.length - 1)}
                                                                        >
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-sm">{product.name}</span>
                                                                                <span className="text-[11px] text-gray-500">
                                                                                    Réf: {product.code} • {formatCurrency(product.unit_price || 0)}
                                                                                </span>
                                                                            </div>
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

                                {/* Last Page Content: Totals, Signatures */}
                                {isLastPage && (
                                    <>
                                        {/* Totals Section */}
                                        <div className="flex justify-end mt-4">
                                            <div className="w-80">
                                                <div className="space-y-0.5 pb-2 text-[16px] text-black">
                                                    <div className="flex justify-between items-center italic">
                                                        <span>Subtotal HT</span>
                                                        <span className="font-bold">{formatCurrency(totals.subtotal)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center italic">
                                                        <span>Total TVA</span>
                                                        <span className="font-bold">{formatCurrency(totals.tva)}</span>
                                                    </div>
                                                </div>
                                                <div className="pt-2">
                                                    <div
                                                        className="flex justify-between items-center px-2 h-[28px]"
                                                        style={{ backgroundColor: primaryColor }}
                                                    >
                                                        <span className="font-bold text-[16px] text-white uppercase italic tracking-wider">Net à Payer</span>
                                                        <span className="font-bold text-[18px] text-white">{formatCurrency(totals.total)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Amount in Words */}
                                        <div className="mt-6 text-black">
                                            <p className="text-[12px] font-bold uppercase tracking-tight italic mb-0 leading-tight">Arrêté le présent bon de livraison à la somme de :</p>
                                            <p className="text-[12px] font-normal capitalize leading-tight">
                                                {numberToWords(totals.total)} Dinars Algériens
                                            </p>
                                        </div>

                                        {/* Notes & Reserves */}
                                        <div className="mt-8 grid grid-cols-2 gap-8 text-black">
                                            <div>
                                                <p className="text-[12px] font-bold text-black uppercase tracking-wider mb-1">Notes</p>
                                                {readOnly ? (
                                                    <p className="text-[12px] text-gray-500 italic bg-gray-50/50 p-2 rounded min-h-[40px] whitespace-pre-wrap">{deliveryNote.notes || "-"}</p>
                                                ) : (
                                                    <textarea
                                                        value={deliveryNote.notes || ""}
                                                        onChange={(e) => updateDeliveryField('notes', e.target.value)}
                                                        className="w-full text-[12px] text-gray-500 italic bg-gray-50/50 p-2 rounded min-h-[40px] border border-gray-100 focus:ring-0 resize-none"
                                                        placeholder="Notes libres..."
                                                    />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-[12px] font-bold text-red-500 uppercase tracking-wider mb-1">Réserves</p>
                                                {readOnly ? (
                                                    <p className="text-[12px] text-red-300 italic bg-red-50/10 p-2 rounded min-h-[40px] whitespace-pre-wrap">{deliveryNote.reserves || "-"}</p>
                                                ) : (
                                                    <textarea
                                                        value={deliveryNote.reserves || ""}
                                                        onChange={(e) => updateDeliveryField('reserves', e.target.value)}
                                                        className="w-full text-[12px] text-red-300 italic bg-red-50/10 p-2 rounded min-h-[40px] border border-red-50 focus:ring-0 resize-none"
                                                        placeholder="Réserves éventuelles..."
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Signatures */}
                                        <div className="mt-6 grid grid-cols-2 gap-8 text-black">
                                            <div className="text-center">
                                                <div className="border border-gray-100 rounded p-4 h-24 flex flex-col justify-center items-center">
                                                    <p className="text-[12px] font-bold uppercase tracking-widest text-black mb-1">Réception Client</p>
                                                    <span className="text-[10px] text-gray-300 italic">Signature et Date</span>
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="h-24 relative flex items-center justify-center">
                                                    {!settings?.stamp_data && !settings?.signature_data && (
                                                        <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded text-[12px] text-gray-400 uppercase tracking-widest">
                                                            Cachet et Signature
                                                        </div>
                                                    )}
                                                    {settings?.stamp_data && (
                                                        <div className="absolute inset-0 z-0 flex items-center justify-center">
                                                            <img 
                                                                src={settings.stamp_data} 
                                                                alt="Cachet" 
                                                                style={{
                                                                    height: settings.stamp_size ? `${settings.stamp_size}px` : "96px",
                                                                    maxWidth: 'none'
                                                                }}
                                                                className="object-contain opacity-90 mx-auto" 
                                                            />
                                                        </div>
                                                    )}
                                                    {settings?.signature_data && (
                                                        <div className="absolute inset-0 z-10 top-2 flex items-center justify-center">
                                                            <img 
                                                                src={settings.signature_data} 
                                                                alt="Signature" 
                                                                style={{
                                                                    height: settings.signature_size ? `${settings.signature_size}px` : "96px",
                                                                    maxWidth: 'none'
                                                                }}
                                                                className="object-contain mx-auto" 
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-[12px] text-gray-400 font-medium tracking-wide">
                                                    Cachet et Signature
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Page Footer */}
                            <div className="absolute bottom-0 left-0 right-0 h-[60px] flex flex-col justify-center bg-white px-[60px]">
                                <div className="border-t border-black" style={{ borderTopWidth: '0.5px' }} />
                                <div className="mt-2 flex justify-between items-start text-[12px] text-black">
                                    <div className="text-left space-y-0.5">
                                        {settings?.company_phone && <p className="leading-tight">Phone Number: {settings.company_phone}</p>}
                                        {settings?.company_email && <p className="leading-tight">Email: {settings.company_email}</p>}
                                    </div>
                                    <div className="text-right space-y-0.5">
                                        {getExtraInfoDisplay() && <p className="leading-tight">{getExtraInfoDisplay()}</p>}
                                        {settings?.company_rib && <p className="leading-tight">RIB: {settings.company_rib}</p>}
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
