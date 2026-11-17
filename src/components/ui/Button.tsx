import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'whatsapp' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none select-none cursor-pointer';

    const variants = {
      primary: 'bg-[#187004] hover:bg-[#135903] text-white font-bold focus-visible:ring-[#187004] shadow-sm',
      secondary: 'bg-[#0e3e03] hover:bg-[#187004] text-white focus-visible:ring-[#187004] shadow-sm',
      whatsapp: 'bg-[#25D366] hover:bg-[#1EBE5D] text-white focus-visible:ring-[#25D366] shadow-sm font-bold',
      outline: 'border border-slate-300 bg-white hover:bg-[#f0f8ed] hover:border-[#187004] text-slate-800 focus-visible:ring-[#187004]',
      danger: 'bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-600 shadow-sm',
      ghost: 'bg-transparent hover:bg-[#f0f8ed] text-slate-700 focus-visible:ring-[#187004]',
    };

    const sizes = {
      sm: 'h-9 px-3 text-xs min-h-[36px]',
      md: 'h-11 px-4 text-sm min-h-[44px]', // Ensures 44px minimum tap target
      lg: 'h-13 px-6 text-base min-h-[50px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
