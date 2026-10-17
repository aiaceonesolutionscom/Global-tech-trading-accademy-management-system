'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DeleteFeeBillModal } from '@/components/fee-bills/DeleteFeeBillModal';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function FeeBillsPage() {
  const [feeBills, setFeeBills] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Delete modal state
  const [deleteModalBill, setDeleteModalBill] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchFeeBills = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        search,
        status,
      });
      const res = await fetch(`/api/fee-bills?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setFeeBills(json.data || []);
        setPagination(json.pagination || pagination);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeeBills();
  }, [pagination.page, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchFeeBills();
  };

  const handleOpenDelete = (bill: any) => {
    setDeleteModalBill({
      id: bill.id,
      billNumber: bill.billNumber,
      studentName: bill.student?.fullName,
      grandTotal: bill.grandTotal,
      paidAmount: bill.paidAmount,
      remainingAmount: bill.remainingAmount,
    });
    setIsDeleteModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Fee Bills & Invoices
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official academy fee vouchers, billing cycles, balances and payments
          </p>
        </div>
        <Link href="/fee-bills/new">
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            className="shrink-0 font-bold"
          >
            Create New Fee Bill
          </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice #, student name, or code..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC] text-slate-800"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC] text-slate-800 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      {/* Fee Bills Table & Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* DESKTOP VIEW: 100% width with ZERO horizontal scrollbar */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left text-xs table-fixed">
            <colgroup>
              <col className="w-[19%]" />
              <col className="w-[21%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-3">Invoice #</th>
                <th className="py-3 px-3">Student</th>
                <th className="py-3 px-3">Dates</th>
                <th className="py-3 px-3">Financials</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#0052CC] mb-2" />
                    Loading invoices...
                  </td>
                </tr>
              ) : feeBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No fee bills found. Click &quot;Create New Fee Bill&quot; to generate an invoice.
                  </td>
                </tr>
              ) : (
                feeBills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                      <span
                        className="inline-block max-w-[150px] truncate bg-blue-50 text-[#0052CC] px-2 py-0.5 rounded border border-blue-200/80 align-middle text-xs"
                        title={b.billNumber}
                      >
                        {b.billNumber}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans block mt-0.5 font-normal">
                        {b.billingMode === 'MONTHLY' ? 'Monthly' : 'One-Time'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 leading-tight max-w-[140px] truncate" title={b.student.fullName}>
                        {b.student.fullName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 max-w-[140px] truncate" title={b.student.studentCode}>
                        {b.student.studentCode}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{formatDate(b.billDate)}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>Due: {b.dueDate ? formatDate(b.dueDate) : '-'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900 font-mono text-xs">
                        {formatCurrency(b.grandTotal)}
                      </div>
                      <div className="text-[11px] mt-0.5 font-mono">
                        {Number(b.remainingAmount) === 0 ? (
                          <span className="text-emerald-600 font-semibold">Paid in Full</span>
                        ) : (
                          <span className="text-rose-600 font-semibold">
                            Due: {formatCurrency(b.remainingAmount)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <Badge status={b.status} />
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap pr-4">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {/* Next Month Action if near end */}
                        {(() => {
                          if (b.billingMode !== 'MONTHLY' || b.status === 'CANCELLED') return null;
                          const now = new Date().getTime();
                          let isNear = false;
                          if (b.endDate) {
                            const end = new Date(b.endDate).getTime();
                            const diffDays = (end - now) / (1000 * 60 * 60 * 24);
                            isNear = diffDays <= 7;
                          } else if (b.dueDate) {
                            const due = new Date(b.dueDate).getTime();
                            const diffDays = (due - now) / (1000 * 60 * 60 * 24);
                            isNear = diffDays <= 7;
                          } else {
                            isNear = true;
                          }

                          if (!isNear) return null;

                          return (
                            <Link
                              href={`/fee-bills/new?studentId=${b.studentId}&mode=NEXT_MONTH&fromBillId=${b.id}`}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shrink-0"
                              title="Generate Next Month Fee Bill"
                            >
                              <Clock className="w-3.5 h-3.5 text-indigo-600" />
                            </Link>
                          );
                        })()}

                        {/* View Button */}
                        <Link
                          href={`/fee-bills/${b.id}`}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-[#0052CC] bg-blue-50 hover:bg-blue-100 border border-blue-200/80 transition-colors shrink-0"
                          title="View Invoice & Download PDF"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>

                        {/* Edit Button */}
                        <Link
                          href={`/fee-bills/${b.id}/edit`}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 transition-colors shrink-0"
                          title="Edit Invoice"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Link>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(b)}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition-colors shrink-0 cursor-pointer"
                          title="Delete / Cancel Invoice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE VIEW: Touch-friendly stacked cards with ZERO horizontal scrolling */}
        <div className="block md:hidden divide-y divide-slate-100">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0052CC] mb-2" />
              Loading invoices...
            </div>
          ) : feeBills.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              No fee bills found. Click &quot;Create New Fee Bill&quot; to generate an invoice.
            </div>
          ) : (
            feeBills.map((b) => (
              <div key={b.id} className="p-4 space-y-3">
                {/* Header: Student & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{b.student.fullName}</h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                      <span>{b.student.studentCode}</span>
                      <span>•</span>
                      <span className="text-[#0052CC] font-bold">{b.billNumber}</span>
                    </div>
                  </div>
                  <Badge status={b.status} />
                </div>

                {/* Financial & Dates Box */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Billed Total:</span>
                    <span className="font-bold text-slate-900 font-mono">{formatCurrency(b.grandTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Paid Amount:</span>
                    <span className="font-semibold text-emerald-600 font-mono">{formatCurrency(b.paidAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 font-semibold">
                    <span className="text-slate-600">Remaining Balance:</span>
                    <span className={Number(b.remainingAmount) === 0 ? 'text-emerald-600 font-mono' : 'text-rose-600 font-bold font-mono'}>
                      {Number(b.remainingAmount) === 0 ? 'Settled (Rs. 0)' : formatCurrency(b.remainingAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                    <span>Bill: {formatDate(b.billDate)}</span>
                    <span>Due: {b.dueDate ? formatDate(b.dueDate) : '-'}</span>
                  </div>
                </div>

                {/* Mobile Actions Grid */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Link
                    href={`/fee-bills/${b.id}`}
                    className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-semibold text-[#0052CC] bg-blue-50 border border-blue-200 text-center"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </Link>
                  <Link
                    href={`/fee-bills/${b.id}/edit`}
                    className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 text-center"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </Link>
                  <button
                    onClick={() => handleOpenDelete(b)}
                    className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 text-center cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} invoices
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
            <span className="font-semibold text-slate-700 px-2">
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

      {/* Delete / Cancel Confirmation Modal */}
      <DeleteFeeBillModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        feeBill={deleteModalBill}
        onSuccess={() => {
          fetchFeeBills();
        }}
      />
    </div>
  );
}
