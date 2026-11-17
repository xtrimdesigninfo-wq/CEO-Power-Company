import { Profile, StaffPermissionsRecord } from '../types';
import { supabase, isSupabaseConfigured, usernameToEmail, matchesProfileIdentifier } from '../lib/supabase';
import { safeStorage } from '../lib/storage';
import { dataService } from './dataService';

export interface AuthSession {
  user: {
    id: string;
    email: string;
  };
  profile: Profile;
  token?: string;
}

const AUTH_STORAGE_KEY = 'ceo_power_portal_current_session';

export interface LoginOptions {
  portal?: 'admin' | 'reseller';
}

export const authService = {
  getCurrentSession(): AuthSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = safeStorage.getItem(AUTH_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setSession(session: AuthSession | null): void {
    if (typeof window === 'undefined') return;
    if (session) {
      safeStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } else {
      safeStorage.removeItem(AUTH_STORAGE_KEY);
    }
  },

  async restoreSession(): Promise<AuthSession | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.user) {
          this.setSession(null);
          return null;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile || profile.status === 'suspended') {
          await supabase.auth.signOut();
          this.setSession(null);
          return null;
        }

        const restored: AuthSession = {
          user: {
            id: session.user.id,
            email: session.user.email || '',
          },
          profile: profile as Profile,
          token: session.access_token,
        };
        this.setSession(restored);
        return restored;
      } catch {
        this.setSession(null);
        return null;
      }
    }

    const local = this.getCurrentSession();
    if (!local?.profile) return null;

    // Re-sync with latest local profile to catch suspensions/role updates
    const profiles = await dataService.getAllProfilesRaw();
    const fresh = profiles.find((p) => p.id === local.profile.id);
    if (!fresh || fresh.status === 'suspended') {
      this.setSession(null);
      return null;
    }

    const updated = { ...local, profile: fresh };
    this.setSession(updated);
    return updated;
  },

  async fetchUserPermissions(userId: string): Promise<{
    profile: Profile;
    staffPermissions: StaffPermissionsRecord | null;
  } | null> {
    if (isSupabaseConfigured && supabase) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile) return null;

      let staffPermissions: StaffPermissionsRecord | null = null;
      if (profile.role === 'staff') {
        const { data: sp } = await supabase
          .from('staff_permissions')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        staffPermissions = (sp as StaffPermissionsRecord) || {
          user_id: userId,
          permissions: [],
          category_scope: null,
          reseller_scope: 'all',
          preset: null,
        };
      }

      return { profile: profile as Profile, staffPermissions };
    }

    const profiles = await dataService.getAllProfilesRaw();
    const profile = profiles.find((p) => p.id === userId);
    if (!profile) return null;

    const staffPermissions =
      profile.role === 'staff' ? await dataService.getStaffPermissionsByUserId(userId) : null;

    return { profile, staffPermissions };
  },

  async login(usernameOrEmail: string, password: string, options?: LoginOptions): Promise<AuthSession> {
    const cleanInput = usernameOrEmail.trim().toLowerCase();
    let email = usernameToEmail(cleanInput);

    // If Supabase is configured, use official Supabase Auth
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: resolvedEmail, error: rpcError } = await supabase.rpc('resolve_login_email', {
          p_identifier: cleanInput,
        });
        if (!rpcError && typeof resolvedEmail === 'string' && resolvedEmail.includes('@')) {
          email = resolvedEmail.trim().toLowerCase();
        }
      } catch {
        // Fallback to usernameToEmail if RPC is not yet deployed
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        if (error?.message?.toLowerCase().includes('invalid api key')) {
          throw new Error('Supabase rejected the API key (Invalid API key). Please copy the active Anon / Publishable key from Supabase Project Settings → API Keys.');
        }
        throw new Error('Wrong username or password.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error('Wrong username or password.');
      }

      if (profile.status === 'suspended') {
        await supabase.auth.signOut();
        if (profile.role === 'staff' || profile.role === 'admin' || options?.portal === 'admin') {
          throw new Error('Your admin access is paused. Contact the main administrator.');
        }
        throw new Error('Your account is paused. Please contact CEO Power Company sales.');
      }

      if (options?.portal === 'admin' && profile.role !== 'admin' && profile.role !== 'staff') {
        await supabase.auth.signOut();
        throw new Error('This login is for administrators only.');
      }

      if (profile.role === 'admin' || profile.role === 'staff') {
        try {
          await supabase.rpc('record_my_sign_in');
        } catch {
          // Ignore if migration not yet applied
        }
      }

      const session: AuthSession = {
        user: {
          id: data.user.id,
          email: data.user.email || email,
        },
        profile: profile as Profile,
        token: data.session?.access_token,
      };

      this.setSession(session);
      return session;
    }

    // Local / Dev Fallback Auth
    const profiles = await dataService.getAllProfilesRaw();
    const matchedProfile = profiles.find((p) => matchesProfileIdentifier(p, cleanInput));

    if (!matchedProfile) {
      throw new Error('Wrong username or password.');
    }

    if (matchedProfile.status === 'suspended') {
      if (matchedProfile.role === 'staff' || matchedProfile.role === 'admin' || options?.portal === 'admin') {
        throw new Error('Your admin access is paused. Contact the main administrator.');
      }
      throw new Error('Your account is paused. Please contact CEO Power Company sales.');
    }

    if (options?.portal === 'admin' && matchedProfile.role !== 'admin' && matchedProfile.role !== 'staff') {
      throw new Error('This login is for administrators only.');
    }

    let passwords: Record<string, string> = {};
    try {
      const stored = safeStorage.getItem('ceo_power_portal_passwords');
      passwords = stored ? JSON.parse(stored) : {};
    } catch {}

    const usernameKey = matchedProfile.username.toLowerCase();
    const expectedPassword = passwords[usernameKey] || (usernameKey === 'xtrimdesign' ? 'Le123456789' : 'Partner2024!');
    if (password !== expectedPassword) {
      throw new Error('Wrong username or password.');
    }

    if (matchedProfile.role === 'admin' || matchedProfile.role === 'staff') {
      await dataService.recordLocalSignIn(matchedProfile.id);
      matchedProfile.last_sign_in_at = new Date().toISOString();
    }

    const session: AuthSession = {
      user: {
        id: matchedProfile.id,
        email: matchedProfile.email || `${usernameKey}@portal.ceopower.local`,
      },
      profile: matchedProfile,
    };

    this.setSession(session);
    return session;
  },

  async logout(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    this.setSession(null);
  },

  async changePassword(currentUserId: string, newPassword: string): Promise<void> {
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      return;
    }

    const session = this.getCurrentSession();
    if (!session) throw new Error('Not authenticated');

    let passwords: Record<string, string> = {};
    try {
      const stored = safeStorage.getItem('ceo_power_portal_passwords');
      passwords = stored ? JSON.parse(stored) : {};
    } catch {}

    passwords[session.profile.username.toLowerCase()] = newPassword;
    safeStorage.setItem('ceo_power_portal_passwords', JSON.stringify(passwords));
  },
};
