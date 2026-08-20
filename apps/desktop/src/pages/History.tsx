import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "../lib/database";
import { format, getMonth, getYear, parseISO, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import {
    RiHistoryLine as HistoryIcon,
    RiLoader4Line as Loader2,
    RiRefreshLine as RefreshCw,
    RiFilter3Line as Filter,
    RiCloseLine as X,
    RiDownloadLine as Download,
    RiDeleteBinLine as Trash2,
} from "@remixicon/react";
import { getActionColor, getActionLabel, getEntityConfig } from "@/lib/activityLog";
import { toast } from "sonner";
import { exportToCSV } from "../lib/csvUtils";
import {
    Button,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Badge,
    MultiSelect,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@sordi/ui";

import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";

export default function History() {
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
        <div className="flex min-h-screen bg-background font-outfit">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Header />
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

                    {/* Table */}
                    <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[200px]">Date & Heure</TableHead>
                                    <TableHead className="w-[150px]">Action</TableHead>
                                    <TableHead className="w-[180px]">Entité</TableHead>
                                    <TableHead>Description</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Chargement...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLogs && filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => (
                                        <TableRow key={log.id} className="hover:bg-muted/50 transition-colors group">
                                            <TableCell>
                                                <div className="font-medium text-foreground">{format(new Date(log.created_at), "dd MMM yyyy", { locale: fr })}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{format(new Date(log.created_at), "HH:mm", { locale: fr })}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`rounded-full px-3 py-0.5 border-0 font-medium ${getActionColor(log.action)}`}>
                                                    {getActionLabel(log.action)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {(() => {
                                                    const config = getEntityConfig(log.entity_type);
                                                    return (
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-xl transition-colors ${config.color}`}>
                                                                {config.icon}
                                                            </div>
                                                            <span className="text-sm font-medium">{config.label}</span>
                                                        </div>
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-foreground/80 font-medium">
                                                {log.description}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <HistoryIcon className="w-8 h-8 opacity-20" />
                                                <p>Aucune activité trouvée pour cette période</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        {/* Load More - optional, slightly simplistic with client-side filtering but useful if we hit limit */}
                        {logs && logs.length >= limit && (
                            <div className="p-4 border-t border-border/50 flex justify-center bg-muted/20">
                                <Button variant="outline" onClick={() => setLimit(l => l + 500)} className="bg-background">
                                    Charger plus d'activités
                                </Button>
                            </div>
                        )}
                    </div>
                </main>
            </div>

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
        </div>
    );
}
