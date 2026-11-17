import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Grid, FileText, User, LogOut, ShieldCheck, Menu, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { FloatingWhatsApp } from '../ui/FloatingWhatsApp';
import { Footer } from '../ui/Footer';

export function ResellerLayout({ children }: { children: React.ReactNode }) {
  const { profile, logout } = useAuthStore();
  const { getItemCount } = useCartStore();
  const location = useLocation();
  const navigate = useNavigate();
  const itemCount = getItemCount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Catalogue', path: '/catalog', icon: Grid },
    { label: 'Cart', path: '/cart', icon: ShoppingBag, badge: itemCount },
    { label: 'Orders', path: '/orders', icon: FileText },
    { label: 'Account', path: '/account', icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9F7] text-slate-800 pb-[68px] md:pb-0">
      {/* Top Banner & Sticky Header */}
      <header
        ref={headerRef}
        className="sticky top-0 z-30 bg-[#0e3e03] text-white shadow-md border-b border-[#187004]/30"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[72px] sm:h-20 gap-3">
            {/* Logo */}
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/catalog" className="flex items-center gap-3.5 group focus:outline-none">
                <div className="bg-white px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl shadow-xs flex items-center group-hover:shadow-md transition-all shrink-0">
                  <img
                    src="/logo.png"
                    alt="CEO Power Company"
                    className="h-9 sm:h-11 lg:h-10 w-auto object-contain"
                  />
                </div>
                <div className="hidden sm:block min-w-0">
                  <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30">
                    B2B Partner Portal
                  </span>
                  <p className="text-[11px] text-emerald-100/75 tracking-wide font-medium truncate mt-0.5">
                    Power Without Limits • Onitsha, Anambra State
                  </p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation Links (lg+) */}
            <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-1.5">
              {navItems.map(item => {
                const isActive = location.pathname === item.path || (item.path === '/catalog' && location.pathname.startsWith('/product'));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#187004] text-white shadow-xs'
                        : 'text-emerald-100 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-[#F5A623] text-slate-950 text-[11px] font-extrabold rounded-md tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right side: Partner badge, Cart Icon, Desktop Logout, Tablet/Mobile Hamburger */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {profile && (
                <div className="hidden xl:flex flex-col text-right pr-2 border-r border-[#187004]/40">
                  <span className="text-xs font-bold text-white leading-tight truncate max-w-[160px]">
                    {profile.business_name || profile.full_name}
                  </span>
                  <span className="text-[11px] text-emerald-300 font-medium flex items-center justify-end gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-300" /> Trade Pricing Active
                  </span>
                </div>
              )}

              {/* Cart Icon Button (Mobile, Tablet & Desktop) */}
              <Link
                to="/cart"
                aria-label={`View Cart, ${itemCount} items`}
                className="relative flex items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-[#F5A623] text-slate-950 text-[11px] font-extrabold rounded-full flex items-center justify-center border-2 border-[#0e3e03] tabular-nums">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </Link>

              {/* Desktop Log Out button (lg+) */}
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out of Reseller Portal"
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-100 hover:text-white hover:bg-red-500/20 hover:border-red-500/30 border border-transparent transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-emerald-200" />
                <span>Log out</span>
              </button>

              {/* Hamburger Menu Toggle (Mobile & Tablet < lg) */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(prev => !prev)}
                aria-expanded={isMobileMenuOpen}
                aria-controls="partner-nav-dropdown"
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                className="lg:hidden flex items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Tablet & Mobile Hamburger Dropdown Menu */}
        {isMobileMenuOpen && (
          <div
            id="partner-nav-dropdown"
            className="lg:hidden bg-[#0a2f02] border-t border-white/10 shadow-xl"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3">
              {profile && (
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {profile.business_name || profile.full_name}
                    </p>
                    <p className="text-[11px] text-emerald-300 font-medium flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>Trade Pricing Active</span>
                    </p>
                  </div>
                </div>
              )}

              <nav aria-label="Tablet Navigation Menu" className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {navItems.map(item => {
                  const isActive = location.pathname === item.path || (item.path === '/catalog' && location.pathname.startsWith('/product'));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                        isActive
                          ? 'bg-[#187004] text-white shadow-xs'
                          : 'text-emerald-100 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </span>
                      {typeof item.badge === 'number' && item.badge > 0 && (
                        <span className="px-2 py-0.5 bg-[#F5A623] text-slate-950 text-[11px] font-extrabold rounded-md tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-200 hover:text-white bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 transition-colors min-h-[44px] cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-10">
        {children}
      </main>

      {/* Site Footer */}
      <Footer className="pb-20 sm:pb-20 md:pb-6" />

      {/* Floating WhatsApp Button */}
      <FloatingWhatsApp />

      {/* Mobile Bottom Tab Bar (Reseller) */}
      <nav 
        aria-label="Mobile Navigation" 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg px-2 py-1.5 flex items-center justify-around safe-area-inset-bottom"
      >
        {navItems.map(item => {
          const isActive = location.pathname === item.path || (item.path === '/catalog' && location.pathname.startsWith('/product'));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center min-h-[44px] min-w-[64px] py-1 rounded-xl transition-colors relative ${
                isActive ? 'text-[#187004]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px] text-[#187004]' : 'stroke-[1.75px]'}`} />
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 bg-[#F5A623] text-slate-950 text-[10px] font-extrabold rounded-full tabular-nums">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-[#187004]' : 'font-medium'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#187004] mt-0.5" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
