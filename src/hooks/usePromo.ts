import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PromoValidation {
  valid: boolean;
  error?: string;
  promo?: {
    id: string;
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    max_discount_amount: number | null;
    minimum_spend: number | null;
    applies_to_table_id: string | null;
  };
}

export function useValidatePromo() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      code,
      originalPrice,
      tableId,
    }: {
      code: string;
      originalPrice: number;
      tableId: string;
    }): Promise<PromoValidation> => {
      if (!user) return { valid: false, error: "Not authenticated" };

      const { data, error } = await supabase.rpc("validate_promo_code", {
        p_code: code,
        p_original_price: originalPrice,
        p_table_id: tableId,
      });

      if (error) return { valid: false, error: "Failed to validate promo code" };

      const result = data as unknown as PromoValidation;
      return result;
    },
  });
}
