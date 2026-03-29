import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, CreditCard, Download, Film, Sparkles } from "lucide-react";
import { fmtDateSG as fmtDate, fmtTimeSG as fmtTime } from "@/lib/sgTime";

interface BookingData {
  id: string;
  start_time: string;
  end_time: string;
  created_at: string;
  duration_hours: number;
  final_price: number;
  price: number;
  status: string;
  payment_method: string | null;
  tables?: { table_number: number } | null;
}

interface BookingDetailDialogProps {
  booking: BookingData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusBadge: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-accent/20 text-accent-foreground border-accent/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  completed: "bg-muted text-muted-foreground border-border",
  refunded: "bg-orange-500/10 text-orange-600 border-orange-300",
  no_show: "bg-destructive/10 text-destructive border-destructive/20",
};

const paymentLabel: Record<string, string> = {
  wallet: "Wallet",
  paynow: "Paynow",
  stripe: "Paynow",
};

const BookingDetailDialog = ({ booking, open, onOpenChange }: BookingDetailDialogProps) => {
  const [downloadMode, setDownloadMode] = useState<"choose" | null>(null);

  if (!booking) return null;

  const b = booking as any;
  const startTime = b.startTime || b.start_time;
  const endTime = b.endTime || b.end_time;
  const createdAt = b.createdAt || b.created_at;
  const durationHours = b.duration_hours || b.duration;
  const finalPrice = b.finalPrice ?? b.final_price ?? b.price ?? 0;
  const tableNum = b.tableId?.name || b.tables?.table_number || "?";
  const paymentMethodRaw = b.paymentMethod || b.payment_method;

  const isCompleted = (booking.status === "confirmed" || booking.status === "completed") && new Date(endTime) < new Date();
  const displayStatus = isCompleted ? "completed" : booking.status;
  const statusLabel = displayStatus === "no_show" ? "No Show" : displayStatus;
  const payment = paymentMethodRaw
    ? paymentLabel[paymentMethodRaw] ?? paymentMethodRaw
    : "N/A";

  const handleDownload = (type: "paid" | "watermark") => {
    // TODO: integrate with actual video storage/API
    if (type === "paid") {
      // Trigger paid download flow
      console.log("Paid download for booking:", booking.id);
    } else {
      // Trigger watermarked download
      console.log("Watermark download for booking:", booking.id);
    }
    setDownloadMode(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setDownloadMode(null); }}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg gold-gradient">
            Table {tableNum} — Booking Details
          </DialogTitle>
          <DialogDescription className="sr-only">
            Details for your booking on table {tableNum}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant="outline" className={statusBadge[displayStatus] ?? ""}>
              {statusLabel}
            </Badge>
          </div>

          <Separator className="bg-border/50" />

          {/* Date */}
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-accent shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="font-medium">{fmtDate(startTime)}</p>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-accent shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Time</p>
              <p className="font-medium">
                {fmtTime(startTime)} – {fmtTime(endTime)}
                {durationHours && <span className="text-muted-foreground text-sm ml-2">({durationHours}h)</span>}
              </p>
            </div>
          </div>

          {/* Payment Method */}
          <div className="flex items-center gap-3">
            <CreditCard className="h-4 w-4 text-accent shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <p className="font-medium">{payment}</p>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 text-accent shrink-0 text-center font-bold text-sm">$</span>
            <div>
              <p className="text-sm text-muted-foreground">Amount Paid</p>
              <p className="font-medium">${(booking.final_price ?? booking.price)?.toFixed(2)}</p>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Order Created */}
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-accent shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Order Created</p>
              <p className="font-medium">{fmtDate(booking.created_at)} at {fmtTime(booking.created_at)}</p>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Video Download */}
          {downloadMode === "choose" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Choose download option:</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-1.5 h-auto py-4 border-primary/30 hover:bg-primary/10 hover:border-primary"
                  onClick={() => handleDownload("paid")}
                >
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="text-xs font-semibold">Premium</span>
                  <span className="text-[10px] text-muted-foreground">No watermark</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-1.5 h-auto py-4 border-border hover:bg-muted"
                  onClick={() => handleDownload("watermark")}
                >
                  <Film className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Free</span>
                  <span className="text-[10px] text-muted-foreground">With watermark</span>
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => setDownloadMode("choose")}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Video
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingDetailDialog;
