import { useMemo, useState } from "react";
import { useAllAdminRewards, useDeleteReward, RewardType, RewardReason } from "@/hooks/useRewards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Gift, Copy, Trash2, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fmtDateSG } from "@/lib/sgTime";

const TYPE_LABELS: Record<string, string> = {
  free_session: "Free Session",
  wallet_credit: "Wallet Credit",
  free_item: "Free Item",
  booking_discount: "Booking Discount",
};

const REASON_LABELS: Record<string, string> = {
  reviews: "Google Review",
  social_follow: "Social Follow",
  birthday: "Birthday",
  refund: "Refund",
  other: "Other",
};

function formatValue(r: any): string {
  const t = r.type as RewardType;
  const v = Number(r.value);
  if (t === "free_session") return Number.isFinite(v) ? `${v} hr${v === 1 ? "" : "s"}` : "—";
  if (t === "wallet_credit") return Number.isFinite(v) ? `$${v.toFixed(2)}` : "—";
  if (t === "booking_discount") return Number.isFinite(v) ? `${v}% off` : "—";
  return "—";
}

function getUser(r: any): { id?: string; name: string; email: string } {
  const u = r.user || r.userId;
  if (u && typeof u === "object") {
    return {
      id: u._id || u.id,
      name: u.legalName || u.name || u.email || "—",
      email: u.email || "",
    };
  }
  return {
    id: typeof u === "string" ? u : (r.userIdString || undefined),
    name: r.userName || r.userLegalName || "—",
    email: r.userEmail || "",
  };
}

function getIssuedBy(r: any): string {
  const ib = r.issuedBy || r.createdBy;
  if (ib && typeof ib === "object") return ib.name || ib.email || "—";
  return typeof ib === "string" ? ib : "—";
}

function getUsage(r: any): { label: string; tone: "active" | "redeemed" | "muted" } {
  if (r.unlimited) {
    const used = Number(r.usesCount ?? r.usesUsed ?? 0);
    return { label: `Unlimited · ${used} used`, tone: "active" };
  }
  const allowed = Number(r.usesAllowed);
  const remaining = Number(r.usesRemaining);
  if (Number.isFinite(allowed) && allowed > 1) {
    const used = Number.isFinite(remaining) ? allowed - remaining : 0;
    if (Number.isFinite(remaining) && remaining <= 0) {
      return { label: `${allowed}/${allowed} used`, tone: "redeemed" };
    }
    return { label: `${used}/${allowed} used`, tone: "active" };
  }
  return r.redeemed
    ? { label: "Redeemed", tone: "redeemed" }
    : { label: "Active", tone: "active" };
}

function isActive(r: any): boolean {
  if (r.unlimited) return true;
  const allowed = Number(r.usesAllowed);
  const remaining = Number(r.usesRemaining);
  if (Number.isFinite(allowed) && allowed > 1) {
    return !Number.isFinite(remaining) || remaining > 0;
  }
  return !r.redeemed;
}

export default function RewardsTab({
  onCustomerClick,
}: {
  onCustomerClick?: (info: { id?: string; email: string; name: string }) => void;
}) {
  const { toast } = useToast();
  const { data: rewards, isLoading } = useAllAdminRewards();
  const deleteReward = useDeleteReward();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = rewards || [];
    const q = search.trim().toLowerCase();
    return list.filter((r: any) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (reasonFilter !== "all" && r.reason !== reasonFilter) return false;
      if (statusFilter === "active" && !isActive(r)) return false;
      if (statusFilter === "redeemed" && isActive(r)) return false;
      if (q) {
        const u = getUser(r);
        const hay = `${r.code || ""} ${u.name} ${u.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rewards, typeFilter, statusFilter, reasonFilter, search]);

  const summary = useMemo(() => {
    const list = rewards || [];
    let total = list.length;
    let active = 0;
    let redeemed = 0;
    let walletGiven = 0;
    for (const r of list) {
      if (isActive(r)) active++;
      else redeemed++;
      if (r.type === "wallet_credit" && r.redeemed) {
        walletGiven += Number(r.value) || 0;
      }
    }
    return { total, active, redeemed, walletGiven };
  }, [rewards]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-accent" /> Rewards
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Total Issued" value={summary.total.toString()} />
          <SummaryCard label="Active" value={summary.active.toString()} />
          <SummaryCard label="Redeemed" value={summary.redeemed.toString()} />
          <SummaryCard label="Wallet Credit Given" value={`$${summary.walletGiven.toFixed(2)}`} />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search code, name, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="free_session">Free Session</SelectItem>
              <SelectItem value="wallet_credit">Wallet Credit</SelectItem>
              <SelectItem value="free_item">Free Item</SelectItem>
              <SelectItem value="booking_discount">Booking Discount</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="redeemed">Redeemed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger><SelectValue placeholder="Reason" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reasons</SelectItem>
              {(Object.keys(REASON_LABELS) as RewardReason[]).map(k => (
                <SelectItem key={k} value={k}>{REASON_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading && !(rewards as any[] | undefined)?.length ? (
          <p className="text-muted-foreground text-sm">Loading rewards…</p>
        ) : !filtered.length ? (
          <p className="text-muted-foreground text-sm">No rewards match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">Code</th>
                  <th className="pb-2 pr-4">Customer</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Value</th>
                  <th className="pb-2 pr-4">Reason</th>
                  <th className="pb-2 pr-4">Issued By</th>
                  <th className="pb-2 pr-4">Issued On</th>
                  <th className="pb-2 pr-4">Expires</th>
                  <th className="pb-2 pr-4">Usage</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => {
                  const u = getUser(r);
                  const usage = getUsage(r);
                  const active = isActive(r);
                  return (
                    <tr key={r._id || r.id || r.code} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">{r.code}</span>
                          <Button
                            size="sm" variant="ghost" className="h-6 w-6 p-0"
                            onClick={() => { navigator.clipboard.writeText(r.code); toast({ title: "Code copied" }); }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <button
                          className="text-left hover:underline"
                          onClick={() => onCustomerClick?.(u)}
                          disabled={!u.email && !u.id}
                        >
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                        </button>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="capitalize whitespace-nowrap">
                          {TYPE_LABELS[r.type] || r.type}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatValue(r)}</td>
                      <td className="py-2 pr-4">{REASON_LABELS[r.reason] || r.reason || "—"}</td>
                      <td className="py-2 pr-4">{getIssuedBy(r)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{fmtDateSG(r.createdAt || r.created_at)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {r.expiresAt ? fmtDateSG(r.expiresAt) : <span className="text-muted-foreground">No expiry</span>}
                      </td>
                      <td className="py-2 pr-4">
                        {usage.tone === "redeemed"
                          ? <Badge variant="outline" className="bg-muted whitespace-nowrap">{usage.label}</Badge>
                          : <Badge className="whitespace-nowrap">{usage.label}</Badge>}
                      </td>
                      <td className="py-2 text-right">
                        {active && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(r._id || r.id)}
                            disabled={deleteReward.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reward?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this reward? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteReward.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteId) return;
                try {
                  await deleteReward.mutateAsync({ id: deleteId });
                  setDeleteId(null);
                } catch {}
              }}
              disabled={deleteReward.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteReward.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground mt-1">{value}</p>
    </div>
  );
}
