import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

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
    valid_time_start: string | null;
    valid_time_end: string | null;
    minimum_hours: number | null;
  };
}

export function useValidatePromo() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      code,
      originalPrice,
      tableId,
      bookingStartTime,
      bookingEndTime,
    }: {
      code: string;
      originalPrice: number;
      tableId: string;
      bookingStartTime?: string | null;
      bookingEndTime?: string | null;
    }): Promise<PromoValidation> => {
      if (!user) return { valid: false, error: "Not authenticated" };

      const res = await apiFetch("/api/promo/validate", {
        method: "POST",
        body: JSON.stringify({
          code,
          originalPrice,
          tableId,
          bookingStartTime: bookingStartTime ?? undefined,
          bookingEndTime: bookingEndTime ?? undefined,
        }),
      });

      if (!res.ok) return { valid: false, error: "Failed to validate promo code" };

      const data = await res.json();
      return data as PromoValidation;
    },
  });
}
