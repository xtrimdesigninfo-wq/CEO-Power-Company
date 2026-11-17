-- ====================================================================
-- CEO Power Company — Granular Staff Admin Permissions & Activity Log
-- Migration: 20240103000000_staff_permissions_and_activity.sql
-- ====================================================================

-- 1. UPDATE PROFILES TABLE (allow 'staff', add assigned_staff_id & last_sign_in_at)
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname
    INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'staff', 'reseller'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_assigned_staff_id ON public.profiles(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);

-- 2. VALID PERMISSION KEYS LOOKUP TABLE & VALIDATOR
CREATE TABLE IF NOT EXISTS public.permission_keys (
  key text PRIMARY KEY,
  group_name text NOT NULL,
  label text NOT NULL
);

INSERT INTO public.permission_keys (key, group_name, label) VALUES
  ('dashboard.view', 'Dashboard', 'View dashboard overview'),
  ('products.view', 'Products', 'View product catalogue'),
  ('products.view_prices', 'Products', 'View trade prices'),
  ('products.create', 'Products', 'Create new products'),
  ('products.edit', 'Products', 'Edit product details & specs'),
  ('products.edit_images', 'Products', 'Upload & change product images'),
  ('products.edit_price', 'Products', 'Edit product trade prices'),
  ('products.edit_stock', 'Products', 'Edit stock status'),
  ('products.toggle_visibility', 'Products', 'Show / hide products'),
  ('products.bulk_edit', 'Products', 'Use bulk actions'),
  ('products.delete', 'Products', 'Delete products'),
  ('categories.view', 'Categories', 'View categories'),
  ('categories.create_edit', 'Categories', 'Create & edit categories'),
  ('categories.reorder', 'Categories', 'Reorder categories'),
  ('categories.toggle_visibility', 'Categories', 'Show / hide categories'),
  ('categories.delete', 'Categories', 'Delete categories'),
  ('resellers.view', 'Resellers', 'View resellers directory'),
  ('resellers.create', 'Resellers', 'Create reseller accounts'),
  ('resellers.edit', 'Resellers', 'Edit reseller details'),
  ('resellers.reset_password', 'Resellers', 'Reset reseller passwords'),
  ('resellers.suspend', 'Resellers', 'Suspend / reactivate resellers'),
  ('resellers.delete', 'Resellers', 'Delete reseller accounts'),
  ('orders.view', 'Orders', 'View order requests'),
  ('orders.update_status', 'Orders', 'Update order fulfillment status'),
  ('orders.export', 'Orders', 'Export orders to CSV'),
  ('settings.view', 'Settings', 'View portal & company settings'),
  ('settings.edit', 'Settings', 'Edit portal & company settings')
ON CONFLICT (key) DO UPDATE SET
  group_name = EXCLUDED.group_name,
  label = EXCLUDED.label;

CREATE OR REPLACE FUNCTION public.are_valid_permissions(p_perms text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_perms, '{}'::text[])) AS perm
    WHERE NOT EXISTS (
      SELECT 1 FROM public.permission_keys pk WHERE pk.key = perm
    )
  );
$$;

-- 3. STAFF PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.staff_permissions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  permissions text[] NOT NULL DEFAULT '{}' CHECK (public.are_valid_permissions(permissions)),
  category_scope uuid[] NULL,
  reseller_scope text NOT NULL DEFAULT 'all' CHECK (reseller_scope IN ('all', 'assigned')),
  preset text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 4. ADMIN ACTIVITY LOG TABLE
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON public.admin_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.admin_activity_log(entity);

-- 5. SECURITY DEFINER STABLE PERMISSION HELPERS
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
$$;

