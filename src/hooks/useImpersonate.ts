import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** An account the master can log in as (Team → Staff → "Log in as any account"). */
export interface AccountHit {
  id: string;
  name: string;
  email: string;
  role: "user" | "staff" | "admin";
  shortId: string | null;
}

async function fail(res: Response, fallback: string): Promise<never> {
  const json = await res.json().catch(() => null);
  throw new Error(json?.error || fallback);
}

export function useAccountSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ["impersonate-search", term],
    queryFn: async (): Promise<AccountHit[]> => {
      const res = await apiFetch(`/api/admin/impersonate/search?q=${encodeURIComponent(term)}`);
      if (!res.ok) await fail(res, "Search failed");
      return res.json();
    },
    enabled: term.length >= 2,
    staleTime: 30_000,
  });
}

export function useImpersonate() {
  return useMutation({
    mutationFn: async (userId: string): Promise<{ token: string; user: AccountHit; expiresInMinutes: number }> => {
      const res = await apiFetch(`/api/admin/impersonate/${userId}`, { method: "POST" });
      if (!res.ok) await fail(res, "Could not open that account");
      return res.json();
    },
  });
}
