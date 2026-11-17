-- ====================================================================
-- CEO Power Company — Automated Low-Stock Threshold & Alert System
-- Migration: 20240106000000_inventory_low_stock_alerts.sql
-- ====================================================================

-- 1. NUMERIC INVENTORY QUANTITY ON PRODUCTS
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity int NOT NULL DEFAULT 25;

-- Backfill realistic starting counts from existing stock_status
UPDATE public.products
SET stock_quantity = CASE
  WHEN stock_status = 'out_of_stock' THEN 0
  WHEN stock_status = 'low_stock' THEN 5
  ELSE GREATEST(stock_quantity, 25)
END
WHERE stock_quantity = 25 AND stock_status IN ('out_of_stock', 'low_stock');

-- 2. DEFAULT PORTAL-WIDE LOW-STOCK THRESHOLD SETTING
INSERT INTO public.settings (key, value)
VALUES ('low_stock_threshold', '10')
ON CONFLICT (key) DO NOTHING;

-- Allow Stock Officers (products.edit_stock) to customize low_stock_threshold in settings
DROP POLICY IF EXISTS "settings_low_stock_threshold_update" ON public.settings;
CREATE POLICY "settings_low_stock_threshold_update"
  ON public.settings FOR ALL
  TO authenticated
  USING (
    key = 'low_stock_threshold' AND public.has_permission('products.edit_stock')
  )
  WITH CHECK (
    key = 'low_stock_threshold' AND public.has_permission('products.edit_stock')
  );

-- 3. ADMIN NOTIFICATIONS TABLE FOR LOW-STOCK ALERTS
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('low_stock', 'out_of_stock')),
  title text NOT NULL,
  message text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  sku text,
  stock_quantity int,
  threshold int NOT NULL DEFAULT 10,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_notifications_select" ON public.admin_notifications;
CREATE POLICY "admin_notifications_select"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (
    public.has_permission('dashboard.view') OR public.has_permission('products.view')
  );

DROP POLICY IF EXISTS "admin_notifications_update" ON public.admin_notifications;
CREATE POLICY "admin_notifications_update"
  ON public.admin_notifications FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('dashboard.view') OR public.has_permission('products.edit_stock')
  )
  WITH CHECK (
    public.has_permission('dashboard.view') OR public.has_permission('products.edit_stock')
  );

-- 4. SYNC stock_status (BEFORE) & EMIT AUTOMATED LOW-STOCK NOTIFICATIONS (AFTER)
CREATE OR REPLACE FUNCTION public.handle_product_inventory_status_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold int := 10;
  v_raw_threshold text;
BEGIN
  SELECT value INTO v_raw_threshold
  FROM public.settings
  WHERE key = 'low_stock_threshold';

  IF v_raw_threshold ~ '^[0-9]+$' THEN
    v_threshold := GREATEST(1, v_raw_threshold::int);
  END IF;

  IF TG_OP = 'INSERT' OR NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
    IF COALESCE(NEW.stock_quantity, 0) <= 0 THEN
      NEW.stock_status := 'out_of_stock';
    ELSIF NEW.stock_quantity < v_threshold THEN
      NEW.stock_status := 'low_stock';
    ELSE
      NEW.stock_status := 'in_stock';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_product_inventory_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold int := 10;
  v_raw_threshold text;
  v_alert_type text;