-- Keep is_admin() aligned to Super Admin for backward compatibility
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin();
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'staff'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.staff_permissions sp ON sp.user_id = p.id
      WHERE p.id = auth.uid()
        AND p.role = 'staff'
        AND p.status = 'active'
        AND perm = ANY(sp.permissions)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_category(cat uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.staff_permissions sp ON sp.user_id = p.id
      WHERE p.id = auth.uid()
        AND p.role = 'staff'
        AND p.status = 'active'
        AND (
          sp.category_scope IS NULL
          OR (cat IS NOT NULL AND cat = ANY(sp.category_scope))
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_reseller(reseller uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.staff_permissions sp ON sp.user_id = p.id
      WHERE p.id = auth.uid()
        AND p.role = 'staff'
        AND p.status = 'active'
        AND (
          sp.reseller_scope = 'all'
          OR EXISTS (
            SELECT 1
            FROM public.profiles r
            WHERE r.id = reseller
              AND r.role = 'reseller'
              AND r.assigned_staff_id = auth.uid()
          )
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_category(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_reseller(uuid) TO authenticated;

-- Helper RPC for admin/staff login timestamp tracking
CREATE OR REPLACE FUNCTION public.record_my_sign_in()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET last_sign_in_at = now()
  WHERE id = auth.uid()
    AND role IN ('admin', 'staff')
    AND status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_my_sign_in() TO authenticated;

-- 6. PRICE-HIDING RPCS FOR ADMIN/STAFF PRODUCT ACCESS
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
  WHERE p.id = p_id
    AND public.can_access_category(p.category_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_products() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_product(uuid) TO authenticated;

-- 7. COLUMN-LEVEL CONTROL TRIGGERS
CREATE OR REPLACE FUNCTION public.enforce_product_column_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow server/service role (auth.uid() IS NULL) and Super Admin
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.price IS DISTINCT FROM OLD.price AND NOT public.has_permission('products.edit_price') THEN
    RAISE EXCEPTION 'You do not have permission to change prices.';
  END IF;

  IF NEW.stock_status IS DISTINCT FROM OLD.stock_status AND NOT public.has_permission('products.edit_stock') THEN
    RAISE EXCEPTION 'You do not have permission to change stock status.';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT public.has_permission('products.toggle_visibility') THEN
    RAISE EXCEPTION 'You do not have permission to change product visibility.';
  END IF;

  IF NEW.images IS DISTINCT FROM OLD.images AND NOT public.has_permission('products.edit_images') THEN
    RAISE EXCEPTION 'You do not have permission to change product images.';
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

  IF NEW.category_id IS DISTINCT FROM OLD.category_id AND NOT public.can_access_category(NEW.category_id) THEN
    RAISE EXCEPTION 'You do not have access to the target category.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_product_column_permissions ON public.products;
CREATE TRIGGER trigger_enforce_product_column_permissions
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_product_column_permissions();

CREATE OR REPLACE FUNCTION public.enforce_category_column_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.sort_order IS DISTINCT FROM OLD.sort_order AND NOT public.has_permission('categories.reorder') THEN
    RAISE EXCEPTION 'You do not have permission to reorder categories.';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT public.has_permission('categories.toggle_visibility') THEN
    RAISE EXCEPTION 'You do not have permission to change category visibility.';
  END IF;

  IF (
    NEW.name IS DISTINCT FROM OLD.name
    OR NEW.slug IS DISTINCT FROM OLD.slug
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.image_url IS DISTINCT FROM OLD.image_url
  ) AND NOT public.has_permission('categories.create_edit') THEN
    RAISE EXCEPTION 'You do not have permission to edit category details.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_category_column_permissions ON public.categories;
CREATE TRIGGER trigger_enforce_category_column_permissions
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_category_column_permissions();

CREATE OR REPLACE FUNCTION public.enforce_order_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NOT public.has_permission('orders.update_status') THEN
    RAISE EXCEPTION 'You do not have permission to update order status.';
  END IF;

  IF (
    NEW.ref IS DISTINCT FROM OLD.ref
    OR NEW.reseller_id IS DISTINCT FROM OLD.reseller_id
    OR NEW.items IS DISTINCT FROM OLD.items
    OR NEW.total IS DISTINCT FROM OLD.total
    OR NEW.note IS DISTINCT FROM OLD.note
  ) THEN
    RAISE EXCEPTION 'Only order fulfillment status may be updated.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_order_update_permissions ON public.order_requests;
CREATE TRIGGER trigger_enforce_order_update_permissions
  BEFORE UPDATE ON public.order_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_update_permissions();

-- 8. AUTOMATIC AUDIT TRIGGERS FOR ADMIN ACTIVITY LOG
CREATE OR REPLACE FUNCTION public.log_admin_table_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_entity text := TG_TABLE_NAME;
  v_action text;
  v_entity_id text;
  v_details jsonb := '{}'::jsonb;
BEGIN
  -- Skip logging reseller order creation (resellers placing storefront orders)
  IF v_entity = 'order_requests' AND TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Record only when triggered by an authenticated admin/staff session
  IF v_actor IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_actor AND role IN ('admin', 'staff')
  ) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF v_entity = 'products' THEN
    IF TG_OP = 'INSERT' THEN
      v_action := 'product.create';
      v_entity_id := NEW.id::text;
      v_details := jsonb_build_object(
        'name', NEW.name,
        'sku', NEW.sku,
        'after', jsonb_build_object('price', NEW.price, 'stock_status', NEW.stock_status, 'is_active', NEW.is_active)
      );
    ELSIF TG_OP = 'UPDATE' THEN
      v_action := 'product.update';
      v_entity_id := NEW.id::text;
      v_details := jsonb_build_object(
        'name', NEW.name,
        'before', jsonb_build_object('price', OLD.price, 'stock_status', OLD.stock_status, 'is_active', OLD.is_active),
        'after', jsonb_build_object('price', NEW.price, 'stock_status', NEW.stock_status, 'is_active', NEW.is_active)
      );
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'product.delete';
      v_entity_id := OLD.id::text;
      v_details := jsonb_build_object(
        'name', OLD.name,
        'before', jsonb_build_object('price', OLD.price, 'stock_status', OLD.stock_status)
      );
    END IF;
  ELSIF v_entity = 'categories' THEN
    v_entity_id := COALESCE(NEW.id, OLD.id)::text;
    v_action := 'category.' || lower(TG_OP);
    v_details := jsonb_build_object(
      'name', COALESCE(NEW.name, OLD.name),
      'before', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN jsonb_build_object('name', OLD.name, 'sort_order', OLD.sort_order, 'is_active', OLD.is_active) ELSE NULL END,
      'after', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN jsonb_build_object('name', NEW.name, 'sort_order', NEW.sort_order, 'is_active', NEW.is_active) ELSE NULL END
    );
  ELSIF v_entity = 'order_requests' AND TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id::text;
    v_action := 'order.update_status';
    v_details := jsonb_build_object(
      'ref', NEW.ref,
      'before', jsonb_build_object('status', OLD.status),
      'after', jsonb_build_object('status', NEW.status)
    );
  ELSIF v_entity = 'settings' THEN
    v_entity_id := COALESCE(NEW.key, OLD.key);
    v_action := 'settings.update';
    v_details := jsonb_build_object(
      'key', v_entity_id,
      'before', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN jsonb_build_object('value', OLD.value) ELSE NULL END,
      'after', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN jsonb_build_object('value', NEW.value) ELSE NULL END
    );
  END IF;

  IF v_action IS NOT NULL THEN
    INSERT INTO public.admin_activity_log (actor_id, action, entity, entity_id, details)
    VALUES (v_actor, v_action, v_entity, v_entity_id, v_details);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_products ON public.products;
CREATE TRIGGER trigger_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_table_activity();

DROP TRIGGER IF EXISTS trigger_audit_categories ON public.categories;
CREATE TRIGGER trigger_audit_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_table_activity();

DROP TRIGGER IF EXISTS trigger_audit_orders ON public.order_requests;
CREATE TRIGGER trigger_audit_orders
  AFTER UPDATE ON public.order_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_table_activity();

DROP TRIGGER IF EXISTS trigger_audit_settings ON public.settings;
CREATE TRIGGER trigger_audit_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_table_activity();

-- 9. ENABLE RLS ON NEW TABLES
ALTER TABLE public.permission_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permission_keys_auth_select" ON public.permission_keys;
CREATE POLICY "permission_keys_auth_select"
  ON public.permission_keys FOR SELECT
  TO authenticated
  USING (public.is_super_admin() OR public.is_active_staff());

DROP POLICY IF EXISTS "staff_permissions_own_select" ON public.staff_permissions;
CREATE POLICY "staff_permissions_own_select"
  ON public.staff_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "staff_permissions_super_admin_all" ON public.staff_permissions;
CREATE POLICY "staff_permissions_super_admin_all"
  ON public.staff_permissions FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "activity_log_super_admin_select" ON public.admin_activity_log;
CREATE POLICY "activity_log_super_admin_select"
  ON public.admin_activity_log FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "activity_log_super_admin_insert" ON public.admin_activity_log;
CREATE POLICY "activity_log_super_admin_insert"
  ON public.admin_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

-- 10. REPLACE ADMIN-ONLY RLS POLICIES WITH GRANULAR PERMISSION POLICIES

-- PROFILES (writes go strictly through Edge Function; staff sees only allowed resellers)
DROP POLICY IF EXISTS "profiles_admin_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_staff_reseller_select" ON public.profiles;

CREATE POLICY "profiles_super_admin_select_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "profiles_staff_reseller_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    role = 'reseller'
    AND public.has_permission('resellers.view')
    AND public.can_access_reseller(id)
  );

-- CATEGORIES
DROP POLICY IF EXISTS "categories_admin_all" ON public.categories;
DROP POLICY IF EXISTS "categories_staff_select" ON public.categories;
DROP POLICY IF EXISTS "categories_staff_insert" ON public.categories;
DROP POLICY IF EXISTS "categories_staff_update" ON public.categories;
DROP POLICY IF EXISTS "categories_staff_delete" ON public.categories;

CREATE POLICY "categories_staff_select"
  ON public.categories FOR SELECT
  TO authenticated
  USING (
    (
      public.has_permission('categories.view')
      OR public.has_permission('products.view')
      OR public.has_permission('products.create')
    )
    AND public.can_access_category(id)
  );

CREATE POLICY "categories_staff_insert"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('categories.create_edit')
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.staff_permissions sp
        WHERE sp.user_id = auth.uid() AND sp.category_scope IS NULL
      )
    )
  );

CREATE POLICY "categories_staff_update"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (
    (
      public.has_permission('categories.create_edit')
      OR public.has_permission('categories.reorder')
      OR public.has_permission('categories.toggle_visibility')
    )
    AND public.can_access_category(id)
  )
  WITH CHECK (
    (
      public.has_permission('categories.create_edit')
      OR public.has_permission('categories.reorder')
      OR public.has_permission('categories.toggle_visibility')
    )
    AND public.can_access_category(id)
  );

CREATE POLICY "categories_staff_delete"
  ON public.categories FOR DELETE
  TO authenticated
  USING (
    public.has_permission('categories.delete')
    AND public.can_access_category(id)
  );

-- PRODUCTS (direct REST select requires products.view_prices; staff without it must use admin_list_products/admin_get_product)
DROP POLICY IF EXISTS "products_admin_all" ON public.products;
DROP POLICY IF EXISTS "products_staff_select" ON public.products;
DROP POLICY IF EXISTS "products_staff_insert" ON public.products;
DROP POLICY IF EXISTS "products_staff_update" ON public.products;
DROP POLICY IF EXISTS "products_staff_delete" ON public.products;

CREATE POLICY "products_staff_select"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    public.has_permission('products.view')
    AND public.has_permission('products.view_prices')
    AND public.can_access_category(category_id)
  );

