import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, ChevronRight, Users2, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@sordi/ui";
import { usePartners } from "@/hooks/usePartners";
import { db, type PartnerWithdrawal } from "@/lib/database";
import { cn } from "@/lib/utils";

const BENTO_CARD_CLASS =
  "bg-white/90 border-slate-200/70 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.03)] rounded-2xl transition-all dark:bg-card dark:border-border";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount) + " DA";

export function PartnersGovernanceWidget() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [isMasked, setIsMasked] = useState(false);

  // Fetch partners for current year
  const { data: partners = [] } = usePartners(currentYear);

  // Fetch withdrawals for all partners
  const partnerIds = useMemo(() => partners.map((p) => p.id).join(","), [partners]);
  const { data: withdrawalsMap = {} } = useQuery({
    queryKey: ["partners-widget-withdrawals", partnerIds],
    queryFn: async () => {
      const map: Record<string, PartnerWithdrawal[]> = {};
      await Promise.all(
        partners.map(async (partner) => {
          try {
            const list = await db.partners.getWithdrawals(partner.id);
            map[partner.id] = list || [];
          } catch {
            map[partner.id] = [];
          }
        })
      );
      return map;
    },
    enabled: partners.length > 0,
  });

  // Calculate annual withdrawals per partner
  const partnerAnnualStats = useMemo(() => {
    return partners.map((p) => {
      const pWithdrawals = withdrawalsMap[p.id] || [];
      const thisYearWithdrawn = pWithdrawals
        .filter((w) => w.withdrawal_date?.startsWith(String(currentYear)))
        .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

      const withdrawn = thisYearWithdrawn || p.total_withdrawn || 0;
      return {
        ...p,
        withdrawn,
      };
    });
  }, [partners, withdrawalsMap, currentYear]);

  const totalDraws = useMemo(
    () => partnerAnnualStats.reduce((sum, p) => sum + p.withdrawn, 0),
    [partnerAnnualStats]
  );

  // Helper for initials
  const getInitials = (name: string) => {
    if (!name) return "AS";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const p1 = partnerAnnualStats[0];
  const p2 = partnerAnnualStats[1];
  const share1 = totalDraws > 0 && p1 ? (p1.withdrawn / totalDraws) * 100 : 50;
  const share2 = totalDraws > 0 && p2 ? (p2.withdrawn / totalDraws) * 100 : 50;

  return (
    <Card className={cn("flex flex-col h-full", BENTO_CARD_CLASS)}>
      <CardHeader className="flex flex-row items-center justify-between pb-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            Gouvernance &amp; Retraits ({currentYear})
          </CardTitle>
          {/* Understated total-distributed badge — the ratio bar below
              already communicates balance, so the header just needs the
              headline total. */}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200/60 dark:bg-muted dark:text-muted-foreground dark:border-border shrink-0">
            Total prélevé : {isMasked ? "•••••• DA" : formatCurrency(totalDraws)}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Privacy Toggle */}
          <button
            type="button"
            onClick={() => setIsMasked((prev) => !prev)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isMasked ? "Afficher les montants" : "Masquer les montants (Mode confidentialité)"}
          >
            {isMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          {/* View all link */}
          <button
            type="button"
            onClick={() => navigate("/partners")}
            className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-0.5 font-medium transition-colors"
          >
            <span>Gérer</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col justify-between p-5 pt-0 space-y-4">
        {partners.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center space-y-2.5 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Users2 className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-500">Aucun associé configuré pour l'exercice {currentYear}</p>
            <button
              onClick={() => navigate("/partners")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Configurer les associés</span>
            </button>
          </div>
        ) : (
          <div className="py-2">
            {/* Flat, borderless two-column comparison — data sits directly
                on the parent card's white surface, no nested sub-cards. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {partnerAnnualStats.slice(0, 2).map((partner, idx) => {
                const isFirst = idx === 0;
                return (
                  <div
                    key={partner.id}
                    className={`flex items-center justify-between ${
                      isFirst ? "" : "md:border-l md:border-slate-100 dark:md:border-slate-800 md:pl-8"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 ${
                          isFirst
                            ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                            : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                        }`}
                      >
                        {getInitials(partner.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                          {partner.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {partner.role || (isFirst ? "Associé Gérant" : "Associé")} ·{" "}
                          {Number(partner.equity_percentage ?? 50).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <p className="text-base font-mono font-semibold text-slate-900 dark:text-slate-100 shrink-0 ms-3">
                      {isMasked ? "••••••" : formatCurrency(partner.withdrawn).replace(" DA", "")}{" "}
                      <span className="text-xs font-normal text-slate-400">DA</span>
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Ultra-slim ratio bar — how this year's actual withdrawals
                split between the two partners, distinct from their fixed
                equity share above. */}
            {partnerAnnualStats.length >= 2 && (
              <div className="mt-5 space-y-2">
                <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                  <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${share1}%` }} />
                  <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${share2}%` }} />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                    <span className="truncate">
                      {p1?.name || "Associé 1"} ({share1.toFixed(1)}%)
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">
                      {p2?.name || "Associé 2"} ({share2.toFixed(1)}%)
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
