import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/database";

export interface ClientProductSummary {
  product_id: string;
  product_code: string;
  product_name: string;
  unit: string;
  total_quantity: number;
  total_amount: number;
}

export function useClientProducts(
  clientId: string | undefined,
  filters?: {
    productId?: string;
    month?: string;
    year?: number;
  }
) {
  return useQuery({
    queryKey: ["client-products", clientId, filters],
    queryFn: async () => {
      if (!clientId) return [];
      try {
        const products = await db.clients.getProducts(
          clientId,
          filters?.productId,
          filters?.month,
          filters?.year
        );
        return products;
      } catch (error) {
        console.error("Error loading client products:", error);
        throw error;
      }
    },
    enabled: !!clientId,
    staleTime: 30000, // Cache for 30 seconds
  });
}
