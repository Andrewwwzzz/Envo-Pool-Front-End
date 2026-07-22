import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface Campaign {
  _id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  imageData?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  isActive: boolean;
  isDeleted?: boolean;
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

export function useAdminCampaigns(includeDeleted = false) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const campaigns = useQuery<Campaign[]>({
    queryKey: ["campaigns", "admin", includeDeleted],
    queryFn: async () => {
      const url = includeDeleted ? "/api/admin/campaigns?includeDeleted=true" : "/api/admin/campaigns";
      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
  });

  const create = useMutation({
    mutationFn: async (data: Omit<Campaign, "_id" | "isActive" | "createdAt"> & { imageFile?: File | null }) => {
      const fd = new FormData();
      fd.append("title", data.title);
      fd.append("body", data.body);
      if (data.imageFile) fd.append("image", data.imageFile);
      if (data.buttonLabel) fd.append("buttonLabel", data.buttonLabel);
      if (data.buttonUrl) fd.append("buttonUrl", data.buttonUrl);
      const res = await apiFetch("/api/admin/campaigns", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create campaign");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Campaign created" });
      qc.invalidateQueries({ queryKey: ["campaigns"], exact: false });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Campaign> & { imageFile?: File | null } }) => {
      const fd = new FormData();
      if (data.title !== undefined) fd.append("title", data.title);
      if (data.body !== undefined) fd.append("body", data.body);
      if (data.imageFile) fd.append("image", data.imageFile);
      if (data.buttonLabel !== undefined) fd.append("buttonLabel", data.buttonLabel ?? "");
      if (data.buttonUrl !== undefined) fd.append("buttonUrl", data.buttonUrl ?? "");
      const res = await apiFetch(`/api/admin/campaigns/${id}`, { method: "PATCH", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update campaign");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Campaign updated" });
      qc.invalidateQueries({ queryKey: ["campaigns"], exact: false });
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
      qc.invalidateQueries({ queryKey: ["campaigns"], exact: false });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/admin/campaigns/${id}/restore`, { method: "PATCH" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to restore campaign");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Campaign restored" });
      qc.invalidateQueries({ queryKey: ["campaigns"], exact: false });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to archive campaign");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Campaign deleted" });
      qc.invalidateQueries({ queryKey: ["campaigns"], exact: false });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return { ...campaigns, create, update, toggle, restore, remove };
}
