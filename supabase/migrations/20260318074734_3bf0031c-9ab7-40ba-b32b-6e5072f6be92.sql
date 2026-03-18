
-- 1. Drop the permissive user UPDATE policy on profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2. Create a SECURITY DEFINER RPC that only allows updating safe columns
CREATE OR REPLACE FUNCTION public.update_own_profile(p_name text, p_phone text, p_dob date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET name = p_name,
      phone = p_phone,
      date_of_birth = COALESCE(p_dob, date_of_birth)
  WHERE user_id = auth.uid();
END;
$$;
