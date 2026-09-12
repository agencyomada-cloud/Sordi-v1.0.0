import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { db } from "../lib/database";
import { format, getMonth, parseISO, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import {
    RiRefreshLine as RefreshCw,
    RiCloseLine as X,
    RiDownloadLine as Download,
    RiDeleteBinLine as Trash2,
} from "@remixicon/react";
import { getActionLabel, getEntityConfig, getEntityRoute } from "@/lib/activityLog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { exportToCSV } from "../lib/csvUtils";
import {
    Button,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    MultiSelect,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    EmptyState,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    TableLoading,
} from "@sordi/ui";

// Same solid-dot palette as the Dashboard's Activité Récente timeline —
// getActionColor's low-opacity chip classes read as near-invisible at dot size.
const ACTION_DOT_COLORS: Record<string, string> = {
    CREATE: "bg-emerald-500",
    UPDATE: "bg-primary",
    DELETE: "bg-destructive",
    CONVERT: "bg-purple-500",
};

export default function History() {
    const navigate = useNavigate();
    const [limit, setLimit] = useState(500); // Increased limit as we do client-side filtering
    const [entityType, setEntityType] = useState<string>("all");
    const [action, setAction] = useState<string>("all");
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    // Date Filters matching Dashboard
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear.toString());
    const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

    const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
    const monthOptions = [
        { value: "1", label: "Janvier" },
        { value: "2", label: "Février" },
        { value: "3", label: "Mars" },
        { value: "4", label: "Avril" },
        { value: "5", label: "Mai" },
        { value: "6", label: "Juin" },
        { value: "7", label: "Juillet" },
        { value: "8", label: "Août" },
        { value: "9", label: "Septembre" },
        { value: "10", label: "Octobre" },
        { value: "11", label: "Novembre" },
        { value: "12", label: "Décembre" },
    ];

    // Backend fetching - Fetch by YEAR to minimize data over wire, but allow client filtering
    const startDate = startOfYear(new Date(parseInt(selectedYear), 0, 1)).toISOString();
    const endDate = endOfYear(new Date(parseInt(selectedYear), 0, 1)).toISOString();

    const { data: logs, isLoading, refetch } = useQuery({
        queryKey: ["activity_logs", limit, entityType, action, selectedYear],
        queryFn: () => db.history.getLogs(
            limit,
            entityType === "all" ? undefined : entityType,
            action === "all" ? undefined : action,
            startDate,
            endDate
        ),
    });

    // Client-side filtering for Months — memoized so it doesn't re-scan
    // the fetched log list on every unrelated re-render.
    const filteredLogs = useMemo(() => logs?.filter(log => {
        if (selectedMonths.length === 0) return true;
        const logDate = parseISO(log.created_at);
        const month = (getMonth(logDate) + 1).toString();
        return selectedMonths.includes(month);
    }), [logs, selectedMonths]);

    const clearFilters = () => {
        setEntityType("all");
        setAction("all");
        setSelectedMonths([]);
        setSelectedYear(currentYear.toString());
    };

    const hasActiveFilters = entityType !== "all" || action !== "all" || selectedMonths.length > 0 || selectedYear !== currentYear.toString();

    const handleExport = () => {
        if (!filteredLogs || filteredLogs.length === 0) {
            toast.error("Aucune donnée à exporter");
            return;
        }

        const dataToExport = filteredLogs.map(log => ({
            date: format(parseISO(log.created_at), "dd/MM/yyyy HH:mm"),
            entity: getEntityConfig(log.entity_type).label,
            action: getActionLabel(log.action),
            details: log.description,
        }));

        const columns = [
            { key: "date" as const, label: "Date" },
            { key: "entity" as const, label: "Entité" },
            { key: "action" as const, label: "Action" },
            { key: "details" as const, label: "Détails" },
        ];

        exportToCSV(dataToExport, `historique_${format(new Date(), "yyyy-MM-dd")}`, columns);
        toast.success("Fichier CSV téléchargé avec succès");
        toast.success("Historique exporté avec succès");
    };

    const handleClearHistory = async () => {
        setIsClearing(true);
        try {
            await db.history.clear();
            toast.success("Historique effacé avec succès");
            setIsClearDialogOpen(false);
            refetch();
        } catch (error: unknown) {
            // Tauri rejects a Result::Err(String) command with the raw
            // string (e.g. the read-only-license message), not an Error
            // instance — surface it as-is rather than a generic fallback.
            const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
            toast.error(message || "Échec de l'effacement de l'historique");
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <>
                <main className="flex-1 p-6 space-y-5">
                    {/* Header */}
                    <div className="flex flex-col items-start xl:flex-row xl:items-center justify-between gap-3">
                        <div>
                            <h1 className="text-lg font-semibold text-foreground tracking-tight">Historique</h1>
                            <p className="text-xs text-muted-foreground mt-0.5">Suivez toutes les activités et changements</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" onClick={handleExport} className="h-[30px] gap-1.5 text-xs rounded-md">
                                <Download className="w-3.5 h-3.5" />
                                Exporter
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsClearDialogOpen(true)}
                                disabled={!logs || logs.length === 0}
                                className="h-[30px] gap-1.5 text-xs rounded-md text-muted-foreground hover:text-destructive"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Effacer l'historique
                            </Button>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => { refetch(); toast.success("Historique actualisé"); }}
                                        className="h-[30px] w-[30px] rounded-md"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Actualiser</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Filter bar — a plain row with a bottom hairline, not a
                        floating rounded-3xl card. */}
                    <div className="flex flex-wrap gap-2 items-center pb-3 border-b border-border/70">
                        <Select value={entityType} onValueChange={setEntityType}>
                            <SelectTrigger className="w-[170px] h-[30px] text-xs rounded-md">
                                <SelectValue placeholder="Entité" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes les entités</SelectItem>
                                <SelectItem value="CLIENT">Clients</SelectItem>
                                <SelectItem value="INVOICE">Factures</SelectItem>
                                <SelectItem value="ORDER">Commandes</SelectItem>
                                <SelectItem value="DELIVERY">Livraisons</SelectItem>
                                <SelectItem value="PAYMENT">Paiements</SelectItem>
                                <SelectItem value="EXPENSE">Dépenses</SelectItem>
                                <SelectItem value="PRODUCT">Produits</SelectItem>
                                <SelectItem value="SETTINGS">Paramètres</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={action} onValueChange={setAction}>
                            <SelectTrigger className="w-[150px] h-[30px] text-xs rounded-md">
                                <SelectValue placeholder="Action" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes les actions</SelectItem>
                                <SelectItem value="CREATE">Création</SelectItem>
                                <SelectItem value="UPDATE">Modification</SelectItem>
                                <SelectItem value="DELETE">Suppression</SelectItem>
                                <SelectItem value="CONVERT">Conversion</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="h-4 w-px bg-border mx-1 hidden md:block" aria-hidden="true" />

                        {/* Date Filters matching Dashboard */}
                        <MultiSelect
                            key={selectedYear}
                            options={monthOptions}
                            selected={selectedMonths}
                            onChange={setSelectedMonths}
                            placeholder="Filtrer par mois..."
                            className="w-56 h-[30px] text-xs"
                        />

                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-24 h-[30px] text-xs rounded-md">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {yearOptions.map(year => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-[30px] text-xs rounded-md text-muted-foreground hover:text-destructive">
                                <X className="w-3.5 h-3.5 mr-1" />
                                Effacer
                            </Button>
                        )}
                    </div>

                    {/* Structured desktop audit ledger — a proper table
                        (Date & Heure | Utilisateur | Module | Action |
                        Détails) instead of floating bulleted timeline
                        bubbles. */}
                    <div className="border border-border/80 rounded-md bg-card overflow-hidden w-full">
                        <Table>
                            <TableHeader>
                                <TableRow className="h-8 bg-muted/40 hover:bg-muted/40">
                                    <TableHead className="w-36 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Date &amp; Heure</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Utilisateur</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Module</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Action</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Détails</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableLoading columns={5} rows={8} />
                                ) : filteredLogs && filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => {
                                        const entityConfig = getEntityConfig(log.entity_type);
                                        return (
                                            <TableRow
                                                key={log.id}
                                                className="h-8 text-xs border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                                                onClick={() => navigate(getEntityRoute(log.entity_type, log.entity_id))}
                                            >
                                                <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                    {format(new Date(log.created_at), "dd/MM/yy HH:mm")}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {log.user_id || "—"}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", ACTION_DOT_COLORS[log.action] || "bg-muted-foreground")} />
                                                        {entityConfig.label}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">{getActionLabel(log.action)}</TableCell>
                                                <TableCell className="text-foreground max-w-[420px] truncate" title={log.description}>{log.description}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <EmptyState type="history" title="Aucune activité" description="Aucune activité enregistrée sur cette période" />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        {/* Load More - optional, slightly simplistic with client-side filtering but useful if we hit limit */}
                        {logs && logs.length >= limit && (
                            <div className="p-3 border-t border-border/60 flex justify-center">
                                <Button variant="outline" size="sm" onClick={() => setLimit(l => l + 500)} className="h-[30px] text-xs rounded-md">
                                    Charger plus d'activités
                                </Button>
                            </div>
                        )}
                    </div>
                </main>

            <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Effacer tout l'historique ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action supprimera définitivement les {logs?.length ?? 0} entrée{(logs?.length ?? 0) > 1 ? "s" : ""} d'historique enregistrée{(logs?.length ?? 0) > 1 ? "s" : ""}.
                            Cette action est irréversible et n'affecte pas vos clients, factures ou autres données — uniquement le journal d'activité.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isClearing}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleClearHistory();
                            }}
                            disabled={isClearing}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isClearing ? "Effacement…" : "Effacer définitivement"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
