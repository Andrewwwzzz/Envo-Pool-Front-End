import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useTermsContent() {
  return useQuery({
    queryKey: ["terms-conditions"],
    queryFn: async () => {
      const res = await apiFetch("/api/terms");
      if (!res.ok) throw new Error("Failed to fetch terms");
      const data = await res.json();
      return data as { id: string; content: string; updated_at: string };
    },
  });
}

export function useUpdateTerms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await apiFetch("/api/terms", {
        method: "PUT",
        body: JSON.stringify({ id, content }),
      });
      if (!res.ok) throw new Error("Failed to update terms");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms-conditions"] });
    },
  });
}
