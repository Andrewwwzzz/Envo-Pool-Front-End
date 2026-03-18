
-- 1. Fix booking UPDATE policy: use a trigger to block status changes by non-admins
DROP POLICY IF EXISTS "Users can update own bookings no status change" ON public.bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;

-- Users can update their own bookings but NOT the status field
-- We use a trigger approach since RLS WITH CHECK can't reference OLD values
CREATE POLICY "Users can update own bookings"
  ON public.bookings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger to prevent non-admin users from changing booking status
CREATE OR REPLACE FUNCTION public.prevent_user_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If status is being changed, only allow admins
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'You are not allowed to change booking status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_booking_status_change ON public.bookings;
CREATE TRIGGER check_booking_status_change
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_status_change();

-- 2. Remove user INSERT on wallet_transactions (only server-side functions should insert)
DROP POLICY IF EXISTS "Users can insert own wallet transactions" ON public.wallet_transactions;

-- 3. Remove user INSERT on reward_transactions (only server-side functions should insert)
DROP POLICY IF EXISTS "Users can insert own reward transactions" ON public.reward_transactions;
