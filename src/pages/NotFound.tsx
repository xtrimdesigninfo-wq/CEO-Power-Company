import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Footer } from '../components/ui/Footer';

export default function NotFound() {
  const { isAuthenticated, role } = useAuthStore();

  const homePath = !isAuthenticated ? '/login' : role === 'admin' ? '/admin' : '/catalog';
  const homeLabel = !isAuthenticated ? 'Go to Login' : role === 'admin' ? 'Back to Admin Console' : 'Back to Product Catalog';

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA]">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-lg p-8 sm:p-10 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
              <img src="/logo.png" alt="CEO Power Company" className="h-10 w-auto object-contain" />
            </div>
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-[#187004] text-xs font-bold uppercase tracking-wider mb-2">
            Page Not Found (404)
          </span>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
            Lost in the Circuit?
          </h1>

          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            The page or product link you requested doesn't exist or may have been relocated.
          </p>

          <div className="mt-8">
            <Link
              to={homePath}
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-xl bg-[#187004] hover:bg-[#135903] text-white font-bold text-sm shadow-md transition-colors"
            >
              <span>{homeLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Compass className="w-3.5 h-3.5 text-[#187004]" />
            <span>CEO Power Company • Power Without Limits</span>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
