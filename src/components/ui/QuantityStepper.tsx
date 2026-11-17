import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function QuantityStepper({
  value,
  min = 1,
  max = 9999,
  step = 1,
  disabled = false,
  onChange,
  className,
  size = 'md',
}: QuantityStepperProps) {
  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || value <= min) return;
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || value >= max) return;
    onChange(Math.min(max, value + step));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10);
    if (!isNaN(raw)) {
      onChange(Math.max(min, Math.min(max, raw)));
    }
  };

  const isSm = size === 'sm';

  return (
    <div
      className={cn(
        'inline-flex items-center border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden',
        isSm ? 'h-9' : 'h-11 min-h-[44px]',
        disabled && 'opacity-50 pointer-events-none bg-slate-50',
        className
      )}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        className={cn(
          'flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent',
          isSm ? 'w-8 h-8' : 'w-11 h-11 min-w-[44px] min-h-[44px]'
        )}
      >
        <Minus className={isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      </button>

      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        aria-label="Item quantity"
        className={cn(
          'text-center font-bold text-slate-800 focus:outline-none bg-transparent tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          isSm ? 'w-10 text-xs' : 'w-12 text-sm'
        )}
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
        className={cn(
          'flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent',
          isSm ? 'w-8 h-8' : 'w-11 h-11 min-w-[44px] min-h-[44px]'
        )}
      >
        <Plus className={isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      </button>
    </div>
  );
}
