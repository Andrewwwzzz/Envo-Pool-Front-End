
REVOKE EXECUTE ON FUNCTION public.update_own_profile(text, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_booking_atomic(uuid, timestamptz, timestamptz, numeric, numeric, numeric, numeric, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_table_booked_slots(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_own_profile(text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_atomic(uuid, timestamptz, timestamptz, numeric, numeric, numeric, numeric, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_booked_slots(uuid, timestamptz, timestamptz) TO authenticated;
