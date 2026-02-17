
-- =============================================
-- 1. Fix existing RLS policies (RESTRICTIVE → PERMISSIVE)
-- =============================================

-- Fix bookings policies
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can insert own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;

CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all bookings" ON public.bookings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix profiles policies
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Fix reward_transactions policies
DROP POLICY IF EXISTS "Admins can manage reward transactions" ON public.reward_transactions;
DROP POLICY IF EXISTS "Users can insert own reward transactions" ON public.reward_transactions;
DROP POLICY IF EXISTS "Users can view own reward transactions" ON public.reward_transactions;

CREATE POLICY "Users can view own reward transactions" ON public.reward_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reward transactions" ON public.reward_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage reward transactions" ON public.reward_transactions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix wallet_transactions policies
DROP POLICY IF EXISTS "Admins can manage wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can insert own wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can view own wallet transactions" ON public.wallet_transactions;

CREATE POLICY "Users can view own wallet transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet transactions" ON public.wallet_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage wallet transactions" ON public.wallet_transactions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix tables policies
DROP POLICY IF EXISTS "Admins can manage tables" ON public.tables;
DROP POLICY IF EXISTS "Anyone authenticated can view tables" ON public.tables;

CREATE POLICY "Anyone authenticated can view tables" ON public.tables FOR SELECT USING (true);
CREATE POLICY "Admins can manage tables" ON public.tables FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix user_roles policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 2. Alter profiles table - add Singpass & age fields
-- =============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS singpass_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS singpass_id text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false;

-- =============================================
-- 3. Alter bookings table - add pricing/promo fields
-- =============================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS original_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_id uuid;

-- Drop old payment_method check if exists and recreate
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_method_check 
  CHECK (payment_method IS NULL OR payment_method IN ('wallet', 'stripe'));

-- =============================================
-- 4. Create pricing_rules table
-- =============================================
CREATE TABLE public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  hourly_rate numeric NOT NULL,
  applies_to_weekdays text[] NOT NULL DEFAULT '{"Mon","Tue","Wed","Thu","Fri","Sat","Sun"}',
  specific_date date,
  applies_to_table_id uuid REFERENCES public.tables(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active pricing" ON public.pricing_rules FOR SELECT USING (true);
CREATE POLICY "Admins can manage pricing rules" ON public.pricing_rules FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 5. Create promo_codes table
-- =============================================
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL,
  minimum_spend numeric,
  max_discount_amount numeric,
  usage_limit integer,
  per_user_limit integer,
  applies_to_table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  expiry_date timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active promos" ON public.promo_codes FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage promo codes" ON public.promo_codes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 6. Create promo_usage table
-- =============================================
CREATE TABLE public.promo_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  discount_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own promo usage" ON public.promo_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own promo usage" ON public.promo_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage promo usage" ON public.promo_usage FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Add foreign key for bookings.promo_id
ALTER TABLE public.bookings ADD CONSTRAINT bookings_promo_id_fkey 
  FOREIGN KEY (promo_id) REFERENCES public.promo_codes(id) ON DELETE SET NULL;

-- =============================================
-- 7. Create indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_table_id ON public.bookings(table_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON public.bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON public.pricing_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_usage_promo_id ON public.promo_usage(promo_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_user_id ON public.promo_usage(user_id);
