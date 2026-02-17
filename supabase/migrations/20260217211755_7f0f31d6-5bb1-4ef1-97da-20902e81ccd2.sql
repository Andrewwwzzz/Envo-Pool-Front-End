
CREATE TABLE public.terms_conditions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.terms_conditions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "Anyone can view terms" ON public.terms_conditions
FOR SELECT USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage terms" ON public.terms_conditions
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed with default content
INSERT INTO public.terms_conditions (content) VALUES (
'# Terms and Conditions

1. **No Cancellation After Payment** — Bookings cannot be cancelled once payment is confirmed.

2. **No Refunds** — All payments are final and non-refundable.

3. **Late Arrival Policy** — Tables will be released after 15 minutes of no-show.

4. **Management Rights** — Management reserves the right to modify or cancel bookings under special circumstances.

5. **Table Usage** — Tables must be used within the booked time slot. Overstaying may incur additional charges.

6. **Conduct** — All patrons are expected to maintain appropriate conduct. Management reserves the right to refuse service.
');
