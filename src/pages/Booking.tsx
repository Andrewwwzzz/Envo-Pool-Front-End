import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useTables, useCreateBooking, TableStatus, validateDuration } from "@/hooks/useBooking";
import { usePricingRules } from "@/hooks/usePricing";
import { useValidatePromo, PromoValidation } from "@/hooks/usePromo";
import { useProfile, useUserRole } from "@/hooks/useProfile";
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
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { startOfDay, isBefore } from "date-fns";

const statusColor: Record<TableStatus, string> = {
  Available: "bg-primary/10 text-primary border-primary/20",
  Booked: "bg-destructive/10 text-destructive border-destructive/20",
  "Pending Payment": "bg-accent/20 text-accent-foreground border-accent/30",
  "In Use": "bg-destructive/10 text-destructive border-destructive/20",
  Maintenance: "bg-destructive/10 text-destructive border-destructive/20",
};

function slotToDate(date: Date, slot: string): Date {
  const [h, m] = slot.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

const Booking = () => {
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();

  // Step 1: Date
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  // Step 2: Table
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  // Step 3: Time slots
  const [startSlot, setStartSlot] = useState<string | null>(null);
  const [endSlot, setEndSlot] = useState<string | null>(null);

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoValidation["promo"] | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "stripe" | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);

  // Fetch tables (basic info, no time filter needed for display)
  const { data: tables, isLoading: tablesLoading } = useTables(null, null);

  // Fetch bookings for the selected table + date to show slot availability
  const { data: tableBookings } = useQuery({
    queryKey: ["table-day-bookings", selectedTable, selectedDate?.toISOString()],
    queryFn: async () => {
      if (!selectedTable || !selectedDate) return [];
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("bookings")
        .select("start_time, end_time, status, created_at")
        .eq("table_id", selectedTable)
        .in("status", ["pending", "confirmed"])
        .lt("start_time", dayEnd.toISOString())
        .gt("end_time", dayStart.toISOString());

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedTable && !!selectedDate,
    refetchInterval: 30000,
  });

  const { data: pricingRules } = usePricingRules();
  const { data: profile } = useProfile();
  const { data: role } = useUserRole();
  const createBooking = useCreateBooking();
  const validatePromo = useValidatePromo();

  // Compute start/end Date from slots
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

  // Get table status for display
  const selectedTableData = tables?.find((t) => t.id === selectedTable);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground dark">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;

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
    !durationError &&
    (paymentMethod !== "wallet" || (profile && profile.wallet_balance >= finalPrice));

  const handleBookClick = () => {
    setAgreedToTerms(false);
    setShowConfirm(true);
  };


  const handleConfirmBook = async () => {
    if (!selectedTable || !startDate || !endDate || !selectedTableData || !paymentMethod) return;
    setShowConfirm(false);
    setIsProcessing(true);

    try {
      // 1️⃣ Create booking
      const bookingResponse = await fetch(
        "https://anytime-pool-api.onrender.com/api/bookings/create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "69b29fd2945d95cf8f55c86a", // Temporary hardcoded MongoDB user ID until Singpass integration
            tableId: selectedTableData?.hardware_id,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
          }),
        }
      );

      if (!bookingResponse.ok) {
        if (bookingResponse.status === 409) {
          toast({ title: "Time slot already booked", description: "Please choose a different time.", variant: "destructive" });
        } else if (bookingResponse.status === 400) {
          toast({ title: "Missing booking information", description: "Please fill in all required fields.", variant: "destructive" });
        } else {
          toast({ title: "Unable to create booking", description: "Please try again.", variant: "destructive" });
        }
        return;
      }

      const bookingData = await bookingResponse.json();
      const bookingId = bookingData._id;

      if (paymentMethod === "stripe") {
        // 2️⃣ Create Stripe checkout session
        const paymentResponse = await fetch(
          "https://anytime-pool-api.onrender.com/api/payments/create-checkout",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookingId,
              amount: Math.round(finalPrice * 100),
            }),
          }
        );

        if (!paymentResponse.ok) {
          toast({ title: "Payment error", description: "Could not create checkout session. Please try again.", variant: "destructive" });
          return;
        }

        const paymentData = await paymentResponse.json();

        // 3️⃣ Redirect to Stripe
        window.location.href = paymentData.url;
      } else if (paymentMethod === "wallet") {
        const walletResponse = await fetch(
          `https://anytime-pool-api.onrender.com/api/payment/wallet-confirm/${bookingId}`,
          { method: "POST" }
        );

        if (!walletResponse.ok) {
          toast({ title: "Wallet payment failed", description: "Please try again.", variant: "destructive" });
          return;
        }

        window.location.href = "/booking-success";
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

  // Check if table is bookable (not maintenance/in-use)
  const isTableBookable = (table: typeof tables extends (infer T)[] ? T : never) => {
    return table.status !== "Maintenance" && table.status !== "In Use";
  };

  return (
    <div className="min-h-screen bg-background dark">
      <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <header className="relative z-10 border-b border-border/50 bg-card/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight gold-gradient">Anytime Pool</h1>
          <span className="text-muted-foreground text-sm hidden sm:inline">|</span>
          <span className="text-sm text-muted-foreground hidden sm:inline">Reserve a Table</span>
        </div>
        <div className="flex items-center gap-2">
          {role === "admin" && (
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
              {tablesLoading ? (
                <p className="text-muted-foreground">Loading tables...</p>
              ) : !tables?.length ? (
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
                    {seg.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {seg.endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
              <button
                onClick={() => setPaymentMethod("wallet")}
                className={`rounded-xl border p-4 text-left transition-all duration-200 ${
                  paymentMethod === "wallet"
                    ? "border-accent ring-2 ring-accent/20 bg-accent/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium">Wallet</p>
                    <p className="text-sm text-muted-foreground">
                      Balance: ${profile?.wallet_balance?.toFixed(2) ?? "0.00"}
                    </p>
                  </div>
                </div>
                {paymentMethod === "wallet" && profile && profile.wallet_balance < finalPrice && (
                  <p className="mt-2 text-xs text-destructive">Insufficient balance</p>
                )}
              </button>
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
                    <p className="font-medium">Card (Stripe)</p>
                    <p className="text-sm text-muted-foreground">Pay with credit/debit card</p>
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
            disabled={!canBook || isProcessing}
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
              <Button disabled={!agreedToTerms} onClick={handleConfirmBook} className="bg-accent text-accent-foreground hover:bg-accent/90">
                Confirm & Pay
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Booking;
