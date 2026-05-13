import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { useTables, TableStatus, validateDuration } from "@/hooks/useBooking";
import { usePricingRules } from "@/hooks/usePricing";
import { useValidatePromo, PromoValidation } from "@/hooks/usePromo";
import { useProfile } from "@/hooks/useProfile";
import { calculateBookingPrice, calculateDiscount } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LogOut, CalendarDays, Tag, CreditCard, Wallet, ChevronRight, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch, BASE_URL } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isBefore } from "date-fns";
import { todaySG, sgSlotToUTC, sgDayBoundsUTC } from "@/lib/sgTime";

const statusColor: Record<TableStatus, string> = {
  Available: "bg-primary/10 text-primary border-primary/20",
  Booked: "bg-destructive/10 text-destructive border-destructive/20",
  "Pending Payment": "bg-accent/20 text-accent-foreground border-accent/30",
  "In Use": "bg-destructive/10 text-destructive border-destructive/20",
  Maintenance: "bg-destructive/10 text-destructive border-destructive/20",
};

function slotToDate(date: Date, slot: string): Date {
  return sgSlotToUTC(date, slot);
}

const Booking = () => {
  const { user, loading, signOut, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [startSlot, setStartSlot] = useState<string | null>(null);
  const [endSlot, setEndSlot] = useState<string | null>(null);

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoValidation["promo"] | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "stripe" | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const today = useMemo(() => todaySG(), []);

  const { data: tables, isLoading: tablesLoading } = useTables(null, null);

  const selectedTableData_pre = tables?.find((t) => t.id === selectedTable);
  const { data: tableBookings } = useQuery({
    queryKey: ["table-day-bookings", selectedTable, selectedDate?.toISOString()],
    queryFn: async () => {
      if (!selectedTable || !selectedDate || !selectedTableData_pre?.hardware_id) return [];
      const { dayStart, dayEnd } = sgDayBoundsUTC(selectedDate);
      const hardwareId = selectedTableData_pre.hardware_id;

      const res = await apiFetch("/api/bookings");
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const allBookings = await res.json();

      const filtered = (allBookings || []).filter((b: any) => {
        // Skip cancelled — backend deletes expired
        if (b.status === "cancelled") return false;
        const bTableId = typeof b.tableId === "object" ? b.tableId?.hardware_id : b.tableId;
        if (bTableId !== hardwareId) return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return bStart < dayEnd && bEnd > dayStart;
      });

      return filtered.map((b: any) => ({
        start_time: b.startTime,
        end_time: b.endTime,
        status: b.status === "confirmed" ? "confirmed" : "pending",
        created_at: b.createdAt || new Date().toISOString(),
        expires_at: b.expiresAt || null,
        user_name: b.userName || null,
      }));
    },
    enabled: !!selectedTable && !!selectedDate && !!selectedTableData_pre?.hardware_id,
    refetchInterval: 30000,
    staleTime: 0,
  });

  const { data: pricingRules } = usePricingRules();
  const { data: profile } = useProfile();
  const isAdmin = user?.isAdmin === true;
  const validatePromo = useValidatePromo();

  const startDate = selectedDate && startSlot ? slotToDate(selectedDate, startSlot) : null;
  const endDate = selectedDate && endSlot ? slotToDate(selectedDate, endSlot) : null;

  const pricing = useMemo(() => {
    if (!startDate || !endDate || !selectedTable || endDate <= startDate || !pricingRules) return null;
    return calculateBookingPrice(pricingRules, selectedTable, startDate, endDate);
  }, [startDate, endDate, selectedTable, pricingRules]);

  const originalPrice = pricing?.totalPrice ?? 0;

  const discountAmount = useMemo(() => {
    if (!appliedPromo || !originalPrice) return 0;
    return calculateDiscount(
      originalPrice,
      appliedPromo.discount_type,
      appliedPromo.discount_value,
      appliedPromo.max_discount_amount
    );
  }, [appliedPromo, originalPrice]);

  const finalPrice = Math.max(0, originalPrice - discountAmount);

  const durationError = useMemo(() => {
    if (!startDate || !endDate || endDate <= startDate) return null;
    return validateDuration(startDate, endDate);
  }, [startDate, endDate]);

  const selectedTableData = tables?.find((t) => t.id === selectedTable);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground dark">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  const isVerified = user.isVerified !== false;

  if (!isVerified) return <PendingVerificationCard onSignOut={signOut} />;

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setStartSlot(null);
    setEndSlot(null);
    setAppliedPromo(null);
  };

  const handleTableSelect = (tableId: string) => {
    setSelectedTable(tableId);
    setStartSlot(null);
    setEndSlot(null);
    setAppliedPromo(null);
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !selectedTable) return;
    const result = await validatePromo.mutateAsync({
      code: promoCode,
      originalPrice,
      tableId: selectedTable,
    });
    if (result.valid && result.promo) {
      setAppliedPromo(result.promo);
      toast({ title: "Promo applied!", description: `Code ${result.promo.code} applied successfully.` });
    } else {
      toast({ title: "Invalid promo", description: result.error, variant: "destructive" });
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
  };

  const canBook =
    startDate &&
    endDate &&
    endDate > startDate &&
    selectedTable &&
    paymentMethod &&
    !durationError;

  const handleBookClick = () => {
    setAgreedToTerms(false);
    setShowConfirm(true);
  };

  const handleConfirmBook = async () => {
    if (!user || !selectedTable || !startDate || !endDate || !selectedTableData || !paymentMethod) return;
    if (isProcessing) return;

    if (!selectedTableData.hardware_id) {
      toast({ title: "Table configuration error", description: "Please refresh the page.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setShowConfirm(false);

    const hardwareId = selectedTableData.hardware_id;

    try {
      // STEP 1: Create booking via POST /api/bookings
      const createRes = await apiFetch("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          tableId: hardwareId,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          amount: finalPrice,
          promoCode: appliedPromo?.code || null,
          promoDiscount: discountAmount || 0,
          originalAmount: originalPrice || finalPrice,
        }),
      });

      const createText = await createRes.text();
      let createData: any;
      try { createData = JSON.parse(createText); } catch { createData = {}; }

      if (!createRes.ok) {
        const errMsg = createData.error || createData.message || `Server error (${createRes.status})`;
        if (createRes.status === 409) {
          toast({ title: "Time slot already booked", description: "Please select another slot.", variant: "destructive" });
          setStartSlot(null);
          setEndSlot(null);
          queryClient.invalidateQueries({ queryKey: ["table-day-bookings", selectedTable, selectedDate?.toISOString()] });
        } else {
          toast({ title: "Booking failed", description: errMsg, variant: "destructive" });
        }
        return;
      }

      const bookingId = createData.bookingId || createData.booking?.id || createData.booking?._id || createData.id || createData._id;
      if (!bookingId) {
        toast({ title: "Booking failed", description: "No booking ID returned.", variant: "destructive" });
        return;
      }

      // Store for socket listener
      sessionStorage.setItem("pending_booking_id", bookingId);

      // STEP 2: Pay
      if (paymentMethod === "wallet") {
        // POST /api/payments/wallet
        const walletRes = await apiFetch("/api/payments/wallet", {
          method: "POST",
          body: JSON.stringify({ bookingId }),
        });

        if (!walletRes.ok) {
          const walletData = await walletRes.json().catch(() => ({}));
          toast({ title: "Payment failed", description: walletData.error || walletData.message || "Wallet payment failed.", variant: "destructive" });
          return;
        }

        // Success — refetch and redirect
        sessionStorage.removeItem("pending_booking_id");
        if (appliedPromo?.id) {
          apiFetch("/api/promo/apply", {
            method: "POST",
            body: JSON.stringify({ promoId: appliedPromo.id }),
          }).catch(() => {});
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["profile"] }),
          queryClient.invalidateQueries({ queryKey: ["my-bookings"] }),
          queryClient.invalidateQueries({ queryKey: ["tables-with-status"] }),
          queryClient.invalidateQueries({ queryKey: ["table-day-bookings"] }),
          queryClient.invalidateQueries({ queryKey: ["transaction-history"] }),
        ]);
        toast({ title: "Booking confirmed!", description: "Your table has been reserved successfully." });
        navigate("/booking-confirmed");
      } else {
        // POST /api/payments/checkout (PayNow/Stripe)
        const checkoutRes = await apiFetch("/api/payments/checkout", {
          method: "POST",
          body: JSON.stringify({ bookingId }),
        });

        const checkoutData = await checkoutRes.json().catch(() => ({}));

        if (!checkoutRes.ok) {
          toast({ title: "Payment failed", description: checkoutData.error || checkoutData.message || "Failed to initiate payment.", variant: "destructive" });
          return;
        }

        let checkoutUrl = checkoutData.checkoutUrl || checkoutData.checkout_url || checkoutData.url;
        if (!checkoutUrl) {
          toast({ title: "Invalid response", description: "Missing checkout URL from server.", variant: "destructive" });
          return;
        }

        // Ensure URL has a scheme
        if (!checkoutUrl.startsWith("http://") && !checkoutUrl.startsWith("https://")) {
          checkoutUrl = "https://" + checkoutUrl;
        }

        // Redirect to Stripe/PayNow — socket will handle confirmation
        if (appliedPromo?.id) {
          try {
            await apiFetch("/api/promo/apply", {
              method: "POST",
              body: JSON.stringify({ promoId: appliedPromo.id }),
            });
          } catch {}
        }
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to create booking",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isTableBookable = (table: typeof tables extends (infer T)[] ? T : never) => {
    return table.status !== "Maintenance" && table.status !== "In Use";
  };

  return (
    <div className="min-h-screen bg-background dark">
      <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <header className="relative z-10 border-b border-border/50 bg-card/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight gold-gradient">Envo Pool</h1>
          <span className="text-muted-foreground text-sm hidden sm:inline">|</span>
          <span className="text-sm text-muted-foreground hidden sm:inline">Reserve a Table</span>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link to="/admin">
              <Button variant="outline" size="sm" className="border-accent/30 text-accent hover:bg-accent/10"><Shield className="mr-2 h-4 w-4" /> Admin</Button>
            </Link>
          )}
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">Dashboard</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl p-6 space-y-6">
        {!isVerified && (
          <Card className="card-premium border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="pt-6 text-center">
              <p className="text-yellow-400 font-semibold">⏳ Awaiting admin verification</p>
              <p className="text-sm text-muted-foreground mt-1">Your account is pending approval. You cannot book until verified.</p>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Date Selection */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-accent" />
              <span>1. Select Date</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => isBefore(date, today)}
              className="p-3 pointer-events-auto"
            />
          </CardContent>
        </Card>

        {/* Step 2: Table Selection */}
        {selectedDate && (
          <Card className="card-premium">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">2. Select a Table</CardTitle>
            </CardHeader>
            <CardContent>
              {!tables?.length ? (
                <p className="text-muted-foreground">No tables available.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {tables.map((table) => {
                    const bookable = isTableBookable(table);
                    return (
                      <button
                        key={table.id}
                        onClick={() => bookable && handleTableSelect(table.id)}
                        disabled={!bookable}
                        className={`rounded-xl border p-4 text-left transition-all duration-200 ${
                          selectedTable === table.id
                            ? "border-accent ring-2 ring-accent/20 bg-accent/5"
                            : "border-border hover:border-muted-foreground/30 hover:bg-card"
                        } ${!bookable ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <p className="font-semibold text-foreground">Table {table.table_number}</p>
                        {!bookable && (
                          <Badge variant="outline" className={`mt-2 text-xs ${statusColor[table.status]}`}>
                            {table.status}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Time Slot Selection */}
        {selectedDate && selectedTable && (
          <Card className="card-premium">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">3. Choose Time</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSlotPicker
                date={selectedDate}
                bookedSlots={tableBookings || []}
                startSlot={startSlot}
                endSlot={endSlot}
                onSelectStart={setStartSlot}
                onSelectEnd={setEndSlot}
              />
              {durationError && (
                <p className="mt-3 text-sm text-destructive">{durationError}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pricing Breakdown */}
        {pricing && selectedTable && !durationError && startSlot && endSlot && (
          <Card className="card-premium">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pricing.segments.map((seg, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {seg.startTime.toLocaleTimeString("en-SG", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit" })} –{" "}
                    {seg.endTime.toLocaleTimeString("en-SG", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit" })}
                    <span className="ml-2 text-xs opacity-60">@ ${seg.hourlyRate}/hr</span>
                  </span>
                  <span className="font-medium">${seg.segmentCost.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-border pt-3 flex justify-between font-medium">
                <span>Subtotal</span>
                <span>${originalPrice.toFixed(2)}</span>
              </div>

              {/* Promo Code */}
              <div className="space-y-2">
                {appliedPromo ? (
                  <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">{appliedPromo.code}</span>
                      <span className="text-sm text-muted-foreground">-${discountAmount.toFixed(2)}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleRemovePromo} className="text-xs h-7">
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Promo code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="flex-1 bg-background/50"
                    />
                    <Button
                      variant="outline"
                      onClick={handleApplyPromo}
                      disabled={!promoCode.trim() || validatePromo.isPending}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>Discount</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-border pt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="gold-gradient">${finalPrice.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Method */}
        {pricing && selectedTable && !durationError && startSlot && endSlot && (
          <Card className="card-premium">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-accent" /> Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {(() => {
                const walletBalance = profile?.wallet_balance ?? 0;
                const insufficient = walletBalance < finalPrice;
                return (
                  <div>
                    <button
                      onClick={() => !insufficient && setPaymentMethod("wallet")}
                      disabled={insufficient}
                      className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${
                        paymentMethod === "wallet"
                          ? "border-accent ring-2 ring-accent/20 bg-accent/5"
                          : "border-border hover:border-muted-foreground/30"
                      } ${insufficient ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <Wallet className="h-5 w-5 text-accent" />
                        <div>
                          <p className="font-medium">Wallet</p>
                          <p className="text-sm text-muted-foreground">
                            Balance: ${walletBalance.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </button>
                    {insufficient && (
                      <p className="mt-1 text-xs text-destructive">Insufficient balance</p>
                    )}
                  </div>
                );
              })()}
              <button
                onClick={() => setPaymentMethod("stripe")}
                className={`rounded-xl border p-4 text-left transition-all duration-200 ${
                  paymentMethod === "stripe"
                    ? "border-accent ring-2 ring-accent/20 bg-accent/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium">Paynow</p>
                    <p className="text-sm text-muted-foreground">Scan and Pay</p>
                  </div>
                </div>
              </button>
            </CardContent>
          </Card>
        )}

        {/* Book Button */}
        <div className="flex justify-end">
          <Button
            size="lg"
            disabled={!canBook || isProcessing || !isVerified}
            onClick={handleBookClick}
            className="gap-2 h-12 px-8 text-sm font-semibold tracking-wide uppercase bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isProcessing ? "Processing..." : `Reserve Table — $${finalPrice.toFixed(2)}`}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Terms & Conditions Confirmation Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="card-premium">
            <DialogHeader>
              <DialogTitle>Confirm Reservation</DialogTitle>
              <DialogDescription>
                Please review and accept our terms before proceeding with payment.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="agree-terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              />
              <label htmlFor="agree-terms" className="text-sm cursor-pointer select-none">
                I have read and agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-accent/80 font-medium">
                  Terms & Conditions
                </a>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button disabled={!agreedToTerms || isProcessing} onClick={handleConfirmBook} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {isProcessing ? "Processing..." : "Confirm & Pay"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Booking;