import { toast } from "sonner";
import React, { useMemo, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useQuery } from "@tanstack/react-query";
import { db, ClientCumulativeRecord } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SearchInput, Skeleton, EmptyState, TableLoading } from "@sordi/ui";
import {
    RiTableLine as TableIcon,
    RiArrowUpSLine,
    RiArrowDownSLine,
    RiExpandUpDownLine,
} from "@remixicon/react";
import { generateCumulativesPDF } from "@/lib/pdfGenerator";
import { cn } from "@/lib/utils";
import { ExportActionMenu } from "@/components/ui/export-action-menu";

interface ClientCumulativeTableProps {
    year: number;
    months: string[];
}

type SortKey = keyof Pick<ClientCumulativeRecord, "client_name" | "invoice_count" | "total_quantity" | "total_ht" | "total_tva" | "total_timbre" | "total_ttc">;

export const ClientCumulativeTable: React.FC<ClientCumulativeTableProps> = ({
    year,
    months,
}) => {
    const { data: settings } = useSettings();
    const { activeCompanyId, isReady } = useWorkspace();
    const [searchQuery, setSearchQuery] = useState("");
    const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "total_ttc", direction: "desc" });
    const { data, isLoading } = useQuery({
        queryKey: ["client-cumulatives", activeCompanyId, year, months],
        queryFn: () => db.dashboard.getClientCumulatives(activeCompanyId, year, months),
        enabled: isReady,
    });

    const formatCurrency = (amount: number) => {
        if (!amount && amount !== 0) return "0 DA";
        return new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount) + " DA";
    };

    const toggleSort = (key: SortKey) => {
        setSort((prev) => prev.key === key
            ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
            : { key, direction: "desc" });
    };

    const rows = useMemo(() => {
        const list = data ?? [];
        const q = searchQuery.trim().toLowerCase();
        const filtered = q ? list.filter(r => r.client_name.toLowerCase().includes(q)) : list;

        return [...filtered].sort((a, b) => {
            const av = a[sort.key];
            const bv = b[sort.key];
            const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
            return sort.direction === "asc" ? cmp : -cmp;
        });
    }, [data, searchQuery, sort]);

    const totals = useMemo(() => rows.reduce((acc, curr) => ({
        ht: acc.ht + curr.total_ht,
        tva: acc.tva + curr.total_tva,
        timbre: acc.timbre + curr.total_timbre,
        ttc: acc.ttc + curr.total_ttc,
        quantity: acc.quantity + curr.total_quantity,
        invoices: acc.invoices + curr.invoice_count
    }), { ht: 0, tva: 0, timbre: 0, ttc: 0, quantity: 0, invoices: 0 }), [rows]);

    const exportToCSV = () => {
        if (!data) return;
        const headers = ["Client", "Factures", "Total Quantité", "Total HT", "Total TVA", "Total Timbre", "Total TTC"];
        const csvRows = rows.map(r => [
            r.client_name,
            r.invoice_count,
            r.total_quantity,
            r.total_ht,
            r.total_tva,
            r.total_timbre,
            r.total_ttc
        ]);
        csvRows.push(["TOTAL", totals.invoices, totals.quantity, totals.ht, totals.tva, totals.timbre, totals.ttc]);

        const csvContent = [
            headers.join(","),
            ...csvRows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `rapport_cumule_clients_${year}.csv`);
        link.click();
        toast.success("Fichier CSV téléchargé avec succès");
  };

    const [isExportingPDF, setIsExportingPDF] = React.useState(false);

    const exportToPDF = async () => {
        if (!data || !settings) return;
        setIsExportingPDF(true);
        try {
            const periodLabel = months.length > 0 ? `${months.join(", ")} ${year}` : `${year}`;
            const totalsForPDF = { total_ht: totals.ht, total_tva: totals.tva, total_timbre: totals.timbre, total_ttc: totals.ttc };
            await generateCumulativesPDF(data, totalsForPDF, periodLabel, settings);
      toast.success("PDF généré et téléchargé avec succès");
        } catch (error) {
            console.error("Erreur PDF:", error);
        } finally {
            setIsExportingPDF(false);
        }
    };

    const SortHeader = ({ label, sortKey, align = "left" }: { label: string; sortKey: SortKey; align?: "left" | "center" | "right" }) => (
        <TableHead
            numeric={align === "right"}
            className={cn(
                "cursor-pointer select-none hover:text-foreground transition-colors text-[11px] font-semibold text-muted-foreground uppercase px-3",
                align === "center" && "text-center"
            )}
            onClick={() => toggleSort(sortKey)}
        >
            <span className={cn(
                "inline-flex items-center gap-1",
                align === "right" && "flex-row-reverse",
                align === "center" && "flex-row-reverse"
            )}>
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
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-40" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-7 w-16 rounded-md" />
                            <Skeleton className="h-7 w-16 rounded-md" />
                        </div>
                    </div>
                    <Skeleton className="h-8 w-full sm:w-72 rounded-md" />
                </div>
                <Table className="w-full text-sm">
                    <TableHeader>
                        <TableRow>
                            {Array.from({ length: 7 }).map((_, i) => (
                                <TableHead key={i}><Skeleton className="h-3 w-16" /></TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableLoading columns={7} rows={6} numericColumns={[1, 2, 3, 4, 5, 6]} />
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
                            Rapport Global Clients
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Cumuls HT, TVA, Timbre et TTC</p>
                    </div>
                    <ExportActionMenu onExportCSV={exportToCSV} onExportPDF={exportToPDF} isExportingPDF={isExportingPDF} />
                </div>
                <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Rechercher un client..."
                    className="h-[30px] text-xs bg-background border-border/80 rounded-md"
                    containerClassName="w-full sm:w-72"
                />
            </div>

            <div className="overflow-x-auto">
                    <Table className="w-full text-sm">
                        <TableHeader className="sticky top-0 z-10 bg-muted/40">
                            <TableRow className="h-8 bg-muted/40 hover:bg-muted/40">
                                <SortHeader label="Client" sortKey="client_name" />
                                <SortHeader label="Factures" sortKey="invoice_count" align="center" />
                                <SortHeader label="Qté Totale" sortKey="total_quantity" align="center" />
                                <SortHeader label="Total HT" sortKey="total_ht" align="right" />
                                <SortHeader label="Total TVA" sortKey="total_tva" align="right" />
                                <SortHeader label="Timbre" sortKey="total_timbre" align="right" />
                                <TableHead numeric className="text-primary text-[11px] font-semibold uppercase px-3">
                                    <span
                                        className="inline-flex items-center gap-1 flex-row-reverse cursor-pointer select-none"
                                        onClick={() => toggleSort("total_ttc")}
                                    >
                                        Total TTC
                                        {sort.key === "total_ttc" ? (
                                            sort.direction === "asc" ? <RiArrowUpSLine className="w-3.5 h-3.5" /> : <RiArrowDownSLine className="w-3.5 h-3.5" />
                                        ) : (
                                            <RiExpandUpDownLine className="w-3.5 h-3.5 opacity-30" />
                                        )}
                                    </span>
                                </TableHead>
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
                                rows.map((record) => (
                                    <TableRow key={record.client_name} className="h-8 text-xs border-b border-border/30 hover:bg-muted/20 transition-colors">
                                        <TableCell className="font-medium px-3">{record.client_name}</TableCell>
                                        <TableCell className="text-center text-muted-foreground font-mono tabular-nums font-medium px-3">{record.invoice_count}</TableCell>
                                        <TableCell className="text-center font-mono tabular-nums font-medium px-3">{new Intl.NumberFormat("fr-DZ").format(record.total_quantity)}</TableCell>
                                        <TableCell numeric className="font-medium px-3">{formatCurrency(record.total_ht)}</TableCell>
                                        <TableCell numeric className="font-medium px-3">{formatCurrency(record.total_tva)}</TableCell>
                                        <TableCell numeric className="font-medium text-muted-foreground px-3">{formatCurrency(record.total_timbre)}</TableCell>
                                        <TableCell numeric className="font-semibold text-primary px-3">{formatCurrency(record.total_ttc)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        {rows.length > 0 && (
                            <tfoot>
                                <TableRow className="h-9 bg-muted/30 border-t border-border/60 font-semibold text-xs font-mono tabular-nums hover:bg-muted/30">
                                    <TableCell className="uppercase tracking-wide text-xs text-primary font-sans px-3">
                                        Total {searchQuery ? "(filtré)" : "Général"}
                                    </TableCell>
                                    <TableCell className="text-center text-primary font-mono tabular-nums px-3">{totals.invoices}</TableCell>
                                    <TableCell className="text-center text-primary font-mono tabular-nums px-3">{new Intl.NumberFormat("fr-DZ").format(totals.quantity)}</TableCell>
                                    <TableCell numeric className="text-primary px-3">{formatCurrency(totals.ht)}</TableCell>
                                    <TableCell numeric className="text-primary px-3">{formatCurrency(totals.tva)}</TableCell>
                                    <TableCell numeric className="text-primary px-3">{formatCurrency(totals.timbre)}</TableCell>
                                    <TableCell numeric className="text-primary text-sm px-3">{formatCurrency(totals.ttc)}</TableCell>
                                </TableRow>
                            </tfoot>
                        )}
                    </Table>
                </div>
            </div>
    );
};
