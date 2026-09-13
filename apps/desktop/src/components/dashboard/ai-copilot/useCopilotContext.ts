import { useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useProducts } from "@/hooks/useProducts";
import { EXPENSE_CATEGORIES } from "@/hooks/useExpenses";
import type { CopilotContext } from "./types";

/** Builds the entity-resolution payload sent alongside the free-text
 *  prompt — all three lists (clients/suppliers/products) are already
 *  cached by React Query elsewhere in the app (the Clients/Suppliers/
 *  Products pages keep them warm), so this reads from cache rather than
 *  issuing new queries in the common case. */
export function useCopilotContext(): CopilotContext {
  const { data: clients } = useClients();
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();

  return useMemo(
    () => ({
      clients: (clients ?? []).map((c) => ({ id: c.id, name: c.name })),
      suppliers: (suppliers ?? []).map((s) => ({ id: s.id, name: s.name })),
      catalogItems: (products ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        unitPrice: p.unit_price,
        category: undefined,
      })),
      categories: EXPENSE_CATEGORIES,
    }),
    [clients, suppliers, products]
  );
}
