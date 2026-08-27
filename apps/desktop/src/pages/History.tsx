import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { db } from "../lib/database";
import { format, formatDistanceToNow, getMonth, parseISO, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import {
    RiRefreshLine as RefreshCw,
    RiFilter3Line as Filter,
    RiCloseLine as X,
    RiDownloadLine as Download,
    RiDeleteBinLine as Trash2,
} from "@remixicon/react";
import { getActionColor, getActionLabel, getEntityConfig, getEntityRoute } from "@/lib/activityLog";
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
    Skeleton,
    EmptyState,
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

    // Client-side filtering for Months
    const filteredLogs = logs?.filter(log => {
        if (selectedMonths.length === 0) return true;
        const logDate = parseISO(log.created_at);
        const month = (getMonth(logDate) + 1).toString();
        return selectedMonths.includes(month);
    });

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
                <main className="flex-1 p-8 pt-4 space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-foreground tracking-tight">Historique</h1>
                            <p className="text-muted-foreground mt-1">Suivez toutes les activités et changements</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleExport} className="h-9 gap-2">
                                <Download className="w-4 h-4" />
                                Exporter
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsClearDialogOpen(true)}
                                disabled={!logs || logs.length === 0}
                                className="h-9 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                            >
                                <Trash2 className="w-4 h-4" />
                                Effacer l'historique
                            </Button>
                            <Button size="sm" onClick={() => { refetch(); toast.success("Historique actualisé"); }} className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm border-0 font-medium">
                                <RefreshCw className="w-4 h-4" />
                                Actualiser
                            </Button>
                        </div>
                    </div>

                    {/* Filters Bar */}
                    <div className="flex flex-wrap gap-4 items-center bg-card p-4 rounded-3xl border border-border/30 shadow-sm relative z-30">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
                            <Filter className="w-4 h-4" />
                            <span className="font-medium">Filtres:</span>
                        </div>

                        <Select value={entityType} onValueChange={setEntityType}>
                            <SelectTrigger className="w-[200px]">
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
                            <SelectTrigger className="w-[200px]">
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

                        <div className="h-8 w-px bg-border mx-2 hidden md:block"></div>

                        {/* Date Filters matching Dashboard */}
                        <MultiSelect
                            key={selectedYear}
                            options={monthOptions}
                            selected={selectedMonths}
                            onChange={setSelectedMonths}
                            placeholder="Filtrer par mois..."
                            className="w-64"
                        />

                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {yearOptions.map(year => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-11 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <X className="w-4 h-4 mr-2" />
                                Effacer
                            </Button>
                        )}
                    </div>

                    {/* Interactive timeline / feed — same avatar-chip, entity-chip,
                        and relative-date pattern as the Dashboard's Activité
                        Récente card, instead of a flat raw database table. Days
                        are grouped with a sticky date header so a long history
                        still reads as a scannable feed rather than a log dump. */}
                    <div className="bg-card/60 backdrop-blur-sm rounded-3xl border border-border/40 p-2">
                        {isLoading ? (
                            <div className="px-4 py-2">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="flex items-start gap-3 p-2">
                                        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                                        <div className="min-w-0 flex-1 pt-1 space-y-1.5">
                                            <Skeleton className="h-4 w-2/3" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredLogs && filteredLogs.length > 0 ? (
                            (() => {
                                // Group consecutive entries by calendar day for the
                                // sticky day headers, preserving the existing sort order.
                                const groups: { day: string; logs: typeof filteredLogs }[] = [];
                                for (const log of filteredLogs) {
                                    const day = format(new Date(log.created_at), "yyyy-MM-dd");
                                    const last = groups[groups.length - 1];
                                    if (last && last.day === day) last.logs.push(log);
                                    else groups.push({ day, logs: [log] });
                                }
                                return groups.map((group) => (
                                    <div key={group.day} className="mb-2 last:mb-0">
                                        <div className="sticky top-0 z-10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-card/95 backdrop-blur-sm rounded-xl">
                                            {format(parseISO(group.day), "EEEE d MMMM yyyy", { locale: fr })}
                                        </div>
                                        <ol className="relative px-4">
                                            {group.logs.map((log, i) => {
                                                const entityConfig = getEntityConfig(log.entity_type);
                                                const isLast = i === group.logs.length - 1;
                                                return (
                                                    <li key={log.id} className="relative pb-4 last:pb-2">
                                                        {!isLast && <span className="absolute left-4 top-9 bottom-0 w-px bg-border/60" />}
                                                        <button
                                                            onClick={() => navigate(getEntityRoute(log.entity_type, log.entity_id))}
                                                            className="w-full flex items-start gap-3 text-left group/item p-2 rounded-xl hover:bg-muted/40 transition-colors"
                                                        >
                                                            <span className="relative shrink-0 z-10">
                                                                <span className={cn("flex items-center justify-center w-8 h-8 rounded-full ring-4 ring-card", entityConfig.color)}>{entityConfig.icon}</span>
                                                                <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-card", ACTION_DOT_COLORS[log.action] || "bg-muted-foreground")} />
                                                            </span>
                                                            <span className="min-w-0 flex-1 pt-1">
                                                                <span className="text-sm text-foreground leading-snug group-hover/item:text-primary transition-colors">{log.description}</span>
                                                                <span className="flex items-center gap-1.5 mt-1">
                                                                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", getActionColor(log.action))}>{getActionLabel(log.action)}</span>
                                                                    <span className="text-[10px] text-muted-foreground/70 font-mono tabular-nums">
                                                                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                                                                    </span>
                                                                </span>
                                                            </span>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ol>
                                    </div>
                                ));
                            })()
                        ) : (
                            <EmptyState type="history" title="Aucune activité" description="Aucune activité enregistrée sur cette période" />
                        )}
                        {/* Load More - optional, slightly simplistic with client-side filtering but useful if we hit limit */}
                        {logs && logs.length >= limit && (
                            <div className="p-4 flex justify-center">
                                <Button variant="outline" onClick={() => setLimit(l => l + 500)} className="bg-background">
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