CREATE POLICY "products_staff_insert"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('products.create')
    AND public.can_access_category(category_id)
  );

CREATE POLICY "products_staff_update"
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    (
      public.has_permission('products.edit')
      OR public.has_permission('products.edit_images')
      OR public.has_permission('products.edit_price')
      OR public.has_permission('products.edit_stock')
      OR public.has_permission('products.toggle_visibility')
      OR public.has_permission('products.bulk_edit')
    )
    AND public.can_access_category(category_id)
  )
  WITH CHECK (
    (
      public.has_permission('products.edit')
      OR public.has_permission('products.edit_images')
      OR public.has_permission('products.edit_price')
      OR public.has_permission('products.edit_stock')
      OR public.has_permission('products.toggle_visibility')
      OR public.has_permission('products.bulk_edit')
    )
    AND public.can_access_category(category_id)
  );

CREATE POLICY "products_staff_delete"
  ON public.products FOR DELETE
  TO authenticated
  USING (
    public.has_permission('products.delete')
    AND public.can_access_category(category_id)
  );

-- ORDER REQUESTS
DROP POLICY IF EXISTS "orders_admin_all" ON public.order_requests;
DROP POLICY IF EXISTS "orders_staff_select" ON public.order_requests;
DROP POLICY IF EXISTS "orders_staff_update" ON public.order_requests;

