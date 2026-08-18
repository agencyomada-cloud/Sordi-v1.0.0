import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { numberToWords } from "@/lib/numberToWords";
import { useSettings } from "@/hooks/useSettings";
import { chunkItems } from "@/lib/paginationUtils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useProducts } from "@/hooks/useProducts";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface OrderEditablePreviewProps {
    order: any;
    onOrderChange: (order: any) => void;
    clients?: any[];
    readOnly?: boolean;
}

export function OrderEditablePreview({ order, onOrderChange, clients, readOnly = false }: OrderEditablePreviewProps) {
    const { data: settings } = useSettings();
    const { data: products } = useProducts();
    const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);
    const [openClientCombo, setOpenClientCombo] = useState(false);
    const [newProductId, setNewProductId] = useState("");

    const formatCurrency = (amount: number | null) => {
        if (!amount) return "0,00 DA";
        const formatted = amount.toFixed(2).replace(/\./g, ',');
        const parts = formatted.split(',');
        const integerPart = parts[0];
        const decimalPart = parts[1] || '00';
        const integerWithSpaces = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return `${integerWithSpaces},${decimalPart} DA`;
    };

    const updateOrderField = (field: string, value: any) => {
        onOrderChange({
            ...order,
            [field]: value
        });
    };

    const updateClient = (clientId: string) => {
        const selectedClient = clients?.find(c => c.id === clientId);
        if (selectedClient) {
            onOrderChange({
                ...order,
                client_id: clientId,
                supplier_name: selectedClient.name,
                supplier_address: selectedClient.address,
                supplier_rc: selectedClient.rc,
                supplier_nif: selectedClient.nif,
                supplier_nis: selectedClient.nis,
                supplier_ai: selectedClient.ai,
            });
        } else {
            updateOrderField('client_id', clientId);
        }
    };

    const recalculateTotals = (items: any[]) => {
        const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);

        let totalTva = 0;
        items.forEach((item: any) => {
            const itemAmount = (item.quantity || 0) * (item.unit_price || 0);
            const tvaRate = item.tva_rate === undefined ? 19.0 : item.tva_rate;
            if (tvaRate && tvaRate > 0) {
                totalTva += itemAmount * (tvaRate / 100);
            }
        });

        const total = subtotal + totalTva;
        return { subtotal, tvaAmount: totalTva, total };
    };

    const updateItem = (index: number, field: string, value: any) => {
        const updatedItems = [...(order.items || [])];
        if (updatedItems[index]) {
            updatedItems[index] = { ...updatedItems[index], [field]: value };

            const totals = recalculateTotals(updatedItems);
            onOrderChange({
                ...order,
                items: updatedItems,
                subtotal_ht: totals.subtotal,
                tva_amount: totals.tvaAmount,
                total_ttc: totals.total
            });
        }
    };

    const removeItem = (index: number) => {
        const updatedItems = [...(order.items || [])];
        updatedItems.splice(index, 1);

        const totals = recalculateTotals(updatedItems);
        onOrderChange({
            ...order,
            items: updatedItems,
            subtotal_ht: totals.subtotal,
            tva_amount: totals.tvaAmount,
            total_ttc: totals.total
        });
    };

    const addItem = () => {
        const newItem = {
            id: crypto.randomUUID(),
            product_code: "",
            product_name: "",
            quantity: 1,
            unit_price: 0
        };
        const updatedItems = [...(order.items || []), newItem];

        const totals = recalculateTotals(updatedItems);
        onOrderChange({
            ...order,
            items: updatedItems,
            subtotal_ht: totals.subtotal,
            tva_amount: totals.tvaAmount,
            total_ttc: totals.total
        });
    };

    const primaryColor = settings?.primary_color || "#FFCC00";
    const logoBgColor = settings?.logo_bg_color || "#000000";
    const logoTextColor = settings?.logo_text_color || "#FFFFFF";

    const companyName = settings?.company_name || "";
    const parts = companyName.split(' ');
    const companyMain = parts[0] || "";

    const items = order.items || [];
    const pages = chunkItems(items);

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
                                                {order.custom_title || "BON DE COMMANDE"}
                                            </h2>
                                        ) : (
                                            <Input
                                                type="text"
                                                value={order.custom_title || "BON DE COMMANDE"}
                                                onChange={(e) => updateOrderField('custom_title', e.target.value)}
                                                className="text-[18px] font-extrabold text-black uppercase tracking-tight text-right w-full bg-transparent border-none focus:ring-0 p-0 shadow-none h-auto shrink-0 leading-tight"
                                            />
                                        )}

                                        <div className="text-[16px] font-bold leading-tight flex items-center justify-end gap-1">
                                            <span>Bon N:</span>
                                            {readOnly ? (
                                                <span>{order.order_number}</span>
                                            ) : (
                                                <Input
                                                    type="text"
                                                    value={order.order_number || ""}
                                                    onChange={(e) => updateOrderField('order_number', e.target.value)}
                                                    className="font-bold text-[16px] w-24 text-right bg-transparent border-none focus:ring-0 p-0 shadow-none h-auto shrink-0"
                                                    placeholder="N°"
                                                />
                                            )}
                                        </div>

                                        <div className="text-[16px] font-bold leading-tight">Date De Commande</div>
                                        <div className="text-[16px] font-normal leading-tight">
                                            {readOnly ? (
                                                order.order_date
                                            ) : (
                                                <Input
                                                    type="date"
                                                    value={order.order_date}
                                                    onChange={(e) => updateOrderField('order_date', e.target.value)}
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

                                    {/* Fournisseur Column - EDITABLE */}
                                    <div className="flex flex-col text-right items-end">
                                        <div className="text-[16px] space-y-0 w-full flex flex-col items-end text-black">
                                            {readOnly ? (
                                                <>
                                                    <p className="text-[16px] font-bold mb-0 uppercase leading-tight">{order.supplier_name || "-"}</p>
                                                    {order.supplier_address && <p className="leading-tight"><span className="font-bold">Adresse :</span> {order.supplier_address}</p>}
                                                    {order.supplier_rc && <p className="leading-tight"><span className="font-bold">RC :</span> {order.supplier_rc}</p>}
                                                    {order.supplier_nif && <p className="leading-tight"><span className="font-bold">NIF :</span> {order.supplier_nif}</p>}
                                                    {order.supplier_nis && <p className="leading-tight"><span className="font-bold">NIS :</span> {order.supplier_nis}</p>}
                                                    {order.supplier_ai && <p className="leading-tight"><span className="font-bold">AI :</span> {order.supplier_ai}</p>}
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex items-center justify-end w-full leading-tight">
                                                        <Input
                                                            value={order.supplier_name || ""}
                                                            onChange={(e) => updateOrderField('supplier_name', e.target.value)}
                                                            className="text-[16px] font-bold text-black text-right border-none bg-transparent hover:bg-gray-100 p-0 mb-0 h-auto focus:ring-0 placeholder:text-gray-400 uppercase leading-tight w-auto min-w-[150px]"
                                                            placeholder="Nom du fournisseur"
                                                        />
                                                        {clients && clients.length > 0 && (
                                                            <Popover open={openClientCombo} onOpenChange={setOpenClientCombo}>
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 p-0 ml-1 hover:bg-gray-200 shrink-0"
                                                                    >
                                                                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-[300px] p-0" align="end">
                                                                    <Command>
                                                                        <CommandInput placeholder="Rechercher un fournisseur..." />
                                                                        <CommandList>
                                                                            <CommandEmpty>Aucun fournisseur trouvé.</CommandEmpty>
                                                                            <CommandGroup>
                                                                                {clients.map((client) => (
                                                                                    <CommandItem
                                                                                        key={client.id}
                                                                                        value={client.name}
                                                                                        onSelect={() => {
                                                                                            updateClient(client.id);
                                                                                            setOpenClientCombo(false);
                                                                                        }}
                                                                                    >
                                                                                        <Check className={cn("mr-2 h-4 w-4", order.client_id === client.id ? "opacity-100" : "opacity-0")} />
                                                                                        {client.name}
                                                                                    </CommandItem>
                                                                                ))}
                                                                            </CommandGroup>
                                                                        </CommandList>
                                                                    </Command>
                                                                </PopoverContent>
                                                            </Popover>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col gap-0 w-full items-end">
                                                        <div className="flex items-center justify-end w-full leading-tight">
                                                            <span className="font-bold shrink-0">Adresse :&nbsp;</span>
                                                            <Input
                                                                value={order.supplier_address || ""}
                                                                onChange={(e) => updateOrderField('supplier_address', e.target.value)}
                                                                className="text-[16px] text-black text-right border-none bg-transparent hover:bg-gray-100 p-0 h-auto focus:ring-0 shadow-none w-auto min-w-[50px]"
                                                                placeholder="Adresse..."
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-end w-full leading-tight">
                                                            <span className="font-bold shrink-0">RC :&nbsp;</span>
                                                            <Input
                                                                value={order.supplier_rc || ""}
                                                                onChange={(e) => updateOrderField('supplier_rc', e.target.value)}
                                                                className="text-[16px] text-black text-right border-none bg-transparent hover:bg-gray-100 p-0 h-auto focus:ring-0 shadow-none w-auto min-w-[50px]"
                                                                placeholder="00 B 0000000"
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-end w-full leading-tight">
                                                            <span className="font-bold shrink-0">NIF :&nbsp;</span>
                                                            <Input
                                                                value={order.supplier_nif || ""}
                                                                onChange={(e) => updateOrderField('supplier_nif', e.target.value)}
                                                                className="text-[16px] text-black text-right border-none bg-transparent hover:bg-gray-100 p-0 h-auto focus:ring-0 shadow-none w-auto min-w-[50px]"
                                                                placeholder="000000000000000"
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-end w-full leading-tight">
                                                            <span className="font-bold shrink-0">NIS :&nbsp;</span>
                                                            <Input
                                                                value={order.supplier_nis || ""}
                                                                onChange={(e) => updateOrderField('supplier_nis', e.target.value)}
                                                                className="text-[16px] text-black text-right border-none bg-transparent hover:bg-gray-100 p-0 h-auto focus:ring-0 shadow-none w-auto min-w-[50px]"
                                                                placeholder="000000000000000"
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-end w-full leading-tight">
                                                            <span className="font-bold shrink-0">AI :&nbsp;</span>
                                                            <Input
                                                                value={order.supplier_ai || ""}
                                                                onChange={(e) => updateOrderField('supplier_ai', e.target.value)}
                                                                className="text-[16px] text-black text-right border-none bg-transparent hover:bg-gray-100 p-0 h-auto focus:ring-0 shadow-none w-auto min-w-[50px]"
                                                                placeholder="00000000000"
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

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
                                                        <td className="py-2 text-[16px] font-normal text-black align-top">
                                                            {readOnly ? (
                                                                <span className="block p-1">{item.product_code || ""}</span>
                                                            ) : (
                                                                <Input
                                                                    value={item.product_code || ""}
                                                                    onChange={(e) => updateItem(globalIdx, 'product_code', e.target.value)}
                                                                    className="w-full text-[16px] font-normal border-transparent bg-transparent hover:bg-gray-50 focus:bg-white p-1 h-auto shadow-none focus-visible:ring-0"
                                                                    placeholder="Code"
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="py-2 text-[16px] text-black align-top">
                                                            {readOnly ? (
                                                                <div className="flex flex-col gap-0.5 p-1">
                                                                    <div className="font-normal text-black leading-tight">{item.product_name || item.products?.name || item.name || ""}</div>
                                                                    {(item.product_description || item.products?.description || item.description) && (
                                                                        <div className="text-[12px] text-gray-700 italic leading-normal">
                                                                            {item.product_description || item.products?.description || item.description}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <Input
                                                                        value={item.product_name || ""}
                                                                        onChange={(e) => updateItem(globalIdx, 'product_name', e.target.value)}
                                                                        className="w-full text-[16px] font-normal border-transparent bg-transparent hover:bg-gray-50 focus:bg-white p-1 h-auto leading-tight shadow-none focus-visible:ring-0"
                                                                        placeholder="Désignation"
                                                                    />
                                                                    <Input
                                                                        value={item.product_description || item.products?.description || item.description || ""}
                                                                        onChange={(e) => updateItem(globalIdx, 'product_description', e.target.value)}
                                                                        className="w-full text-[12px] text-gray-700 italic border-transparent bg-transparent hover:bg-gray-50 focus:bg-white p-1 h-auto leading-normal shadow-none focus-visible:ring-0"
                                                                        placeholder="Description..."
                                                                    />
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-2 text-right">
                                                            {readOnly ? (
                                                                <span className="text-[16px] font-normal p-1 block">{item.quantity}</span>
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
                                                        <td className="py-2 text-center text-[16px] text-gray-500">
                                                            {readOnly ? (
                                                                <span className="h-auto w-full mx-auto p-0 justify-center flex items-center italic">
                                                                    {tvaLabel}
                                                                </span>
                                                            ) : (
                                                                <Popover
                                                                    open={openPopoverIndex === globalIdx}
                                                                    onOpenChange={(isOpen) => setOpenPopoverIndex(isOpen ? globalIdx : null)}
                                                                >
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant="ghost" className="h-auto text-[16px] w-full mx-auto p-0 justify-center font-normal text-gray-400 border border-transparent hover:border-gray-200 hover:bg-gray-50 italic">
                                                                            {tvaLabel}
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-[300px] p-3" align="center">
                                                                        <div className="space-y-4">
                                                                            <div className="space-y-2">
                                                                                <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Taux Standards</h4>
                                                                                <div className="grid grid-cols-2 gap-2">
                                                                                    <Button variant="outline" className="h-auto py-2 px-3 text-xs bg-transparent hover:bg-muted justify-start font-medium" onClick={() => { updateItem(globalIdx, 'tva_rate', 19); setOpenPopoverIndex(null); }}>19%</Button>
                                                                                    <Button variant="outline" className="h-auto py-2 px-3 text-xs bg-transparent hover:bg-muted justify-start font-medium" onClick={() => { updateItem(globalIdx, 'tva_rate', 9); setOpenPopoverIndex(null); }}>9%</Button>
                                                                                    <Button variant="outline" className="h-auto py-2 px-3 text-xs bg-transparent hover:bg-muted justify-start text-left whitespace-normal leading-tight min-h-[40px]" onClick={() => { updateItem(globalIdx, 'tva_rate', 0); setOpenPopoverIndex(null); }}>0% (Non assujetti)</Button>
                                                                                    <Button variant="outline" className="h-auto py-2 px-3 text-xs bg-transparent hover:bg-muted justify-start text-left whitespace-normal leading-tight min-h-[40px]" onClick={() => { updateItem(globalIdx, 'tva_rate', -1); setOpenPopoverIndex(null); }}>Exo (TVA)</Button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            )}
                                                        </td>
                                                        <td className="py-2 text-right text-[16px] font-normal text-black relative group-hover:pr-8 transition-all">
                                                            {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                                                            {!readOnly && (
                                                                <button
                                                                    className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                                                                    onClick={() => removeItem(globalIdx)}
                                                                    title="Supprimer la ligne"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Add Row - Only on last page */}
                                            {isLastPage && !readOnly && (
                                                <tr className="border-t border-gray-100">
                                                    <td colSpan={6} className="py-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full h-8 text-[12px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-dashed border-gray-200 mt-2"
                                                            onClick={addItem}
                                                        >
                                                            <Plus className="w-4 h-4 mr-1" />
                                                            Ajouter une ligne
                                                        </Button>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Totals Section - Only on last page */}
                                {isLastPage && (
                                    <>
                                        <div className="flex justify-end mt-4">
                                            <div className="w-80">
                                                <div className="space-y-0.5 pb-2 text-[16px] text-black">
                                                    <div className="flex justify-between items-center">
                                                        <span>Total HT</span>
                                                        <span className="font-bold">{formatCurrency(order.subtotal_ht || 0)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pb-1">
                                                        <span>Total TVA</span>
                                                        <span className="font-bold">{formatCurrency(order.tva_amount || 0)}</span>
                                                    </div>
                                                </div>

                                                <div className="pt-2">
                                                    <div
                                                        className="flex justify-between items-center px-2 h-[28px]"
                                                        style={{ backgroundColor: primaryColor }}
                                                    >
                                                        <span className="font-bold text-[16px] text-white uppercase italic tracking-wider">Total TTC</span>
                                                        <span className="font-bold text-[18px] text-white">{formatCurrency(order.total_ttc || 0)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Arrêté sum text & stamp row */}
                                        <div className="mt-6 flex items-end justify-between">
                                            <div className="max-w-[50%]">
                                                <p className="text-[12px] font-bold text-black uppercase mb-0 leading-tight italic text-shadow-none">
                                                    Arrêté le présent bon de commande à la somme de :
                                                </p>
                                                <p className="font-normal text-[12px] text-black capitalize leading-tight whitespace-pre-line">
                                                    {numberToWords(order.total_ttc || 0)} Dinars Algériens
                                                </p>
                                            </div>

                                            <div className="w-48 h-20 relative flex-shrink-0 text-center">
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
                                                <p className="absolute -bottom-5 w-full text-[12px] text-gray-400 font-medium tracking-wide">
                                                    Cachet et Signature
                                                </p>
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        <div className="mt-8">
                                            <p className="text-[12px] font-bold text-black uppercase mb-1">Notes</p>
                                            {readOnly ? (
                                                <div className="text-[12px] text-gray-500 italic bg-gray-50/50 rounded p-2 min-h-[64px] whitespace-pre-wrap">
                                                    {order.notes || "Aucune note."}
                                                </div>
                                            ) : (
                                                <textarea
                                                    value={order.notes || ""}
                                                    onChange={(e) => updateOrderField('notes', e.target.value)}
                                                    className="w-full text-[12px] text-gray-500 italic border border-gray-100 bg-gray-50/30 rounded p-2 focus:ring-0 resize-none h-16"
                                                    placeholder="Notes ou commentaires..."
                                                />
                                            )}
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
