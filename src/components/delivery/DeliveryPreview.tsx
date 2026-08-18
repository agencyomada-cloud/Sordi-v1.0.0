import { useSettings } from "@/hooks/useSettings";
import { chunkItems } from "@/lib/paginationUtils";

interface DeliveryPreviewProps {
    deliveryNote: any;
}

export function DeliveryPreview({ deliveryNote }: DeliveryPreviewProps) {
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

    const primaryColor = settings?.primary_color || "#FFCC00";
    const logoBgColor = settings?.logo_bg_color || "#000000";
    const logoTextColor = settings?.logo_text_color || "#FFFFFF";

    const companyName = settings?.company_name || "";
    const parts = companyName.split(' ');
    const companyMain = parts[0] || "";

    const items = deliveryNote.items || deliveryNote.delivery_note_items || deliveryNote.delivery_items || [];
    const pages = chunkItems(items);

    return (
        <div id="invoice-preview">
            {pages.map((pageItems, pageIndex) => {
                const isFirstPage = pageIndex === 0;
                const isLastPage = pageIndex === pages.length - 1;

                return (
                    <div
                        key={pageIndex}
                        id={`invoice-preview-page-${pageIndex + 1}`}
                        className="bg-white text-black relative shadow-2xl transition-transform duration-200 flex flex-col"
                        style={{
                            width: '210mm',
                            height: '297mm',
                            margin: pageIndex > 0 ? '40px auto 0' : '0 auto',
                            position: 'relative',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            pageBreakAfter: isLastPage ? 'auto' : 'always',
                            overflow: 'hidden',
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
                                        <h2 className="text-[18px] font-extrabold uppercase leading-tight">
                                            {deliveryNote.custom_title || "BON DE LIVRAISON"}
                                        </h2>

                                        <div className="text-[16px] font-bold leading-tight">
                                            Bon N: {deliveryNote.delivery_number}
                                        </div>

                                        <div className="text-[16px] font-bold leading-tight">
                                            Date De Livraison
                                        </div>
                                        <div className="text-[16px] font-normal leading-tight text-black">
                                            {deliveryNote.delivery_date ? deliveryNote.delivery_date.replace(/-/g, '.') : new Date(deliveryNote.delivery_date).toLocaleDateString().replace(/\//g, '.')}
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

                                    {/* Adresse a Column */}
                                    <div className="flex flex-col text-right items-end">
                                        <div className="text-[16px] space-y-0 text-black">
                                            <p className="text-[16px] font-bold mb-0 uppercase leading-tight">{deliveryNote.clients?.name || "-"}</p>
                                            {deliveryNote.clients?.address && <p className="leading-tight"><span className="font-bold">Adresse :</span> {deliveryNote.clients.address}</p>}
                                            {deliveryNote.clients?.rc && <p className="leading-tight"><span className="font-bold">RC :</span> {deliveryNote.clients.rc}</p>}
                                            {deliveryNote.clients?.nif && <p className="leading-tight"><span className="font-bold">NIF :</span> {deliveryNote.clients.nif}</p>}
                                            {deliveryNote.clients?.nis && <p className="leading-tight"><span className="font-bold">NIS :</span> {deliveryNote.clients.nis}</p>}
                                            {deliveryNote.clients?.ai && <p className="leading-tight"><span className="font-bold">AI :</span> {deliveryNote.clients.ai}</p>}
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
                                            {pageItems.map((item: any, index: number) => {
                                                const productCode = item.products?.code || item.product_code || "-";
                                                const productName = item.products?.name || item.product_name || "-";
                                                const tvaLabel = item.tva_rate === -1 ? "Exo" :
                                                    (item.tva_rate === null || item.tva_rate === 0) ? "0%" :
                                                        item.tva_rate === undefined ? "19%" :
                                                            `${item.tva_rate}%`;

                                                return (
                                                    <tr key={index} className="border-b border-gray-100">
                                                        <td className="py-2 text-[16px] font-normal text-black align-top">{productCode}</td>
                                                        <td className="py-2 text-[16px] text-black align-top">
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="font-normal leading-tight">{productName}</div>
                                                                {(item.product_description || item.products?.description || item.description) && (
                                                                    <div className="text-[12px] text-gray-700 italic leading-normal">
                                                                        {item.product_description || item.products?.description || item.description}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 text-right text-[16px] font-normal align-top">{(item.quantity || 0).toFixed(3)}</td>
                                                        <td className="py-2 text-right text-[16px] align-top font-normal">{formatCurrency(item.unit_price || item.products?.unit_price)}</td>
                                                        <td className="py-2 text-center text-[16px] text-gray-500 align-top italic font-normal">
                                                            {tvaLabel}
                                                        </td>
                                                        <td className="py-2 text-right text-[16px] font-normal text-black align-top">
                                                            {formatCurrency((item.quantity || 0) * (item.unit_price || item.products?.unit_price || 0))}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Last Page Content: Transport, Notes, Signatures */}
                                {isLastPage && (
                                    <>
                                        {/* Total Summary */}
                                        <div className="flex justify-end mt-4 pt-4">
                                            <div className="flex gap-4 items-center">
                                                <span className="font-bold text-[16px] text-black uppercase tracking-tight italic">Total Quantité</span>
                                                <span className="text-[24px] font-black" style={{ color: primaryColor }}>
                                                    {(items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0)).toFixed(3)} T
                                                </span>
                                            </div>
                                        </div>

                                        {/* Transport & Location */}
                                        <div className="mt-4 grid grid-cols-2 gap-8 text-black">
                                            <div className="space-y-0.5">
                                                <p className="text-[16px] font-bold text-black uppercase tracking-wider mb-1">Détails Transport</p>
                                                <div className="text-[16px] flex items-center gap-2">
                                                    <span className="font-bold w-24">Chauffeur:</span>
                                                    <span>{deliveryNote.driver_name || "-"}</span>
                                                </div>
                                                <div className="text-[16px] flex items-center gap-2">
                                                    <span className="font-bold w-24">Camion:</span>
                                                    <span>{deliveryNote.truck_plate || "-"}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-[16px] font-bold text-black uppercase tracking-wider mb-1">Lieu de Livraison</p>
                                                <p className="text-[16px]">{deliveryNote.delivery_location || "-"}</p>
                                            </div>
                                        </div>

                                        {/* Notes & Reserves */}
                                        <div className="mt-4 grid grid-cols-2 gap-8 text-black">
                                            <div>
                                                <p className="text-[12px] font-bold text-black uppercase tracking-wider mb-1">Notes</p>
                                                <p className="text-[12px] text-gray-500 italic bg-gray-50/50 p-2 rounded min-h-[40px] whitespace-pre-wrap">{deliveryNote.notes || "-"}</p>
                                            </div>
                                            <div>
                                                <p className="text-[12px] font-bold text-red-500 uppercase tracking-wider mb-1">Réserves</p>
                                                <p className="text-[12px] text-red-400 italic bg-red-50/10 p-2 rounded min-h-[40px] whitespace-pre-wrap">{deliveryNote.reserves || "-"}</p>
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
                                        {settings?.company_extra_info && <p className="leading-tight">{settings.company_extra_info}</p>}
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
