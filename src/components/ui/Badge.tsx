import React from 'react';
import { cn, getStatusBadgeClass } from '@/lib/utils';
import { CheckCircle2, Clock, AlertCircle, CircleDot } from 'lucide-react';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'status';
  status?: string;
  className?: string;
}

export function Badge({ children, variant = 'default', status, className }: BadgeProps) {
  if (status) {
    const upper = status.toUpperCase();
    const Icon =
      upper === 'PAID' || upper === 'ACTIVE' || upper === 'COMPLETED'
        ? CheckCircle2
        : upper === 'PARTIALLY_PAID' || upper === 'PENDING'
        ? Clock
        : upper === 'OVERDUE' || upper === 'UNPAID' || upper === 'CANCELLED'
        ? AlertCircle
        : CircleDot;

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-sm tracking-wide uppercase',
          getStatusBadgeClass(status),
          className
        )}
      >
        <Icon className="w-3 h-3 opacity-85" />
        <span>{children || status.replace('_', ' ')}</span>
      </span>
    );
  }

  const variantClasses = {
    default: 'bg-slate-100/90 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-[#EEF6FF] text-[#0052CC] border-blue-200',
    status: '',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-sm tracking-wide',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