BEGIN
  SELECT value INTO v_raw_threshold
  FROM public.settings
  WHERE key = 'low_stock_threshold';

  IF v_raw_threshold ~ '^[0-9]+$' THEN
    v_threshold := GREATEST(1, v_raw_threshold::int);
  END IF;

  -- Mark previous unread notifications for this product read once restocked above threshold
  IF NEW.stock_quantity >= v_threshold AND NEW.stock_status = 'in_stock' THEN
    UPDATE public.admin_notifications
    SET is_read = true
    WHERE product_id = NEW.id AND is_read = false;
    RETURN NEW;
  END IF;

  -- Emit notification when created below threshold or inventory drops below threshold
  IF (NEW.stock_quantity < v_threshold OR NEW.stock_status IN ('low_stock', 'out_of_stock'))
     AND (
       TG_OP = 'INSERT'
       OR NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity
       OR NEW.stock_status IS DISTINCT FROM OLD.stock_status
     )
  THEN
    v_alert_type := CASE WHEN COALESCE(NEW.stock_quantity, 0) <= 0 OR NEW.stock_status = 'out_of_stock' THEN 'out_of_stock' ELSE 'low_stock' END;

    INSERT INTO public.admin_notifications (
      type, title, message, product_id, product_name, sku, stock_quantity, threshold
    )
    VALUES (
      v_alert_type,
      CASE WHEN v_alert_type = 'out_of_stock' THEN 'Product Out of Stock' ELSE 'Low Stock Alert' END,
      NEW.name || ' has ' || COALESCE(NEW.stock_quantity, 0) || ' unit(s) remaining (threshold: ' || v_threshold || ').',
      NEW.id,
      NEW.name,
      NEW.sku,
      NEW.stock_quantity,
      v_threshold
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_inventory_status_sync ON public.products;
CREATE TRIGGER trg_products_inventory_status_sync
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_product_inventory_status_sync();

DROP TRIGGER IF EXISTS trg_products_inventory_threshold ON public.products;
CREATE TRIGGER trg_products_inventory_threshold
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_product_inventory_threshold();

-- 5. UPDATE COLUMN PERMISSION TRIGGER TO ALLOW products.edit_stock ON stock_quantity
CREATE OR REPLACE FUNCTION public.enforce_product_column_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NOT public.can_access_category(OLD.category_id) OR NOT public.can_access_category(NEW.category_id) THEN
    RAISE EXCEPTION 'You do not have access to this product category.';
  END IF;

  IF NEW.price IS DISTINCT FROM OLD.price AND NOT public.has_permission('products.edit_price') THEN
    RAISE EXCEPTION 'You do not have permission to change prices.';
  END IF;

  IF (NEW.stock_status IS DISTINCT FROM OLD.stock_status OR NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity)
     AND NOT public.has_permission('products.edit_stock') THEN
    RAISE EXCEPTION 'You do not have permission to change stock levels.';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT public.has_permission('products.toggle_visibility') THEN
    RAISE EXCEPTION 'You do not have permission to change product visibility.';
  END IF;

  IF NEW.images IS DISTINCT FROM OLD.images AND NOT public.has_permission('products.edit_images') THEN
    RAISE EXCEPTION 'You do not have permission to modify product images.';
  END IF;

  IF (
    NEW.category_id IS DISTINCT FROM OLD.category_id
    OR NEW.name IS DISTINCT FROM OLD.name
    OR NEW.slug IS DISTINCT FROM OLD.slug
    OR NEW.brand IS DISTINCT FROM OLD.brand
    OR NEW.sku IS DISTINCT FROM OLD.sku
    OR NEW.short_description IS DISTINCT FROM OLD.short_description
    OR NEW.specs IS DISTINCT FROM OLD.specs
    OR NEW.min_order_qty IS DISTINCT FROM OLD.min_order_qty
    OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
  ) AND NOT public.has_permission('products.edit') THEN
    RAISE EXCEPTION 'You do not have permission to edit product details.';
  END IF;

  RETURN NEW;
END;
$$;

-- 6. INCLUDE stock_quantity IN ADMIN RPCs (drop first to update return column list)
DROP FUNCTION IF EXISTS public.admin_list_products();
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
  stock_quantity int,
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
    p.stock_quantity,
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

DROP FUNCTION IF EXISTS public.admin_get_product(uuid);
CREATE OR REPLACE FUNCTION public.admin_get_product(p_id uuid)
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
  stock_quantity int,
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
    p.stock_quantity,
    p.images,
    p.is_active,
    p.is_featured,
    p.created_at,
    p.updated_at
  FROM public.products p
  WHERE p.id = p_id
    AND public.can_access_category(p.category_id);
END;
$$;
