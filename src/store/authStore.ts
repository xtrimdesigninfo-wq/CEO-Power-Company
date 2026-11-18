import { create } from 'zustand';
import { Profile, UserRole } from '../types';
import { authService, AuthSession, LoginOptions } from '../services/authService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthState {
  session: AuthSession | null;
  profile: Profile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (usernameOrEmail: string, password: string, options?: LoginOptions) => Promise<AuthSession>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setProfile: (profile: Profile) => void;
  clearError: () => void;
}

let authListenerAttached = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    if (isSupabaseConfigured && supabase && !authListenerAttached) {
      authListenerAttached = true;
      supabase.auth.onAuthStateChange((event, supaSession) => {
        if (event === 'SIGNED_OUT') {
          authService.setSession(null);
          set({ session: null, profile: null, role: null, isAuthenticated: false, isLoading: false });
        } else if (event === 'TOKEN_REFRESHED' && supaSession) {
          const current = get().session;
          if (current) {
            const refreshed: AuthSession = {
              ...current,
              user: {
                id: supaSession.user.id,
                email: supaSession.user.email ?? current.user?.email ?? '',
              },
              token: supaSession.access_token,
            };
            authService.setSession(refreshed);
            set({ session: refreshed });
          }
        }
      });
    }

    try {
      const current = await authService.restoreSession();
      if (current && current.profile) {
        if (current.profile.status === 'suspended') {
          await authService.logout();
          set({ session: null, profile: null, role: null, isAuthenticated: false, isLoading: false });
          return;
        }
        set({
          session: current,
          profile: current.profile,
          role: current.profile.role,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ session: null, profile: null, role: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ session: null, profile: null, role: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (usernameOrEmail: string, password: string, options?: LoginOptions) => {
    set({ isLoading: true, error: null });
    try {
      const session = await authService.login(usernameOrEmail, password, options);
      set({
        session,
        profile: session.profile,
        role: session.profile.role,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return session;
    } catch (err: any) {
      set({
        session: null,
        profile: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        error: err.message || 'Login failed',
      });
      throw err;
    }
  },

  logout: async () => {
    await authService.logout();
    set({
      session: null,
      profile: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  setProfile: (profile: Profile) => {
    const currentSession = get().session;
    if (currentSession) {
      const updatedSession = { ...currentSession, profile };
      authService.setSession(updatedSession);
      set({ session: updatedSession, profile, role: profile.role });
    }
  },

  clearError: () => set({ error: null }),
}));
