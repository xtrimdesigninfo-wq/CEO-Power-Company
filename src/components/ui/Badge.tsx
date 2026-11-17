import React from 'react';
import { cn } from '../../lib/utils';
import { StockStatus, OrderStatus, UserStatus } from '../../types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-orange-50 text-orange-800 border-orange-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide uppercase',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StockBadge({ status }: { status: StockStatus }) {
  if (status === 'in_stock') {
    return (
      <Badge variant="success" className="gap-1.5 normal-case font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
        In Stock
      </Badge>
    );
  }
  if (status === 'low_stock') {
    return (
      <Badge variant="warning" className="gap-1.5 normal-case font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
        Low Stock
      </Badge>
    );
  }
  return (
    <Badge variant="danger" className="gap-1.5 normal-case font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
      Out of Stock
    </Badge>
  );
}

export function OrderBadge({ status }: { status: OrderStatus }) {
  const configs: Record<OrderStatus, { label: string; variant: 'info' | 'warning' | 'success' | 'danger' }> = {
    new: { label: 'New Request', variant: 'info' },
    confirmed: { label: 'Confirmed', variant: 'warning' },
    fulfilled: { label: 'Fulfilled', variant: 'success' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
  };

  const { label, variant } = configs[status] || { label: status, variant: 'default' };
  return <Badge variant={variant}>{label}</Badge>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  if (status === 'active') {
    return <Badge variant="success">Active</Badge>;
  }
  return <Badge variant="danger">Suspended</Badge>;
}