CREATE POLICY "orders_staff_select"
  ON public.order_requests FOR SELECT
  TO authenticated
  USING (
    public.has_permission('orders.view')
    AND public.can_access_reseller(reseller_id)
  );

CREATE POLICY "orders_staff_update"
  ON public.order_requests FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('orders.update_status')
    AND public.can_access_reseller(reseller_id)
  )
  WITH CHECK (
    public.has_permission('orders.update_status')
    AND public.can_access_reseller(reseller_id)
  );

-- SETTINGS
DROP POLICY IF EXISTS "settings_auth_select" ON public.settings;
DROP POLICY IF EXISTS "settings_admin_update" ON public.settings;
DROP POLICY IF EXISTS "settings_staff_select" ON public.settings;
DROP POLICY IF EXISTS "settings_staff_insert" ON public.settings;
DROP POLICY IF EXISTS "settings_staff_update" ON public.settings;
DROP POLICY IF EXISTS "settings_staff_delete" ON public.settings;

CREATE POLICY "settings_public_select"
  ON public.settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "settings_staff_insert"
  ON public.settings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('settings.edit')
    AND (key <> 'whatsapp_number' OR public.is_super_admin())
  );

CREATE POLICY "settings_staff_update"
  ON public.settings FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('settings.edit')
    AND (key <> 'whatsapp_number' OR public.is_super_admin())
  )
  WITH CHECK (
    public.has_permission('settings.edit')
    AND (key <> 'whatsapp_number' OR public.is_super_admin())
  );

