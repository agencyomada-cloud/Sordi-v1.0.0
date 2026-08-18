import { useState, useMemo } from "react";
import { TrendingUp, Award, Target, Zap, ChevronRight, User, Plus, Trash2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useEmployees } from "@/hooks/useEmployees";
import { useProjects } from "@/hooks/useProjects";
import { useScores } from "@/hooks/useScores";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const months = [
    { label: "Janvier", value: "01" },
    { label: "Février", value: "02" },
    { label: "Mars", value: "03" },
    { label: "Avril", value: "04" },
    { label: "Mai", value: "05" },
    { label: "Juin", value: "06" },
    { label: "Juillet", value: "07" },
    { label: "Août", value: "08" },
    { label: "Septembre", value: "09" },
    { label: "Octobre", value: "10" },
    { label: "Novembre", value: "11" },
    { label: "Décembre", value: "12" },
];

const years = ["2024", "2025", "2026"];

const ScoreSection = () => {
    const currentMonth = new Date().getMonth() + 1;
    const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString().padStart(2, "0"));
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

    const { data: employees } = useEmployees();
    const { data: projects } = useProjects();
    const { data: scores, upsertScore, deleteScore } = useScores(selectedMonth, selectedYear);

    // Filter and aggregate scores for ranking
    const employeeRankings = useMemo(() => {
        if (!employees || !scores) return [];

        const rankingMap = new Map();

        employees.forEach(emp => {
            rankingMap.set(emp.id, {
                ...emp,
                totalScore: 0,
                count: 0
            });
        });

        scores.forEach(score => {
            if (rankingMap.has(score.employee_id)) {
                const data = rankingMap.get(score.employee_id);
                data.totalScore += score.score;
                data.count += 1;
            }
        });

        return Array.from(rankingMap.values())
            .sort((a, b) => b.totalScore - a.totalScore);
    }, [employees, scores]);

    const selectedEmployee = useMemo(() =>
        employees?.find(e => e.id === selectedEmployeeId),
        [employees, selectedEmployeeId]
    );

    // Scoring table management
    const [newFeatureName, setNewFeatureName] = useState("");

    const handleAddScore = (feature: string, score: number) => {
        if (!selectedEmployeeId) return;

        upsertScore.mutate({
            employee_id: selectedEmployeeId,
            project_id: null,
            month: selectedMonth,
            year: selectedYear,
            feature: feature,
            score: score,
        });
    };

    const handleFeatureInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && newFeatureName.trim()) {
            // Check if user typed "Feature @Score"
            const parts = newFeatureName.split("@");
            let name = parts[0].trim();
            let score = 0;

            if (parts.length > 1) {
                const parsedScore = parseFloat(parts[1].trim());
                if (!isNaN(parsedScore)) {
                    score = parsedScore;
                }
            }

            handleAddScore(name, score);
            setNewFeatureName("");
        }
    };

    const employeeScores = useMemo(() => {
        if (!selectedEmployeeId || !scores) return [];
        return scores.filter(s => s.employee_id === selectedEmployeeId);
    }, [selectedEmployeeId, scores]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-3xl border border-border/50 shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Période :</span>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-36 rounded-xl border-border/50">
                            <SelectValue placeholder="Mois" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {months.map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-28 rounded-xl border-border/50">
                            <SelectValue placeholder="Année" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {years.map(y => (
                                <SelectItem key={y} value={y}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Ranking List */}
                <Card className="lg:col-span-1 border-border/50 rounded-3xl overflow-hidden shadow-card">
                    <CardHeader className="bg-secondary/10 border-b border-border/10">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Award className="w-5 h-5 text-primary" />
                            Classement
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border/10">
                            {employeeRankings.map((emp, index) => (
                                <button
                                    key={emp.id}
                                    onClick={() => setSelectedEmployeeId(emp.id)}
                                    className={cn(
                                        "w-full p-4 flex items-center gap-4 hover:bg-secondary/30 transition-all text-left group",
                                        selectedEmployeeId === emp.id ? "bg-primary/5 border-l-4 border-primary" : "border-l-4 border-transparent"
                                    )}
                                >
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                        #{index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-foreground truncate">{emp.name}</p>
                                        <p className="text-xs text-muted-foreground">{emp.role || "Employé"}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-primary">{emp.totalScore} pts</p>
                                    </div>
                                    <ChevronRight className={cn(
                                        "w-4 h-4 text-muted-foreground transition-transform duration-300",
                                        selectedEmployeeId === emp.id ? "translate-x-1 text-primary" : ""
                                    )} />
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Scoring Dashboard */}
                <div className="lg:col-span-2 space-y-6">
                    {!selectedEmployeeId ? (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 bg-secondary/10 rounded-3xl border border-dashed border-border/50 text-center">
                            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-4 shadow-sm">
                                <User className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground">Sélectionnez un employé</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                                Choisissez un employé dans la liste pour consulter ses performances ou lui attribuer des points.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            {/* Employee Header */}
                            <div className="flex items-center justify-between p-6 bg-card rounded-3xl border border-border/50 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                                        {selectedEmployee?.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground">{selectedEmployee?.name}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className="rounded-lg">{selectedEmployee?.role || "Employé"}</Badge>
                                            <span className="text-sm text-muted-foreground">{selectedMonth}/{selectedYear}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Score Total</p>
                                    <p className="text-4xl font-black text-primary">
                                        {employeeRankings.find(r => r.id === selectedEmployeeId)?.totalScore || 0}
                                        <span className="text-lg font-bold ml-1">pts</span>
                                    </p>
                                </div>
                            </div>

                            {/* Scoring Input */}
                            <Card className="border-border/50 rounded-3xl shadow-sm overflow-hidden">
                                <CardHeader className="p-4 border-b border-border/10 bg-secondary/5">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Target className="w-4 h-4 text-primary" />
                                        Ajouter une évaluation
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex-1 min-w-[200px]">
                                            <Input
                                                placeholder="Saisissez un KPI (ex: 'Timing @10')"
                                                value={newFeatureName}
                                                onChange={(e) => setNewFeatureName(e.target.value)}
                                                onKeyDown={handleFeatureInput}
                                                className="rounded-xl border-border/50 h-11"
                                            />
                                            <p className="text-[10px] text-muted-foreground mt-1.5 ml-1 italic">
                                                Astuce: Utilisez <b>@</b> pour ajouter le score directement (ex: Timing @20)
                                            </p>
                                        </div>
                                        <Button
                                            onClick={() => handleFeatureInput({ key: "Enter" } as any)}
                                            className="h-11 px-6 rounded-xl gap-2"
                                            disabled={!newFeatureName.trim()}
                                        >
                                            <Plus className="w-4 h-4" />
                                            Ajouter
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Detailed Scores Table */}
                            <Card className="border-border/50 rounded-3xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-secondary/10">
                                            <TableRow className="border-border/10 hover:bg-transparent">
                                                <TableHead className="font-bold">KPI / Feature</TableHead>
                                                <TableHead className="font-bold text-center w-32">Score</TableHead>
                                                <TableHead className="font-bold text-right w-20"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {employeeScores.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                                                        Aucune note enregistrée pour cette période.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                employeeScores.map((score) => (
                                                    <TableRow key={score.id} className="border-border/10 group hover:bg-secondary/5">
                                                        <TableCell className="font-medium">{score.feature}</TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <Input
                                                                    type="number"
                                                                    value={score.score}
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value);
                                                                        if (!isNaN(val)) {
                                                                            handleAddScore(score.feature, val);
                                                                        }
                                                                    }}
                                                                    className="w-20 h-8 text-center rounded-lg border-transparent group-hover:border-border/50 bg-transparent group-hover:bg-card focus:border-primary transition-all font-bold text-primary"
                                                                />
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold">pts</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => deleteScore.mutate(score.id)}
                                                                className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScoreSection;
