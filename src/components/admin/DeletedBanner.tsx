import { AlertTriangle } from "lucide-react";
import { fmtDateSG } from "@/lib/sgTime";

export interface DeletedInfo {
  reason?: string;
  by?: string;
  at?: string;
}

export function getDeletedInfo(r: any): DeletedInfo {
  if (!r) return {};
  const by = r.deletedBy ?? r.deleted_by ?? r.cancelledBy ?? r.cancelled_by;
  const byName =
    by && typeof by === "object"
      ? by.name || by.legalName || by.email || "—"
      : typeof by === "string"
      ? by
      : undefined;
  return {
    reason:
      r.deleteReason ||
      r.deletionReason ||
      r.deleted_reason ||
      r.cancelReason ||
      r.cancellationReason ||
      r.cancellation_reason ||
      undefined,
    by: byName,
    at: r.deletedAt || r.deleted_at || r.cancelledAt || r.cancelled_at || undefined,
  };
}

export function isDeleted(r: any): boolean {
  if (!r) return false;
  return Boolean(
    r.deleted === true ||
      r.isDeleted === true ||
      r.deletedAt ||
      r.deleted_at ||
      r.status === "deleted",
  );
}

export function isCancelled(r: any): boolean {
  if (!r) return false;
  return (
    r.status === "cancelled" ||
    r.status === "canceled" ||
    Boolean(r.cancelledAt || r.cancelled_at)
  );
}

export default function DeletedBanner({ info }: { info: DeletedInfo }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm space-y-1">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle className="h-4 w-4" /> This record has been deleted
      </div>
      <div className="text-xs text-foreground/80 space-y-0.5 pl-6">
        <div><span className="text-muted-foreground">Reason:</span> {info.reason || "—"}</div>
        <div><span className="text-muted-foreground">Deleted by:</span> {info.by || "—"}</div>
        <div><span className="text-muted-foreground">Deleted at:</span> {info.at ? fmtDateSG(info.at) : "—"}</div>
      </div>
    </div>
  );
}
