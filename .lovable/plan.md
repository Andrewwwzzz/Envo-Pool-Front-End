

## Fix: Booking Check Constraint Violation

**Root Cause:** In `src/hooks/useBooking.ts` (line ~139), the booking insert sets `payment_method: "pending"`, which violates the `bookings_payment_method_check` constraint that only allows `NULL`, `'wallet'`, or `'stripe'`.

**Fix:** Change `payment_method: "pending"` to `payment_method: null` in the insert statement.

### Technical Details

**File:** `src/hooks/useBooking.ts`

Change on the insert object (around line 139):
- Before: `payment_method: "pending"`
- After: `payment_method: null`

This aligns with the updated constraint and the intended flow where payment method is set later during the payment step.

