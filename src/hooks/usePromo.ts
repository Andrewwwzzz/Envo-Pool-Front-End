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

      const trimmedCode = code.trim().toUpperCase();

      // Fetch promo
      const { data: promo, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", trimmedCode)
        .eq("is_active", true)
        .maybeSingle();

      if (error) return { valid: false, error: "Failed to validate promo code" };
      if (!promo) return { valid: false, error: "Invalid promo code" };

      // Check expiry
      if (promo.expiry_date && new Date(promo.expiry_date) < new Date()) {
        return { valid: false, error: "Promo code has expired" };
      }

      // Check table restriction
      if (promo.applies_to_table_id && promo.applies_to_table_id !== tableId) {
        return { valid: false, error: "This promo code is not valid for the selected table" };
      }

      // Check minimum spend
      if (promo.minimum_spend !== null && originalPrice < promo.minimum_spend) {
        return { valid: false, error: `Minimum spend of $${promo.minimum_spend} required` };
      }

      // Check total usage
      if (promo.usage_limit !== null) {
        const { count } = await supabase
          .from("promo_usage")
          .select("*", { count: "exact", head: true })
          .eq("promo_id", promo.id);
        if ((count ?? 0) >= promo.usage_limit) {
          return { valid: false, error: "Promo code usage limit reached" };
        }
      }

      // Check per-user usage
      if (promo.per_user_limit !== null) {
        const { count } = await supabase
          .from("promo_usage")
          .select("*", { count: "exact", head: true })
          .eq("promo_id", promo.id)
          .eq("user_id", user.id);
        if ((count ?? 0) >= promo.per_user_limit) {
          return { valid: false, error: "You've already used this promo code the maximum number of times" };
        }
      }

      return {
        valid: true,
        promo: {
          id: promo.id,
          code: promo.code,
          discount_type: promo.discount_type as "percentage" | "fixed",
          discount_value: promo.discount_value,
          max_discount_amount: promo.max_discount_amount,
          minimum_spend: promo.minimum_spend,
          applies_to_table_id: promo.applies_to_table_id,
        },
      };
    },
  });
}
