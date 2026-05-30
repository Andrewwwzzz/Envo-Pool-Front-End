import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { useTables, TableStatus, validateDuration } from "@/hooks/useBooking";
import { usePricingRules } from "@/hooks/usePricing";
import { useValidatePromo, PromoValidation } from "@/hooks/usePromo";
import { validateRewardCode, Reward } from "@/hooks/useRewards";
import { useProfile } from "@/hooks/useProfile";
import { useMyMembership } from "@/hooks/useMembership";
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
import { useOperatingHours } from "@/hooks/useOperatingHours";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch, BASE_URL } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isBefore } from "date-fns";
import { todaySG, sgSlotToUTC, sgDayBoundsUTC, isTodaySG } from "@/lib/sgTime";
import WalkinSessionPanel from "@/components/WalkinSessionPanel";
import { useMyWalkinSession, useStartWalkin } from "@/hooks/useWalkin";
import { Timer } from "lucide-react";

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
  const { data: operatingHours } = useOperatingHours();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [startSlot, setStartSlot] = useState<string | null>(null);
  const [endSlot, setEndSlot] = useState<string | null>(null);

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoValidation["promo"] | null>(null);
  const [rewardCodeInput, setRewardCodeInput] = useState("");
  const [appliedReward, setAppliedReward] = useState<Reward | null>(null);
  const [validatingReward, setValidatingReward] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "stripe" | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const today = useMemo(() => todaySG(), []);

  const { data: tables, isLoading: tablesLoading } = useTables(null, null);
  const { data: activeWalkin } = useMyWalkinSession();
  const startWalkin = useStartWalkin();

  const handleStartWalkin = async (table: { id: string; hardware_id: string | null; table_number: number }) => {
    if (!table.hardware_id) {
      toast({ title: "Cannot start session", description: "This table has no hardware ID configured.", variant: "destructive" });
      return;
    }
    try {
      await startWalkin.mutateAsync(table.hardware_id);
      toast({ title: "Walk-in session started", description: `Table ${table.table_number} is now live.` });
    } catch (err: any) {
      toast({ title: "Failed to start session", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

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

      // Resolve display name based on each booker's privacy preference
      const uniqueUserIds = Array.from(new Set(filtered.map((b: any) => {
        return typeof b.userId === "object" ? b.userId?._id : b.userId;
      }).filter(Boolean)));

      const visibilityMap: Record<string, boolean> = {};
      await Promise.all(uniqueUserIds.map(async (uid: string) => {
        try {
          const r = await apiFetch(`/api/bookings/name-visibility?userId=${uid}`);
          if (r.ok) {
            const d = await r.json();
            visibilityMap[uid] = d?.showName !== false;
          } else {
            visibilityMap[uid] = false;
          }
        } catch {
          visibilityMap[uid] = false;
        }
      }));

      return filtered.map((b: any) => {
        const uid = typeof b.userId === "object" ? b.userId?._id : b.userId;
        const rawName = typeof b.userId === "object" ? (b.userId?.username || b.userId?.name || b.userId?.email) : null;
        const showName = uid ? visibilityMap[uid] : false;
        return {
          start_time: b.startTime,
          end_time: b.endTime,
          status: b.status === "confirmed" ? "confirmed" : "pending",
          created_at: b.createdAt || new Date().toISOString(),
          expires_at: b.expiresAt || null,
          user_name: showName ? (rawName || b.userName || null) : null,
        };
      });
    },
    enabled: !!selectedTable && !!selectedDate && !!selectedTableData_pre?.hardware_id,
    refetchInterval: 30000,
    staleTime: 0,
  });

  const { data: tableMaintenance } = useQuery({
    queryKey: ["table-maintenance", selectedTable],
    queryFn: async () => {
      if (!selectedTable) return [];
      const res = await apiFetch(`/api/admin/maintenance/${selectedTable}`);
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : (data?.maintenance || data?.windows || []);
    },
    enabled: !!selectedTable,
    refetchInterval: 60000,
    staleTime: 0,
  });

  const { data: pricingRules } = usePricingRules();
  const { data: profile } = useProfile();
  const { data: myMembership } = useMyMembership();
  const isAdmin = user?.isAdmin === true;
  const validatePromo = useValidatePromo();

  const startDate = selectedDate && startSlot ? slotToDate(selectedDate, startSlot) : null;
  const endDate = selectedDate && endSlot ? slotToDate(selectedDate, endSlot) : null;

  const pricing = useMemo(() => {
    if (!startDate || !endDate || !selectedTable || endDate <= startDate || !pricingRules) return null;
    return calculateBookingPrice(pricingRules, selectedTable, startDate, endDate);
  }, [startDate, endDate, selectedTable, pricingRules]);

  const originalPrice = pricing?.totalPrice ?? 0;

  // ---- Discount candidates ----
  // Compare promo, reward, and membership; only the single highest applies (no stacking).

  // Promo (percentage or fixed)
  const promoDiscountAmt = useMemo(() => {
    if (!appliedPromo || !originalPrice) return 0;
    return calculateDiscount(
      originalPrice,
      appliedPromo.discount_type,
      appliedPromo.discount_value,
      appliedPromo.max_discount_amount
    );
  }, [appliedPromo, originalPrice]);
  const promoPct = originalPrice > 0 ? (promoDiscountAmt / originalPrice) * 100 : 0;

  // Reward (free_session => hour credit; booking_discount => %; free_item => no $ impact)
  const rewardHourlyRate = pricing?.segments?.[0]?.hourlyRate ?? 0;
  const rewardFreeHours = appliedReward?.type === "free_session" ? (appliedReward.value ?? 0) : 0;
  const rewardDiscountPercent = appliedReward?.type === "booking_discount" ? (appliedReward.value ?? 0) : 0;
  // For free_session: consume segments in order until free minutes run out,
  // pricing each consumed minute at that segment's hourly rate.
  const freeSessionCredit = useMemo(() => {
    if (appliedReward?.type !== "free_session") return 0;
    let freeMinutesRemaining = rewardFreeHours * 60;
    let credit = 0;
    const segs = pricing?.segments ?? [];
    for (const seg of segs) {
      if (freeMinutesRemaining <= 0) break;
      const segMins =
        (new Date(seg.endTime).getTime() - new Date(seg.startTime).getTime()) / (1000 * 60);
      const minsToUse = Math.min(segMins, freeMinutesRemaining);
      credit += (minsToUse / 60) * (seg.hourlyRate ?? 0);
      freeMinutesRemaining -= minsToUse;
    }
    return Math.min(originalPrice, parseFloat(credit.toFixed(2)));
  }, [appliedReward, rewardFreeHours, pricing?.segments, originalPrice]);

  const rewardDiscountAmt =
    appliedReward?.type === "free_session"
      ? freeSessionCredit
      : appliedReward?.type === "booking_discount"
      ? Math.min(originalPrice, originalPrice * (rewardDiscountPercent / 100))
      : 0;
  const rewardPct = originalPrice > 0 ? (rewardDiscountAmt / originalPrice) * 100 : 0;


  // Membership — highest active membership benefit
  const activeMembership = useMemo(() => {
    const list: any[] = myMembership?.memberships ?? [];
    const getPlan = (m: any) =>
      (m?.planId && typeof m.planId === "object" ? m.planId : null) || m?.plan || null;
    const getPct = (m: any) =>
      Number(getPlan(m)?.benefits?.bookingDiscount ?? m?.benefits?.bookingDiscount ?? 0);
    const actives = list.filter((m) => {
      const status = String(m?.status ?? (m?.active ? "active" : "")).toLowerCase();
      return status === "active";
    });
    if (!actives.length) return null;
    return actives.reduce(
      (best, m) => (getPct(m) > getPct(best) ? m : best),
      actives[0]
    );
  }, [myMembership]);

  const activeMembershipPlan =
    (activeMembership?.planId && typeof activeMembership.planId === "object"
      ? activeMembership.planId
      : null) || activeMembership?.plan || null;
  const membershipDiscountPct = Number(
    activeMembershipPlan?.benefits?.bookingDiscount ??
      activeMembership?.benefits?.bookingDiscount ??
      0
  );
  const membershipPlanName = activeMembershipPlan?.name ?? activeMembership?.planName ?? "Membership";

  // Free minutes per visit — granted once per SGT day. Consumed from first
  // segments at their respective hourly rates, like a free_session reward.
  const freeMinutesPerVisit = Number(
    activeMembershipPlan?.benefits?.freeMinutesPerVisit ??
      activeMembership?.benefits?.freeMinutesPerVisit ??
      0
  );
  const lastVisitDateRaw = activeMembership?.lastVisitDate ?? activeMembership?.last_visit_date ?? null;
  const freeMinutesAvailable = useMemo(() => {
    if (!activeMembership || freeMinutesPerVisit <= 0) return 0;
    if (!lastVisitDateRaw) return freeMinutesPerVisit;
    const lastVisit = new Date(lastVisitDateRaw);
    if (isNaN(lastVisit.getTime())) return freeMinutesPerVisit;
    return isTodaySG(lastVisit) ? 0 : freeMinutesPerVisit;
  }, [activeMembership, freeMinutesPerVisit, lastVisitDateRaw]);

  const { freeMinutesCredit, freeMinutesApplied } = useMemo(() => {
    if (freeMinutesAvailable <= 0 || originalPrice <= 0) {
      return { freeMinutesCredit: 0, freeMinutesApplied: 0 };
    }
    let remaining = freeMinutesAvailable;
    let credit = 0;
    let used = 0;
    const segs = pricing?.segments ?? [];
    for (const seg of segs) {
      if (remaining <= 0) break;
      const segMins =
        (new Date(seg.endTime).getTime() - new Date(seg.startTime).getTime()) / (1000 * 60);
      const minsToUse = Math.min(segMins, remaining);
      credit += (minsToUse / 60) * (seg.hourlyRate ?? 0);
      used += minsToUse;
      remaining -= minsToUse;
    }
    const cappedCredit = Math.min(originalPrice, parseFloat(credit.toFixed(2)));
    return { freeMinutesCredit: cappedCredit, freeMinutesApplied: used };
  }, [freeMinutesAvailable, originalPrice, pricing?.segments]);

  // Membership % applies AFTER free minutes credit
  const membershipPercentBase = Math.max(0, originalPrice - freeMinutesCredit);
  const membershipDiscountAmt = membershipPercentBase * (membershipDiscountPct / 100);
  // Total membership benefit (free mins + percent) — used to compare against promo/reward
  const membershipBenefitAmt = freeMinutesCredit + membershipDiscountAmt;

  // ---- Pick the single winning discount ----
  type DiscountSource = "none" | "promo" | "reward" | "membership";
  const winningDiscount = useMemo(() => {
    const candidates: { source: DiscountSource; amount: number; pct: number }[] = [];
    if (membershipBenefitAmt > 0) candidates.push({ source: "membership", amount: membershipBenefitAmt, pct: membershipDiscountPct });
    if (appliedPromo) candidates.push({ source: "promo", amount: promoDiscountAmt, pct: promoPct });
    if (appliedReward && rewardDiscountAmt > 0) candidates.push({ source: "reward", amount: rewardDiscountAmt, pct: rewardPct });
    if (!candidates.length) return { source: "none" as DiscountSource, amount: 0, pct: 0 };
    return candidates.reduce((best, c) => (c.amount > best.amount ? c : best), candidates[0]);
  }, [appliedPromo, appliedReward, membershipDiscountPct, membershipBenefitAmt, promoDiscountAmt, rewardDiscountAmt, promoPct, rewardPct]);

  // Notice shown when user-entered code interacts with the membership rate
  const discountNotice = useMemo(() => {
    const userApplied = !!appliedPromo || (!!appliedReward && rewardDiscountAmt > 0);
    if (!userApplied || membershipBenefitAmt <= 0) return null;
    const userCandidate = appliedPromo
      ? { amount: promoDiscountAmt, label: "Promo" }
      : { amount: rewardDiscountAmt, label: "Reward" };
    if (winningDiscount.source === "membership") {
      return `Your membership benefits are higher — membership rate applied instead.`;
    }
    if ((winningDiscount.source === "promo" || winningDiscount.source === "reward") && userCandidate.amount > membershipBenefitAmt) {
      return `${userCandidate.label} discount applied — better than your membership rate.`;
    }
    return null;
  }, [appliedPromo, appliedReward, rewardDiscountAmt, membershipBenefitAmt, promoDiscountAmt, winningDiscount]);

  const finalPrice = Math.max(0, originalPrice - winningDiscount.amount);

  // Amounts to send/show, derived from the winner only (no stacking)
  const discountAmount = winningDiscount.source === "promo" ? winningDiscount.amount : 0;
  const rewardDiscount = winningDiscount.source === "reward" ? winningDiscount.amount : 0;
  const membershipDiscount = winningDiscount.source === "membership" ? membershipDiscountAmt : 0;
  const appliedFreeMinutesCredit = winningDiscount.source === "membership" ? freeMinutesCredit : 0;
  const appliedFreeMinutesUsed = winningDiscount.source === "membership" ? freeMinutesApplied : 0;



  const durationError = useMemo(() => {
    if (!startDate || !endDate || endDate <= startDate) return null;
    return validateDuration(startDate, endDate);
  }, [startDate, endDate]);

  const selectedTableData = tables?.find((t) => t.id === selectedTable);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground dark">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  const kycVerified = !!user.kyc?.verified;

  const handleStartSingpass = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/myinfo/auth-url-public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.authorizeUrl) throw new Error(data.error || "Failed to start Singpass verification");
      window.location.href = data.authorizeUrl;
    } catch (err: any) {
      toast({ title: "Singpass error", description: err.message, variant: "destructive" });
    }
  };

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

  const handleApplyReward = async () => {
    const code = rewardCodeInput.trim().toUpperCase();
    if (!code) return;
    setValidatingReward(true);
    try {
      const result = await validateRewardCode(code);
      if (result.valid && result.reward) {
        const t = result.reward.type;
        if (t === "wallet_credit") {
          toast({
            title: "Cannot apply here",
            description: "This reward is a wallet credit — redeem it in My Rewards in Settings, not at checkout.",
            variant: "destructive",
          });
          return;
        }
        if (t !== "free_session" && t !== "booking_discount" && t !== "free_item") {
          toast({ title: "Cannot apply here", description: "This reward type can't be used at booking.", variant: "destructive" });
          return;
        }
        setAppliedReward(result.reward);

        const title =
          t === "free_session" ? "Free session applied!" :
          t === "booking_discount" ? `${result.reward.value}% discount applied!` :
          "Free item reward applied!";
        toast({ title, description: result.reward.description });
      } else {
        toast({ title: "Invalid reward", description: result.error || "Code not valid.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Invalid reward", description: err.message, variant: "destructive" });
    } finally {
      setValidatingReward(false);
    }
  };

  const handleRemoveReward = () => {
    setAppliedReward(null);
    setRewardCodeInput("");
  };

  const isFreeReward = !!appliedReward && finalPrice === 0;
  const canBook =
    startDate &&
    endDate &&
    endDate > startDate &&
    selectedTable &&
    (paymentMethod || isFreeReward) &&
    !durationError;

  const handleBookClick = () => {
    setAgreedToTerms(false);
    setShowConfirm(true);
  };

  const handleConfirmBook = async () => {
    if (!user || !selectedTable || !startDate || !endDate || !selectedTableData) return;
    if (!paymentMethod && !isFreeReward) return;
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
      // Backend handles all discount calculations server-side. Always send the
      // original (pre-discount) subtotal as both `amount` and `originalAmount`.
      const subtotal = Number(Number(originalPrice || 0).toFixed(2));
      const createRes = await apiFetch("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          tableId: selectedTableData.id,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          amount: subtotal,
          originalAmount: subtotal,
          // Only send the winning discount source. free_item rewards are
          // tracked for counter pickup even when they don't win on price.
          promoCode: winningDiscount.source === "promo" ? appliedPromo?.code || null : null,
          promoDiscount: winningDiscount.source === "promo" ? discountAmount : 0,
          rewardCode:
            winningDiscount.source === "reward" || appliedReward?.type === "free_item"
              ? appliedReward?.code || null
              : null,
          rewardDiscount: winningDiscount.source === "reward" ? rewardDiscount : 0,
          membershipDiscount: winningDiscount.source === "membership" ? membershipDiscount : 0,
          membershipDiscountPercent: winningDiscount.source === "membership" ? membershipDiscountPct : 0,
          freeMinutesCredit: appliedFreeMinutesCredit,
          freeMinutesApplied: appliedFreeMinutesUsed,
          membershipPlanId:
            winningDiscount.source === "membership"
              ? activeMembershipPlan?._id ?? activeMembershipPlan?.id ??
                (typeof activeMembership?.planId === "string" ? activeMembership.planId : null)
              : null,
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

      // Free reward — backend auto-confirms, no payment needed
      if (isFreeReward) {
        sessionStorage.removeItem("pending_booking_id");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["profile"] }),
          queryClient.invalidateQueries({ queryKey: ["my-bookings"] }),
          queryClient.invalidateQueries({ queryKey: ["tables-with-status"] }),
          queryClient.invalidateQueries({ queryKey: ["table-day-bookings"] }),
          queryClient.invalidateQueries({ queryKey: ["my-rewards"] }),
        ]);
        toast({ title: "Booking confirmed!", description: "Your free session has been booked." });
        navigate("/booking-confirmed");
        return;
      }

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

      <header className="relative z-10 border-b border-border/50 bg-card/80 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
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

      <main className="relative z-10 mx-auto max-w-4xl p-4 sm:p-6 space-y-4 sm:space-y-6">
        <WalkinSessionPanel />
        {!kycVerified && (
          <Card className="card-premium border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="pt-6 text-center space-y-3">
              <p className="text-yellow-400 font-semibold">Identity verification required</p>
              <p className="text-sm text-muted-foreground">Please verify your identity via singpass or with our staff before booking.</p>
              <Button onClick={handleStartSingpass} className="bg-[#E3002B] hover:bg-[#c20025] text-white">
                Verify with Singpass
              </Button>
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
                maintenanceWindows={tableMaintenance || []}
                operatingHours={operatingHours}
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

              {/* Reward Code */}
              <div className="space-y-2">
                {appliedReward ? (
                  <div className="flex items-center justify-between rounded-lg bg-accent/10 border border-accent/30 px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-accent" />
                      <span className="text-sm font-medium text-accent">{appliedReward.code}</span>
                      <span className="text-sm text-muted-foreground">
                        {appliedReward.type === "free_session" && `${rewardFreeHours}hr free applied`}
                        {appliedReward.type === "booking_discount" && `${rewardDiscountPercent}% off applied`}
                        {appliedReward.type === "free_item" && `Free item — collect at counter`}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleRemoveReward} className="text-xs h-7">
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Have a reward code?"
                      value={rewardCodeInput}
                      onChange={(e) => setRewardCodeInput(e.target.value.toUpperCase())}
                      className="flex-1 bg-background/50"
                    />
                    <Button
                      variant="outline"
                      onClick={handleApplyReward}
                      disabled={!rewardCodeInput.trim() || validatingReward}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>

              {/* Single winning discount line (promo / reward / membership) */}
              {winningDiscount.source === "promo" && discountAmount > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>Promo discount ({Math.round(promoPct)}% off)</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}

              {winningDiscount.source === "reward" && rewardDiscount > 0 && (
                <div className="flex justify-between text-sm text-accent">
                  <span>
                    {appliedReward?.type === "free_session"
                      ? `Free session reward (${rewardFreeHours}hr)`
                      : `Reward discount (${rewardDiscountPercent}% off)`}
                  </span>
                  <span>-${rewardDiscount.toFixed(2)}</span>
                </div>
              )}

              {winningDiscount.source === "membership" && appliedFreeMinutesCredit > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>Free {appliedFreeMinutesUsed} mins (membership benefit)</span>
                  <span>-${appliedFreeMinutesCredit.toFixed(2)}</span>
                </div>
              )}

              {winningDiscount.source === "membership" && membershipDiscount > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>{membershipPlanName} discount ({membershipDiscountPct}% off)</span>
                  <span>-${membershipDiscount.toFixed(2)}</span>
                </div>
              )}

              {discountNotice && (
                <p className="text-xs text-muted-foreground italic">{discountNotice}</p>
              )}

              {appliedReward?.type === "free_item" && (
                <div className="rounded-lg bg-accent/10 border border-accent/30 px-3 py-2 text-sm text-accent">
                  Free item reward applied — collect at counter
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
        {pricing && selectedTable && !durationError && startSlot && endSlot && !isFreeReward && (
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
            disabled={!canBook || isProcessing || !kycVerified}
            onClick={handleBookClick}
            className="gap-2 h-12 px-8 text-sm font-semibold tracking-wide uppercase bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isProcessing ? "Processing..." : isFreeReward ? "Reserve Table — FREE" : `Reserve Table — $${finalPrice.toFixed(2)}`}
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