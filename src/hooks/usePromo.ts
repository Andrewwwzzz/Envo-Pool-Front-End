import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

export interface PromoValidation {
  valid: boolean;
  error?: string;
  promo?: {
    id: string;
    code: string;
    discount_type: "percentage" | "fixed" | "package_price" | "hourly_rate";
    discount_value: number;
    max_discount_amount: number | null;
    minimum_spend: number | null;
    applies_to_table_id: string | null;
    valid_time_start: string | null;
    valid_time_end: string | null;
    minimum_hours: number | null;
    exact_hours?: number | null;
    staff_only?: boolean;
    /** Server-priced saving for package / per-hour codes (null for % / fixed). */
    server_discount?: number | null;
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
      counter,
    }: {
      code: string;
      originalPrice: number;
      tableId: string;
      bookingStartTime?: string | null;
      bookingEndTime?: string | null;
      /** Staff applying it from the admin dashboard — allows staff-only codes. */
      counter?: boolean;
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
          counter: counter || undefined,
        }),
      });

      if (!res.ok) return { valid: false, error: "Failed to validate promo code" };

      const data = await res.json();
      if (data.valid && data.promo) data.promo.server_discount = data.discountAmount ?? null;
      return data as PromoValidation;
    },
  });
}
