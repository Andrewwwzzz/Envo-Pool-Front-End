
-- Update handle_new_user to store phone and date_of_birth from signup metadata
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
