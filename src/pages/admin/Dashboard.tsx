import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Layers,
  Users,
  ShoppingBag,
  ArrowRight,
  PlusCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  RotateCcw,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { formatNaira, formatDate } from '../../lib/utils';
import { OrderBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { AdminNotification, AdminProduct, Category, OrderRequest, Profile } from '../../types';
import { usePermissions } from '../../context/PermissionsContext';

export default function Dashboard() {
  const { can, roleBadge } = usePermissions();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const canViewProducts = can('products.view');
  const canCreateProduct = can('products.create');
  const canViewCategories = can('categories.view');
  const canViewResellers = can('resellers.view');
  const canCreateReseller = can('resellers.create');
  const canViewOrders = can('orders.view');
  const canEditSettings = can('settings.edit');

  const { data: products = [] } = useQuery<AdminProduct[]>({
    queryKey: ['admin-products'],
    queryFn: () => dataService.getAdminProducts(),
    enabled: canViewProducts,
    staleTime: 1000 * 60,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories', false],
    queryFn: () => dataService.getCategories(false),
    enabled: canViewCategories,
    staleTime: 1000 * 60 * 5,
  });

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['admin-profiles'],
    queryFn: () => dataService.getProfiles(),
    enabled: canViewResellers,
    staleTime: 1000 * 60 * 2,
  });

  const { data: orders = [], isLoading: isOrdersLoading } = useQuery<OrderRequest[]>({
    queryKey: ['admin-orders'],
    queryFn: () => dataService.getOrderRequests(),
    enabled: canViewOrders,
    staleTime: 1000 * 30,
  });

  const { data: alertSummary, isLoading: isAlertsLoading } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: () => dataService.getInventoryAlerts(),
    enabled: canViewProducts,
    refetchInterval: 60_000,
  });

  const stats = useMemo(
    () => ({
      activeProducts: products.filter(p => p.is_active).length,
      categoriesCount: categories.length,
      activeResellers: profiles.filter(p => p.role === 'reseller' && p.status === 'active').length,
      newOrdersCount: orders.filter(o => o.status === 'new').length,
    }),
    [products, categories, profiles, orders]
  );

  const recentOrders = useMemo(() => orders.slice(0, 10), [orders]);
  const isLoading = isOrdersLoading && orders.length === 0;

  const handleAcknowledgeOne = async (notification: AdminNotification) => {
    try {
      await dataService.dismissInventoryAlert(notification.fingerprint, notification.id);
      await queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      success(`Acknowledged alert for "${notification.product_name}".`);
    } catch (err: any) {
      toastError(err?.message || 'Failed to acknowledge notification.');
    }
  };

  const handleAcknowledgeAll = async () => {
    if (!alertSummary || alertSummary.notifications.length === 0) return;
    try {
      await dataService.acknowledgeAllLowStockAlerts(alertSummary.notifications);
      await queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      success('All active low-stock notifications acknowledged.');
    } catch (err: any) {
      toastError(err?.message || 'Failed to acknowledge notifications.');
    }
  };

  const handleRestoreDismissed = async () => {
    try {
      await dataService.clearDismissedLowStockAlerts();
      await queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      success('Restored dismissed low-stock notifications.');
    } catch (err: any) {
      toastError(err?.message || 'Failed to restore notifications.');
    }
  };

  const threshold = alertSummary?.threshold ?? 10;
  const totalFlagged = alertSummary?.totalAlertCount ?? 0;
  const allNotifications = alertSummary?.notifications ?? [];
  const unreadNotifications = allNotifications.filter(n => !n.is_read);
  const dismissedCount = allNotifications.filter(n => n.is_read).length;

  return (
    <div className="space-y-8">
      {/* Page Title & Quick Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
            Executive Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Role: <span className="font-semibold text-slate-700">{roleBadge}</span> — Operations dashboard for CEO Power Company.
          </p>
        </div>

        {(canCreateProduct || canCreateReseller) && (
          <div className="flex flex-wrap items-center gap-2">
            {canCreateProduct && (
              <Link
                to="/admin/products/new"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#187004] hover:bg-[#0e3e03] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors"
              >
                <PlusCircle className="w-4 h-4 text-[#F5A623]" />
                <span>Add New Product</span>
              </Link>
            )}
            {canCreateReseller && (
              <Link
                to="/admin/resellers/new"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold transition-colors"
              >
                <Users className="w-4 h-4 text-slate-500" />
                <span>New Reseller</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Stat Cards Grid (Filtered by caller permissions) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {canViewProducts && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-slate-300/90 transition-all flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Active Products
              </span>
              <span className="text-2xl sm:text-3xl font-black text-[#187004] font-heading mt-1 block tabular-nums">
                {stats.activeProducts}
              </span>
              <Link
                to="/admin/products"
                className="text-xs font-semibold text-amber-700 hover:underline mt-2 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>Manage products</span>
                <ArrowRight className="w-3 h-3 shrink-0" />
              </Link>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
          </div>
        )}

        {canViewProducts && (
          <div
            className={`p-5 rounded-2xl border shadow-xs hover:shadow-sm transition-all flex items-center justify-between gap-2 ${
              totalFlagged > 0
                ? 'bg-orange-50/80 border-orange-300'
                : 'bg-white border-slate-200/80 hover:border-slate-300/90'
            }`}
          >
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Low-Stock Alerts
              </span>
              <span
                className={`text-2xl sm:text-3xl font-black font-heading mt-1 block tabular-nums ${
                  totalFlagged > 0 ? 'text-orange-700' : 'text-[#187004]'
                }`}
              >
                {totalFlagged}
              </span>
              <Link
                to="/admin/products?alerts=1"
                className={`text-xs font-semibold hover:underline mt-2 inline-flex items-center gap-1 whitespace-nowrap ${
                  totalFlagged > 0 ? 'text-orange-900' : 'text-slate-600'
                }`}
              >
                <span>Below {threshold} units</span>
                <ArrowRight className="w-3 h-3 shrink-0" />
              </Link>
            </div>
            <div
              className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
                totalFlagged > 0
                  ? 'bg-orange-100 border-orange-200 text-orange-700'
                  : 'bg-emerald-50 border-emerald-200/80 text-emerald-700'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        )}

        {canViewCategories && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-slate-300/90 transition-all flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Categories
              </span>
              <span className="text-2xl sm:text-3xl font-black text-[#187004] font-heading mt-1 block tabular-nums">
                {stats.categoriesCount}
              </span>
              <Link
                to="/admin/categories"
                className="text-xs font-semibold text-teal-700 hover:underline mt-2 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>View categories</span>
                <ArrowRight className="w-3 h-3 shrink-0" />
              </Link>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200/80 text-teal-700 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        )}

        {canViewResellers && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-slate-300/90 transition-all flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Active Resellers
              </span>
              <span className="text-2xl sm:text-3xl font-black text-[#187004] font-heading mt-1 block tabular-nums">
                {stats.activeResellers}
              </span>
              <Link
                to="/admin/resellers"
                className="text-xs font-semibold text-[#187004] hover:underline mt-2 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>View directory</span>
                <ArrowRight className="w-3 h-3 shrink-0" />
              </Link>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-[#187004] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
        )}

        {canViewOrders && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-slate-300/90 transition-all flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                New Order Requests
              </span>
              <span className="text-2xl sm:text-3xl font-black text-sky-700 font-heading mt-1 block tabular-nums">
                {stats.newOrdersCount}
              </span>
              <Link
                to="/admin/orders"
                className="text-xs font-semibold text-sky-700 hover:underline mt-2 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>Process orders</span>
                <ArrowRight className="w-3 h-3 shrink-0" />
              </Link>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200/80 text-sky-700 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      {/* Automated Low-Stock & Inventory Notifications Panel */}
      {canViewProducts && (
        <section
          aria-labelledby="inventory-notifications-heading"
          className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
        >
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  unreadNotifications.length > 0
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-emerald-50 text-[#187004]'
                }`}
              >
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="inventory-notifications-heading"
                    className="text-lg font-bold text-slate-900 font-heading"
                  >
                    Low-Stock Inventory Notifications
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                      unreadNotifications.length > 0
                        ? 'bg-orange-100 text-orange-900 border-orange-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {unreadNotifications.length} unread
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 tabular-nums">
                    Threshold: &lt; {threshold} units
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated alerts trigger whenever a product drops below your configured inventory threshold.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {dismissedCount > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRestoreDismissed}
                  className="text-xs gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Show Dismissed ({dismissedCount})</span>
                </Button>
              )}
              {unreadNotifications.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAcknowledgeAll}
                  className="text-xs gap-1.5"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-[#187004]" />
                  <span>Acknowledge All</span>
                </Button>
              )}
              {canEditSettings && (
                <Link
                  to="/admin/settings"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                >
                  <span>Threshold Settings</span>
                </Link>
              )}
              <Link
                to="/admin/products?alerts=1"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#187004] hover:underline px-2 py-1"
              >
                <span>Review Flagged Stock</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {isAlertsLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2].map(n => (
                <div key={n} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : unreadNotifications.length === 0 ? (
            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/40 text-sm">
              <div className="flex items-center gap-2.5 text-emerald-900">
                <Check className="w-4 h-4 text-[#187004] shrink-0" />
                <span className="font-medium">
                  {totalFlagged === 0
                    ? `All monitored products are stocked at or above ${threshold} units.`
                    : `All ${totalFlagged} low-stock item(s) have been acknowledged.`}
                </span>
              </div>
              {totalFlagged > 0 && (
                <Link
                  to="/admin/products?alerts=1"
                  className="text-xs font-bold text-amber-800 hover:underline shrink-0"
                >
                  View {totalFlagged} low-stock product(s) →
                </Link>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {unreadNotifications.map(notification => {
                const isOut = notification.type === 'out_of_stock';
                return (
                  <li
                    key={notification.id}
                    className={`px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      isOut ? 'bg-red-50/55 hover:bg-red-50/85' : 'bg-orange-50/50 hover:bg-orange-50/80'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isOut
                            ? 'bg-red-100 text-red-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/admin/products/${notification.product_id}`}
                            className="font-bold text-slate-900 hover:text-[#187004] font-heading truncate"
                          >
                            {notification.product_name}
                          </Link>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border tabular-nums ${
                              isOut
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : 'bg-orange-100 text-orange-900 border-orange-300'
                            }`}
                          >
                            {isOut
                              ? 'Out of stock • 0 units'
                              : typeof notification.stock_quantity === 'number'
                                ? `${notification.stock_quantity} / ${notification.threshold} units`
                                : `Low stock • < ${notification.threshold} units`}
                          </span>
                          {notification.sku && (
                            <span className="text-[11px] font-mono text-slate-500">
                              {notification.sku}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {notification.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 sm:pl-4">
                      <Link
                        to={`/admin/products/${notification.product_id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#187004] hover:bg-[#0e3e03] text-white text-xs font-bold transition-colors"
                      >
                        <span>Restock</span>
                      </Link>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledgeOne(notification)}
                        className="text-xs py-1 px-2.5 h-8 gap-1"
                      >
                        <Check className="w-3.5 h-3.5 text-[#187004]" />
                        <span>Acknowledge</span>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Latest 10 Order Requests */}
      {canViewOrders && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-heading">
                Latest 10 Order Requests
              </h2>
              <p className="text-xs text-slate-500">
                Orders received from resellers via the portal and WhatsApp dispatch.
              </p>
            </div>
            <Link
              to="/admin/orders"
              className="text-xs font-bold text-[#187004] hover:underline inline-flex items-center gap-1"
            >
              <span>View All Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No order requests received yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Ref</th>
                    <th className="px-6 py-3.5">Reseller / Business</th>
                    <th className="px-6 py-3.5">Items</th>
                    <th className="px-6 py-3.5">Total Amount</th>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {recentOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-[#187004]">
                        {order.ref}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">
                          {order.reseller?.full_name || 'Reseller'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {order.reseller?.business_name || 'Partner'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {order.items.reduce((s, i) => s + i.qty, 0)} units ({order.items.length} SKUs)
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
                        <Link
                          to="/admin/orders"
                          className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline"
                        >
                          View Details
                        </Link>
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

