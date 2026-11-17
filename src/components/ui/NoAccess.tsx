import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { usePermissions } from '../../context/PermissionsContext';
import { useAuthStore } from '../../store/authStore';
import { Button } from './Button';

interface NoAccessProps {
  requiredPermission?: string;
  superAdminOnly?: boolean;
}

export function NoAccess({ requiredPermission, superAdminOnly }: NoAccessProps) {
  const { firstAllowedRoute, permissions } = usePermissions();
  const { logout } = useAuthStore();

  const hasAnyAdminRoute = firstAllowedRoute !== '/admin/no-access' && permissions.length > 0;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/90 shadow-sm p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading">
            You don't have access to this page
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            {superAdminOnly
              ? 'This section is restricted to the Super Admin account.'
              : 'Your current staff role does not include permission to view this section. Contact the Super Admin if you need access.'}
          </p>
          {requiredPermission && (
            <p className="text-xs font-mono text-slate-400 pt-1">
              Required: {requiredPermission}
            </p>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          {hasAnyAdminRoute ? (
            <Link
              to={firstAllowedRoute}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#187004] hover:bg-[#0e3e03] text-white text-sm font-bold shadow-xs transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go to Allowed Home</span>
            </Link>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => logout()}
              className="w-full sm:w-auto gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
