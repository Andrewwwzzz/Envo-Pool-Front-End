
-- Fix 1: Enforce age verification server-side in handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  dob date;
  is_age_verified boolean := false;
BEGIN
  -- Parse date_of_birth if provided
  IF NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL THEN
    dob := (NEW.raw_user_meta_data->>'date_of_birth')::date;
    -- Verify age >= 16
    is_age_verified := (CURRENT_DATE - dob) / 365 >= 16;
    
    -- Reject underage users
    IF NOT is_age_verified THEN
      RAISE EXCEPTION 'You must be at least 16 years old to create an account.';
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, name, email, phone, date_of_birth, age_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    dob,
    is_age_verified
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$function$;

-- Fix 2: Create RPC to validate promo codes securely (no broad SELECT needed)
CREATE OR REPLACE FUNCTION public.validate_promo_code(
  p_code text,
  p_original_price numeric,
  p_table_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_promo record;
  v_user_id uuid;
  v_total_usage bigint;
  v_user_usage bigint;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE code = upper(trim(p_code))
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid promo code');
  END IF;

  -- Check expiry
  IF v_promo.expiry_date IS NOT NULL AND v_promo.expiry_date < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code has expired');
  END IF;

  -- Check table restriction
  IF v_promo.applies_to_table_id IS NOT NULL AND v_promo.applies_to_table_id != p_table_id THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This promo code is not valid for the selected table');
  END IF;

  -- Check minimum spend
  IF v_promo.minimum_spend IS NOT NULL AND p_original_price < v_promo.minimum_spend THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Minimum spend of $' || v_promo.minimum_spend || ' required');
  END IF;

  -- Check total usage limit
  IF v_promo.usage_limit IS NOT NULL THEN
    SELECT count(*) INTO v_total_usage FROM public.promo_usage WHERE promo_id = v_promo.id;
    IF v_total_usage >= v_promo.usage_limit THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Promo code usage limit reached');
    END IF;
  END IF;

  -- Check per-user usage limit
  IF v_promo.per_user_limit IS NOT NULL THEN
    SELECT count(*) INTO v_user_usage FROM public.promo_usage WHERE promo_id = v_promo.id AND user_id = v_user_id;
    IF v_user_usage >= v_promo.per_user_limit THEN
      RETURN jsonb_build_object('valid', false, 'error', 'You have already used this promo code the maximum number of times');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'promo', jsonb_build_object(
      'id', v_promo.id,
      'code', v_promo.code,
      'discount_type', v_promo.discount_type,
      'discount_value', v_promo.discount_value,
      'max_discount_amount', v_promo.max_discount_amount,
      'minimum_spend', v_promo.minimum_spend,
      'applies_to_table_id', v_promo.applies_to_table_id
    )
  );
END;
$$;

-- Remove broad SELECT policy on promo_codes (users no longer need direct access)
DROP POLICY IF EXISTS "Anyone authenticated can view active promos" ON public.promo_codes;
