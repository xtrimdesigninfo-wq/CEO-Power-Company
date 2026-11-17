import React from 'react';
import { Link } from 'react-router-dom';

interface FooterProps {
  variant?: 'light' | 'dark';
  className?: string;
  showAdminLink?: boolean;
}

export function Footer({
  variant = 'light',
  className = '',
  showAdminLink = false,
}: FooterProps) {
  const currentYear = new Date().getFullYear();

  if (variant === 'dark') {
    return (
      <footer
        className={`relative z-10 w-full border-t border-emerald-950 py-5 sm:py-4 lg:py-6 px-4 sm:px-6 text-xs text-emerald-300/75 ${className}`}
      >
        <div
          className={`max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center leading-relaxed ${
            showAdminLink ? 'sm:justify-between sm:text-left' : 'justify-center'
          }`}
        >
          <p>
            © {currentYear} CEO Power Company. All rights reserved.{' '}
            <span className="inline-block">
              Powered by{' '}
              <a
                href="https://xtrimdesigns.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-300 hover:text-white underline decoration-emerald-500/50 underline-offset-2 transition-colors"
              >
                Xtrim Design
              </a>
              .
            </span>
          </p>
          {showAdminLink && (
            <Link
              to="/admin/login"
              className="font-medium text-emerald-300/75 hover:text-emerald-200 underline decoration-emerald-500/40 underline-offset-4 transition-colors shrink-0"
            >
              Admin Console
            </Link>
          )}
        </div>
      </footer>
    );
  }

  return (
    <footer
      className={`bg-white border-t border-slate-200 py-5 sm:py-6 px-4 sm:px-6 text-xs text-slate-500 ${className}`}
    >
      <div
        className={`max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center leading-relaxed ${
          showAdminLink ? 'sm:justify-between sm:text-left' : 'justify-center'
        }`}
      >
        <p>
          © {currentYear} CEO Power Company. All rights reserved.{' '}
          <span className="inline-block">
            Powered by{' '}
            <a
              href="https://xtrimdesigns.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#187004] hover:text-[#135903] underline decoration-[#187004]/40 underline-offset-2 transition-colors"
            >
              Xtrim Design
            </a>
            .
          </span>
        </p>
        {showAdminLink && (
          <Link
            to="/admin/login"
            className="font-bold text-amber-700 hover:text-amber-800 underline decoration-amber-600/50 underline-offset-4 transition-colors shrink-0"
          >
            Admin Console
          </Link>
        )}
      </div>
    </footer>
  );
}
