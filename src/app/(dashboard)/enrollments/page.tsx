'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  RotateCcw,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle,
  X,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate, formatCurrency } from '@/lib/utils';
import { EnrollStudentModal } from '@/components/enrollments/EnrollStudentModal';

export default function EnrollmentsPage() {
  const router = useRouter();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [navigatingBillId, setNavigatingBillId] = useState<string | null>(null);

  // Course Completion Confirmation Modal State
  const [completingEnrollment, setCompletingEnrollment] = useState<any | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const calculateCoursePeriod = (startDateStr: string | Date, val: number, unit: string) => {
    try {
      const start = new Date(startDateStr);
      if (isNaN(start.getTime())) return { start: null, end: null, isEnded: false };
      const end = new Date(start);
      const u = (unit || 'MONTHS').toUpperCase();
      if (u === 'DAYS') end.setDate(end.getDate() + val);
      else if (u === 'WEEKS') end.setDate(end.getDate() + val * 7);
      else if (u === 'YEARS') end.setFullYear(end.getFullYear() + val);
      else end.setMonth(end.getMonth() + val);
      end.setDate(end.getDate() - 1);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endClean = new Date(end);
      endClean.setHours(23, 59, 59, 999);
      const isEnded = today > endClean;

      return { start, end, isEnded };
    } catch {
      return { start: null, end: null, isEnded: false };
    }
  };

  const handleOpenFeeBill = async (enrollmentId: string, fallbackFeeBillId?: string) => {
    if (fallbackFeeBillId) {
      router.push(`/fee-bills/${fallbackFeeBillId}`);
      return;
    }
    setNavigatingBillId(enrollmentId);
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}/fee-bill`);
      const data = await res.json();
      if (data.feeBillId) {
        router.push(`/fee-bills/${data.feeBillId}`);
      }
    } catch {
      // ignore
    } finally {
      setNavigatingBillId(null);
    }
  };

  const fetchEnrollments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        search,
        status,
      });
      const res = await fetch(`/api/enrollments?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setEnrollments(json.data || []);
        setPagination(json.pagination || pagination);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, [pagination.page, status]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/enrollments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          completionDate: newStatus === 'COMPLETED' ? new Date().toISOString() : null,
        }),
      });
      fetchEnrollments();
    } catch {
      // ignore
    }
  };

  const handleConfirmComplete = async () => {
    if (!completingEnrollment) return;
    setIsUpdatingStatus(true);
    try {
      await fetch(`/api/enrollments/${completingEnrollment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          completionDate: new Date().toISOString(),
        }),
      });
      setCompletingEnrollment(null);
      fetchEnrollments();
    } catch {
      // ignore
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await fetch(`/api/enrollments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ACTIVE',
          completionDate: null,
        }),
      });
      fetchEnrollments();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Active Course Enrollments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Active academy batches, verified payment-linked enrollments and course completion tracking
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => setIsEnrollModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shrink-0 font-bold shadow-sm"
        >
          Enroll Student in Course
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search enrollment code, student, or course..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC] font-medium text-slate-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="text-xs px-3.5 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table & Mobile Cards Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* DESKTOP VIEW: Perfectly fitted 100% table with ZERO horizontal scrollbar */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left text-xs table-auto">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
              <tr>
                <th className="py-3 px-3">Enrollment #</th>
                <th className="py-3 px-3">Student</th>
                <th className="py-3 px-3">Course & Trainer</th>
                <th className="py-3 px-3">Batch Timeline</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#0052CC] mb-2" />
                    Loading enrollments...
                  </td>
                </tr>
              ) : enrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No course enrollments found. Enrollments are automatically activated when qualifying payments are verified.
                  </td>
                </tr>
              ) : (
                enrollments.map((enr) => {
                  const period = calculateCoursePeriod(enr.enrollmentDate, enr.durationValue, enr.durationUnit);
                  return (
                    <tr key={enr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-semibold text-[#0052CC] whitespace-nowrap">
                        <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {enr.enrollmentCode}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <Link
                          href={`/students/${enr.student.id}`}
                          className="font-semibold text-slate-900 hover:text-[#0052CC]"
                        >
                          {enr.student.fullName}
                        </Link>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {enr.student.studentCode}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 leading-tight">{enr.course.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{enr.trainer?.name || 'Unassigned'}</span>
                        </div>
                        <div className="mt-1">
                          {enr.feeBillStatus === 'PAID' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              Fee Paid
                            </span>
                          ) : enr.feeBillStatus === 'PARTIALLY_PAID' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Partial ({formatCurrency(enr.feeBillRemaining)} Due)
                            </span>
                          ) : enr.feeBillStatus === 'UNPAID' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Unpaid ({formatCurrency(enr.feeBillRemaining || enr.course.defaultPrice)} Due)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">No Bill Linked</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <div className="font-semibold text-slate-800 whitespace-nowrap">
                          {enr.durationValue} {enr.durationUnit.toLowerCase()}
                        </div>
                        <div className="text-[11px] text-slate-500 whitespace-nowrap flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{formatDate(enr.enrollmentDate)}</span>
                          <span>→</span>
                          <span>{period.end ? formatDate(period.end) : 'N/A'}</span>
                        </div>
                        {enr.status === 'ACTIVE' && period.isEnded && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Duration Ended
                            </span>
                          </div>
                        )}
                        {enr.status === 'COMPLETED' && enr.completionDate && (
                          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                            Done: {formatDate(enr.completionDate)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <Badge status={enr.status} />
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {enr.feeBillId ? (
                            <Link
                              href={`/fee-bills/${enr.feeBillId}`}
                              className="font-bold text-[#0052CC] bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 inline-flex items-center gap-1 transition-colors text-xs"
                              title="View Fee Bill"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Bill</span>
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenFeeBill(enr.id)}
                              disabled={navigatingBillId === enr.id}
                              className="font-bold text-[#0052CC] bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 inline-flex items-center gap-1 transition-colors text-xs cursor-pointer disabled:opacity-50"
                              title="View Fee Bill"
                            >
                              {navigatingBillId === enr.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5" />
                              )}
                              <span>Bill</span>
                            </button>
                          )}

                          {enr.status === 'PENDING' && (
                            <button
                              onClick={() => handleUpdateStatus(enr.id, 'ACTIVE')}
                              className="font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 inline-flex items-center gap-1 transition-colors text-xs cursor-pointer"
                              title="Activate enrollment without waiting for payment"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Activate</span>
                            </button>
                          )}

                          {enr.status === 'ACTIVE' && (
                            <button
                              onClick={() => setCompletingEnrollment(enr)}
                              className={`font-semibold px-2.5 py-1 rounded-lg border inline-flex items-center gap-1 transition-colors text-xs cursor-pointer ${
                                period.isEnded
                                  ? 'text-white bg-emerald-600 hover:bg-emerald-700 border-emerald-600 shadow-sm'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                              }`}
                              title="Mark Course As Completed"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Complete</span>
                            </button>
                          )}

                          {enr.status === 'COMPLETED' && (
                            <button
                              onClick={() => handleReactivate(enr.id)}
                              className="font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-300 inline-flex items-center gap-1 transition-colors text-xs cursor-pointer"
                              title="Re-activate enrollment back to ACTIVE"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                              <span>Re-activate</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE VIEW: Beautifully stacked cards with ZERO horizontal scrolling */}
        <div className="block md:hidden divide-y divide-slate-100">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0052CC] mb-2" />
              Loading enrollments...
            </div>
          ) : enrollments.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              No course enrollments found. Enrollments are automatically activated when qualifying payments are verified.
            </div>
          ) : (
            enrollments.map((enr) => {
              const period = calculateCoursePeriod(enr.enrollmentDate, enr.durationValue, enr.durationUnit);
              return (
                <div key={enr.id} className="p-4 space-y-3">
                  {/* Top: Student & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/students/${enr.student.id}`}
                        className="text-sm font-bold text-slate-900 hover:text-[#0052CC]"
                      >
                        {enr.student.fullName}
                      </Link>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                        <span>{enr.student.studentCode}</span>
                        <span>•</span>
                        <span className="text-[#0052CC] font-semibold">{enr.enrollmentCode}</span>
                      </div>
                    </div>
                    <Badge status={enr.status} />
                  </div>

                  {/* Course, Trainer & Duration Box */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{enr.course.name}</span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {enr.trainer?.name || 'Unassigned'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 text-[11px]">Fee Status:</span>
                      <div>
                        {enr.feeBillStatus === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Fee Paid
                          </span>
                        ) : enr.feeBillStatus === 'PARTIALLY_PAID' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Partial ({formatCurrency(enr.feeBillRemaining)} Due)
                          </span>
                        ) : enr.feeBillStatus === 'UNPAID' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Unpaid ({formatCurrency(enr.feeBillRemaining || enr.course.defaultPrice)} Due)
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">No Bill Linked</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] text-slate-600">
                      <span>Timeline:</span>
                      <span className="font-semibold text-slate-800">
                        {enr.durationValue} {enr.durationUnit.toLowerCase()} ({formatDate(enr.enrollmentDate)} → {period.end ? formatDate(period.end) : 'N/A'})
                      </span>
                    </div>

                    {enr.status === 'ACTIVE' && period.isEnded && (
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 w-full justify-center">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Duration Ended • Ready to Complete
                        </span>
                      </div>
                    )}

                    {enr.status === 'COMPLETED' && enr.completionDate && (
                      <div className="text-[10px] text-emerald-600 font-medium text-right pt-0.5">
                        Completed on: {formatDate(enr.completionDate)}
                      </div>
                    )}
                  </div>

                  {/* Actions: Side-by-side touch buttons (100% width on mobile) */}
                  <div className="flex items-center gap-2 pt-1">
                    {enr.feeBillId ? (
                      <Link
                        href={`/fee-bills/${enr.feeBillId}`}
                        className="flex-1 font-bold text-[#0052CC] bg-blue-50 hover:bg-blue-100 py-2 rounded-lg border border-blue-200 inline-flex items-center justify-center gap-1.5 transition-colors text-xs text-center"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Bill</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenFeeBill(enr.id)}
                        disabled={navigatingBillId === enr.id}
                        className="flex-1 font-bold text-[#0052CC] bg-blue-50 hover:bg-blue-100 py-2 rounded-lg border border-blue-200 inline-flex items-center justify-center gap-1.5 transition-colors text-xs cursor-pointer disabled:opacity-50"
                      >
                        {navigatingBillId === enr.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                        <span>View Bill</span>
                      </button>
                    )}

                    {enr.status === 'PENDING' && (
                      <button
                        onClick={() => handleUpdateStatus(enr.id, 'ACTIVE')}
                        className="flex-1 font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg border border-blue-200 inline-flex items-center justify-center gap-1.5 transition-colors text-xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Activate</span>
                      </button>
                    )}

                    {enr.status === 'ACTIVE' && (
                      <button
                        onClick={() => setCompletingEnrollment(enr)}
                        className={`flex-1 font-semibold py-2 rounded-lg border inline-flex items-center justify-center gap-1.5 transition-colors text-xs cursor-pointer ${
                          period.isEnded
                            ? 'text-white bg-emerald-600 hover:bg-emerald-700 border-emerald-600 shadow-sm'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Complete</span>
                      </button>
                    )}

                    {enr.status === 'COMPLETED' && (
                      <button
                        onClick={() => handleReactivate(enr.id)}
                        className="flex-1 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 py-2 rounded-lg border border-slate-300 inline-flex items-center justify-center gap-1.5 transition-colors text-xs cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                        <span>Re-activate</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            <strong className="text-slate-900">{pagination.total}</strong> enrollments
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <span className="font-semibold text-slate-800 px-2">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Complete Course Confirmation Modal */}
      {completingEnrollment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Confirm Course Completion
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mark student enrollment as completed / graduated
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCompletingEnrollment(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student & Course Summary Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Student:</span>
                <span className="font-bold text-slate-900">
                  {completingEnrollment.student.fullName} ({completingEnrollment.student.studentCode})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Course:</span>
                <span className="font-semibold text-slate-900">
                  {completingEnrollment.course.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration:</span>
                <span className="font-medium text-slate-700">
                  {completingEnrollment.durationValue} {completingEnrollment.durationUnit.toLowerCase()}
                </span>
              </div>
            </div>

            {/* Financial Warning / Clearance Box */}
            {Number(completingEnrollment.feeBillRemaining || 0) > 0 || completingEnrollment.feeBillStatus !== 'PAID' ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-rose-900">
                    Warning: Outstanding Fee Balance!
                  </h4>
                  <p className="text-rose-700">
                    This student still has an unpaid balance of{' '}
                    <strong className="text-rose-950 font-bold">
                      {formatCurrency(completingEnrollment.feeBillRemaining || completingEnrollment.course.defaultPrice)}
                    </strong>
                    {completingEnrollment.feeBillNumber ? ` on Fee Bill #${completingEnrollment.feeBillNumber}` : ''}.
                  </p>
                  <p className="text-[11px] text-rose-600 pt-1">
                    Once marked as <strong>COMPLETED</strong>, subsequent monthly recurring bills will no longer be generated for this course.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <h4 className="font-bold text-emerald-900">
                    All Course Fees Fully Cleared
                  </h4>
                  <p className="text-emerald-700 mt-0.5">
                    Verified! All billing dues are 100% paid. Student is cleared for course completion and certificate issuance.
                  </p>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setCompletingEnrollment(null)}
                disabled={isUpdatingStatus}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleConfirmComplete}
                isLoading={isUpdatingStatus}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Confirm & Mark Completed
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      <EnrollStudentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        onSuccess={() => {
          fetchEnrollments();
        }}
      />
    </div>
  );
}
