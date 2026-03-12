
CREATE OR REPLACE FUNCTION public.get_table_booked_slots(
  p_table_id uuid,
  p_day_start timestamptz,
  p_day_end timestamptz
)
RETURNS TABLE(start_time timestamptz, end_time timestamptz, status text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.start_time, b.end_time, b.status, b.created_at
  FROM public.bookings b
  WHERE b.table_id = p_table_id
    AND b.status IN ('pending', 'confirmed')
    AND b.start_time < p_day_end
    AND b.end_time > p_day_start;
$$;
