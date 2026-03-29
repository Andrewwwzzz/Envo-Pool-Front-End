import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useTables, TableStatus, validateDuration } from "@/hooks/useBooking";
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
import { LogOut, CalendarDays, Tag, CreditCard, ChevronRight, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
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
  // Build a proper UTC Date representing this slot in Singapore time
  return sgSlotToUTC(date, slot);
}

const Booking = () => {
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step 1: Date
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  // Step 2: Table
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  // Step 3: Time slots
  const [startSlot, setStartSlot] = useState<string | null>(null);
  const [endSlot, setEndSlot] = useState<string | null>(null);

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoValidation["promo"] | null>(null);
  const [paymentMethod] = useState<"stripe">("stripe");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const today = useMemo(() => todaySG(), []);

  // Fetch tables (basic info, no time filter needed for display)
  const { data: tables, isLoading: tablesLoading } = useTables(null, null);

  // Fetch bookings for the selected table + date to show slot availability
  const { data: tableBookings } = useQuery({
    queryKey: ["table-day-bookings", selectedTable, selectedDate?.toISOString()],
    queryFn: async () => {
      if (!selectedTable || !selectedDate) return [];
      const { dayStart, dayEnd } = sgDayBoundsUTC(selectedDate);

      const { data, error } = await supabase.rpc("get_table_booked_slots", {
        p_table_id: selectedTable,
        p_day_start: dayStart.toISOString(),
        p_day_end: dayEnd.toISOString(),
      });

      if (error) throw error;
      return (data || []) as { start_time: string; end_time: string; status: string; created_at: string }[];
    },
    enabled: !!selectedTable && !!selectedDate,
    refetchInterval: 30000,
  });

  const { data: pricingRules } = usePricingRules();
  const { data: profile } = useProfile();
  const { data: role } = useUserRole();
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
    !durationError;

  const handleBookClick = () => {
    setAgreedToTerms(false);
    setShowConfirm(true);
  };


  const handleConfirmBook = async () => {
    if (!user || !selectedTable || !startDate || !endDate || !selectedTableData) return;

    if (!selectedTableData.hardware_id) {
      toast({ title: "Table configuration error", description: "Please refresh the page.", variant: "destructive" });
      return;
    }

    setShowConfirm(false);
    setIsProcessing(true);

    const hardwareId = selectedTableData.hardware_id;

    try {
      if (paymentMethod === "wallet") {
        // Use atomic RPC for wallet — handles booking creation, wallet deduction, transactions, and rewards
        const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
        const { data, error } = await supabase.rpc("create_booking_atomic", {
          p_table_id: selectedTable,
          p_start_time: startDate.toISOString(),
          p_end_time: endDate.toISOString(),
          p_duration_hours: durationHours,
          p_original_price: originalPrice,
          p_discount_amount: discountAmount,
          p_final_price: finalPrice,
          p_promo_id: appliedPromo?.id ?? undefined,
          p_payment_method: "wallet",
        });

        if (error) throw new Error(error.message);
        const result = data as unknown as { success?: boolean; error?: string; booking_id?: string };
        if (result.error) throw new Error(result.error);

        // Create in external API for hardware sync (time-based)
        try {
          const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
          await fetch("https://anytime-pool-api.onrender.com/api/bookings/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: "69b29fd2945d95cf8f55c86a",
              tableId: hardwareId,
              startTime: startDate.toISOString(),
              duration: durationMinutes,
            }),
          });
        } catch (extErr) {
          console.warn("External API booking failed (non-critical):", extErr);
        }

        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
        queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
        queryClient.invalidateQueries({ queryKey: ["table-day-bookings"] });
        window.location.href = "/booking-confirmed";
      } else {
        // Stripe flow: single backend call that creates booking + payment
        const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));

        const response = await fetch(
          "https://anytime-pool-api.onrender.com/api/bookings/create-with-payment",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: "69b29fd2945d95cf8f55c86a",
              tableId: hardwareId,
              startTime: startDate.toISOString(),
              duration: durationMinutes,
            }),
          }
        );

        if (!response.ok) {
          if (response.status === 409) {
            toast({
              title: "Time slot already booked",
              description: "This time slot has just been booked by another player. Please select another slot.",
              variant: "destructive",
            });
            setStartSlot(null);
            setEndSlot(null);
            queryClient.invalidateQueries({ queryKey: ["table-day-bookings", selectedTable, selectedDate?.toISOString()] });
          } else if (response.status === 400) {
            const errData = await response.json().catch(() => ({}));
            toast({ title: "Validation error", description: errData.message || "Please check your booking details.", variant: "destructive" });
          } else {
            toast({ title: "Unable to create booking", description: "Please try again.", variant: "destructive" });
          }
          return;
        }

        const { checkoutUrl, bookingId } = await response.json();

        if (!checkoutUrl || !bookingId) {
          toast({ title: "Invalid response", description: "Missing checkout URL from server.", variant: "destructive" });
          return;
        }

        // Mirror booking locally for tracking
        const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
        const { data: mirroredBooking, error: mirrorError } = await supabase
          .from("bookings")
          .insert({
            user_id: user.id,
            table_id: selectedTable,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            duration_hours: durationHours,
            price: finalPrice,
            original_price: originalPrice,
            discount_amount: discountAmount,
            final_price: finalPrice,
            promo_id: appliedPromo?.id ?? null,
            payment_method: "stripe",
            payment_id: bookingId,
            status: "pending",
          })
          .select("id")
          .single();

        if (mirrorError) {
          console.error("Failed to mirror booking locally:", mirrorError);
        }

        if (mirroredBooking) {
          sessionStorage.setItem("pending_booking_id", mirroredBooking.id);
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
