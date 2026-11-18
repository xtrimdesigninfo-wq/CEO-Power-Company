import { createClient } from '@supabase/supabase-js';
import { safeStorage } from './storage';

export const PORTAL_EMAIL_DOMAIN = 'portal.ceopower.local';

export const DEFAULT_PUBLIC_SUPABASE_URL = 'https://vhdsfrnatyfrtlekuzlk.supabase.co';
export const DEFAULT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_sKS4JX_svfmj177x9ck3nQ_TifH14Bl';

function cleanEnvString(value: unknown): string {
  if (typeof value !== 'string') return '';
  let trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export interface ResolvedSupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export function resolveSupabaseConfig(
  envRecord?: Record<string, unknown>
): ResolvedSupabaseConfig {
  const source =
    envRecord ??
    (typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env as Record<string, unknown>)
      : typeof process !== 'undefined'
        ? (process.env as Record<string, unknown>)
        : {});

  const rawEnvUrl = cleanEnvString(source.VITE_SUPABASE_URL);
  const rawEnvKey = cleanEnvString(source.VITE_SUPABASE_ANON_KEY);

  // Allow explicit local-demo opt-out or placeholder values to disable Supabase intentionally
  const explicitlyDisabled =
    rawEnvUrl.toLowerCase() === 'local' ||
    rawEnvUrl.toLowerCase() === 'disabled' ||
    rawEnvUrl.includes('your-project') ||
    rawEnvKey.includes('your-anon-key');

  if (explicitlyDisabled) {
    return { url: '', anonKey: '', isConfigured: false };
  }

  const normalizedEnvUrl = rawEnvUrl
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');

  const url = normalizedEnvUrl || DEFAULT_PUBLIC_SUPABASE_URL;
  const anonKey = rawEnvKey || DEFAULT_PUBLIC_SUPABASE_ANON_KEY;

  const isConfigured = Boolean(
    url &&
      anonKey &&
      /^https?:\/\//i.test(url) &&
      !url.includes('your-project') &&
      !anonKey.includes('your-anon-key')
  );

  return { url, anonKey, isConfigured };
}

const resolvedConfig = resolveSupabaseConfig();

export const isSupabaseConfigured = resolvedConfig.isConfigured;

export const supabase = isSupabaseConfigured
  ? createClient(resolvedConfig.url, resolvedConfig.anonKey, {
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
