
-- Drop restrictive admin policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins can manage reward transactions" ON public.reward_transactions;

-- Recreate as PERMISSIVE so admins can insert for any user
CREATE POLICY "Admins can manage wallet transactions"
ON public.wallet_transactions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage reward transactions"
ON public.reward_transactions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
