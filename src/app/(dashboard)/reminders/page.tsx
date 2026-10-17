'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function RemindersPage() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReminders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reminders');
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Reminders & Fee Notifications
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated alerts for overdue fee bills, approaching due dates and pending installments
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchReminders}
          leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-600" />}
          className="font-semibold"
        >
          Scan Database Ledger
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#0052CC] mb-2" />
            Scanning outstanding ledgers...
          </div>
        ) : reminders.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              All Invoices in Good Standing!
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              No overdue or upcoming fee reminders detected at this time.
            </p>
          </div>
        ) : (
          reminders.map((r) => {
            const isOverdue = r.type === 'OVERDUE';
            return (
              <div
                key={r.id}
                className={`bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-between ${
                  isOverdue ? 'border-rose-200' : 'border-amber-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                        isOverdue
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isOverdue ? (
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                      ) : (
                        <Clock className="w-3 h-3 text-amber-600" />
                      )}
                      {r.type.replace('_', ' ')}
                    </span>
                    <span className="font-mono font-semibold text-[#0052CC] text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {r.billNumber}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mt-3">{r.title}</h3>
                  <p className="text-xs text-slate-600 mt-1">{r.message}</p>

                  <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Student:</span>
                      <Link
                        href={`/students/${r.studentId}`}
                        className="font-semibold text-[#0052CC] hover:underline"
                      >
                        {r.studentName}
                      </Link>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Amount Due:</span>
                      <span className="font-bold text-rose-600">
                        {formatCurrency(r.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Due Date:</span>
                      <span className="font-medium text-slate-900">
                        {r.dueDate ? formatDate(r.dueDate) : 'Immediate'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link href={`/fee-bills/${r.feeBillId}`} className="w-full">
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                      className="w-full text-xs font-semibold"
                    >
                      Open Bill & Record Payment
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
