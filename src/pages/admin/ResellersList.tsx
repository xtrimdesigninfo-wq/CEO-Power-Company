import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  KeyRound,
  Eye,
  Trash2,
  Copy,
  MessageSquare,
  Search,
  X,
  Lock,
  Sparkles,
} from 'lucide-react';
import { Profile } from '../../types';
import { dataService } from '../../services/dataService';
import { formatDate } from '../../lib/utils';
import { generateTemporaryPassword } from '../../lib/permissions';
import { UserStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { openWhatsAppChat, buildResellerWelcomeMessage } from '../../lib/whatsapp';
import { usePermissions } from '../../context/PermissionsContext';
import { useAuthStore } from '../../store/authStore';

export default function ResellersList() {
  const { profile: currentActor } = useAuthStore();
  const { can, isSuperAdmin, resellerScope } = usePermissions();

  const canCreate = can('resellers.create');
  const canResetPassword = can('resellers.reset_password');
  const canSuspend = can('resellers.suspend');
  const canDelete = can('resellers.delete');

  const [resellers, setResellers] = useState<Profile[]>([]);
  const [staffOptions, setStaffOptions] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create Reseller Dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formFullName, setFormFullName] = useState('');
  const [formBusinessName, setFormBusinessName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formState, setFormState] = useState('Anambra');
  const [formCity, setFormCity] = useState('Onitsha');
  const [formAssignedStaffId, setFormAssignedStaffId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password Reset Reveal Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<Profile | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { success, error: toastError } = useToast();

  const loadResellers = async () => {
    setIsLoading(true);
    try {
      const data = await dataService.getProfiles();
      setResellers(data.filter(p => p.role === 'reseller'));
      if (isSuperAdmin) {
        setStaffOptions(data.filter(p => p.role === 'staff' && p.status === 'active'));
      }
    } catch (err) {
      console.error('Failed to load resellers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadResellers();
  }, [isSuperAdmin]);

  const staffMap = new Map(staffOptions.map(s => [s.id, s]));

  const handleCreateReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;

    const cleanEmail = formEmail.trim().toLowerCase();
    if (!formFullName || !formUsername || !cleanEmail || !formPassword || !formPhone) {
      toastError('Please fill in all required fields.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toastError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newProfile = await dataService.createResellerProfile({
        username: formUsername.toLowerCase().trim(),
        email: cleanEmail,
        password: formPassword,
        full_name: formFullName.trim(),
        business_name: formBusinessName.trim() || formFullName.trim(),
        phone: formPhone.trim(),
        state: formState.trim(),
        city: formCity.trim(),
        ...(isSuperAdmin ? { assigned_staff_id: formAssignedStaffId || null } : {}),
      });

      success(`Reseller account created for ${newProfile.full_name}`);
      setCreateDialogOpen(false);

      setResetTargetUser(newProfile);
      setGeneratedPassword(formPassword);
      setResetModalOpen(true);

      setFormFullName('');
      setFormBusinessName('');
      setFormUsername('');
      setFormEmail('');
      setFormPassword('');
      setFormPhone('');
      setFormAssignedStaffId('');
      await loadResellers();
    } catch (err: any) {
      toastError(err.message || 'Failed to create reseller.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (reseller: Profile) => {
    if (!canSuspend) return;
    const nextStatus = reseller.status === 'active' ? 'suspended' : 'active';
    try {
      await dataService.setResellerStatus(reseller.id, nextStatus);
      setResellers(prev =>
        prev.map(r => (r.id === reseller.id ? { ...r, status: nextStatus } : r))
      );
      success(`Account for ${reseller.full_name} is now ${nextStatus}.`);
    } catch (err: any) {
      toastError(err.message || 'Failed to update account status.');
    }
  };

  const handleTriggerResetPassword = async (reseller: Profile) => {
    if (!canResetPassword) return;
    const tempPass = generateTemporaryPassword();
    setIsResetting(true);
    try {
      await dataService.resetResellerPassword(reseller.id, tempPass);
      setResetTargetUser(reseller);
      setGeneratedPassword(tempPass);
      setResetModalOpen(true);
      success(`Password reset for ${reseller.full_name}.`);
    } catch (err: any) {
      toastError(err.message || 'Failed to reset password.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopyPassword = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(generatedPassword);
      success('Password copied to clipboard!');
    }
  };

  const handleSendWhatsAppCredentials = () => {
    if (!resetTargetUser) return;
    const msg = buildResellerWelcomeMessage(
      resetTargetUser.full_name,
      resetTargetUser.username,
      generatedPassword,
      resetTargetUser.email
    );
    openWhatsAppChat(resetTargetUser.phone, msg);
  };

  const handleTriggerDelete = (reseller: Profile) => {
    if (!canDelete) return;
    setDeleteTarget(reseller);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dataService.deleteReseller(deleteTarget.id);
      setResellers(prev => prev.filter(r => r.id !== deleteTarget.id));
      success('Reseller account deleted.');
    } catch (err: any) {
      toastError(err.message || 'Failed to delete reseller.');
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const filteredResellers = resellers.filter(r => {
    const q = search.toLowerCase();
    return (
      r.full_name.toLowerCase().includes(q) ||
      r.business_name?.toLowerCase().includes(q) ||
      r.username.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.phone?.toLowerCase().includes(q) ||
      r.city?.toLowerCase().includes(q) ||
      r.state?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
            Reseller Accounts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {resellerScope === 'assigned' && !isSuperAdmin
              ? 'Showing resellers assigned to your account.'
              : 'Authorize trade partners, manage portal logins, reset credentials, and monitor territory orders.'}
          </p>
        </div>

        {canCreate && (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setCreateDialogOpen(true)}
            className="gap-2 font-bold shadow-xs self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4 text-[#F5A623]" />
            <span>Create Reseller</span>
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, business, email, phone, or username..."
            className="w-full min-h-[40px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#187004]"
          />
        </div>
      </div>

      {/* Reseller Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredResellers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No reseller accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Reseller Name</th>
                  <th className="px-6 py-3.5">Business Name</th>
                  <th className="px-6 py-3.5">Username / Email</th>
                  <th className="px-6 py-3.5">Phone (WhatsApp)</th>
                  <th className="px-6 py-3.5">Location</th>
                  {isSuperAdmin && <th className="px-6 py-3.5">Assigned Staff</th>}
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Created</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredResellers.map(reseller => {
                  const assignedStaff = reseller.assigned_staff_id
                    ? staffMap.get(reseller.assigned_staff_id)
                    : null;

                  return (
                    <tr key={reseller.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          to={`/admin/resellers/${reseller.id}`}
                          className="font-bold text-[#187004] hover:underline"
                        >
                          {reseller.full_name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {reseller.business_name || 'Individual'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-slate-800">{reseller.username}</div>
                        {reseller.email && (
                          <div className="text-xs text-slate-500 mt-0.5">{reseller.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {reseller.phone}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {reseller.city}, {reseller.state}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {assignedStaff ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-[#187004] font-semibold border border-emerald-200">
                              {assignedStaff.full_name}
                            </span>
                          ) : (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <UserStatusBadge status={reseller.status} />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(reseller.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/admin/resellers/${reseller.id}`}
                            className="p-1.5 text-slate-400 hover:text-[#187004] hover:bg-slate-100 rounded-lg"
                            title="View Profile & Orders"
                            aria-label={`View ${reseller.full_name}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {canResetPassword && (
                            <button
                              type="button"
                              disabled={isResetting}
                              onClick={() => handleTriggerResetPassword(reseller)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                              title="Reset Password"
                              aria-label={`Reset password for ${reseller.full_name}`}
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                          )}

                          {canSuspend && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(reseller)}
                              className={`p-1.5 rounded-lg cursor-pointer text-xs font-bold ${
                                reseller.status === 'active'
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={reseller.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
                            >
                              {reseller.status === 'active' ? 'Pause' : 'Activate'}
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleTriggerDelete(reseller)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                              title="Delete Reseller"
                              aria-label={`Delete ${reseller.full_name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Reseller Modal Dialog */}
      {createDialogOpen && canCreate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 font-heading">
                Create New Authorized Reseller
              </h3>
              <button
                type="button"
                onClick={() => setCreateDialogOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                aria-label="Close create reseller dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReseller} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Person Name *"
                  placeholder="e.g. Emeka Okafor"
                  value={formFullName}
                  onChange={e => setFormFullName(e.target.value)}
                />
                <Input
                  label="Business / Trading Name *"
                  placeholder="e.g. SolarPlus Nig Ltd"
                  value={formBusinessName}
                  onChange={e => setFormBusinessName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Login Username *"
                  placeholder="e.g. emeka_solar"
                  value={formUsername}
                  onChange={e => setFormUsername(e.target.value)}
                  helperText="Lower-case letters, numbers, underscores"
                />
                <Input
                  label="Email Address *"
                  type="email"
                  placeholder="e.g. emeka@solarplus.ng"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  helperText="Reseller can also sign in with this email"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 tracking-wide">
                      Initial Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormPassword(generateTemporaryPassword())}
                      className="text-[11px] font-bold text-[#187004] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" /> Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Min 6 characters"
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#187004]"
                  />
                </div>
                <Input
                  label="WhatsApp Phone Number *"
                  placeholder="e.g. 08031234567"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  helperText="Used for order confirmation and dispatch"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="City *"
                  placeholder="e.g. Onitsha"
                  value={formCity}
                  onChange={e => setFormCity(e.target.value)}
                />
                <Input
                  label="State *"
                  placeholder="e.g. Anambra"
                  value={formState}
                  onChange={e => setFormState(e.target.value)}
                />
              </div>

              {/* Assigned Staff Field */}
              {isSuperAdmin ? (
                <div>
                  <label htmlFor="assigned-staff-select" className="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">
                    Assigned Staff (Optional)
                  </label>
                  <select
                    id="assigned-staff-select"
                    value={formAssignedStaffId}
                    onChange={e => setFormAssignedStaffId(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#187004]"
                  >
                    <option value="">Unassigned (Visible to all-scope staff & Super Admin)</option>
                    {staffOptions.map(st => (
                      <option key={st.id} value={st.id}>
                        {st.full_name} (@{st.username})
                      </option>
                    ))}
                  </select>
                </div>
              ) : resellerScope === 'assigned' ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-[#187004] font-semibold">
                  Assigned Staff: Automatically assigned to {currentActor?.full_name} (@{currentActor?.username})
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  className="font-bold shadow-xs"
                >
                  Create Partner Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset / Generated Reveal Modal */}
      {resetModalOpen && resetTargetUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden p-6 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#D98200] flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  Partner Login Credentials
                </h3>
                <p className="text-xs text-slate-500">
                  Reseller: {resetTargetUser.full_name}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Username:</span>
                <span className="font-mono font-bold text-slate-900">{resetTargetUser.username}</span>
              </div>
              {resetTargetUser.email && (
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Email:</span>
                  <span className="font-medium text-slate-900">{resetTargetUser.email}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Password:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm text-[#187004] bg-white px-2 py-0.5 rounded border border-slate-200">
                    {generatedPassword}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-1 text-slate-500 hover:text-slate-800 rounded"
                    title="Copy Password"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              This password is shown once. Send these login details directly to the reseller on WhatsApp:
            </p>

            <div className="space-y-2">
              <Button
                type="button"
                variant="whatsapp"
                size="md"
                onClick={handleSendWhatsAppCredentials}
                className="w-full text-xs font-bold gap-2 py-3"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send login details on WhatsApp ({resetTargetUser.phone})</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setResetModalOpen(false)}
                className="w-full text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete Reseller Account?"
        description={`Are you sure you want to delete ${deleteTarget?.full_name}? They will no longer be able to log in or submit orders.`}
        confirmText="Delete Account"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
