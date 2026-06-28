

# Mutual Exclusivity: Maintenance and Bookings

## What Changes

### Admin Panel (`src/pages/Admin.tsx`)
- **Remove the `disabled={hasActiveBooking}` restriction** on the maintenance toggle button (line 313), so admins can always toggle maintenance on or off regardless of active bookings.

### Booking Page (already handled)
- The booking system already marks tables with `status === "maintenance"` as unavailable, so no new bookings can be placed on a table in maintenance mode. No changes needed here.

## Behavior After Fix

| Scenario | Result |
|----------|--------|
| Table has active booking | Admin CAN still set maintenance on/off |
| Table is in maintenance | Customers CANNOT book it |
| Admin removes maintenance | Table becomes available for booking again |
| Table in maintenance | Admin CANNOT open timer (already blocked) |

## Technical Detail

**`src/pages/Admin.tsx` (line 313):**
Change the maintenance button from:
```typescript
disabled={hasActiveBooking}
```
to:
```typescript
disabled={false}
```
(or simply remove the `disabled` prop)

This is a single-line change. No database or booking logic changes required.

