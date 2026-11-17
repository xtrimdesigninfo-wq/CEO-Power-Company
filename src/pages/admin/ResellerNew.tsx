import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Lock, MessageSquare, Sparkles, UserPlus } from 'lucide-react';
import { Profile } from '../../types';
import { dataService } from '../../services/dataService';
import { generateTemporaryPassword } from '../../lib/permissions';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { buildResellerWelcomeMessage, openWhatsAppChat } from '../../lib/whatsapp';
import { usePermissions } from '../../context/PermissionsContext';
import { useAuthStore } from '../../store/authStore';

export default function ResellerNew() {
  const navigate = useNavigate();
  const { profile: currentActor } = useAuthStore();
  const { isSuperAdmin, resellerScope } = usePermissions();
  const { success, error: toastError } = useToast();

  const [staffOptions, setStaffOptions] = useState<Profile[]>([]);
  const [formFullName, setFormFullName] = useState('');
  const [formBusinessName, setFormBusinessName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState(generateTemporaryPassword());
  const [formPhone, setFormPhone] = useState('');
  const [formCity, setFormCity] = useState('Onitsha');
  const [formState, setFormState] = useState('Anambra');
  const [formAssignedStaffId, setFormAssignedStaffId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createdProfile, setCreatedProfile] = useState<Profile | null>(null);
  const [createdPassword, setCreatedPassword] = useState('');

  useEffect(() => {
    async function loadStaff() {
      if (!isSuperAdmin) return;
      try {
        const profiles = await dataService.getProfiles();
        setStaffOptions(profiles.filter(p => p.role === 'staff' && p.status === 'active'));
      } catch {
        // Ignore
      }
    }
    loadStaff();
  }, [isSuperAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const created = await dataService.createResellerProfile({
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
      setCreatedProfile(created);
      setCreatedPassword(formPassword);
      success(`Reseller account created for ${created.full_name}.`);
    } catch (err: any) {
      toastError(err.message || 'Failed to create reseller.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdProfile) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#D98200] flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 font-heading">Partner Login Credentials</h1>
            <p className="text-xs text-slate-500">Reseller: {createdProfile.full_name}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Username:</span>
            <span className="font-mono font-bold text-slate-900">{createdProfile.username}</span>
          </div>
          {createdProfile.email && (
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="font-medium text-slate-900">{createdProfile.email}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Password:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-[#187004] bg-white px-2 py-0.5 rounded border border-slate-200">
                {createdPassword}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(createdPassword);
                  success('Password copied!');
                }}
                className="p-1 text-slate-500 hover:text-slate-800 rounded"
                aria-label="Copy password"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            type="button"
            variant="whatsapp"
            size="md"
            onClick={() =>
              openWhatsAppChat(
                createdProfile.phone,
                buildResellerWelcomeMessage(
                  createdProfile.full_name,
                  createdProfile.username,
                  createdPassword,
                  createdProfile.email
                )
              )
            }
            className="w-full text-xs font-bold gap-2 py-3"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Send login details on WhatsApp ({createdProfile.phone})</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => navigate('/admin/resellers')}
            className="w-full text-xs"
          >
            Back to Resellers Directory
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          to="/admin/resellers"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-[#187004]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Resellers</span>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
          Create Authorized Reseller
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Set up wholesale portal access with username and email sign-in.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
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
          />
          <Input
            label="Email Address *"
            type="email"
            placeholder="e.g. emeka@solarplus.ng"
            value={formEmail}
            onChange={e => setFormEmail(e.target.value)}
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

        {isSuperAdmin ? (
          <div>
            <label htmlFor="new-reseller-assigned-staff" className="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">
              Assigned Staff (Optional)
            </label>
            <select
              id="new-reseller-assigned-staff"
              value={formAssignedStaffId}
              onChange={e => setFormAssignedStaffId(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#187004]"
            >
              <option value="">Unassigned</option>
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

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="md" onClick={() => navigate('/admin/resellers')}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting} className="font-bold gap-2">
            <UserPlus className="w-4 h-4" />
            <span>Create Partner Account</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
