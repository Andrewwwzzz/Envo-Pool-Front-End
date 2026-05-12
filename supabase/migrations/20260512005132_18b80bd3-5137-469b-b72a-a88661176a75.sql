
-- Revoke broad EXECUTE on SECURITY DEFINER functions, then grant only what users need.

-- Internal helpers / triggers — not callable from PostgREST.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_user_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_booking_sensitive_fields() FROM PUBLIC, anon, authenticated;

-- User-facing RPCs — only authenticated users.
REVOKE ALL ON FUNCTION public.update_own_profile(text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile(text, text, date) TO authenticated;

REVOKE ALL ON FUNCTION public.get_table_booked_slots(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_table_booked_slots(uuid, timestamptz, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_promo_code(text, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, numeric, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.create_booking_atomic(uuid, timestamptz, timestamptz, numeric, numeric, numeric, numeric, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_atomic(uuid, timestamptz, timestamptz, numeric, numeric, numeric, numeric, uuid, text) TO authenticated;
