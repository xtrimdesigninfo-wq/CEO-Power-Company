import React, { useEffect, useMemo, useState } from 'react';
import {
  UserPlus,
  Edit3,
  KeyRound,
  Trash2,
  Copy,
  MessageSquare,
  Shield,
  Lock,
  Sparkles,
  X,
  CheckSquare,
  Square,
  AlertCircle,
  Search,
} from 'lucide-react';
import {
  Category,
  PermissionKey,
  ResellerScope,
  StaffMember,
} from '../../types';
import { dataService } from '../../services/dataService';
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  STAFF_PRESETS,
  generateTemporaryPassword,
} from '../../lib/permissions';
import { formatDate } from '../../lib/utils';
import { buildStaffWelcomeMessage, openWhatsAppChat } from '../../lib/whatsapp';
import { UserStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';

function findMatchingPreset(
  permissions: PermissionKey[],
  resellerScope: ResellerScope
): string | null {
  const permSet = new Set(permissions);
  for (const preset of STAFF_PRESETS) {
    if (
      preset.reseller_scope === resellerScope &&
      preset.permissions.length === permSet.size &&
      preset.permissions.every(p => permSet.has(p))
    ) {
      return preset.name;
    }
  }
  return null;
}

export default function TeamList() {
  const { success, error: toastError } = useToast();

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [migrationWarning, setMigrationWarning] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Create / Edit Staff Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [formFullName, setFormFullName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPreset, setFormPreset] = useState<string>('Stock Officer');
  const [formPermissions, setFormPermissions] = useState<PermissionKey[]>([]);
  const [formAllCategories, setFormAllCategories] = useState(true);
  const [formCategoryScope, setFormCategoryScope] = useState<string[]>([]);
  const [formResellerScope, setFormResellerScope] = useState<ResellerScope>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // One-time Password Reveal Modal
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [credentialsTarget, setCredentialsTarget] = useState<{
    full_name: string;
    username: string;
    phone: string;
    preset: string | null;
  } | null>(null);
  const [revealedPassword, setRevealedPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setMigrationWarning(null);
    try {
      const [members, cats] = await Promise.all([
        dataService.getStaffMembers(),
        dataService.getCategories(false),
      ]);
      setStaffList(members);
      setCategories(cats);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load staff team.';
      if (
        msg.toLowerCase().includes('staff_permissions') ||
        msg.toLowerCase().includes('does not exist') ||
        msg.toLowerCase().includes('could not find the table')
      ) {
        setMigrationWarning(
          'Staff permissions tables have not been applied to your Supabase database yet. Run migration 20240103000000_staff_permissions_and_activity.sql in your Supabase SQL Editor and redeploy the admin-users Edge Function.'
        );
      } else {
        toastError(msg);
      }
      try {
        const cats = await dataService.getCategories(false);
        setCategories(cats);
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categoryNameMap = useMemo(
    () => new Map(categories.map(c => [c.id, c.name])),
    [categories]
  );

  const openCreateModal = () => {
    const defaultPreset = STAFF_PRESETS.find(p => p.name === 'Stock Officer') || STAFF_PRESETS[0];
    setEditingMember(null);
    setFormFullName('');
    setFormUsername('');
    setFormPhone('');
    setFormPassword(generateTemporaryPassword());
    setFormPreset(defaultPreset.name);
    setFormPermissions([...defaultPreset.permissions]);
    setFormAllCategories(true);
    setFormCategoryScope([]);
    setFormResellerScope(defaultPreset.reseller_scope);
    setModalOpen(true);
  };

  const openEditModal = (member: StaffMember) => {
    const sp = member.staff_permissions;
    const matched = findMatchingPreset(sp.permissions, sp.reseller_scope);
    setEditingMember(member);
    setFormFullName(member.profile.full_name);
    setFormUsername(member.profile.username);
    setFormPhone(member.profile.phone);
    setFormPassword('');
    setFormPreset(sp.preset || matched || 'Custom');
    setFormPermissions([...sp.permissions]);
    setFormAllCategories(!sp.category_scope || sp.category_scope.length === 0);
    setFormCategoryScope(sp.category_scope ? [...sp.category_scope] : []);
    setFormResellerScope(sp.reseller_scope || 'all');
    setModalOpen(true);
  };

  const handleSelectPreset = (presetName: string) => {
    setFormPreset(presetName);
    if (presetName === 'Custom') return;
    const found = STAFF_PRESETS.find(p => p.name === presetName);
    if (found) {
      setFormPermissions([...found.permissions]);
      setFormResellerScope(found.reseller_scope);
    }
  };

  const togglePermission = (key: PermissionKey) => {
    setFormPermissions(prev => {
      const next = prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key];
      const matched = findMatchingPreset(next, formResellerScope);
      setFormPreset(matched || 'Custom');
      return next;
    });
  };

  const toggleGroupAll = (groupKeys: PermissionKey[]) => {
    setFormPermissions(prev => {
      const allSelected = groupKeys.every(k => prev.includes(k));
      let next: PermissionKey[];
      if (allSelected) {
        next = prev.filter(k => !groupKeys.includes(k));
      } else {
        const merged = new Set([...prev, ...groupKeys]);
        next = Array.from(merged);
      }
      const matched = findMatchingPreset(next, formResellerScope);
      setFormPreset(matched || 'Custom');
      return next;
    });
  };

  const handleResellerScopeChange = (scope: ResellerScope) => {
    setFormResellerScope(scope);
    const matched = findMatchingPreset(formPermissions, scope);
    if (matched) {
      setFormPreset(matched);
    } else if (formPreset !== 'Custom') {
      setFormPreset('Custom');
    }
  };

  const toggleCategoryScopeItem = (catId: string) => {
    setFormCategoryScope(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim() || !formPhone.trim()) {
      toastError('Full name and WhatsApp phone are required.');
      return;
    }
    if (!editingMember && (!formUsername.trim() || !formPassword.trim())) {
      toastError('Username and password are required for new staff accounts.');
      return;
    }
    if (!editingMember && formPassword.trim().length < 6) {
      toastError('Password must be at least 6 characters.');
      return;
    }
    if (formPermissions.length === 0) {
      toastError('Select at least one permission for this staff admin.');
      return;
    }
    if (!formAllCategories && formCategoryScope.length === 0) {
      toastError('Select at least one category or switch to "All categories".');
      return;
    }

    const effectiveCategoryScope = formAllCategories ? null : formCategoryScope;
    const effectivePreset = formPreset === 'Custom' ? 'Custom' : formPreset;

    setIsSubmitting(true);
    try {
      if (editingMember) {
        await dataService.updateStaffPermissions({
          user_id: editingMember.profile.id,
          full_name: formFullName.trim(),
          phone: formPhone.trim(),
          permissions: formPermissions,
          category_scope: effectiveCategoryScope,
          reseller_scope: formResellerScope,
          preset: effectivePreset,
        });
        success(`Permissions updated for ${formFullName.trim()}.`);
        setModalOpen(false);
        await loadData();
      } else {
        const cleanUsername = formUsername.toLowerCase().trim();
        const created = await dataService.createStaffAdmin({
          full_name: formFullName.trim(),
          username: cleanUsername,
          phone: formPhone.trim(),
          password: formPassword,
          permissions: formPermissions,
          category_scope: effectiveCategoryScope,
          reseller_scope: formResellerScope,
          preset: effectivePreset,
        });
        success(`Staff admin created for ${created.profile.full_name}.`);
        setModalOpen(false);
        setCredentialsTarget({
          full_name: created.profile.full_name,
          username: created.profile.username,
          phone: created.profile.phone,
          preset: effectivePreset,
        });
        setRevealedPassword(formPassword);
        setCredentialsModalOpen(true);
        await loadData();
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to save staff admin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (member: StaffMember) => {
    const tempPass = generateTemporaryPassword();
    setIsResettingPassword(true);
    try {
      await dataService.resetStaffPassword(member.profile.id, tempPass);
      setCredentialsTarget({
        full_name: member.profile.full_name,
        username: member.profile.username,
        phone: member.profile.phone,
        preset: member.staff_permissions.preset,
      });
      setRevealedPassword(tempPass);
      setCredentialsModalOpen(true);
      success(`Password reset for ${member.profile.full_name}.`);
    } catch (err: any) {
      toastError(err.message || 'Failed to reset staff password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleToggleStatus = async (member: StaffMember) => {
    const nextStatus = member.profile.status === 'active' ? 'suspended' : 'active';
    try {
      await dataService.setStaffStatus(member.profile.id, nextStatus);
      setStaffList(prev =>
        prev.map(m =>
          m.profile.id === member.profile.id
            ? { ...m, profile: { ...m.profile, status: nextStatus } }
            : m
        )
      );
      success(`${member.profile.full_name} is now ${nextStatus}.`);
    } catch (err: any) {
      toastError(err.message || 'Failed to update staff status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await dataService.deleteStaffAdmin(deleteTarget.profile.id);
      setStaffList(prev => prev.filter(m => m.profile.id !== deleteTarget.profile.id));
      success(`Deleted staff admin ${deleteTarget.profile.full_name}.`);
    } catch (err: any) {
      toastError(err.message || 'Failed to delete staff admin.');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const filteredStaff = staffList.filter(m => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      m.profile.full_name.toLowerCase().includes(q) ||
      m.profile.username.toLowerCase().includes(q) ||
      m.profile.phone?.toLowerCase().includes(q) ||
      (m.staff_permissions.preset || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#187004] mb-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Super Admin Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
            Team & Staff Admin Roles
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Create role-scoped staff accounts with database-enforced permissions, price visibility controls, and territory boundaries.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={openCreateModal}
          className="gap-2 font-bold shadow-xs self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Admin</span>
        </Button>
      </div>

      {migrationWarning && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Database migration required on live Supabase project</p>
            <p className="mt-1 text-amber-800">{migrationWarning}</p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff by name, username, phone, or preset role..."
            className="w-full min-h-[40px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#187004]"
          />
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-slate-500 text-sm font-medium">
              {search ? 'No staff admins match your search.' : 'No staff admin accounts created yet.'}
            </p>
            {!search && (
              <Button type="button" variant="outline" size="sm" onClick={openCreateModal}>
                Create First Staff Admin
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Staff Member</th>
                  <th className="px-6 py-3.5">Username</th>
                  <th className="px-6 py-3.5">Role Preset</th>
                  <th className="px-6 py-3.5">Permissions</th>
                  <th className="px-6 py-3.5">Scopes</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Last Login</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStaff.map(member => {
                  const sp = member.staff_permissions;
                  const catLabels =
                    !sp.category_scope || sp.category_scope.length === 0
                      ? 'All categories'
                      : sp.category_scope
                          .map(cid => categoryNameMap.get(cid) || 'Category')
                          .slice(0, 2)
                          .join(', ') +
                        (sp.category_scope.length > 2 ? ` +${sp.category_scope.length - 2}` : '');

                  return (
                    <tr key={member.profile.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{member.profile.full_name}</div>
                        <div className="text-xs text-slate-500">{member.profile.phone}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-700">
                        @{member.profile.username}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#187004] border border-emerald-200 text-xs font-bold">
                          {sp.preset || 'Custom'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700">
                        <span className="font-bold text-slate-900">{sp.permissions.length}</span>
                        <span className="text-slate-400"> / {ALL_PERMISSIONS.length}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 space-y-0.5">
                        <div>
                          <span className="text-slate-400">Cats:</span>{' '}
                          <span className="font-semibold text-slate-700">{catLabels}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Resellers:</span>{' '}
                          <span className="font-semibold text-slate-700">
                            {sp.reseller_scope === 'assigned' ? 'Assigned only' : 'All'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <UserStatusBadge status={member.profile.status} />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {member.profile.last_sign_in_at
                          ? formatDate(member.profile.last_sign_in_at)
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(member)}
                            className="p-1.5 text-slate-400 hover:text-[#187004] hover:bg-emerald-50 rounded-lg cursor-pointer"
                            title="Edit Permissions & Scopes"
                            aria-label={`Edit permissions for ${member.profile.full_name}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isResettingPassword}
                            onClick={() => handleResetPassword(member)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                            title="Reset Password"
                            aria-label={`Reset password for ${member.profile.full_name}`}
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(member)}
                            className={`px-2 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                              member.profile.status === 'active'
                                ? 'text-slate-500 hover:text-amber-700 hover:bg-amber-50'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                          >
                            {member.profile.status === 'active' ? 'Suspend' : 'Reactivate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(member);
                              setDeleteDialogOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                            title="Delete Staff Admin"
                            aria-label={`Delete ${member.profile.full_name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Add / Edit Staff Admin Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-6">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 font-heading">
                  {editingMember
                    ? `Edit Permissions — ${editingMember.profile.full_name}`
                    : 'Add Staff Admin'}
                </h2>
                <p className="text-xs text-slate-500">
                  {editingMember
                    ? 'Update role preset, granular permissions, and data scopes.'
                    : 'Assign exact portal capabilities. Credentials map to @portal.ceopower.local internally.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Close staff modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-6">
              {/* Identity Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name *"
                  placeholder="e.g. Chinedu Eze"
                  value={formFullName}
                  onChange={e => setFormFullName(e.target.value)}
                />
                <Input
                  label="WhatsApp Phone *"
                  placeholder="e.g. 08031234567"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Login Username *"
                    placeholder="e.g. chinedu_stock"
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value)}
                    disabled={Boolean(editingMember)}
                    helperText={
                      editingMember
                        ? 'Username cannot be changed after creation'
                        : 'Used to sign in at /admin/login'
                    }
                  />
                </div>

                {!editingMember && (
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
                      value={formPassword}
                      onChange={e => setFormPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#187004]"
                    />
                  </div>
                )}
              </div>

              {/* Preset Selector */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label
                    htmlFor="staff-preset-select"
                    className="text-xs font-bold text-slate-800 uppercase tracking-wider"
                  >
                    Role Preset (fills checklist, still editable)
                  </label>
                  <span className="text-xs font-semibold text-[#187004]">
                    {formPermissions.length} of {ALL_PERMISSIONS.length} permissions selected
                  </span>
                </div>
                <select
                  id="staff-preset-select"
                  value={formPreset}
                  onChange={e => handleSelectPreset(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#187004]"
                >
                  {STAFF_PRESETS.map(p => (
                    <option key={p.name} value={p.name}>
                      {p.name} — {p.description}
                    </option>
                  ))}
                  <option value="Custom">Custom Permission Set</option>
                </select>
              </div>

              {/* Permission Checklist Grouped by Domain */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Granular Permissions Checklist
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PERMISSION_GROUPS.map(group => {
                    const groupKeys = group.items.map(i => i.key);
                    const allChecked = groupKeys.every(k => formPermissions.includes(k));
                    const selectedCount = groupKeys.filter(k => formPermissions.includes(k)).length;

                    return (
                      <div
                        key={group.group}
                        className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">
                              {group.group}{' '}
                              <span className="text-[11px] font-semibold text-slate-400">
                                ({selectedCount}/{groupKeys.length})
                              </span>
                            </h4>
                            <p className="text-[11px] text-slate-500">{group.description}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleGroupAll(groupKeys)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#187004] hover:underline shrink-0 cursor-pointer"
                          >
                            {allChecked ? (
                              <>
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span>Clear all</span>
                              </>
                            ) : (
                              <>
                                <Square className="w-3.5 h-3.5" />
                                <span>Select all</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {group.items.map(item => {
                            const checked = formPermissions.includes(item.key);
                            return (
                              <label
                                key={item.key}
                                className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermission(item.key)}
                                  className="w-4 h-4 rounded border-slate-300 text-[#187004] focus:ring-[#187004]"
                                />
                                <span className={checked ? 'font-semibold text-slate-900' : ''}>
                                  {item.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category Scope & Reseller Scope */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Category Scope
                  </h4>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="cat-scope"
                        checked={formAllCategories}
                        onChange={() => {
                          setFormAllCategories(true);
                          setFormCategoryScope([]);
                        }}
                        className="text-[#187004] focus:ring-[#187004]"
                      />
                      <span>All categories</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="cat-scope"
                        checked={!formAllCategories}
                        onChange={() => setFormAllCategories(false)}
                        className="text-[#187004] focus:ring-[#187004]"
                      />
                      <span>Specific categories</span>
                    </label>
                  </div>

                  {!formAllCategories && (
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pt-2 border-t border-slate-100">
                      {categories.map(cat => (
                        <label
                          key={cat.id}
                          className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formCategoryScope.includes(cat.id)}
                            onChange={() => toggleCategoryScopeItem(cat.id)}
                            className="w-4 h-4 rounded border-slate-300 text-[#187004] focus:ring-[#187004]"
                          />
                          <span>{cat.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Reseller Scope
                  </h4>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="reseller-scope"
                        checked={formResellerScope === 'all'}
                        onChange={() => handleResellerScopeChange('all')}
                        className="mt-0.5 text-[#187004] focus:ring-[#187004]"
                      />
                      <div>
                        <span className="font-semibold text-slate-900 block">All resellers</span>
                        <span className="text-slate-500">
                          Can view and manage all reseller accounts and orders.
                        </span>
                      </div>
                    </label>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="reseller-scope"
                        checked={formResellerScope === 'assigned'}
                        onChange={() => handleResellerScopeChange('assigned')}
                        className="mt-0.5 text-[#187004] focus:ring-[#187004]"
                      />
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          Assigned resellers only
                        </span>
                        <span className="text-slate-500">
                          Sees only resellers assigned to them (and resellers they create).
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setModalOpen(false)}
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
                  {editingMember ? 'Save Permissions' : 'Create Staff Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Time Password Reveal Modal */}
      {credentialsModalOpen && credentialsTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden p-6 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#D98200] flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  Staff Admin Credentials
                </h3>
                <p className="text-xs text-slate-500">
                  {credentialsTarget.full_name} ({credentialsTarget.preset || 'Staff Admin'})
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Admin Login URL:</span>
                <span className="font-mono font-semibold text-slate-800">/admin/login</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Username:</span>
                <span className="font-mono font-bold text-slate-900">
                  {credentialsTarget.username}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Password:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm text-[#187004] bg-white px-2 py-0.5 rounded border border-slate-200">
                    {revealedPassword}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(revealedPassword);
                      success('Password copied to clipboard!');
                    }}
                    className="p-1 text-slate-500 hover:text-slate-800 rounded"
                    title="Copy Password"
                    aria-label="Copy password"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              This password is shown once. Copy it now or send directly on WhatsApp.
            </p>

            <div className="space-y-2">
              <Button
                type="button"
                variant="whatsapp"
                size="md"
                onClick={() =>
                  openWhatsAppChat(
                    credentialsTarget.phone,
                    buildStaffWelcomeMessage(
                      credentialsTarget.full_name,
                      credentialsTarget.username,
                      revealedPassword,
                      credentialsTarget.preset
                    )
                  )
                }
                className="w-full text-xs font-bold gap-2 py-3"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send on WhatsApp ({credentialsTarget.phone})</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setCredentialsModalOpen(false)}
                className="w-full text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Staff Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete Staff Admin Account?"
        description={`Are you sure you want to delete ${deleteTarget?.profile.full_name} (@${deleteTarget?.profile.username})? Their admin access will be permanently revoked.`}
        confirmText="Delete Staff Admin"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
