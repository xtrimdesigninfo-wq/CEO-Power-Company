import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Lock, Save, CheckCircle2, ShieldCheck } from 'lucide-react';
import { CompanySettings } from '../../types';
import { dataService } from '../../services/dataService';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { formatWhatsAppDisplay } from '../../lib/whatsapp';
import { DEFAULT_LOW_STOCK_THRESHOLD, normalizeLowStockThreshold } from '../../lib/inventory';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { usePermissions } from '../../context/PermissionsContext';

export default function Settings() {
  const { profile } = useAuthStore();
  const { can, isSuperAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const canEditSettings = can('settings.edit');
  const { success, error: toastError } = useToast();

  const [settings, setSettings] = useState<CompanySettings>({
    whatsapp_number: '2347066449882',
    company_name: 'CEO Power Company',
    company_address: '20 Oguta Road, Onitsha, Anambra State',
    support_email: 'info@ceopowercompany.org',
    tagline: 'Power Without Limits',
    est_year: '2014',
    low_stock_threshold: String(DEFAULT_LOW_STOCK_THRESHOLD),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const data = await dataService.getSettings();
        setSettings(data);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings) return;
    setIsSavingSettings(true);
    try {
      const normalizedThreshold = normalizeLowStockThreshold(
        settings.low_stock_threshold,
        DEFAULT_LOW_STOCK_THRESHOLD
      );
      const payload: Partial<CompanySettings> = {
        company_name: settings.company_name,
        company_address: settings.company_address,
        support_email: settings.support_email,
        tagline: settings.tagline,
        est_year: settings.est_year,
        low_stock_threshold: String(normalizedThreshold),
      };
      if (isSuperAdmin) {
        payload.whatsapp_number = settings.whatsapp_number;
      }

      const updated = await dataService.updateSettings(payload);
      setSettings(updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['company-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] }),
      ]);
      success('Company settings saved successfully.');
    } catch (err: any) {
      toastError(err.message || 'Failed to update company settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toastError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError('Passwords do not match.');
      return;
    }

    if (!profile) return;

    setIsUpdatingPassword(true);
    try {
      await authService.changePassword(profile.id, newPassword);
      success('Admin password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toastError(err.message || 'Failed to update admin password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-96 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
          Portal & Company Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Configure the WhatsApp dispatch target, business address, and administrator credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Company & WhatsApp Settings */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center font-bold">
                <MessageSquare className="w-5 h-5 text-[#25D366]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 font-heading">
                  WhatsApp Dispatch & Contact
                </h2>
                <p className="text-xs text-slate-500">
                  Number where reseller orders and inquiries are sent
                </p>
              </div>
            </div>
            {!canEditSettings && (
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Read-only
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCompanySettings} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="whatsapp-order-number"
                  className="block text-xs font-semibold text-slate-700 tracking-wide"
                >
                  WhatsApp Order Number *
                </label>
                {isSuperAdmin ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-[#187004] border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-3 h-3" />
                    Master Admin Control
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                    <Lock className="w-3 h-3" />
                    Master Admin Only
                  </span>
                )}
              </div>
              <Input
                id="whatsapp-order-number"
                placeholder="e.g. 2347066449882"
                value={settings.whatsapp_number}
                disabled={!canEditSettings || !isSuperAdmin}
                readOnly={!isSuperAdmin}
                onChange={e => {
                  if (!isSuperAdmin) return;
                  setSettings({ ...settings, whatsapp_number: e.target.value });
                }}
                helperText={
                  isSuperAdmin
                    ? `All portal orders & WhatsApp links route to ${formatWhatsAppDisplay(settings.whatsapp_number)}. Format with country code without + or spaces (e.g. 2347066449882).`
                    : `Locked (${formatWhatsAppDisplay(settings.whatsapp_number)}). Only the Master Admin can change the WhatsApp order receiving number.`
                }
              />
            </div>

            <fieldset disabled={!canEditSettings} className="space-y-4 disabled:opacity-80">

              <Input
                label="Company Name"
                value={settings.company_name}
                onChange={e => setSettings({ ...settings, company_name: e.target.value })}
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">
                  Head Office Address
                </label>
                <textarea
                  rows={2}
                  value={settings.company_address}
                  onChange={e => setSettings({ ...settings, company_address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#187004] disabled:bg-slate-100"
                />
              </div>

              <Input
                label="Official Support Email"
                type="email"
                value={settings.support_email}
                onChange={e => setSettings({ ...settings, support_email: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Brand Tagline"
                  value={settings.tagline || ''}
                  onChange={e => setSettings({ ...settings, tagline: e.target.value })}
                />
                <Input
                  label="Established Year"
                  value={settings.est_year || ''}
                  onChange={e => setSettings({ ...settings, est_year: e.target.value })}
                />
              </div>

              <Input
                label="Low-Stock Alert Threshold (Units)"
                type="number"
                min="1"
                max="100000"
                step="1"
                value={String(settings.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD)}
                onChange={e => setSettings({ ...settings, low_stock_threshold: e.target.value })}
                helperText="Products with unit inventory below this number are highlighted in Catalogue Management and trigger Admin Dashboard notifications."
              />
            </fieldset>

            {canEditSettings && (
              <div className="pt-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSavingSettings}
                  className="w-full font-bold shadow-xs"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  <span>Save Company Settings</span>
                </Button>
              </div>
            )}
          </form>
        </div>

        {/* Change Own Password */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#187004]/5 text-[#187004] flex items-center justify-center font-bold">
                <Lock className="w-5 h-5 text-[#187004]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 font-heading">
                  Change My Password
                </h2>
                <p className="text-xs text-slate-500">
                  Account: <span className="font-mono font-bold">{profile?.username || 'xtrimdesign'}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleChangeAdminPassword} className="space-y-4">
              <Input
                label="New Password"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />

              <div className="pt-3">
                <Button
                  type="submit"
                  variant="secondary"
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
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">Role Security Notice:</p>
              <p>Portal settings edits are logged in the Super Admin Activity Log with before/after values.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
