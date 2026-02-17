import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTermsContent() {
  return useQuery({
    queryKey: ["terms-conditions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms_conditions" as any)
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data as unknown as { id: string; content: string; updated_at: string };
    },
  });
}

export function useUpdateTerms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("terms_conditions" as any)
        .update({ content, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms-conditions"] });
    },
  });
}
