import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  MessageSquare,
} from 'lucide-react';
import { Profile, OrderRequest } from '../../types';
import { dataService } from '../../services/dataService';
import { formatNaira, formatDate } from '../../lib/utils';
import { UserStatusBadge, OrderBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { openWhatsAppChat } from '../../lib/whatsapp';
import { usePermissions } from '../../context/PermissionsContext';

export default function ResellerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const { can, isSuperAdmin } = usePermissions();

  const canEditReseller = can('resellers.edit');
  const canViewOrders = can('orders.view');

  const [reseller, setReseller] = useState<Profile | null>(null);
  const [staffOptions, setStaffOptions] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<OrderRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setIsLoading(true);
      try {
        const [profile, allProfiles] = await Promise.all([
          dataService.getProfileById(id),
          isSuperAdmin ? dataService.getProfiles().catch(() => []) : Promise.resolve([]),
        ]);

        if (isSuperAdmin) {
          setStaffOptions(allProfiles.filter(p => p.role === 'staff'));
        }

        if (profile) {
          setReseller(profile);
          setFullName(profile.full_name);
          setBusinessName(profile.business_name || '');
          setEmail(profile.email || '');
          setPhone(profile.phone || '');
          setCity(profile.city || '');
          setState(profile.state || '');
          setAssignedStaffId(profile.assigned_staff_id || '');

          if (canViewOrders) {
            const orderRequests = await dataService.getOrderRequests(profile.id).catch(() => []);
            setOrders(orderRequests);
          }
        } else {
          toastError('Reseller profile not found or outside your scope.');
          navigate('/admin/resellers');
        }
      } catch (err) {
        console.error('Failed to load reseller:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id, navigate, toastError, isSuperAdmin, canViewOrders]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !reseller || !canEditReseller) return;

    setIsSaving(true);
    try {
      const updated = await dataService.updateResellerProfile(id, {
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
        phone: phone.trim(),
        city: city.trim(),
        state: state.trim(),
        ...(isSuperAdmin ? { assigned_staff_id: assignedStaffId || null } : {}),
      });
      setReseller(updated);
      setIsEditing(false);
      success('Reseller profile updated.');
    } catch (err: any) {
      toastError(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleWhatsAppChat = () => {
    if (!reseller?.phone) return;
    openWhatsAppChat(reseller.phone, `Hello ${reseller.full_name}, this is CEO Power Company administration.`);
  };

  if (isLoading || !reseller) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-64 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);
  const assignedStaffObj = staffOptions.find(s => s.id === reseller.assigned_staff_id);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link
          to="/admin/resellers"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-[#187004]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Resellers List</span>
        </Link>
      </div>

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#187004] text-white flex items-center justify-center font-bold text-xl font-heading shadow-sm">
            {reseller.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading">
                {reseller.full_name}
              </h1>
              <UserStatusBadge status={reseller.status} />
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {reseller.business_name} • Username: <span className="font-mono font-bold">{reseller.username}</span>
              {reseller.email && (
                <> • Email: <span className="font-medium text-slate-700">{reseller.email}</span></>
              )}
            </p>
            {isSuperAdmin && (
              <p className="text-xs text-slate-500 mt-1">
                Assigned Staff:{' '}
                <span className="font-semibold text-[#187004]">
                  {assignedStaffObj ? `${assignedStaffObj.full_name} (@${assignedStaffObj.username})` : 'Unassigned'}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="whatsapp"
            size="md"
            onClick={handleWhatsAppChat}
            className="text-xs font-bold gap-1.5"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat on WhatsApp</span>
          </Button>
          {canEditReseller && (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs font-bold"
            >
              {isEditing ? 'Cancel Edit' : 'Edit Profile'}
            </Button>
          )}
        </div>
      </div>

      {/* Profile Details / Edit Form */}
      {isEditing && canEditReseller ? (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 font-heading pb-3 border-b border-slate-100">
            Edit Reseller Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Contact Person Name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />
            <Input
              label="Business Name"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
            />
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="WhatsApp Phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <Input
              label="City"
              value={city}
              onChange={e => setCity(e.target.value)}
            />
            <Input
              label="State"
              value={state}
              onChange={e => setState(e.target.value)}
            />
          </div>

          {isSuperAdmin && (
            <div>
              <label htmlFor="detail-assigned-staff" className="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">
                Assigned Staff Admin
              </label>
              <select
                id="detail-assigned-staff"
                value={assignedStaffId}
                onChange={e => setAssignedStaffId(e.target.value)}
                className="w-full sm:max-w-sm min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#187004]"
              >
                <option value="">Unassigned</option>
                {staffOptions.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.full_name} (@{st.username})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSaving}
              className="font-bold"
            >
              <Save className="w-4 h-4 mr-1.5" />
              <span>Save Changes</span>
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Orders</span>
            <span className="text-2xl font-black text-[#187004] font-heading mt-1 block">
              {canViewOrders ? orders.length : '—'}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Cumulative Value</span>
            <span className="text-2xl font-black text-[#187004] font-heading mt-1 block tabular-nums">
              {canViewOrders ? formatNaira(totalSpent) : '—'}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Phone</span>
            <span className="text-sm font-bold text-slate-800 mt-1 block">
              {reseller.phone}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Territory</span>
            <span className="text-sm font-bold text-slate-800 mt-1 block">
              {reseller.city}, {reseller.state}
            </span>
          </div>
        </div>
      )}

      {/* Reseller Order Requests History */}
      {canViewOrders && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-heading">
                Order Requests by {reseller.full_name}
              </h2>
              <p className="text-xs text-slate-500">
                Orders placed by this partner through the reseller portal.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {orders.length} requests
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              This reseller has not submitted any order requests yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Ref</th>
                    <th className="px-6 py-3.5">Items</th>
                    <th className="px-6 py-3.5">Total Amount</th>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-[#187004]">
                        {order.ref}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {order.items.reduce((s, i) => s + i.qty, 0)} units
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 tabular-nums">
                        {formatNaira(order.total)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <OrderBadge status={order.status} />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                        {order.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
