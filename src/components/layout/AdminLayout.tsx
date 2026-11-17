import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Package,
  Layers,
  Users,
  ShoppingBag,
  Settings,
  ExternalLink,
  LogOut,
  Menu,
  X,
  Shield,
  UserCog,
  History,
  Bell,
  AlertTriangle,
  CheckCheck,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../context/PermissionsContext';
import { dataService } from '../../services/dataService';
import { PermissionKey } from '../../types';
import { Footer } from '../ui/Footer';

interface MenuItemConfig {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: PermissionKey;
  superAdminOnly?: boolean;
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, logout } = useAuthStore();
  const { can, isSuperAdmin, roleBadge, firstAllowedRoute } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [alertsMenuOpen, setAlertsMenuOpen] = useState(false);
  const alertsPopoverRef = useRef<HTMLDivElement | null>(null);

  const canViewProducts = can('products.view');

  const { data: alertSummary } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: () => dataService.getInventoryAlerts(),
    enabled: canViewProducts,
    refetchInterval: 60_000,
  });

  const allAlerts = alertSummary?.notifications ?? [];
  const unreadAlerts = allAlerts.filter(n => !n.is_read);
  const unreadCount = unreadAlerts.length;
  const totalAlertCount = alertSummary?.totalAlertCount ?? 0;
  const alertThreshold = alertSummary?.threshold ?? 10;

  useEffect(() => {
    setAlertsMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!alertsMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (alertsPopoverRef.current && !alertsPopoverRef.current.contains(e.target as Node)) {
        setAlertsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAlertsMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [alertsMenuOpen]);

  const handleMarkAllRead = async () => {
    if (unreadAlerts.length === 0) return;
    await dataService.acknowledgeAllLowStockAlerts(unreadAlerts);
    await queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const primaryMenuItems: MenuItemConfig[] = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, permission: 'dashboard.view' },
    { label: 'Products', path: '/admin/products', icon: Package, permission: 'products.view' },
    { label: 'Categories', path: '/admin/categories', icon: Layers, permission: 'categories.view' },
    { label: 'Resellers', path: '/admin/resellers', icon: Users, permission: 'resellers.view' },
    { label: 'Order Requests', path: '/admin/orders', icon: ShoppingBag, permission: 'orders.view' },
    { label: 'Settings', path: '/admin/settings', icon: Settings, permission: 'settings.view' },
  ];

  const governanceMenuItems: MenuItemConfig[] = [
    { label: 'Team & Roles', path: '/admin/team', icon: UserCog, superAdminOnly: true },
    { label: 'Activity Log', path: '/admin/activity', icon: History, superAdminOnly: true },
  ];

  const visiblePrimaryItems = primaryMenuItems.filter(item =>
    item.permission ? can(item.permission) : true
  );
  const visibleGovernanceItems = governanceMenuItems.filter(item =>
    item.superAdminOnly ? isSuperAdmin : true
  );

  const brandHome = firstAllowedRoute !== '/admin/no-access' ? firstAllowedRoute : '/admin';

  return (
    <div className="min-h-screen flex bg-[#F7F9F7] text-slate-800">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0e3e03] text-white shrink-0 border-r border-[#187004]/30 select-none">
        {/* Brand Header */}
        <div className="h-20 flex items-center px-5 border-b border-[#187004]/30">
          <Link to={brandHome} className="flex items-center gap-3">
            <div className="bg-white px-2.5 py-1.5 rounded-xl shadow-xs flex items-center">
              <img
                src="/logo.png"
                alt="CEO Power Company"
                className="h-7 w-auto object-contain"
              />
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-[#F5A623]">
                Admin Console
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {visiblePrimaryItems.map(item => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-[#187004] text-white shadow-xs'
                    : 'text-emerald-100/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.path === '/admin/products' && totalAlertCount > 0 && (
                  <span
                    title={`${totalAlertCount} low-stock product(s)`}
                    className="px-1.5 py-0.5 rounded-md bg-[#F5A623] text-slate-950 text-[10px] font-extrabold tabular-nums shrink-0"
                  >
                    {totalAlertCount}
                  </span>
                )}
              </Link>
            );
          })}

          {visibleGovernanceItems.length > 0 && (
            <>
              <div className="pt-6 pb-2">
                <span className="px-3.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">
                  Security & Governance
                </span>
              </div>
              {visibleGovernanceItems.map(item => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#187004] text-white shadow-xs'
                        : 'text-emerald-100/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </>
          )}

          <div className="pt-6 pb-2">
            <span className="px-3.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">
              Quick Links
            </span>
          </div>

          <Link
            to="/catalog"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-emerald-100/80 hover:text-white hover:bg-white/10 transition-all"
          >
            <div className="flex items-center gap-3">
              <ExternalLink className="w-4 h-4 shrink-0 text-emerald-300" />
              <span>Reseller Storefront</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-emerald-200">New tab</span>
          </Link>
        </nav>

        {/* User profile, Role Badge & Logout */}
        <div className="p-4 border-t border-[#187004]/30 bg-[#092802]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#187004] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {profile?.full_name || profile?.username || 'Admin'}
                </p>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-bold text-emerald-200 truncate max-w-full">
                  {roleBadge}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out of Admin Console"
              className="p-2 text-emerald-200 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area with Top Header (Desktop Role Header + Mobile Top Bar) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Identity Bar */}
        <header className="hidden lg:flex items-center justify-between bg-white border-b border-slate-200/80 px-8 h-16 shrink-0 relative z-20">
          <div className="text-xs font-semibold text-slate-500">
            CEO Power Company — Partner Operations Console
          </div>
          <div className="flex items-center gap-4">
            {canViewProducts && (
              <div className="relative" ref={alertsPopoverRef}>
                <button
                  type="button"
                  onClick={() => setAlertsMenuOpen(prev => !prev)}
                  aria-expanded={alertsMenuOpen}
                  aria-label="Inventory low-stock notifications"
                  className={`relative p-2 rounded-xl border transition-colors cursor-pointer ${
                    unreadCount > 0
                      ? 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums shadow-xs">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {alertsMenuOpen && (
                  <div
                    role="dialog"
                    aria-label="Low-stock notifications menu"
                    className="absolute right-0 mt-2 w-88 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl z-40 overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                      <div>
                        <p className="text-xs font-extrabold text-slate-900 font-heading">
                          Inventory Alerts
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {totalAlertCount} product(s) below {alertThreshold} units
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#187004] hover:underline cursor-pointer"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Mark all read</span>
                        </button>
                      )}
                    </div>

                    {unreadAlerts.length === 0 ? (
                      <div className="p-5 text-center text-xs text-slate-500">
                        {totalAlertCount === 0
                          ? `No products below ${alertThreshold} units.`
                          : 'All current low-stock alerts have been acknowledged.'}
                      </div>
                    ) : (
                      <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                        {unreadAlerts.slice(0, 6).map(item => (
                          <li key={item.id}>
                            <Link
                              to={`/admin/products/${item.product_id}`}
                              onClick={() => setAlertsMenuOpen(false)}
                              className="flex items-start gap-2.5 px-4 py-3 hover:bg-orange-50/70 transition-colors"
                            >
                              <AlertTriangle
                                className={`w-4 h-4 mt-0.5 shrink-0 ${
                                  item.type === 'out_of_stock' ? 'text-red-600' : 'text-orange-600'
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {item.product_name}
                                </p>
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                  {item.type === 'out_of_stock'
                                    ? 'Out of stock (0 units)'
                                    : typeof item.stock_quantity === 'number'
                                      ? `${item.stock_quantity} units left (threshold ${item.threshold})`
                                      : `Marked low stock (threshold ${item.threshold} units)`}
                                </p>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
                      <Link
                        to="/admin"
                        onClick={() => setAlertsMenuOpen(false)}
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                      >
                        Dashboard Alerts
                      </Link>
                      <Link
                        to="/admin/products?alerts=1"
                        onClick={() => setAlertsMenuOpen(false)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#187004] hover:underline"
                      >
                        <span>Review in Catalogue</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-right">
              <span className="text-xs font-bold text-slate-900">
                {profile?.full_name || profile?.username}
              </span>
              <span className="text-xs text-slate-400 ml-1.5 font-mono">
                @{profile?.username}
              </span>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                isSuperAdmin
                  ? 'bg-[#187004]/10 text-[#187004] border-[#187004]/30'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {roleBadge}
            </span>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#0e3e03] text-white px-4 h-16 flex items-center justify-between border-b border-[#187004]/30 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="p-2 -ml-2 text-slate-200 hover:text-white rounded-lg focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="bg-white px-2 py-1 rounded-lg flex items-center shrink-0">
              <img
                src="/logo.png"
                alt="CEO Power"
                className="h-6 w-auto object-contain"
              />
            </div>
            <span className="text-[11px] font-bold text-emerald-200 bg-white/10 px-2 py-0.5 rounded-md truncate">
              {roleBadge}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canViewProducts && (
              <Link
                to="/admin/products?alerts=1"
                aria-label={`Low-stock alerts (${unreadCount} unread)`}
                className="relative p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#F5A623] text-slate-950 text-[10px] font-extrabold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )}
            <Link
              to="/catalog"
              aria-label="View catalogue"
              className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium flex items-center gap-1"
            >
              <span>Catalog</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="p-2 text-slate-300 hover:text-red-400"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Mobile Drawer Backdrop and Drawer */}
        {mobileDrawerOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 flex"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative flex flex-col w-72 max-w-xs bg-[#0e3e03] text-white h-full shadow-2xl z-10">
              <div className="h-16 flex items-center justify-between px-6 border-b border-[#187004]/30">
                <div className="bg-white px-2 py-1 rounded-lg flex items-center">
                  <img
                    src="/logo.png"
                    alt="CEO Power"
                    className="h-6 w-auto object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-2 text-slate-300 hover:text-white rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="px-5 py-3 border-b border-[#187004]/30 bg-[#092802]">
                <p className="text-xs font-bold text-white truncate">
                  {profile?.full_name || profile?.username}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-bold text-emerald-200">
                  {roleBadge}
                </span>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {visiblePrimaryItems.map(item => {
                  const isActive =
                    location.pathname === item.path ||
                    (item.path !== '/admin' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-[#187004] text-white'
                          : 'text-emerald-100 hover:text-white'
                      }`}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {visibleGovernanceItems.length > 0 && (
                  <>
                    <div className="pt-4 pb-1">
                      <span className="px-3.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">
                        Security & Governance
                      </span>
                    </div>
                    {visibleGovernanceItems.map(item => {
                      const isActive = location.pathname.startsWith(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileDrawerOpen(false)}
                          className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                            isActive
                              ? 'bg-[#187004] text-white'
                              : 'text-emerald-100 hover:text-white'
                          }`}
                        >
                          <item.icon className="w-5 h-5 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </>
                )}
              </nav>

              <div className="p-4 border-t border-[#187004]/30">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600/30 text-red-200 font-semibold text-sm hover:bg-red-600/40"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Container */}
        <main className="flex-1 p-5 sm:p-7 lg:p-9 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Site Footer */}
        <Footer />
      </div>
    </div>
  );
}
