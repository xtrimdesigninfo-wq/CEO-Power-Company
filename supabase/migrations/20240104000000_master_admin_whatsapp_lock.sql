-- ====================================================================
-- CEO Power Company — Master Admin Lock on WhatsApp Order Number
-- Migration: 20240104000000_master_admin_whatsapp_lock.sql
-- ====================================================================

-- 1. Allow public/unauthenticated read of non-secret contact settings (e.g. Login page WhatsApp button & footer)
DROP POLICY IF EXISTS "settings_staff_select" ON public.settings;
DROP POLICY IF EXISTS "settings_public_select" ON public.settings;
CREATE POLICY "settings_public_select"
  ON public.settings FOR SELECT
  TO public
  USING (true);

-- 2. Restrict RLS write policies on settings so staff with settings.edit cannot modify 'whatsapp_number'
DROP POLICY IF EXISTS "settings_staff_insert" ON public.settings;
CREATE POLICY "settings_staff_insert"
  ON public.settings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('settings.edit')
    AND (key <> 'whatsapp_number' OR public.is_super_admin())
  );

DROP POLICY IF EXISTS "settings_staff_update" ON public.settings;
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

DROP POLICY IF EXISTS "settings_staff_delete" ON public.settings;
CREATE POLICY "settings_staff_delete"
  ON public.settings FOR DELETE
  TO authenticated
  USING (
    public.has_permission('settings.edit')
    AND (key <> 'whatsapp_number' OR public.is_super_admin())
  );

-- 3. Trigger enforcing that ONLY the Master Admin (is_super_admin()) can insert/update/delete whatsapp_number
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