CREATE POLICY "settings_staff_delete"
  ON public.settings FOR DELETE
  TO authenticated
  USING (
    public.has_permission('settings.edit')
    AND (key <> 'whatsapp_number' OR public.is_super_admin())
  );

CREATE OR REPLACE FUNCTION public.enforce_master_admin_whatsapp_setting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF COALESCE(NEW.key, OLD.key) = 'whatsapp_number' THEN
    RAISE EXCEPTION 'Only the Master Admin can change the WhatsApp order number.';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_master_admin_whatsapp ON public.settings;
CREATE TRIGGER trigger_enforce_master_admin_whatsapp
  BEFORE INSERT OR UPDATE OR DELETE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_master_admin_whatsapp_setting();

-- STORAGE BUCKET: "product-images"
DROP POLICY IF EXISTS "storage_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_admin_delete" ON storage.objects;

CREATE POLICY "storage_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      public.has_permission('products.edit_images')
      OR public.has_permission('products.create')
      OR public.has_permission('categories.create_edit')
    )
  );

CREATE POLICY "storage_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (
      public.has_permission('products.edit_images')
      OR public.has_permission('products.create')
      OR public.has_permission('categories.create_edit')
    )
  );

CREATE POLICY "storage_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (
      public.has_permission('products.edit_images')
      OR public.has_permission('products.delete')
    )
  );
