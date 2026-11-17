-- ====================================================================
-- CEO Power Company — Reseller Portal Database Schema & RLS Policies
-- ====================================================================

-- 1. Helper function to check if current authenticated user is an active admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper function to check if current user is an active reseller
CREATE OR REPLACE FUNCTION public.is_active_reseller()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'reseller'
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'reseller')),
  username text UNIQUE NOT NULL,
  email text UNIQUE,
  full_name text,
  business_name text,
  phone text,
  state text,
  city text,
  status text NOT NULL CHECK (status IN ('active', 'suspended')) DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helper RPC to resolve either username or email to the account's auth email
CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_clean text := lower(trim(p_identifier));
  v_auth_email text;
BEGIN
  IF v_clean IS NULL OR v_clean = '' THEN
    RETURN NULL;
  END IF;

  SELECT au.email
    INTO v_auth_email
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE lower(p.username) = v_clean
     OR (p.email IS NOT NULL AND lower(p.email) = v_clean)
     OR lower(au.email) = v_clean
  LIMIT 1;

  IF v_auth_email IS NOT NULL THEN
    RETURN v_auth_email;
  END IF;

  IF position('@' IN v_clean) > 0 THEN
    RETURN v_clean;
  END IF;

  RETURN v_clean || '@portal.ceopower.local';
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

-- 4. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  brand text,
  sku text,
  short_description text,
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  min_order_qty int NOT NULL DEFAULT 1 CHECK (min_order_qty >= 1),
  stock_status text NOT NULL CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock')) DEFAULT 'in_stock',
  images text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for auto-updating updated_at on products
CREATE OR REPLACE FUNCTION public.update_products_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_products_updated_at ON public.products;
CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_products_updated_at();

-- 6. ORDER SEQUENCE & ORDER REQUESTS TABLE
CREATE SEQUENCE IF NOT EXISTS public.order_ref_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.generate_order_ref()
RETURNS text AS $$
DECLARE
  current_yymm text;
  seq_val bigint;
  formatted_ref text;
BEGIN
  current_yymm := to_char(now(), 'YYMM');
  seq_val := nextval('public.order_ref_seq');
  formatted_ref := 'CEO-' || current_yymm || '-' || lpad(seq_val::text, 4, '0');
  RETURN formatted_ref;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.order_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text UNIQUE NOT NULL DEFAULT public.generate_order_ref(),
  reseller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  items jsonb NOT NULL,
  total numeric(14,2) NOT NULL CHECK (total >= 0),
  note text,
  status text NOT NULL CHECK (status IN ('new', 'confirmed', 'fulfilled', 'cancelled')) DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- 8. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 9. RLS POLICIES FOR PROFILES
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_admin_select_all" ON public.profiles;
CREATE POLICY "profiles_admin_select_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Edge Function / Service role handles insert and delete on profiles

-- 10. RLS POLICIES FOR CATEGORIES
DROP POLICY IF EXISTS "categories_reseller_select" ON public.categories;
CREATE POLICY "categories_reseller_select"
  ON public.categories FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND public.is_active_reseller()
  );

DROP POLICY IF EXISTS "categories_admin_all" ON public.categories;
CREATE POLICY "categories_admin_all"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 11. RLS POLICIES FOR PRODUCTS
DROP POLICY IF EXISTS "products_reseller_select" ON public.products;
CREATE POLICY "products_reseller_select"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND public.is_active_reseller()
  );

DROP POLICY IF EXISTS "products_admin_all" ON public.products;
CREATE POLICY "products_admin_all"
  ON public.products FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 12. RLS POLICIES FOR ORDER REQUESTS
DROP POLICY IF EXISTS "orders_reseller_insert" ON public.order_requests;
CREATE POLICY "orders_reseller_insert"
  ON public.order_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    reseller_id = auth.uid() 
    AND public.is_active_reseller()
  );

DROP POLICY IF EXISTS "orders_reseller_select" ON public.order_requests;
CREATE POLICY "orders_reseller_select"
  ON public.order_requests FOR SELECT
  TO authenticated
  USING (
    reseller_id = auth.uid() 
    AND public.is_active_reseller()
  );

DROP POLICY IF EXISTS "orders_admin_all" ON public.order_requests;
CREATE POLICY "orders_admin_all"
  ON public.order_requests FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 13. RLS POLICIES FOR SETTINGS
DROP POLICY IF EXISTS "settings_auth_select" ON public.settings;
CREATE POLICY "settings_auth_select"
  ON public.settings FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR public.is_active_reseller()
  );

DROP POLICY IF EXISTS "settings_admin_update" ON public.settings;
CREATE POLICY "settings_admin_update"
  ON public.settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 14. STORAGE BUCKET: "product-images"
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for product images
DROP POLICY IF EXISTS "storage_public_read" ON storage.objects;
CREATE POLICY "storage_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

-- Admin write access for product images
DROP POLICY IF EXISTS "storage_admin_insert" ON storage.objects;
CREATE POLICY "storage_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "storage_admin_update" ON storage.objects;
CREATE POLICY "storage_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "storage_admin_delete" ON storage.objects;
CREATE POLICY "storage_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());
