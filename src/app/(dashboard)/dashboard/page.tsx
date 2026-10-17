'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  BookOpen,
  GraduationCap,
  Receipt,
  CreditCard,
  AlertTriangle,
  Clock,
  Plus,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { StatsCard } from '@/components/ui/StatsCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {};

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#001B48] via-[#002B66] to-[#0052CC] rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Academy Overview & Operations
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 mt-1">
            Global Tech International Academy — Live student enrollment, fee invoices and cash flow
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link href="/students">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs"
            >
              View Students
            </Button>
          </Link>
          <Link href="/fee-bills/new">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              className="bg-white text-[#001B48] hover:bg-blue-50 font-bold text-xs"
            >
              New Fee Bill
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Total Students"
          value={metrics.totalStudents ?? 0}
          subtitle={`${metrics.activeStudents ?? 0} Active Enrolled`}
          icon={<Users className="w-5 h-5" />}
          variant="primary"
        />

        <StatsCard
          title="Active Students"
          value={metrics.activeStudents ?? 0}
          subtitle="Currently studying"
          icon={<UserCheck className="w-5 h-5" />}
          variant="success"
        />

        <StatsCard
          title="Total Collected"
          value={formatCurrency(metrics.totalCollected ?? 0)}
          subtitle="Verified payments"
          icon={<CreditCard className="w-5 h-5" />}
          variant="success"
        />

        <StatsCard
          title="Total Outstanding"
          value={formatCurrency(metrics.totalOutstanding ?? 0)}
          subtitle="Pending receivables"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant="danger"
        />

        <StatsCard
          title="Total Fee Bills"
          value={metrics.totalFeeBills ?? 0}
          subtitle="Generated vouchers"
          icon={<Receipt className="w-5 h-5" />}
          variant="default"
        />

        <StatsCard
          title="Partially Paid"
          value={metrics.partiallyPaidBills ?? 0}
          subtitle="Bills with partial balance"
          icon={<Clock className="w-5 h-5" />}
          variant="warning"
        />

        <StatsCard
          title="Overdue Bills"
          value={metrics.overdueBills ?? 0}
          subtitle="Past payment deadline"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant="danger"
        />

        <StatsCard
          title="Courses & Trainers"
          value={`${metrics.totalCourses ?? 0} Courses`}
          subtitle={`${metrics.totalTrainers ?? 0} Active Mentors`}
          icon={<BookOpen className="w-5 h-5" />}
          variant="primary"
        />
      </div>

      {/* Monthly Financial Trend Chart */}
      {data?.chartData && data.chartData.length > 0 && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Billing vs. Collection Trend
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly billed invoice volume compared to actual payments collected
              </p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="billedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0052CC" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0052CC" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(val) => `Rs.${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: any) => formatCurrency(Number(val))}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="billed"
                  name="Total Invoiced"
                  stroke="#0052CC"
                  strokeWidth={2}
                  fill="url(#billedGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="collected"
                  name="Total Collected"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#collectedGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Two Columns: Recent Invoices & Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Fee Bills */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Recent Fee Bills</h2>
              <Link
                href="/fee-bills"
                className="text-xs font-semibold text-[#0052CC] hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Invoice #</th>
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Total</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!data?.recentBills || data.recentBills.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No recent fee bills recorded
                      </td>
                    </tr>
                  ) : (
                    data.recentBills.slice(0, 5).map((b: any) => (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                          <Link href={`/fee-bills/${b.id}`} className="hover:underline text-[#0052CC]">
                            {b.billNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {b.student?.fullName}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {formatCurrency(b.grandTotal)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge status={b.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Recent Payments</h2>
              <Link
                href="/payments"
                className="text-xs font-semibold text-[#0052CC] hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Receipt #</th>
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Amount</th>
                    <th className="py-2.5 px-4">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!data?.recentPayments || data.recentPayments.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No recent payments recorded
                      </td>
                    </tr>
                  ) : (
                    data.recentPayments.slice(0, 5).map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                          {p.receiptNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {p.student?.fullName}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-600">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-semibold">
                            {p.paymentMethod}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
