import { toast } from "sonner";
import React, { useMemo } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/database";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileDown, Table as TableIcon, Loader2, Sparkles } from "lucide-react";
import { generateInvoicePDF } from "@/lib/pdfGenerator";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface CumulativeRecord {
    client_name: string;
    product_name: string;
    total_quantity: number;
    total_ht: number;
    total_tva: number;
    total_ttc: number;
    total_timbre: number;
}

type MetricType = "total_ht" | "total_ttc" | "total_tva" | "total_quantity" | "total_timbre";

interface ClientProductPivotTableProps {
    year: number;
    months: string[];
}

export const ClientProductPivotTable: React.FC<ClientProductPivotTableProps> = ({
    year,
    months,
}) => {
    const [selectedMetric, setSelectedMetric] = React.useState<MetricType>("total_ht");
    const [isExporting, setIsExporting] = React.useState(false);
    const { data: settings } = useSettings();
    const { data, isLoading } = useQuery({
        queryKey: ["client-product-cumulatives", year, months],
        queryFn: () => db.dashboard.getClientProductCumulatives(year, months),
    });

    const primaryColor = settings?.primary_color || "#0067F2";
    const logoBgColor = settings?.logo_bg_color || "#000000";
    const logoTextColor = settings?.logo_text_color || "#FFFFFF";
    const companyMain = (settings?.company_name || "Omada").split(' ')[0];

    const { clients, products, pivotData, totals } = useMemo(() => {
        if (!data) return { clients: [], products: [], pivotData: {}, totals: { products: {}, clients: {}, grandTotal: 0 } };

        const clientsSet = new Set<string>();
        const productsSet = new Set<string>();
        const pivot: Record<string, Record<string, number>> = {};
        const productTotals: Record<string, number> = {};
        const clientTotals: Record<string, number> = {};
        let grandTotal = 0;

        data.forEach((record: CumulativeRecord) => {
            clientsSet.add(record.client_name);
            productsSet.add(record.product_name);

            if (!pivot[record.client_name]) pivot[record.client_name] = {};
            const value = record[selectedMetric] || 0;
            pivot[record.client_name][record.product_name] = value;

            productTotals[record.product_name] = (productTotals[record.product_name] || 0) + value;
            clientTotals[record.client_name] = (clientTotals[record.client_name] || 0) + value;
            grandTotal += value;
        });

        return {
            clients: Array.from(clientsSet).sort(),
            products: Array.from(productsSet).sort(),
            pivotData: pivot,
            totals: {
                products: productTotals,
                clients: clientTotals,
                grandTotal
            }
        };
    }, [data, selectedMetric]);

    const formatValue = (value: number) => {
        if (!value) return selectedMetric === "total_quantity" ? "0" : "0 DA";

        if (selectedMetric === "total_quantity") {
            return new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 2 }).format(value);
        }

        if (selectedMetric === "total_timbre" && value < 1 && value > 0) {
            return new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 2 }).format(value) + " DA";
        }

        return new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(value) + " DA";
    };

    const exportToCSV = () => {
        if (!data) return;

        const headers = ["Client", ...products, "Total"];
        const rows = clients.map(client => [
            client,
            ...products.map(p => pivotData[client][p] || 0),
            totals.clients[client]
        ]);

        rows.push(["TOTAL", ...products.map(p => totals.products[p] || 0), totals.grandTotal]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `cumules_ventes_${year}_${months.join("-") || "annee"}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Fichier CSV téléchargé avec succès");
  };

    const exportToPDF = async () => {
        const element = document.getElementById("cumulatives-table-a3");
        if (!element) return;

        setIsExporting(true);
        try {
            await generateInvoicePDF({ invoice_type: 'cumulatives' }, {} as any, true, {
                paper_size: "A3",
                landscape: true,
                elementId: "cumulatives-table-a3"
            });
        } catch (e) {
            console.error("PDF Export failed", e);
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoading) {
        return (
            <Card className="mt-6 border-none shadow-lg bg-gradient-to-br from-card to-muted/20">
                <CardContent className="h-64 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse font-medium">Analyse des données en cours...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mt-6 border-none shadow-elevated bg-card/50 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <TableIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-bold tracking-tight">Ventes Cumulées</CardTitle>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Analyse des performances par produit</p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <Select value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as MetricType)}>
                        <SelectTrigger className="w-[180px] h-9">
                            <SelectValue placeholder="Choisir la mesure" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="total_ht">Montant HT</SelectItem>
                            <SelectItem value="total_ttc">Montant TTC</SelectItem>
                            <SelectItem value="total_tva">Montant TVA</SelectItem>
                            <SelectItem value="total_timbre">Montant Timbre</SelectItem>
                            <SelectItem value="total_quantity">Quantité</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={exportToCSV}
                        className="h-9 px-3 text-xs gap-2 hover:bg-primary/5 transition-colors"
                    >
                        <FileDown className="w-4 h-4 text-primary" />
                        Exporter CSV
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={exportToPDF}
                        disabled={isExporting}
                        className="h-9 px-3 text-xs gap-2 border-primary/20 hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                    >
                        {isExporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        {isExporting ? "Génération..." : "Rapport PDF A3"}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                <div className="relative">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40">
                        <Table className="border-collapse w-full text-[13px]">
                            <TableHeader className="sticky top-0 z-30 shadow-sm">
                                <TableRow className="hover:bg-transparent border-b bg-background/95 backdrop-blur-md">
                                    <TableHead className="sticky left-0 bg-inherit z-40 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-bold py-4 px-6 text-foreground border-r border-border/50">
                                        Client
                                    </TableHead>
                                    {products.map(p => (
                                        <TableHead key={p} className="text-right min-w-[130px] font-bold py-4 px-6 bg-muted/5 text-muted-foreground uppercase tracking-wider text-[11px]">
                                            {p}
                                        </TableHead>
                                    ))}
                                    <TableHead className="text-right font-bold sticky right-0 bg-primary/[0.02] z-40 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] py-4 px-6 text-primary border-l border-border/50">
                                        Total {selectedMetric === "total_quantity" ? "Quantité" :
                                            selectedMetric === "total_tva" ? "TVA" :
                                                selectedMetric === "total_timbre" ? "Timbre" :
                                                    selectedMetric === "total_ttc" ? "TTC" : "HT"}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.map((client, idx) => (
                                    <TableRow
                                        key={client}
                                        className={cn(
                                            "group transition-all duration-200 h-12 relative",
                                            idx % 2 === 0 ? "bg-transparent" : "bg-muted/5",
                                            "hover:bg-primary/5"
                                        )}
                                    >
                                        <TableCell className="font-semibold sticky left-0 bg-inherit z-20 border-r border-border/50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] py-3 px-6 text-foreground group-hover:text-primary transition-colors">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform origin-center" />
                                            {client}
                                        </TableCell>
                                        {products.map(p => (
                                            <TableCell key={p} className="text-right tabular-nums py-3 px-6">
                                                {pivotData[client][p] ? (
                                                    <span className="font-medium text-foreground tracking-tight">{formatValue(pivotData[client][p])}</span>
                                                ) : (
                                                    <span className="text-muted-foreground/30 font-light">—</span>
                                                )}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right font-bold sticky right-0 bg-primary/[0.02] z-20 border-l border-border/50 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)] py-3 px-6 text-primary/80 group-hover:text-primary">
                                            {formatValue(totals.clients[client])}
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {/* Total Row */}
                                <TableRow className="bg-primary/10 hover:bg-primary/15 font-bold sticky bottom-0 z-30 border-t-2 border-primary/20">
                                    <TableCell className="sticky left-0 bg-inherit z-40 border-r border-primary/20 py-5 px-6 uppercase tracking-widest text-primary">
                                        Total Général
                                    </TableCell>
                                    {products.map(p => (
                                        <TableCell key={p} className="text-right py-5 px-6 text-primary tabular-nums">
                                            {formatValue(totals.products[p] || 0)}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right sticky right-0 bg-primary/20 z-40 border-l border-primary/20 py-5 px-6 text-primary text-base font-black tabular-nums">
                                        {formatValue(totals.grandTotal)}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Hidden element for PDF Report - Matching standard document layout */}
                <div className="absolute left-[-9999px] top-0">
                    <div
                        id="cumulatives-table-a3"
                        className="bg-white text-black relative flex flex-col"
                        style={{
                            width: '420mm',
                            minHeight: '297mm',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            backgroundColor: 'white'
                        }}
                    >
                        {/* Top Decoration Bar */}
                        <div className="w-full h-6 shrink-0" style={{ backgroundColor: primaryColor }} />

                        {/* Content Area */}
                        <div className="p-8 flex flex-col flex-1">
                            {/* Header Section */}
                            <div className="flex justify-between items-end mb-6">
                                <div className="flex items-center gap-4">
                                    {settings?.logo_data ? (
                                        <img
                                            src={settings.logo_data}
                                            alt="Logo"
                                            style={{
                                                height: settings.logo_size ? `${parseInt(settings.logo_size) * 1.2}px` : "70px",
                                                maxWidth: 'none'
                                            }}
                                        />
                                    ) : (
                                        <div className="bg-black text-white p-3 rounded-sm transform -skew-x-12" style={{ backgroundColor: logoBgColor, color: logoTextColor }}>
                                            <span className="font-bold text-3xl skew-x-12 block">{companyMain.charAt(0)}</span>
                                        </div>
                                    )}
                                    <div className="whitespace-nowrap">
                                        <p className="text-sm text-gray-500 uppercase font-bold tracking-widest">Rapport d'Analyse Commerciale</p>
                                    </div>
                                </div>

                                <div className="text-right flex flex-col items-end">
                                    <div className="flex items-center justify-end gap-2 mb-1 whitespace-nowrap">
                                        <h1 className="text-3xl font-black text-black uppercase tracking-tight">Ventes Cumulées</h1>
                                        <div className="px-3 py-0.5 bg-black text-white text-2xl font-black rounded-sm" style={{ backgroundColor: primaryColor }}>{year}</div>
                                    </div>
                                    <p className="text-gray-400 font-bold uppercase tracking-widest text-sm whitespace-nowrap">
                                        {months.length > 0 ? `Période: ${months.join(', ')}` : 'Rapport Annuel Complet'}
                                    </p>
                                </div>
                            </div>

                            <div className="border-b-2 border-gray-100 w-full mb-6" />

                            {/* Pivot Table */}
                            <div className="">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="text-left py-3 px-3 font-bold text-gray-400 uppercase text-[10px] tracking-widest border-b border-black" style={{ width: '350px' }}>Nom du Client</th>
                                            {products.map(p => (
                                                <th key={p} className="text-right py-3 px-3 font-bold text-gray-400 uppercase text-[10px] tracking-widest border-b border-black">{p}</th>
                                            ))}
                                            <th className="text-right py-3 px-3 font-bold text-black uppercase text-[10px] tracking-widest border-b border-black bg-gray-50">
                                                Total {selectedMetric === "total_quantity" ? "Quantité" :
                                                    selectedMetric === "total_tva" ? "TVA" :
                                                        selectedMetric === "total_timbre" ? "Timbre" :
                                                            selectedMetric === "total_ttc" ? "TTC" : "HT"}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clients.map((client, i) => (
                                            <tr key={client} className={cn("border-b border-gray-100", i % 2 === 0 ? "bg-white" : "bg-gray-50/30")}>
                                                <td className="py-2.5 px-3 text-base font-bold text-gray-800 border-r border-gray-50">{client}</td>
                                                {products.map(p => (
                                                    <td key={p} className="py-2.5 px-3 text-right text-sm text-gray-600 font-medium tabular-nums">
                                                        {pivotData[client][p] ? formatValue(pivotData[client][p]) : "-"}
                                                    </td>
                                                ))}
                                                <td className="py-2.5 px-3 text-right text-base font-black text-black tabular-nums bg-gray-50/50">
                                                    {formatValue(totals.clients[client] || 0)}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="text-white font-black" style={{ backgroundColor: primaryColor }}>
                                            <td className="p-4 text-base uppercase tracking-wider">Total Général</td>
                                            {products.map(p => (
                                                <td key={p} className="p-4 text-right text-base tabular-nums">
                                                    {formatValue(totals.products[p] || 0)}
                                                </td>
                                            ))}
                                            <td className="p-4 text-right text-2xl tabular-nums bg-black/10">
                                                {formatValue(totals.grandTotal)}
                                            </td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        {/* Repeating Footer Row - Company info ONLY */}
                                        <tr className="bg-white">
                                            <td colSpan={products.length + 2} className="pt-8">
                                                <div className="border-t border-gray-100 flex justify-between items-end opacity-70 pb-4">
                                                    <div className="space-y-0.5">
                                                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Informations Entreprise</p>
                                                        <p className="text-[11px] text-black font-bold">{settings?.company_name || companyMain}</p>
                                                        <p className="text-[10px] text-gray-600">
                                                            {settings?.company_address || "-"}
                                                            {settings?.company_phone ? ` • Tél: ${settings.company_phone}` : ""}
                                                        </p>
                                                        <p className="text-[10px] font-mono text-gray-500">
                                                            {settings?.company_rib ? `RIB : ${settings.company_rib}` : ""}
                                                        </p>
                                                    </div>
                                                    <div className="text-right space-y-1">
                                                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Document généré le</div>
                                                        <div className="text-base font-bold text-black border-r-4 border-black pr-4" style={{ borderColor: primaryColor }}>
                                                            {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 italic">
                                                            Système Omada Invoicing • Rapport de Synthèse
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
