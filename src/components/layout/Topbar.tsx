'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Plus, Users, Search } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { Button } from '../ui/Button';

interface TopbarProps {
  onToggleSidebar?: () => void;
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const getPageTitle = () => {
    if (!pathname || pathname === '/dashboard') return 'Dashboard Overview';
    if (pathname.startsWith('/students')) return 'Students Management';
    if (pathname.startsWith('/fee-bills')) return 'Fee Bills & Invoices';
    if (pathname.startsWith('/payments')) return 'Payments & Receipts';
    if (pathname.startsWith('/courses')) return 'Trading Courses';
    if (pathname.startsWith('/trainers')) return 'Instructors & Trainers';
    if (pathname.startsWith('/enrollments')) return 'Student Enrollments';
    if (pathname.startsWith('/reports')) return 'Reports & Analytics';
    if (pathname.startsWith('/reminders')) return 'Payment Reminders';
    if (pathname.startsWith('/settings')) return 'System Settings';
    return 'Management Portal';
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            {getPageTitle()}
          </h2>
          <p className="text-xs text-slate-500 hidden sm:block">
            Global Tech International Academy
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/fee-bills/new">
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            className="text-xs font-semibold"
          >
            Create Fee Bill
          </Button>
        </Link>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <NotificationBell />

        <Link
          href="/settings?tab=security"
          className="flex items-center gap-2 pl-2 hover:opacity-85 transition-opacity cursor-pointer group"
          title="Account Security & Password Settings"
        >
          <div className="w-8 h-8 rounded-full bg-[#001B48] text-white font-bold flex items-center justify-center text-xs group-hover:ring-2 group-hover:ring-[#0052CC] transition-all">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'GT'}
          </div>
          <div className="hidden lg:block text-left text-xs">
            <span className="font-semibold text-slate-800 block leading-tight group-hover:text-[#0052CC] transition-colors">
              {user?.name || 'Administrator'}
            </span>
            <span className="text-[11px] text-slate-400 capitalize">
              {user?.role ? user.role.toLowerCase() : 'Super Administrator'}
            </span>
          </div>
        </Link>
      </div>
    </header>
  );
}
