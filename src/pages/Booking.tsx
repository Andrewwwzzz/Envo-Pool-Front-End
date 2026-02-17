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
import { LogOut, Clock, CalendarDays, Tag, CreditCard, Wallet, ChevronRight, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { DateTimePicker } from "@/components/DateTimePicker";

const statusColor: Record<TableStatus, string> = {
  Available: "bg-primary/10 text-primary border-primary/20",
  Booked: "bg-destructive/10 text-destructive border-destructive/20",
  "Pending Payment": "bg-accent/20 text-accent-foreground border-accent/30",
  "In Use": "bg-destructive/10 text-destructive border-destructive/20",
  Maintenance: "bg-muted text-muted-foreground border-muted",
};

const Booking = () => {
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoValidation["promo"] | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "stripe" | null>(null);

  const { data: tables, isLoading: tablesLoading } = useTables(startDate, endDate);
  const { data: pricingRules } = usePricingRules();
  const { data: profile } = useProfile();
  const { data: role } = useUserRole();
  const createBooking = useCreateBooking();
  const validatePromo = useValidatePromo();

  // Calculate pricing
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

  const durationDisplay = useMemo(() => {
    if (!startDate || !endDate || endDate <= startDate) return null;
    const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
  }, [startDate, endDate]);

  const durationError = useMemo(() => {
    if (!startDate || !endDate || endDate <= startDate) return null;
    return validateDuration(startDate, endDate);
  }, [startDate, endDate]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;

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

  const selectedTableData = tables?.find((t) => t.id === selectedTable);
  const canBook =
    selectedTable &&
    startDate &&
    endDate &&
    endDate > startDate &&
    selectedTableData?.status === "Available" &&
    paymentMethod &&
    !durationError &&
    (paymentMethod !== "wallet" || (profile && profile.wallet_balance >= finalPrice));

  const handleBook = () => {
    if (!selectedTable || !startDate || !endDate || !paymentMethod) return;
    createBooking.mutate({
      tableId: selectedTable,
      startTime: startDate,
      endTime: endDate,
      originalPrice,
      discountAmount,
      finalPrice,
      promoId: appliedPromo?.id ?? null,
      paymentMethod,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Book a Table</h1>
        <div className="flex items-center gap-3">
          {role === "admin" && (
            <Link to="/admin">
              <Button variant="outline" size="sm"><Shield className="mr-2 h-4 w-4" /> Admin</Button>
            </Link>
          )}
          <Link to="/dashboard">
            <Button variant="outline" size="sm">My Dashboard</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6 space-y-6">
        {/* Time Selection */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" /> Select Time
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DateTimePicker
              label="Start Time"
              value={startDate}
              onChange={(d) => { setStartDate(d); setAppliedPromo(null); }}
            />
            <DateTimePicker
              label="End Time"
              value={endDate}
              onChange={(d) => { setEndDate(d); setAppliedPromo(null); }}
              minDate={startDate}
              minTime={startDate}
            />
            {durationDisplay && (
              <div className="sm:col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" /> Duration: {durationDisplay}
              </div>
            )}
            {durationError && (
              <p className="sm:col-span-2 text-sm text-destructive">{durationError}</p>
            )}
          </CardContent>
        </Card>

        {/* Table Grid */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Select a Table</CardTitle>
          </CardHeader>
          <CardContent>
            {tablesLoading ? (
              <p className="text-muted-foreground">Loading tables...</p>
            ) : !tables?.length ? (
              <p className="text-muted-foreground">No tables available.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {tables.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => { table.status === "Available" && setSelectedTable(table.id); setAppliedPromo(null); }}
                    disabled={table.status !== "Available"}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      selectedTable === table.id
                        ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    } ${table.status !== "Available" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <p className="font-medium text-foreground">Table {table.table_number}</p>
                    <Badge variant="outline" className={`mt-2 text-xs ${statusColor[table.status]}`}>
                      {table.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing Breakdown */}
        {pricing && selectedTable && !durationError && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pricing.segments.map((seg, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {seg.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {seg.endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    <span className="ml-2 text-xs">@ ${seg.hourlyRate}/hr</span>
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
                      className="flex-1"
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
                <span>${finalPrice.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Method */}
        {pricing && selectedTable && !durationError && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" /> Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setPaymentMethod("wallet")}
                className={`rounded-xl border p-4 text-left transition-all ${
                  paymentMethod === "wallet"
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-primary" />
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
                className={`rounded-xl border p-4 text-left transition-all ${
                  paymentMethod === "stripe"
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
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
            disabled={!canBook || createBooking.isPending}
            onClick={handleBook}
            className="gap-2"
          >
            {createBooking.isPending ? "Processing..." : `Book Table — $${finalPrice.toFixed(2)}`}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Booking;
