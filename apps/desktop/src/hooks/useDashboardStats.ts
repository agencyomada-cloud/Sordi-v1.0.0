import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { db } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";


export function useDashboardStats(
  year?: number,
  months?: string[] // list of month numbers "1"-"12"
) {
  const { activeCompanyId, isReady } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard-stats", activeCompanyId, year, months],
    queryFn: async () => {
      const targetYear = year || new Date().getFullYear();

      // Call backend aggregation
      // We pass months array as strings if present
      const stats = await db.dashboard.getStats(activeCompanyId, targetYear, months);

      // Map snake_case from Rust to camelCase for frontend components
      return {
        currentMonth: stats.current_month,
        yearly: stats.yearly,
        payments: {
          paid: stats.payments.paid,
          unpaid: stats.payments.unpaid,
          initialDebt: stats.payments.initial_debt,
          totalReceivables: stats.payments.total_receivables,
        },
        monthlyData: stats.monthly_data,
        dailyData: stats.daily_data,
        productStats: stats.product_stats,
        salesCumulatives: {
          totalHt: stats.sales_cumulatives.total_ht,
          totalTtc: stats.sales_cumulatives.total_ttc,
          totalTva: stats.sales_cumulatives.total_tva,
          totalTimbre: stats.sales_cumulatives.total_timbre,
        },
        growth: stats.growth,
        invoiceCount: stats.invoice_count,
        isMonthView: stats.is_month_view,
        // True operating profitability (HT basis) — distinct from `yearly`
        // above, which stays cash-basis/TTC.
        revenueHt: stats.revenue_ht,
        expenseCount: stats.expense_count,
        netProfitHt: stats.net_profit_ht,
        marginPercentageHt: stats.margin_percentage_ht,
        outstandingReceivables: stats.outstanding_receivables,
      };
    },
    enabled: isReady,
    placeholderData: keepPreviousData,
  });
}
