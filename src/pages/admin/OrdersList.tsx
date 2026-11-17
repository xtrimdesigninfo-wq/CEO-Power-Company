import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  MessageSquare,
  Download,
} from 'lucide-react';
import { OrderRequest, OrderStatus, Profile } from '../../types';
import { dataService } from '../../services/dataService';
import { formatNaira, formatDate } from '../../lib/utils';
import { OrderBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { openWhatsAppChat } from '../../lib/whatsapp';
import { usePermissions } from '../../context/PermissionsContext';

function escapeCsvCell(val: string | number | null | undefined): string {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function OrdersList() {
  const { can } = usePermissions();
  const canUpdateStatus = can('orders.update_status');
  const canExportCsv = can('orders.export');
  const canViewResellers = can('resellers.view');

  const [orders, setOrders] = useState<OrderRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resellerFilter, setResellerFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [selectedOrder, setSelectedOrder] = useState<OrderRequest | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { success, error: toastError } = useToast();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [orderData, profileData] = await Promise.all([
        dataService.getOrderRequests(),
        canViewResellers ? dataService.getProfiles().catch(() => []) : Promise.resolve([]),
      ]);
      setOrders(orderData);
      setProfiles(profileData);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
      toastError(err?.message || 'Failed to load orders.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [canViewResellers]);

  const handleOpenDrawer = (order: OrderRequest) => {
    setSelectedOrder(order);
    setDrawerOpen(true);
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    if (!canUpdateStatus) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await dataService.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: newStatus } : o)));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      success(`Order ${updated.ref} marked as ${newStatus}.`);
    } catch (err: any) {
      toastError(err.message || 'Failed to update order status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleChatReseller = (order: OrderRequest) => {
    if (!order.reseller?.phone) return;
    const msg = `Hello ${order.reseller.full_name}, regarding your order ${order.ref} on the CEO Power Reseller Portal...`;
    openWhatsAppChat(order.reseller.phone, msg);
  };

  const filteredOrders = orders.filter(order => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      order.ref.toLowerCase().includes(q) ||
      (order.reseller?.full_name && order.reseller.full_name.toLowerCase().includes(q)) ||
      (order.reseller?.business_name && order.reseller.business_name.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesReseller = resellerFilter === 'all' || order.reseller_id === resellerFilter;

    return matchesSearch && matchesStatus && matchesReseller;
  });

  const handleExportCsv = () => {
    if (!canExportCsv) return;
    const headers = ['Order Ref', 'Reseller', 'Business', 'Phone', 'Units', 'Total (NGN)', 'Status', 'Created At', 'Note'];
    const rows = filteredOrders.map(o => [
      escapeCsvCell(o.ref),
      escapeCsvCell(o.reseller?.full_name || 'Reseller'),
      escapeCsvCell(o.reseller?.business_name || ''),
      escapeCsvCell(o.reseller?.phone || ''),
      escapeCsvCell(o.items.reduce((sum, i) => sum + i.qty, 0)),
      escapeCsvCell(o.total),
      escapeCsvCell(o.status),
      escapeCsvCell(o.created_at),
      escapeCsvCell(o.note || ''),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ceo-power-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    success(`Exported ${filteredOrders.length} order(s) to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
            Order Requests
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review, track, and update fulfillment status for orders submitted by registered resellers.
          </p>
        </div>

        {canExportCsv && (
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleExportCsv}
            className="gap-2 font-bold self-start sm:self-auto"
          >
            <Download className="w-4 h-4 text-[#187004]" />
            <span>Export CSV</span>
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by order ref or partner name..."
            className="w-full min-h-[40px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#187004]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filter orders by status"
            className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="new">New Requests</option>
            <option value="confirmed">Confirmed</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {canViewResellers && (
            <select
              value={resellerFilter}
              onChange={e => setResellerFilter(e.target.value)}
              aria-label="Filter orders by reseller"
              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-white max-w-[180px] truncate"
            >
              <option value="all">All Resellers</option>
              {profiles
                .filter(p => p.role === 'reseller')
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.business_name || p.username})
                  </option>
                ))}
            </select>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No order requests found matching the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Order Ref</th>
                  <th className="px-6 py-3.5">Reseller / Business</th>
                  <th className="px-6 py-3.5">Items</th>
                  <th className="px-6 py-3.5">Total Amount</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredOrders.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => handleOpenDrawer(order)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-[#187004]">
                      {order.ref}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">
                        {order.reseller?.full_name || 'Reseller'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {order.reseller?.business_name || 'Partner'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {order.items.reduce((s, i) => s + i.qty, 0)} units ({order.items.length} lines)
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 tabular-nums">
                      {formatNaira(order.total)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <OrderBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-bold text-[#D98200] hover:underline">
                        {canUpdateStatus ? 'Details & Status →' : 'View Details →'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Drawer */}
      {drawerOpen && selectedOrder && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Order Details
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h2 className="text-xl font-extrabold text-[#187004] font-heading">
                    {selectedOrder.ref}
                  </h2>
                  <OrderBadge status={selectedOrder.status} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                aria-label="Close order details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Reseller Contact
                  </span>
                  {selectedOrder.reseller?.phone && (
                    <Button
                      type="button"
                      size="sm"
                      variant="whatsapp"
                      onClick={() => handleChatReseller(selectedOrder)}
                      className="text-xs font-bold py-1 h-8"
                    >
                      <MessageSquare className="w-3.5 h-3.5 mr-1" />
                      Chat on WhatsApp
                    </Button>
                  )}
                </div>
                <div className="text-sm">
                  <p className="font-bold text-slate-900">{selectedOrder.reseller?.full_name}</p>
                  <p className="text-xs text-slate-600">{selectedOrder.reseller?.business_name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Phone: {selectedOrder.reseller?.phone} • {selectedOrder.reseller?.city}, {selectedOrder.reseller?.state}
                  </p>
                </div>
              </div>

              {canUpdateStatus && (
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Change Order Status:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['new', 'confirmed', 'fulfilled', 'cancelled'] as OrderStatus[]).map(statusKey => (
                      <button
                        key={statusKey}
                        type="button"
                        disabled={isUpdatingStatus || selectedOrder.status === statusKey}
                        onClick={() => handleStatusChange(selectedOrder.id, statusKey)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                          selectedOrder.status === statusKey
                            ? 'bg-[#187004] text-white border-[#187004] shadow-xs'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {statusKey}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
                  Ordered Products ({selectedOrder.items.length})
                </span>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-3">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-lg object-cover bg-white border border-slate-200 shrink-0"
                          />
                        )}
                        <div>
                          <p className="font-bold text-slate-900 text-xs sm:text-sm">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.qty} units × {formatNaira(item.unit_price)}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {formatNaira(item.line_total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.note && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
                  <span className="font-bold uppercase tracking-wider block">Reseller Order Note:</span>
                  <p>{selectedOrder.note}</p>
                </div>
              )}

              <div className="p-4 rounded-xl bg-[#187004] text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-200 block tracking-wider">
                    Grand Total
                  </span>
                  <span className="text-2xl font-black tabular-nums font-heading">
                    {formatNaira(selectedOrder.total)}
                  </span>
                </div>
                <span className="text-xs text-emerald-100">
                  {formatDate(selectedOrder.created_at)}
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setDrawerOpen(false)}
              >
                Close Drawer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
