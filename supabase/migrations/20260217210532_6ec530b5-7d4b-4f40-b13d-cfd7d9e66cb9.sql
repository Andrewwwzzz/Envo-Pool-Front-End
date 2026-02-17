CREATE POLICY "Users can delete own pending bookings"
ON public.bookings
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');