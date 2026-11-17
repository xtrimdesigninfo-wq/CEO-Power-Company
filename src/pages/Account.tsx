import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, ShieldCheck, Lock, Building, Phone, MapPin, CheckCircle2, Mail, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

const changePasswordSchema = z
  .object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your new password'),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function Account() {
  const { profile, logout } = useAuthStore();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmitPassword = async (data: ChangePasswordFormData) => {
    if (!profile) return;
    setIsUpdatingPassword(true);
    try {
      await authService.changePassword(profile.id, data.newPassword);
      success('Your password has been changed successfully.');
      reset();
    } catch (err: any) {
      toastError(err.message || 'Failed to update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-heading">
            Account Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            View your authorized partner profile credentials and update your portal password.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="md"
          isLoading={isLoggingOut}
          onClick={handleLogout}
          aria-label="Log out of Reseller Portal"
          className="self-start sm:self-auto shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 focus-visible:ring-red-500 gap-2 font-bold"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Log out</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Details (Read-Only) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-[#187004] flex items-center justify-center font-bold text-lg shrink-0">
              <User className="w-6 h-6 text-[#187004]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-heading">
                Partner Profile
              </h2>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified Reseller Account
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-sm">
            <div className="pb-3.5">
              <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                Authorized Contact Name
              </span>
              <p className="font-bold text-slate-800 text-base mt-0.5">
                {profile?.full_name || '—'}
              </p>
            </div>

            <div className="flex items-start gap-3 py-3.5">
              <Building className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
              <div>
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                  Registered Business Name
                </span>
                <p className="font-bold text-slate-800 mt-0.5">
                  {profile?.business_name || 'Individual Reseller'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 py-3.5">
              <User className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
              <div>
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                  Portal Username
                </span>
                <p className="font-mono font-bold text-slate-800 mt-0.5">
                  {profile?.username}
                </p>
              </div>
            </div>

            {profile?.email && (
              <div className="flex items-start gap-3 py-3.5">
                <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                    Registered Email
                  </span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {profile.email}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 py-3.5">
              <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
              <div>
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                  WhatsApp Contact Phone
                </span>
                <p className="font-bold text-slate-800 mt-0.5">
                  {profile?.phone || '—'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-3.5">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
              <div>
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                  Location / Territory
                </span>
                <p className="font-bold text-slate-800 mt-0.5">
                  {profile?.city}, {profile?.state}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 leading-relaxed">
              To update your company name, location, or verified phone number, contact CEO Power Company administration via WhatsApp.
            </p>
          </div>
        </div>

        {/* Change Password Form */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center font-bold text-lg shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 font-heading">
                  Change Password
                </h2>
                <p className="text-xs text-slate-500">
                  Choose a secure password for your portal account
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmitPassword)} className="space-y-4">
              <Input
                label="New Password"
                type="password"
                placeholder="At least 6 characters"
                error={errors.newPassword?.message}
                {...register('newPassword')}
              />

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-enter new password"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />

              <div className="pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isUpdatingPassword}
                  className="w-full font-bold shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  <span>Update Password</span>
                </Button>
              </div>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100">
            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/70 text-xs text-sky-900 space-y-1">
              <p className="font-bold text-sky-950">Security Notice:</p>
              <p>Keep your login credentials confidential. CEO Power Company will never ask for your password via phone or chat.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
