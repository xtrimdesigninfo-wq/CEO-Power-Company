-- ====================================================================
-- Incremental Migration: Reseller Email & Dual Username/Email Sign-In
-- ====================================================================

-- 1. Add email column to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Ensure unique non-null emails (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique_idx
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL AND email <> '';

-- 2. Backfill profiles.email from auth.users for accounts with real emails
UPDATE public.profiles p
SET email = lower(au.email)
FROM auth.users au
WHERE p.id = au.id
  AND (p.email IS NULL OR p.email = '')
  AND au.email IS NOT NULL
  AND au.email NOT LIKE '%@portal.ceopower.local';

-- 3. Secure RPC helper so login can resolve either username OR email to the account's auth email
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
