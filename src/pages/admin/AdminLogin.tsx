import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ShieldCheck, AlertCircle, Lock, ArrowLeft, KeyRound, Home } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { getFirstAllowedAdminRoute } from '../../lib/permissions';
import { Button } from '../../components/ui/Button';
import { Footer } from '../../components/ui/Footer';

const adminLoginSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Please enter administrator username or email'),
  password: z.string().min(1, 'Please enter your administrator password'),
});

type AdminLoginFormData = z.infer<typeof adminLoginSchema>;

export default function AdminLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [adminRoleError, setAdminRoleError] = useState<string | null>(null);
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AdminLoginFormData>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      usernameOrEmail: '',
      password: '',
    },
  });

  const onSubmit = async (data: AdminLoginFormData) => {
    clearError();
    setAdminRoleError(null);
    try {
      const session = await login(data.usernameOrEmail, data.password, { portal: 'admin' });
      const role = session.profile.role;

      if (role !== 'admin' && role !== 'staff') {
        setAdminRoleError('This login is for administrators only.');
        return;
      }

      if (role === 'admin') {
        navigate(from && from.startsWith('/admin') ? from : '/admin', { replace: true });
        return;
      }

      // Staff admin: inspect permissions to land on first allowed page if dashboard.view is absent
      const fetched = await authService.fetchUserPermissions(session.profile.id);
      const perms = fetched?.staffPermissions?.permissions || [];
      const landing = getFirstAllowedAdminRoute('staff', perms, session.profile.status);

      if (from && from.startsWith('/admin') && from !== '/admin/login') {
        navigate(from, { replace: true });
      } else {
        navigate(landing, { replace: true });
      }
    } catch (err: any) {
      if (err?.message === 'This login is for administrators only.') {
        setAdminRoleError(err.message);
      }
    }
  };

  const handleQuickFill = () => {
    setValue('usernameOrEmail', 'xtrimdesign');
    setValue('password', 'Le123456789');
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#071d02] text-white relative overflow-hidden select-none">
      {/* Background radial gradient & subtle grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#187004_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#187004]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#187004]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-300 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-emerald-500/20"
        >
          <Home className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-300 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-emerald-500/20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Switch to Partner Portal</span>
        </Link>
      </header>

      {/* Main Admin Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-[#0b2b04]/95 backdrop-blur-md rounded-3xl border border-[#187004]/45 shadow-2xl p-6 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#187004] via-emerald-400 to-[#F5A623]" />
          {/* Logo in Crisp White Container */}
          <div className="flex flex-col items-center text-center mb-8">
            <Link
              to="/"
              aria-label="CEO Power Company Home"
              className="bg-white p-3 rounded-2xl shadow-lg border border-emerald-950 mb-4 inline-flex items-center justify-center hover:scale-[1.02] transition-transform"
            >
              <img
                src="/logo.png"
                alt="CEO Power Company"
                className="h-9 sm:h-10 w-auto object-contain"
              />
            </Link>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-widest mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-[#F5A623]" /> Executive Console
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-heading">
              Admin Authentication
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-emerald-100/75 max-w-xs">
              Restricted management console for Super Admin and authorized staff administrators.
            </p>
          </div>

          {/* Form Error or Role Rejection Alert */}
          {(error || adminRoleError) && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-xl bg-red-950/70 border border-red-500/50 flex items-start gap-3 text-xs sm:text-sm text-red-200"
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-snug font-medium">
                {adminRoleError || error}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Username or Email */}
            <div>
              <label
                htmlFor="admin-username"
                className="block text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-1.5"
              >
                Administrator Username
              </label>
              <div className="relative">
                <input
                  id="admin-username"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. xtrimdesign"
                  aria-invalid={errors.usernameOrEmail ? 'true' : 'false'}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-[#187004]/60 bg-[#071d02]/90 text-white placeholder-emerald-200/35 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-colors"
                  {...register('usernameOrEmail')}
                />
              </div>
              {errors.usernameOrEmail && (
                <p className="mt-1 text-xs text-red-400 font-medium">
                  {errors.usernameOrEmail.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-1.5"
              >
                Administrator Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  aria-invalid={errors.password ? 'true' : 'false'}
                  className="w-full min-h-[46px] px-4 py-2.5 pr-12 rounded-xl border border-[#187004]/60 bg-[#071d02]/90 text-white placeholder-emerald-200/35 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-colors"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-emerald-400 hover:text-white rounded-md focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-400 font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full text-sm sm:text-base font-bold shadow-lg mt-2 bg-[#187004] hover:bg-[#135903] text-white"
            >
              <Lock className="w-4 h-4 mr-2" />
              <span>Sign In to Executive Console</span>
            </Button>
          </form>

          {/* Quick Fill Helper for Verification */}
          <div className="mt-6 pt-5 border-t border-[#187004]/30 flex flex-col items-center">
            <button
              type="button"
              onClick={handleQuickFill}
              className="inline-flex items-center gap-1.5 text-xs text-emerald-300/80 hover:text-white hover:underline transition-colors py-1 px-2.5 rounded-lg bg-white/5 border border-white/10"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fill Admin Credentials (xtrimdesign)</span>
            </button>
            <p className="mt-3 text-[11px] text-emerald-100/50 text-center leading-relaxed">
              Authorized personnel only. All access attempts are recorded for compliance.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer variant="dark" />
    </div>
  );
}
