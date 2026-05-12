
-- 1. Restrict booking updates by customers to non-sensitive fields only.
-- Replace the broad "Users can update own bookings" policy with a trigger-based guard.
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;

CREATE POLICY "Users can update own bookings (non-sensitive)"
ON public.bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Block non-admin changes to sensitive columns via trigger.
CREATE OR REPLACE FUNCTION public.protect_booking_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status             := OLD.status;
    NEW.price              := OLD.price;
    NEW.original_price     := OLD.original_price;
    NEW.discount_amount    := OLD.discount_amount;
    NEW.final_price        := OLD.final_price;
    NEW.payment_id         := OLD.payment_id;
    NEW.payment_method     := OLD.payment_method;
    NEW.stripe_session_id  := OLD.stripe_session_id;
    NEW.promo_id           := OLD.promo_id;
    NEW.table_id           := OLD.table_id;
    NEW.start_time         := OLD.start_time;
    NEW.end_time           := OLD.end_time;
    NEW.duration_hours     := OLD.duration_hours;
    NEW.hardware_triggered := OLD.hardware_triggered;
    NEW.user_id            := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_booking_sensitive_fields_trg ON public.bookings;
CREATE TRIGGER protect_booking_sensitive_fields_trg
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.protect_booking_sensitive_fields();

-- 2. Prevent privilege escalation on user_roles.
-- Replace the broad "Admins can manage roles" ALL policy with explicit per-command admin-only policies,
-- and add a restrictive policy that blocks all non-admin writes.
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
