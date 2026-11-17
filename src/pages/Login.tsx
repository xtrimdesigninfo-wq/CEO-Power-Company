import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  MessageCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Package,
  Layers,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Footer } from '../components/ui/Footer';
import { normalizeWhatsAppNumber, formatWhatsAppDisplay } from '../lib/whatsapp';
import { useCompanySettings } from '../hooks/useCompanySettings';

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Please enter your partner username or email'),
  password: z.string().min(1, 'Please enter your password'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();
  const { settings } = useCompanySettings();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      usernameOrEmail: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    clearError();
    try {
      const session = await login(data.usernameOrEmail, data.password);
      if (from) {
        navigate(from, { replace: true });
      } else if (session.profile.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/catalog', { replace: true });
      }
    } catch {
      // Error handled by store
    }
  };

  const handleQuickFillReseller = () => {
    setValue('usernameOrEmail', 'solarplus_onitsha');
    setValue('password', 'Partner2024!');
  };

  const whatsappDigits = normalizeWhatsAppNumber(settings.whatsapp_number);
  const whatsappDisplay = formatWhatsAppDisplay(settings.whatsapp_number);
  const salesWhatsAppUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
    'Hello CEO Power Company sales team, I would like to inquire about becoming an approved reseller/trade partner in Nigeria.'
  )}`;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAF8] text-slate-800">
      {/* Top Banner for Reseller Announcement */}
      <div className="bg-[#0e3e03] text-white text-xs py-2.5 px-4 text-center font-medium border-b border-[#187004]/40">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2.5 flex-wrap">
          <span className="font-bold uppercase tracking-wider bg-[#F5A623] text-slate-950 px-2 py-0.5 rounded text-[10px]">
            Trade Hub
          </span>
          <span className="text-emerald-100/90">
            Authorized Nigerian Solar Resellers &amp; Certified Installers Ordering Portal
          </span>
        </div>
      </div>

      {/* Main Content Split / Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-16">
        
        {/* Left Side: Partner Benefits & Brand Presentation */}
        <div className="w-full lg:w-1/2 max-w-xl">
          <div className="mb-6 flex items-center justify-start">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#187004] hover:text-[#135903] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </div>

          {/* Official Company Logo */}
          <div className="mb-6">
            <Link
              to="/"
              aria-label="CEO Power Company Home"
              className="inline-block focus:outline-none"
            >
              <img
                src="/logo.png"
                alt="CEO Power Company Logo"
                className="h-14 sm:h-16 w-auto object-contain"
              />
            </Link>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-50 text-amber-800 text-xs font-bold uppercase tracking-wider mb-4 border border-amber-200/80">
            <ShieldCheck className="w-4 h-4 text-amber-600" /> B2B Trade Partner Network
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black text-slate-900 tracking-tight font-heading leading-[1.12]">
            Ship Solar Supply Direct from CEO Power Company.
          </h1>

          <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-lg">
            Welcome to the official partner portal of CEO Power Company. Access live dealer pricing, reserve inventory, and dispatch verified orders directly to our sales desk.
          </p>

          {/* Value Props Checklist */}
          <div className="mt-8 space-y-3.5">
            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-600 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-heading">Tier-1 Wholesale Pricing</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Pre-negotiated contractor rates for LONGi, Jinko, ZN Shine, and Tongwei solar panels.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200/70 text-sky-600 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-heading">Direct WhatsApp Dispatch</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Instant cart formatting sent straight to our sales representative at {whatsappDisplay}.
                </p>
              </div>
            </div>
          </div>

          {/* Company website link */}
          <div className="mt-7 pt-6 border-t border-slate-200/80 flex flex-wrap items-center justify-start gap-3 text-xs text-slate-500">
            <a
              href="https://ceopowercompany.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#187004] hover:underline"
            >
              <span>ceopowercompany.org</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Right Side: Partner Login Form Card */}
        <div className="w-full lg:w-1/2 max-w-md">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-900/5 p-6 sm:p-10 relative overflow-hidden">
            {/* Top decorative dual-tone solar accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#187004] via-[#22c55e] to-[#F5A623]" />

            <div className="mb-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#187004] bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-md">
                  Partner Sign In
                </span>
                <span className="text-xs font-medium text-slate-400">Reseller Access</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 font-heading mt-3.5">
                Access Trade Catalog
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Sign in with your assigned partner username or email to view dealer pricing.
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-800"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="leading-snug font-medium text-xs sm:text-sm">
                  {error}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Username or Email */}
              <div>
                <label
                  htmlFor="partner-username"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5"
                >
                  Partner Username or Email
                </label>
                <input
                  id="partner-username"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. solarplus_onitsha or partner@company.com"
                  aria-invalid={errors.usernameOrEmail ? 'true' : 'false'}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#187004] focus:border-[#187004] transition-all"
                  {...register('usernameOrEmail')}
                />
                {errors.usernameOrEmail && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    {errors.usernameOrEmail.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="partner-password"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="partner-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    aria-invalid={errors.password ? 'true' : 'false'}
                    className="w-full min-h-[46px] px-4 py-2.5 pr-12 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#187004] focus:border-[#187004] transition-all"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-md focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full text-base font-bold shadow-md bg-[#187004] hover:bg-[#135903] text-white mt-2"
              >
                <span>Enter Reseller Portal</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>

            {/* Quick Fill Sample Reseller */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center">
              <button
                type="button"
                onClick={handleQuickFillReseller}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#187004] font-medium transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#187004]" />
                <span>Fill Demo Reseller (solarplus_onitsha)</span>
              </button>
            </div>

            {/* Onboarding Box */}
            <div className="mt-6 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-center">
              <p className="text-xs text-slate-700 font-medium">
                Not yet a registered partner?
              </p>
              <a
                href={salesWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold shadow-sm transition-all w-full"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contact Sales Desk on WhatsApp</span>
              </a>
              <p className="mt-2 text-[11px] text-slate-500">
                Partner accounts are issued strictly by CEO Power Company management.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
