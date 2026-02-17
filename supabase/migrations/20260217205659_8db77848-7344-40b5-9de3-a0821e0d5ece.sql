-- Update wallet_transactions FK to cascade on booking delete
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT wallet_transactions_related_booking_id_fkey;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_related_booking_id_fkey
  FOREIGN KEY (related_booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

-- Update reward_transactions FK to cascade on booking delete
ALTER TABLE public.reward_transactions
  DROP CONSTRAINT reward_transactions_related_booking_id_fkey;

ALTER TABLE public.reward_transactions
  ADD CONSTRAINT reward_transactions_related_booking_id_fkey
  FOREIGN KEY (related_booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;