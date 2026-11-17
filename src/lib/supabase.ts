import { createClient } from '@supabase/supabase-js';
import { safeStorage } from './storage';

export const PORTAL_EMAIL_DOMAIN = 'portal.ceopower.local';

const env = (typeof import.meta !== 'undefined' && import.meta.env) 
  ? import.meta.env 
  : ((typeof process !== 'undefined' ? process.env : {}) as any);

const rawSupabaseUrl = (env.VITE_SUPABASE_URL || '').trim();
const supabaseUrl = rawSupabaseUrl
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');
const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  /^https?:\/\//i.test(supabaseUrl) &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: safeStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Transforms username or email into the internal Supabase auth email
 * If no '@' is present, appends '@portal.ceopower.local'
 */
export function usernameToEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed}@${PORTAL_EMAIL_DOMAIN}`;
}

/**
 * Extracts username from email if it ends with internal domain
 */
export function emailToUsername(email: string): string {
  if (email.endsWith(`@${PORTAL_EMAIL_DOMAIN}`)) {
    return email.replace(`@${PORTAL_EMAIL_DOMAIN}`, '');
  }
  return email;
}

/**
 * Checks whether a login identifier (username or email) matches a profile
 */
export function matchesProfileIdentifier(
  profile: { username: string; email?: string | null },
  identifier: string
): boolean {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return false;
  const usernameLower = profile.username.toLowerCase();
  if (usernameLower === clean) return true;
  if (profile.email && profile.email.toLowerCase() === clean) return true;
  if (`${usernameLower}@${PORTAL_EMAIL_DOMAIN}` === clean) return true;
  return false;
}
