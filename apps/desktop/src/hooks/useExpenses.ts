import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { expenseSchema } from "@/lib/validations";
import { mapErrorToUserMessage, isValidationError } from "@/lib/errorMapper";
import { logError } from "@/lib/errorLogger";
import { db, type Expense, type CreateExpenseData } from "@/lib/database";

export const EXPENSE_CATEGORIES = [
  "Carburant",
  "Maintenance",
  "Salaires",
  "Électricité",
  "Eau",
  "Location",
  "Pièces détachées",
  "Transport",
  "Assurance",
  "Impôts & Taxes",
  "Fournitures",
  "Autre"
];

export function useExpenses(monthPeriod?: string) {
  return useQuery({
    queryKey: ["expenses", monthPeriod],
    queryFn: async () => {
      return await db.expenses.getAll(monthPeriod);
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expense: CreateExpenseData) => {
      // Validate input
      // zod 3.25's inferred output type widens every field to optional here despite
      // the schema requiring category/amount/expense_date — a type-level quirk, not
      // a runtime one: .parse() throws if they're actually missing.
      const validated = expenseSchema.parse(expense) as CreateExpenseData;
      return await db.expenses.create(validated);
    },
    onSuccess: (expense) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "CREATE",
        entity_type: "EXPENSE",
        entity_id: expense?.id || null,
        description: `Charge de ${expense?.amount || ""} DA ajoutée (${expense?.category || ""})`,
      });

      toast.success("Charge ajoutée avec succès");
    },
    onError: (error: unknown) => {
      if (isValidationError(error)) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        toast.error(mapErrorToUserMessage(error));
      }
      logError("Expense creation error", error);
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await db.expenses.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "DELETE",
        entity_type: "EXPENSE",
        entity_id: id,
        description: `Charge supprimée`,
      });

      toast.success("Charge supprimée avec succès");
    },
    onError: (error: unknown) => {
      toast.error(mapErrorToUserMessage(error));
      logError("Expense deletion error", error);
    },
  });
}

export function useExpenseStats(monthPeriod?: string) {
  return useQuery({
    queryKey: ["expense-stats", monthPeriod],
    queryFn: async () => {
      const data = await db.expenses.getAll(monthPeriod);
      
      const total = data.reduce((sum, e) => sum + Number(e.amount), 0);
      const byCategory = data.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
        return acc;
      }, {} as Record<string, number>);
      
      return { total, byCategory, count: data.length };
    },
  });
}
