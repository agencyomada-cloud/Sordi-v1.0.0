import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { logError } from "@/lib/errorLogger";
import { db, type Product, type CreateProductData } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";

// Simple validation for price update
const updatePriceSchema = z.object({
  id: z.string().uuid(),
  unit_price: z.coerce.number().min(0, { message: "Le prix ne peut pas être négatif" }),
});

export function useProducts() {
  const { activeCompanyId, isReady } = useWorkspace();
  return useQuery({
    queryKey: ["products", activeCompanyId],
    queryFn: async () => {
      return await db.products.getAll(activeCompanyId);
    },
    enabled: isReady,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useWorkspace();

  return useMutation({
    mutationFn: async (product: Omit<CreateProductData, "company_id">) => {
      return await db.products.create({ ...product, company_id: activeCompanyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produit créé avec succès");
    },
    onError: (error: any) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la création du produit");
      logError("Product create error", error);
    },
  });
}

export function useUpdateProductPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, unit_price }: { id: string; unit_price: number }) => {
      // Validate input
      const validated = updatePriceSchema.parse({ id, unit_price });
      return await db.products.updatePrice(validated.id, validated.unit_price);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Prix mis à jour avec succès");
    },
    onError: (error: any) => {
      if (error.issues) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        toast.error("Erreur lors de la mise à jour du prix");
      }
      logError("Product price update error", error);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Omit<CreateProductData, "company_id"> }) => {
      return await db.products.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produit mis à jour avec succès");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la mise à jour du produit");
      logError("Product update error", error);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await db.products.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produit supprimé avec succès");
    },
    onError: (error: any) => {
      // If error is a string (often from Tauri command), use it.
      // Or if it's an Error object with a message, use that.
      const errorMessage = typeof error === 'string' ? error : (error.message || "Erreur lors de la suppression du produit");

      toast.error(errorMessage);
      logError("Product delete error", error);
    },
  });
}
