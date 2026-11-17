-- ====================================================================
-- CEO Power Company — Brand Sub-Categories & Newest-First Product Sort
-- Migration: 20240105000000_brands_and_newest_sort.sql
-- ====================================================================

-- 1. BRANDS TABLE (Product Sub-Categories belonging to a Category)
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

-- Seed initial brands from existing products and standard catalog brands
INSERT INTO public.brands (category_id, name, slug, sort_order)
SELECT DISTINCT
  p.category_id,
  trim(p.brand),
  lower(regexp_replace(trim(p.brand), '[^a-zA-Z0-9]+', '-', 'g')),
  0
FROM public.products p
WHERE p.brand IS NOT NULL AND trim(p.brand) <> ''
ON CONFLICT (category_id, slug) DO NOTHING;

-- 2. RLS POLICIES FOR BRANDS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brands_auth_select" ON public.brands;
CREATE POLICY "brands_auth_select"
  ON public.brands FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "brands_staff_insert" ON public.brands;
CREATE POLICY "brands_staff_insert"
  ON public.brands FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.has_permission('categories.create_edit') OR public.has_permission('products.create'))
    AND public.can_access_category(category_id)
  );

DROP POLICY IF EXISTS "brands_staff_update" ON public.brands;
CREATE POLICY "brands_staff_update"
  ON public.brands FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('categories.create_edit')
    AND public.can_access_category(category_id)
  )
  WITH CHECK (
    public.has_permission('categories.create_edit')
    AND public.can_access_category(category_id)
  );

DROP POLICY IF EXISTS "brands_staff_delete" ON public.brands;
CREATE POLICY "brands_staff_delete"
  ON public.brands FOR DELETE
  TO authenticated
  USING (
    (public.has_permission('categories.delete') OR public.has_permission('categories.create_edit'))
    AND public.can_access_category(category_id)
  );

-- 3. ENSURE NEWEST CREATED PRODUCTS ALWAYS APPEAR FIRST IN ADMIN LIST
CREATE OR REPLACE FUNCTION public.admin_list_products()
RETURNS TABLE (
  id uuid,
  category_id uuid,
  name text,
  slug text,
  brand text,
  sku text,
  short_description text,
  specs jsonb,
  price numeric(12,2),
  min_order_qty int,
  stock_status text,
  images text[],
  is_active boolean,
  is_featured boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_view_prices boolean;
BEGIN
  IF NOT public.has_permission('products.view') THEN
    RAISE EXCEPTION 'You do not have permission to view products.';
  END IF;

  v_can_view_prices := public.has_permission('products.view_prices');

  RETURN QUERY
  SELECT
    p.id,
    p.category_id,
    p.name,
    p.slug,
    p.brand,
    p.sku,
    p.short_description,
    p.specs,
    CASE WHEN v_can_view_prices THEN p.price ELSE NULL::numeric(12,2) END AS price,
    p.min_order_qty,
    p.stock_status,
    p.images,
    p.is_active,
    p.is_featured,
    p.created_at,
    p.updated_at
  FROM public.products p
  WHERE public.can_access_category(p.category_id)
  ORDER BY p.created_at DESC;
END;
$$;
