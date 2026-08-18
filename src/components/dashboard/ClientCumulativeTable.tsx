import { toast } from "sonner";
import React, { useMemo } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useQuery } from "@tanstack/react-query";
import { db, ClientCumulativeRecord } from "@/lib/database";
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
import { Download, FileDown, Table as TableIcon, Loader2 } from "lucide-react";
import { generateCumulativesPDF } from "@/lib/pdfGenerator";
import { cn } from "@/lib/utils";

interface ClientCumulativeTableProps {
    year: number;
    months: string[];
}

export const ClientCumulativeTable: React.FC<ClientCumulativeTableProps> = ({
    year,
    months,
}) => {
    const { data: settings } = useSettings();
    const { data, isLoading } = useQuery({
        queryKey: ["client-cumulatives", year, months],
        queryFn: () => db.dashboard.getClientCumulatives(year, months),
    });

    const formatCurrency = (amount: number) => {
        if (!amount && amount !== 0) return "0 DA";
        return new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount) + " DA";
    };

    const totals = useMemo(() => {
        if (!data) return { ht: 0, tva: 0, timbre: 0, ttc: 0, quantity: 0, invoices: 0 };
        return data.reduce((acc, curr) => ({
            ht: acc.ht + curr.total_ht,
            tva: acc.tva + curr.total_tva,
            timbre: acc.timbre + curr.total_timbre,
            ttc: acc.ttc + curr.total_ttc,
            quantity: acc.quantity + curr.total_quantity,
            invoices: acc.invoices + curr.invoice_count
        }), { ht: 0, tva: 0, timbre: 0, ttc: 0, quantity: 0, invoices: 0 });
    }, [data]);

    const exportToCSV = () => {
        if (!data) return;
        const headers = ["Client", "Factures", "Total Quantité", "Total HT", "Total TVA", "Total Timbre", "Total TTC"];
        const rows = data.map(r => [
            r.client_name,
            r.invoice_count,
            r.total_quantity,
            r.total_ht,
            r.total_tva,
            r.total_timbre,
            r.total_ttc
        ]);
        rows.push(["TOTAL", totals.invoices, totals.quantity, totals.ht, totals.tva, totals.timbre, totals.ttc]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
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
            await generateCumulativesPDF(data, totals, periodLabel, settings);
      toast.success("PDF généré et téléchargé avec succès");
        } catch (error) {
            console.error("Erreur PDF:", error);
        } finally {
            setIsExportingPDF(false);
        }
    };

    if (isLoading) {
        return (
            <Card className="mt-6 border-none shadow-lg">
                <CardContent className="h-64 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Calcul des rapports clients...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mt-6 border-none shadow-elevated bg-card/50 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
            <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <TableIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-bold">Rapport Détaillé par Client</CardTitle>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Cumuls HT, TVA, Timbre et TTC</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={exportToCSV} className="h-9 text-xs gap-2">
                        <FileDown className="w-4 h-4" />
                        Exporter CSV
                    </Button>
                    <Button variant="default" size="sm" onClick={exportToPDF} disabled={isExportingPDF} className="h-9 text-xs gap-2 shadow-none">
                        {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Exporter PDF
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table className="w-full text-[13px]">
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="py-4 px-6 font-bold">Client</TableHead>
                                <TableHead className="py-4 px-6 font-bold text-center">Factures</TableHead>
                                <TableHead className="py-4 px-6 font-bold text-center">Qté Totale</TableHead>
                                <TableHead className="py-4 px-6 font-bold text-right">Total HT</TableHead>
                                <TableHead className="py-4 px-6 font-bold text-right">Total TVA</TableHead>
                                <TableHead className="py-4 px-6 font-bold text-right text-orange-600">Timbre</TableHead>
                                <TableHead className="py-4 px-6 font-bold text-right text-primary">Total TTC</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data?.map((record, idx) => (
                                <TableRow key={record.client_name} className={cn(idx % 2 === 0 ? "bg-transparent" : "bg-muted/5", "hover:bg-primary/5 transition-colors")}>
                                    <TableCell className="py-3 px-6 font-semibold">{record.client_name}</TableCell>
                                    <TableCell className="py-3 px-6 text-center text-muted-foreground">{record.invoice_count}</TableCell>
                                    <TableCell className="py-3 px-6 text-center tabular-nums font-medium">{new Intl.NumberFormat("fr-DZ").format(record.total_quantity)}</TableCell>
                                    <TableCell className="py-3 px-6 text-right tabular-nums">{formatCurrency(record.total_ht)}</TableCell>
                                    <TableCell className="py-3 px-6 text-right tabular-nums">{formatCurrency(record.total_tva)}</TableCell>
                                    <TableCell className="py-3 px-6 text-right tabular-nums font-medium text-orange-600/80">{formatCurrency(record.total_timbre)}</TableCell>
                                    <TableCell className="py-3 px-6 text-right tabular-nums font-bold text-primary/80">{formatCurrency(record.total_ttc)}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-primary/5 font-bold border-t-2 border-primary/20">
                                <TableCell className="py-4 px-6 uppercase text-primary">TOTAL GÉNÉRAL</TableCell>
                                <TableCell className="py-4 px-6 text-center text-primary">{totals.invoices}</TableCell>
                                <TableCell className="py-4 px-6 text-center text-primary font-bold">{new Intl.NumberFormat("fr-DZ").format(totals.quantity)}</TableCell>
                                <TableCell className="py-3 px-6 text-right tabular-nums text-primary">{formatCurrency(totals.ht)}</TableCell>
                                <TableCell className="py-3 px-6 text-right tabular-nums text-primary">{formatCurrency(totals.tva)}</TableCell>
                                <TableCell className="py-3 px-6 text-right tabular-nums text-orange-600">{formatCurrency(totals.timbre)}</TableCell>
                                <TableCell className="py-3 px-6 text-right tabular-nums text-primary text-base font-black">{formatCurrency(totals.ttc)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};
