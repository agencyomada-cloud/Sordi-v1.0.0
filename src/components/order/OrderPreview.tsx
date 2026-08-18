import { useSettings } from "@/hooks/useSettings";
import { chunkItems } from "@/lib/paginationUtils";
import { numberToWords } from "@/lib/numberToWords";

interface OrderPreviewProps {
    order: any;
}

export function OrderPreview({ order }: OrderPreviewProps) {
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

    const items = order.items || order.order_items || [];
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
                                            {order.custom_title || "BON DE COMMANDE"}
                                        </h2>

                                        <div className="text-[16px] font-bold leading-tight">
                                            Bon N: {order.order_number}
                                        </div>

                                        <div className="text-[16px] font-bold leading-tight">
                                            Date De Commande
                                        </div>
                                        <div className="text-[16px] font-normal leading-tight">
                                            {order.order_date ? order.order_date.replace(/-/g, '.') : new Date(order.order_date).toLocaleDateString().replace(/\//g, '.')}
                                        </div>
                                    </div>
                                </div>

                                {/* Emetteur & Adresse a Section */}
                                <div className="grid grid-cols-2 gap-8 mb-2 mt-4">
                                    {/* Emetteur Column */}
                                    <div className="flex flex-col">
                                        <div className="text-[16px] space-y-0">
                                            <p className="font-bold text-black mb-0 uppercase leading-tight">{settings?.company_name || ""}</p>
                                            {settings?.company_address && <p className="leading-tight"><span className="font-bold">Adresse :</span> {settings.company_address}</p>}
                                            {settings?.company_rc && <p className="leading-tight"><span className="font-bold">RC :</span> {settings.company_rc}</p>}
                                            {settings?.company_nif && <p className="leading-tight"><span className="font-bold">NIF :</span> {settings.company_nif}</p>}
                                            {settings?.company_nis && <p className="leading-tight"><span className="font-bold">NIS :</span> {settings.company_nis}</p>}
                                            {settings?.company_ai && <p className="leading-tight"><span className="font-bold">AI :</span> {settings.company_ai}</p>}
                                        </div>
                                    </div>

                                    {/* Fournisseur Column */}
                                    <div className="flex flex-col text-right items-end">
                                        <div className="text-[16px] space-y-0 w-full flex flex-col items-end">
                                            <p className="text-[16px] font-bold text-black mb-0 uppercase leading-tight">{order.supplier_name || order.clients?.name || "-"}</p>
                                            {(order.supplier_address || order.clients?.address) && <p className="leading-tight"><span className="font-bold">Adresse :</span> {order.supplier_address || order.clients?.address}</p>}
                                            {(order.supplier_rc || order.clients?.rc) && <p className="leading-tight"><span className="font-bold">RC :</span> {order.supplier_rc || order.clients?.rc}</p>}
                                            {(order.supplier_nif || order.clients?.nif) && <p className="leading-tight"><span className="font-bold">NIF :</span> {order.supplier_nif || order.clients?.nif}</p>}
                                            {(order.supplier_nis || order.clients?.nis) && <p className="leading-tight"><span className="font-bold">NIS :</span> {order.supplier_nis || order.clients?.nis}</p>}
                                            {(order.supplier_ai || order.clients?.ai) && <p className="leading-tight"><span className="font-bold">AI :</span> {order.supplier_ai || order.clients?.ai}</p>}
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
                                                <th className="text-left py-2 font-bold text-white uppercase text-[16px] tracking-wider" style={{ width: '80px' }}>Réf</th>
                                                <th className="text-left py-2 font-bold text-white uppercase text-[16px] tracking-wider">Désignation</th>
                                                <th className="text-right py-2 font-bold text-white uppercase text-[16px] tracking-wider" style={{ width: '80px' }}>Qté</th>
                                                <th className="text-right py-2 font-bold text-white uppercase text-[16px] tracking-wider" style={{ width: '110px' }}>Prix Unit.</th>
                                                <th className="text-center py-2 font-bold text-white uppercase text-[16px] tracking-wider" style={{ width: '70px' }}>TVA</th>
                                                <th className="text-right py-2 font-bold text-white uppercase text-[16px] tracking-wider" style={{ width: '120px' }}>Total HT</th>
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
                                                        <td className="py-2 text-[16px] text-gray-600 align-top">
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="font-normal text-black leading-tight">{productName}</div>
                                                                {(item.product_description || item.products?.description || item.description) && (
                                                                    <div className="text-[12px] text-gray-700 leading-normal italic">
                                                                        {item.product_description || item.products?.description || item.description}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 text-right text-[16px] font-normal align-top">{item.quantity}</td>
                                                        <td className="py-2 text-right text-[16px] font-normal align-top">{formatCurrency(item.unit_price)}</td>
                                                        <td className="py-2 text-center text-[16px] text-gray-500 align-top">
                                                            {tvaLabel}
                                                        </td>
                                                        <td className="py-2 text-right text-[16px] font-normal text-black align-top">
                                                            {formatCurrency(item.quantity * item.unit_price)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
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
                                                        <span>Sous-total HT</span>
                                                        <span className="font-bold">{formatCurrency(order.subtotal_ht || 0)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pb-1">
                                                        <span>Total TVA</span>
                                                        <span className="font-bold">{formatCurrency(order.tva_amount || 0)}</span>
                                                    </div>
                                                </div>

                                                <div className="pt-2">
                                                    <div
                                                        className="flex justify-between items-center mb-1 px-2 h-[28px]"
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
                                                <p className="text-[12px] font-bold text-black uppercase mb-0 leading-tight italic">
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
                                        {order.notes && (
                                            <div className="mt-8">
                                                <p className="text-[12px] font-bold text-black uppercase mb-1">Notes</p>
                                                <p className="text-[12px] text-gray-400 italic">{order.notes}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Footer - Locked at the absolute bottom */}
                            <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 p-6 text-center bg-white">
                                <p className="text-[8px] text-black font-mono text-center w-full">
                                    {settings?.company_rib || "RIB : 004.00364.400.000.4811.36 CPA SETIF • Agence 364 CPA BD. CHELIHI KOUIDER, 19000"}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
