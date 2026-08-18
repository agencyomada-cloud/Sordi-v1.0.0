import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (expense: CreateExpenseData) => {
      // Validate input
      const validated = expenseSchema.parse(expense);
      return await db.expenses.create(validated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({ title: "Charge ajoutée avec succès" });
    },
    onError: (error: unknown) => {
      if (isValidationError(error)) {
        toast({ title: "Erreur de validation", description: error.issues[0]?.message, variant: "destructive" });
      } else {
        toast({ title: "Erreur", description: mapErrorToUserMessage(error), variant: "destructive" });
      }
      logError("Expense creation error", error);
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await db.expenses.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({ title: "Charge supprimée" });
    },
    onError: (error: unknown) => {
      toast({ title: "Erreur", description: mapErrorToUserMessage(error), variant: "destructive" });
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
