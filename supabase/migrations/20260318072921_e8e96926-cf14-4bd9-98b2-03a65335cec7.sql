
-- 1. Make create_booking_atomic SECURITY DEFINER so it bypasses RLS
-- (it already validates auth.uid() internally)
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  p_table_id uuid,
  p_start_time timestamp with time zone,
  p_end_time timestamp with time zone,
  p_duration_hours numeric,
  p_original_price numeric,
  p_discount_amount numeric,
  p_final_price numeric,
  p_promo_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'wallet'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_booking_id uuid;
  v_wallet_balance numeric;
  v_new_balance numeric;
  v_conflict_count int;
  v_user_conflict_count int;
  v_reward_points numeric;
  v_new_reward_points numeric;
  v_total_spent numeric;
  v_earned_points int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT wallet_balance, reward_points, total_spent
    INTO v_wallet_balance, v_reward_points, v_total_spent
    FROM public.profiles
    WHERE user_id = v_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  IF p_payment_method = 'wallet' AND v_wallet_balance < p_final_price THEN
    RETURN jsonb_build_object('error', 'Insufficient wallet balance');
  END IF;

  PERFORM 1 FROM public.tables WHERE id = p_table_id FOR UPDATE;

  SELECT COUNT(*) INTO v_conflict_count
    FROM public.bookings
    WHERE table_id = p_table_id
      AND status IN ('pending', 'confirmed')
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND (status = 'confirmed' OR (created_at > now() - interval '5 minutes'));

  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object('error', 'This table is already booked or locked for that time slot.');
  END IF;

  SELECT COUNT(*) INTO v_user_conflict_count
    FROM public.bookings
    WHERE user_id = v_user_id
      AND status IN ('pending', 'confirmed')
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND (status = 'confirmed' OR (created_at > now() - interval '5 minutes'));

  IF v_user_conflict_count > 0 THEN
    RETURN jsonb_build_object('error', 'You already have a booking that overlaps this time.');
  END IF;

  INSERT INTO public.bookings (
    user_id, table_id, start_time, end_time, duration_hours,
    price, original_price, discount_amount, final_price,
    promo_id, payment_method, status
  ) VALUES (
    v_user_id, p_table_id, p_start_time, p_end_time, p_duration_hours,
    p_final_price, p_original_price, p_discount_amount, p_final_price,
    p_promo_id, p_payment_method,
    CASE WHEN p_payment_method = 'wallet' THEN 'confirmed' ELSE 'pending' END
  ) RETURNING id INTO v_booking_id;

  IF p_payment_method = 'wallet' THEN
    v_new_balance := v_wallet_balance - p_final_price;

    UPDATE public.profiles
      SET wallet_balance = v_new_balance,
          total_spent = total_spent + p_final_price
      WHERE user_id = v_user_id;

    INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, related_booking_id)
      VALUES (v_user_id, 'booking_payment', -p_final_price, v_new_balance, v_booking_id);

    v_earned_points := floor(p_final_price * 10);
    IF v_earned_points > 0 THEN
      UPDATE public.profiles
        SET reward_points = reward_points + v_earned_points
        WHERE user_id = v_user_id;

      INSERT INTO public.reward_transactions (user_id, type, points, related_booking_id)
        VALUES (v_user_id, 'earn', v_earned_points, v_booking_id);
    END IF;
  END IF;

  IF p_promo_id IS NOT NULL AND p_discount_amount > 0 THEN
    INSERT INTO public.promo_usage (promo_id, user_id, booking_id, discount_amount)
      VALUES (p_promo_id, v_user_id, v_booking_id, p_discount_amount);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'status', CASE WHEN p_payment_method = 'wallet' THEN 'confirmed' ELSE 'pending' END
  );
END;
$function$;

-- 2. Restrict INSERT: users can only insert pending bookings
DROP POLICY IF EXISTS "Users can insert own bookings" ON public.bookings;
CREATE POLICY "Users can insert own pending bookings"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- 3. Restrict UPDATE: users cannot change status directly
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
CREATE POLICY "Users can update own bookings no status change"
  ON public.bookings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status = status);
