import { toast } from "sonner";
import React, { useMemo, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, SearchInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, EmptyState, TableLoading } from "@sordi/ui";
import {
    RiTableLine as TableIcon,
    RiArrowUpSLine,
    RiArrowDownSLine,
    RiExpandUpDownLine,
} from "@remixicon/react";
import { generateInvoicePDF } from "@/lib/pdfGenerator";
import { cn } from "@/lib/utils";
import { ExportActionMenu } from "@/components/ui/export-action-menu";

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
type SortKey = "client_name" | "product_name" | keyof Omit<CumulativeRecord, "client_name" | "product_name">;

interface ClientProductPivotTableProps {
    year: number;
    months: string[];
}

/**
 * A flat, sortable, searchable list of every (client, product) combination
 * with all five metrics visible at once — not a client×product cross-tab.
 * A pivot matrix here meant one column per product (potentially dozens),
 * most cells empty, and only one metric visible at a time behind a
 * dropdown. Since every record already carries all five metrics, a normal
 * table shows the same data with a fixed column count and nothing sparse.
 * The PDF "Rapport A3" export below still renders a printed cross-tab —
 * that's a distinct, page-formatted document, not this on-screen view.
 */
export const ClientProductPivotTable: React.FC<ClientProductPivotTableProps> = ({
    year,
    months,
}) => {
    const [pdfMetric, setPdfMetric] = React.useState<MetricType>("total_ht");
    const [isExporting, setIsExporting] = React.useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "total_ttc", direction: "desc" });
    const { data: settings } = useSettings();
    const { activeCompanyId, isReady } = useWorkspace();
    const { data, isLoading } = useQuery({
        queryKey: ["client-product-cumulatives", activeCompanyId, year, months],
        queryFn: () => db.dashboard.getClientProductCumulatives(activeCompanyId, year, months),
        enabled: isReady,
    });

    const primaryColor = settings?.primary_color || "#476CFF";
    const logoBgColor = settings?.logo_bg_color || "#000000";
    const logoTextColor = settings?.logo_text_color || "#FFFFFF";
    const companyMain = (settings?.company_name || "Sordi").split(' ')[0];

    const toggleSort = (key: SortKey) => {
        setSort((prev) => prev.key === key
            ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
            : { key, direction: "desc" });
    };

    const rows = useMemo(() => {
        const list = (data as CumulativeRecord[] | undefined) ?? [];
        const q = searchQuery.trim().toLowerCase();
        const filtered = q
            ? list.filter(r => r.client_name.toLowerCase().includes(q) || r.product_name.toLowerCase().includes(q))
            : list;

        return [...filtered].sort((a, b) => {
            const av = a[sort.key];
            const bv = b[sort.key];
            const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
            return sort.direction === "asc" ? cmp : -cmp;
        });
    }, [data, searchQuery, sort]);

    const totals = useMemo(() => rows.reduce((acc, r) => ({
        quantity: acc.quantity + r.total_quantity,
        ht: acc.ht + r.total_ht,
        tva: acc.tva + r.total_tva,
        timbre: acc.timbre + r.total_timbre,
        ttc: acc.ttc + r.total_ttc,
    }), { quantity: 0, ht: 0, tva: 0, timbre: 0, ttc: 0 }), [rows]);

    // Pivoted purely for the printed A3 report (see PDF section below) —
    // the on-screen table above no longer uses this shape.
    const { clients, products, pivotData, pivotTotals } = useMemo(() => {
        if (!data) return { clients: [], products: [], pivotData: {} as Record<string, Record<string, number>>, pivotTotals: { products: {} as Record<string, number>, clients: {} as Record<string, number>, grandTotal: 0 } };

        const clientsSet = new Set<string>();
        const productsSet = new Set<string>();
        const pivot: Record<string, Record<string, number>> = {};
        const productTotals: Record<string, number> = {};
        const clientTotals: Record<string, number> = {};
        let grandTotal = 0;

        (data as CumulativeRecord[]).forEach((record) => {
            clientsSet.add(record.client_name);
            productsSet.add(record.product_name);
            if (!pivot[record.client_name]) pivot[record.client_name] = {};
            const value = record[pdfMetric] || 0;
            pivot[record.client_name][record.product_name] = value;
            productTotals[record.product_name] = (productTotals[record.product_name] || 0) + value;
            clientTotals[record.client_name] = (clientTotals[record.client_name] || 0) + value;
            grandTotal += value;
        });

        return {
            clients: Array.from(clientsSet).sort(),
            products: Array.from(productsSet).sort(),
            pivotData: pivot,
            pivotTotals: { products: productTotals, clients: clientTotals, grandTotal },
        };
    }, [data, pdfMetric]);

    const formatValue = (value: number, metric: MetricType = "total_ht") => {
        if (!value) return metric === "total_quantity" ? "0" : "0 DA";
        if (metric === "total_quantity") {
            return new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 2 }).format(value);
        }
        return new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(value) + " DA";
    };

    const exportToCSV = () => {
        if (!data) return;
        const headers = ["Client", "Produit", "Quantité", "Total HT", "Total TVA", "Timbre", "Total TTC"];
        const csvRows = rows.map(r => [r.client_name, r.product_name, r.total_quantity, r.total_ht, r.total_tva, r.total_timbre, r.total_ttc]);
        csvRows.push(["TOTAL", "", totals.quantity, totals.ht, totals.tva, totals.timbre, totals.ttc]);

        const csvContent = [headers.join(","), ...csvRows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `ventes_client_produit_${year}_${months.join("-") || "annee"}.csv`);
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
            toast.success("Rapport PDF A3 téléchargé avec succès");
        } catch (e) {
            console.error("PDF Export failed", e);
            toast.error("Erreur lors de la génération du PDF");
        } finally {
            setIsExporting(false);
        }
    };

    const SortHeader = ({ label, sortKey, align = "left" }: { label: string; sortKey: SortKey; align?: "left" | "right" }) => (
        <TableHead
            numeric={align === "right"}
            className="cursor-pointer select-none hover:text-foreground transition-colors text-[11px] font-semibold text-muted-foreground uppercase px-3"
            onClick={() => toggleSort(sortKey)}
        >
            <span className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
                {label}
                {sort.key === sortKey ? (
                    sort.direction === "asc" ? <RiArrowUpSLine className="w-3.5 h-3.5" /> : <RiArrowDownSLine className="w-3.5 h-3.5" />
                ) : (
                    <RiExpandUpDownLine className="w-3.5 h-3.5 opacity-30" />
                )}
            </span>
        </TableHead>
    );

    if (isLoading) {
        return (
            <div className="border border-border/80 rounded-md bg-card overflow-hidden">
                <div className="flex flex-col gap-3 p-4 border-b border-border/60">
                    <div className="flex flex-row items-center justify-between gap-4">
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-56" />
                            <Skeleton className="h-3 w-40" />
                        </div>
                        <Skeleton className="h-7 w-32 rounded-md" />
                    </div>
                    <Skeleton className="h-8 w-full sm:w-72 rounded-md" />
                </div>
                <Table className="w-full text-sm">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            {Array.from({ length: 7 }).map((_, i) => (
                                <TableHead key={i}><Skeleton className="h-3 w-16" /></TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableLoading columns={7} rows={6} numericColumns={[2, 3, 4, 5, 6]} />
                    </TableBody>
                </Table>
            </div>
        );
    }

    return (
        <div className="border border-border/80 rounded-md bg-card overflow-hidden w-full">
            <div className="flex flex-col gap-3 p-4 border-b border-border/60">
                <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <TableIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            Ventes Cumulées par Produit
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {rows.length} ligne{rows.length > 1 ? "s" : ""} client × produit sur la période
                        </p>
                    </div>
                    <ExportActionMenu onExportCSV={exportToCSV} onExportPDF={exportToPDF} isExportingPDF={isExporting} pdfLabel="Exporter PDF A3" />
                </div>

                <div className="h-9 flex items-center justify-between gap-3">
                    <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Rechercher un client ou un produit..."
                        className="h-[30px] text-xs bg-background border-border/80 rounded-md"
                        containerClassName="w-full sm:w-72"
                    />

                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        <span className="hidden md:inline">Rapport imprimable :</span>
                        <Select value={pdfMetric} onValueChange={(v) => setPdfMetric(v as MetricType)}>
                            <SelectTrigger className="w-[150px] h-[30px] text-xs rounded-md border-border/80">
                                <SelectValue placeholder="Mesure" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="total_ht">Montant HT</SelectItem>
                                <SelectItem value="total_ttc">Montant TTC</SelectItem>
                                <SelectItem value="total_tva">Montant TVA</SelectItem>
                                <SelectItem value="total_timbre">Montant Timbre</SelectItem>
                                <SelectItem value="total_quantity">Quantité</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <Table className="w-full text-sm">
                        <TableHeader className="sticky top-0 z-10 bg-muted/40">
                            <TableRow className="h-8 bg-muted/40 hover:bg-muted/40">
                                <SortHeader label="Client" sortKey="client_name" />
                                <SortHeader label="Produit" sortKey="product_name" />
                                <SortHeader label="Quantité" sortKey="total_quantity" align="right" />
                                <SortHeader label="Total HT" sortKey="total_ht" align="right" />
                                <SortHeader label="Total TVA" sortKey="total_tva" align="right" />
                                <SortHeader label="Timbre" sortKey="total_timbre" align="right" />
                                <SortHeader label="Total TTC" sortKey="total_ttc" align="right" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7}>
                                        <EmptyState
                                            type="default"
                                            title="Aucune vente"
                                            description={searchQuery ? "Essayez une autre recherche" : "Aucune vente enregistrée sur cette période"}
                                            action={searchQuery ? { label: "Effacer la recherche", onClick: () => setSearchQuery("") } : undefined}
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((r, i) => (
                                    <TableRow key={`${r.client_name}-${r.product_name}-${i}`} className="h-8 text-xs border-b border-border/30 hover:bg-muted/20 transition-colors">
                                        <TableCell className="font-medium px-3">{r.client_name}</TableCell>
                                        <TableCell className="text-muted-foreground px-3">{r.product_name}</TableCell>
                                        <TableCell numeric className="font-medium px-3">{new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 2 }).format(r.total_quantity)}</TableCell>
                                        <TableCell numeric className="font-medium px-3">{formatValue(r.total_ht)}</TableCell>
                                        <TableCell numeric className="font-medium px-3">{formatValue(r.total_tva)}</TableCell>
                                        <TableCell numeric className="font-medium text-muted-foreground px-3">{formatValue(r.total_timbre)}</TableCell>
                                        <TableCell numeric className="font-semibold text-primary px-3">{formatValue(r.total_ttc)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        {rows.length > 0 && (
                            <tfoot>
                                <TableRow className="h-9 bg-muted/30 border-t border-border/60 font-semibold text-xs font-mono tabular-nums hover:bg-muted/30">
                                    <TableCell colSpan={2} className="uppercase tracking-wide text-xs text-primary font-sans px-3">
                                        Total {searchQuery ? "(filtré)" : "Général"}
                                    </TableCell>
                                    <TableCell numeric className="text-primary px-3">{new Intl.NumberFormat("fr-DZ").format(totals.quantity)}</TableCell>
                                    <TableCell numeric className="text-primary px-3">{formatValue(totals.ht)}</TableCell>
                                    <TableCell numeric className="text-primary px-3">{formatValue(totals.tva)}</TableCell>
                                    <TableCell numeric className="text-primary px-3">{formatValue(totals.timbre)}</TableCell>
                                    <TableCell numeric className="text-primary text-sm px-3">{formatValue(totals.ttc)}</TableCell>
                                </TableRow>
                            </tfoot>
                        )}
                    </Table>
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
                                        {months.length > 0
                                            ? `Période: ${months.map(m => ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][parseInt(m) - 1] || m).join(', ')}`
                                            : 'Rapport Annuel Complet'}
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
                                                Total {pdfMetric === "total_quantity" ? "Quantité" :
                                                    pdfMetric === "total_tva" ? "TVA" :
                                                        pdfMetric === "total_timbre" ? "Timbre" :
                                                            pdfMetric === "total_ttc" ? "TTC" : "HT"}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clients.map((client, i) => (
                                            <tr key={client} className={cn("border-b border-gray-100", i % 2 === 0 ? "bg-white" : "bg-gray-50/30")}>
                                                <td className="py-2.5 px-3 text-base font-bold text-gray-800 border-r border-gray-50">{client}</td>
                                                {products.map(p => (
                                                    <td key={p} className="py-2.5 px-3 text-right text-sm text-gray-600 font-medium tabular-nums">
                                                        {pivotData[client]?.[p] ? formatValue(pivotData[client][p], pdfMetric) : "-"}
                                                    </td>
                                                ))}
                                                <td className="py-2.5 px-3 text-right text-base font-black text-black tabular-nums bg-gray-50/50">
                                                    {formatValue(pivotTotals.clients[client] || 0, pdfMetric)}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="text-white font-black" style={{ backgroundColor: primaryColor }}>
                                            <td className="p-4 text-base uppercase tracking-wider">Total Général</td>
                                            {products.map(p => (
                                                <td key={p} className="p-4 text-right text-base tabular-nums">
                                                    {formatValue(pivotTotals.products[p] || 0, pdfMetric)}
                                                </td>
                                            ))}
                                            <td className="p-4 text-right text-2xl tabular-nums bg-black/10">
                                                {formatValue(pivotTotals.grandTotal, pdfMetric)}
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
                                                            Sordi • Rapport de Synthèse
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
            </div>
    );
};

