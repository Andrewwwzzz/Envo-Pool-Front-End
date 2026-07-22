import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface Campaign {
  _id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
}

export function useActiveCampaign() {
  return useQuery<Campaign | null>({
    queryKey: ["campaigns", "active"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/campaigns/active");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminCampaigns() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const campaigns = useQuery<Campaign[]>({
    queryKey: ["campaigns", "admin"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
  });

  const create = useMutation({
    mutationFn: async (data: Omit<Campaign, "_id" | "isActive" | "createdAt">) => {
      const res = await apiFetch("/api/admin/campaigns", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create campaign");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Campaign created" });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggle = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/admin/campaigns/${id}/toggle`, { method: "PATCH" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to toggle campaign");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete campaign");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Campaign deleted" });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return { ...campaigns, create, toggle, remove };
}
