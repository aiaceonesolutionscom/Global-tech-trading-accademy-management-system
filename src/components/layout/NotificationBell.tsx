'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell, AlertCircle, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [reminders, setReminders] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchReminders = async () => {
    try {
      const res = await fetch('/api/reminders');
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
        setCount(data.count || 0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchReminders();
    const interval = setInterval(fetchReminders, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        title="Fee Reminders & Notifications"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 z-50 text-xs animate-fadeIn">
          <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
            <span className="font-bold text-slate-800">Fee Notifications</span>
            <span className="text-[11px] text-slate-400">{count} Overdue / Due</span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {reminders.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                No outstanding payment reminders
              </div>
            ) : (
              reminders.slice(0, 5).map((r) => (
                <div key={r.id} className="p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{r.studentName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{r.billNumber}</p>
                    </div>
                    <span className="font-bold text-rose-600 font-mono">
                      {formatCurrency(r.remainingAmount)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>Due: {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 pt-2 border-t border-slate-100 text-center">
            <Link
              href="/reminders"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 font-semibold text-[#0052CC] hover:underline text-xs"
            >
              <span>View All Reminders</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
