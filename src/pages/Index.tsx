import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MousePointer2 } from 'lucide-react';
import { AntiGravityCanvas } from '../components/ui/particle-effect-for-hero';
import { Footer } from '../components/ui/Footer';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const { isAuthenticated, role, profile } = useAuthStore();

  return (
    <div className="min-h-screen sm:min-h-0 lg:min-h-screen flex flex-col bg-[#071d02] text-white">
      {/* Interactive Particle Hero Section */}
      <section className="relative flex-1 sm:flex-none lg:flex-1 flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8 py-10 sm:py-8 md:py-10 lg:py-16">
        {/* Interactive Canvas Background */}
        <AntiGravityCanvas
          accentColor="#22c55e"
          glowRgb="24, 112, 4"
          backgroundColor="#071d02"
        />

        {/* Subtle gradient scrim + solar gold ambient rim for crisp text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#071d02]/60 via-transparent to-[#071d02]/85 pointer-events-none z-0" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[540px] h-[260px] bg-[#F5A623]/10 blur-3xl rounded-full pointer-events-none z-0" />

        {/* Hero Center Content */}
        <div className="relative z-10 max-w-5xl w-full mx-auto text-center pointer-events-none">
          {/* Brand Logo */}
          <div className="mb-7 flex justify-center pointer-events-auto">
            <div className="bg-white px-5 py-3 rounded-2xl shadow-xl border border-emerald-950/60 inline-flex items-center">
              <img
                src="/logo.png"
                alt="CEO Power Company"
                className="h-10 sm:h-12 w-auto object-contain"
              />
            </div>
          </div>

          <h1
            className="font-extrabold tracking-tight text-white leading-[1.08] mx-auto max-w-4xl font-heading"
            style={{
              fontSize: 'clamp(2.25rem, 5vw, 4.25rem)',
              textWrap: 'balance',
            }}
          >
            Wholesale Solar Distribution Portal
          </h1>

          <p className="mt-5 max-w-2xl mx-auto text-base sm:text-lg text-emerald-100/80 leading-relaxed">
            Private B2B ordering platform for authorized solar resellers, contractors, and executive management. Access live trade pricing and dispatch orders straight to WhatsApp.
          </p>

          {/* Portal Link (Centralised Partner CTA) */}
          <div className="mt-9 flex justify-center pointer-events-auto">
            <Link
              to="/login"
              className="w-full sm:w-auto min-h-[50px] inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-[#187004] hover:bg-[#135903] text-white text-sm sm:text-base font-bold shadow-lg shadow-black/30 border border-emerald-400/20 transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5A623]"
            >
              <span>Partner Sign In</span>
              <ArrowRight className="w-4 h-4 text-[#F5A623]" />
            </Link>
          </div>

          {/* Authenticated Session Quick Link (if already signed in) */}
          {isAuthenticated && profile && (
            <div className="mt-6 pointer-events-auto">
              <Link
                to={role === 'admin' || role === 'staff' ? '/admin' : '/catalog'}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-amber-300 hover:text-white underline underline-offset-4 transition-colors"
              >
                <span>
                  Signed in as {profile.username} · Continue to{' '}
                  {role === 'admin' || role === 'staff' ? 'Admin Console' : 'Wholesale Catalog'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Subtle Bottom Interaction Hint */}
        <div className="relative z-10 mt-10 flex items-center justify-center gap-2 text-xs text-emerald-200/50 pointer-events-none">
          <MousePointer2 className="w-3.5 h-3.5" />
          <span>Move cursor across field to interact</span>
        </div>
      </section>

      {/* Site Footer */}
      <Footer variant="dark" className="bg-[#071d02]" showAdminLink />
    </div>
  );
}
