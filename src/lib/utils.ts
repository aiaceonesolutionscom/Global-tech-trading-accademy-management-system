
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | any, currency = 'Rs.'): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return `${currency} 0.00`;
  }
  const num = Number(amount);
  return `${currency} ${num.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(date: string | Date | null | undefined, fmt = 'dd MMM yyyy'): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';
    return format(d, fmt);
  } catch {
    return '-';
  }
}

export function getStatusBadgeClass(status: string): string {
  switch (status?.toUpperCase()) {
    case 'PAID':
    case 'ACTIVE':
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/20';
    case 'PARTIALLY_PAID':
    case 'PENDING':
      return 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-600/20';
    case 'UNPAID':
    case 'OVERDUE':
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-600/20';
    case 'DRAFT':
    case 'INACTIVE':
    case 'ARCHIVED':
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-600/20';
  }
}
