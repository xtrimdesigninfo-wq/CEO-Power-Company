import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  PermissionKey,
  Profile,
  ResellerScope,
  StaffPermissionsRecord,
} from '../types';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import {
  ALL_PERMISSIONS,
  canAccessCategoryScope,
  canAccessResellerScope,
  canPerform,
  getFirstAllowedAdminRoute,
  getRoleBadgeLabel,
} from '../lib/permissions';
import { useToast } from '../components/ui/Toast';

interface PermissionsContextValue {
  isSuperAdmin: boolean;
  isStaff: boolean;
  isLoadingPermissions: boolean;
  permissions: PermissionKey[];
  categoryScope: string[] | null;
  resellerScope: ResellerScope;
  preset: string | null;
  roleBadge: string;
  can: (perm: PermissionKey) => boolean;
  canAccessCategory: (categoryId: string | null | undefined) => boolean;
  canAccessReseller: (reseller: Pick<Profile, 'id' | 'role' | 'assigned_staff_id'> | null | undefined) => boolean;
  firstAllowedRoute: string;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { profile, isAuthenticated, logout, setProfile } = useAuthStore();
  const { error: toastError } = useToast();

  const [staffPerms, setStaffPerms] = useState<StaffPermissionsRecord | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState<boolean>(false);

  const refreshPermissions = useCallback(async () => {
    if (!isAuthenticated || !profile) {
      setStaffPerms(null);
      setLoadedUserId(null);
      setIsLoadingPermissions(false);
      return;
    }

    if (profile.role !== 'admin' && profile.role !== 'staff') {
      setStaffPerms(null);
      setLoadedUserId(null);
      setIsLoadingPermissions(false);
      return;
    }

    // Only block UI on initial permission fetch for staff accounts whose permissions aren't loaded yet.
    // Super Admin permissions (ALL_PERMISSIONS) are known immediately, and background refreshes stay silent.
    const needsBlockingFetch = profile.role === 'staff' && loadedUserId !== profile.id;
    if (needsBlockingFetch) {
      setIsLoadingPermissions(true);
    }

    try {
      const result = await authService.fetchUserPermissions(profile.id);
      if (!result || result.profile.status === 'suspended' || (result.profile.role !== 'admin' && result.profile.role !== 'staff')) {
        await logout();
        toastError('Your admin access is paused. Contact the main administrator.');
        setStaffPerms(null);
        setLoadedUserId(null);
        return;
      }

      // Only update authStore profile if fields actually changed to avoid extra re-renders
      if (
        result.profile.role !== profile.role ||
        result.profile.status !== profile.status ||
        result.profile.full_name !== profile.full_name
      ) {
        setProfile(result.profile);
      }
      setStaffPerms(result.staffPermissions);
      setLoadedUserId(profile.id);
    } catch (err) {
      console.error('Failed to refresh staff permissions:', err);
    } finally {
      if (needsBlockingFetch) {
        setIsLoadingPermissions(false);
      }
    }
  }, [isAuthenticated, profile?.id, profile?.role, profile?.status, profile?.full_name, loadedUserId, logout, setProfile, toastError]);

  // Load permissions on login / user switch
  useEffect(() => {
    if (isAuthenticated && profile && (profile.role === 'admin' || profile.role === 'staff')) {
      refreshPermissions();
    } else {
      setStaffPerms(null);
      setLoadedUserId(null);
    }
  }, [isAuthenticated, profile?.id, profile?.role, refreshPermissions]);

  // Periodic refresh every 5 minutes (also catches live account suspension)
  useEffect(() => {
    if (!isAuthenticated || !profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
      return;
    }

    const timer = window.setInterval(() => {
      refreshPermissions();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isAuthenticated, profile, refreshPermissions]);

  const value = useMemo<PermissionsContextValue>(() => {
    const isSuperAdmin = Boolean(profile && profile.role === 'admin' && profile.status === 'active');
    const isStaff = Boolean(profile && profile.role === 'staff' && profile.status === 'active');
    const permissions: PermissionKey[] = isSuperAdmin
      ? [...ALL_PERMISSIONS]
      : isStaff && staffPerms
        ? staffPerms.permissions
        : [];
    const categoryScope = isSuperAdmin ? null : staffPerms?.category_scope ?? null;
    const resellerScope: ResellerScope = isSuperAdmin ? 'all' : staffPerms?.reseller_scope ?? 'all';
    const preset = isSuperAdmin ? 'Super Admin' : staffPerms?.preset ?? null;

    return {
      isSuperAdmin,
      isStaff,
      isLoadingPermissions,
      permissions,
      categoryScope,
      resellerScope,
      preset,
      roleBadge: getRoleBadgeLabel(profile?.role, preset),
      can: (perm: PermissionKey) => canPerform(profile, staffPerms, perm),
      canAccessCategory: (categoryId: string | null | undefined) =>
        canAccessCategoryScope(profile, staffPerms, categoryId),
      canAccessReseller: (reseller) => canAccessResellerScope(profile, staffPerms, reseller),
      firstAllowedRoute: getFirstAllowedAdminRoute(profile?.role, permissions, profile?.status),
      refreshPermissions,
    };
  }, [profile, staffPerms, isLoadingPermissions, refreshPermissions]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return ctx;
}
