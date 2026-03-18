
-- Protect sensitive profile fields from non-admin modification
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.wallet_balance := OLD.wallet_balance;
    NEW.reward_points  := OLD.reward_points;
    NEW.total_spent    := OLD.total_spent;
    NEW.age_verified   := OLD.age_verified;
    NEW.singpass_verified := OLD.singpass_verified;
    NEW.singpass_id    := OLD.singpass_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();
