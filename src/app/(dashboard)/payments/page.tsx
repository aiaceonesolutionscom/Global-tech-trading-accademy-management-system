'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Search,
  Filter,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { RecordPaymentModal } from '@/components/fee-bills/RecordPaymentModal';
import { generateReceiptPDF, loadPoppinsFonts } from '@/lib/pdf-generator';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // New Payment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<any>(null);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        search,
        paymentMethod,
      });
      const res = await fetch(`/api/payments?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setPayments(json.data || []);
        setPagination(json.pagination || pagination);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students?limit=200');
      if (res.ok) {
        const json = await res.json();
        setStudents(json.data || []);
      }
    } catch {
      // ignore
    }
  };

  const studentOptions = useMemo(() => {
    return students.map((s) => ({
      value: s.id,
      label: s.fullName,
      sublabel: `${s.studentCode} • ${s.phone || ''}`,
      badge: s.status,
      searchTerms: `${s.email || ''} ${s.guardianName || ''} ${s.cnic || ''}`,
    }));
  }, [students]);

  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPayments();
    fetchStudents();
  }, [pagination.page, paymentMethod]);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {});
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchPayments();
  };

  const loadLogoBase64 = async (): Promise<string | null> => {
    try {
      const res = await fetch('/logo-sm.png');
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const handleDownloadReceipt = async (payment: any) => {
    const [logoUrl, poppinsFonts, freshSettingsRes] = await Promise.all([
      loadLogoBase64(),
      loadPoppinsFonts(),
      fetch('/api/settings', { cache: 'no-store' })
        .then((r) => r.json())
        .catch(() => null),
    ]);

    const activeSettings = freshSettingsRes?.settings || settings;

    const doc = generateReceiptPDF(
      {
        receiptNumber: payment.receiptNumber,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        notes: payment.notes,
        student: payment.student,
        allocations: payment.allocations,
      },
      logoUrl,
      poppinsFonts,
      activeSettings
    );
    doc.save(`${payment.receiptNumber}_Payment_Receipt_A5.pdf`);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Fee Payments & Receipts
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Verified cash receipts, electronic transfers, bill allocations and downloadable payment vouchers
          </p>
        </div>
        <div className="w-72">
          {students.length > 0 && (
            <SearchableSelect
              value=""
              onChange={(studentId) => {
                const s = students.find((st) => st.id === studentId);
                if (s) {
                  setSelectedStudentForModal(s);
                  setIsModalOpen(true);
                }
              }}
              options={studentOptions}
              placeholder="+ Record Payment for Student..."
              searchPlaceholder="Search student name or roll #..."
              pageSize={5}
            />
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by receipt #, ref/tx #, or student name..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC] font-medium text-slate-900"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="text-xs px-3.5 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="ONLINE">Online / Mobile Wallet</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>
      </div>

      {/* Payments Table & Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* DESKTOP VIEW: 100% width with ZERO horizontal scrollbar */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left text-xs table-auto">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-3">Receipt #</th>
                <th className="py-3 px-3">Student</th>
                <th className="py-3 px-3">Date & Method</th>
                <th className="py-3 px-3">Amount & Allocations</th>
                <th className="py-3 px-3 text-right">Receipt PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#0052CC] mb-2" />
                    Loading payment records...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                payments.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                      <span
                        className="inline-block max-w-[160px] truncate bg-blue-50 text-[#0052CC] px-2 py-0.5 rounded border border-blue-200/80 align-middle text-xs"
                        title={pmt.receiptNumber}
                      >
                        {pmt.receiptNumber}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 leading-tight max-w-[150px] truncate" title={pmt.student.fullName}>
                        {pmt.student.fullName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 max-w-[150px] truncate" title={pmt.student.studentCode}>
                        {pmt.student.studentCode}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{formatDate(pmt.paymentDate)}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <CreditCard className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{pmt.paymentMethod.replace('_', ' ')}</span>
                        {pmt.referenceNumber && (
                          <span className="text-slate-400 font-mono font-normal max-w-[120px] truncate" title={pmt.referenceNumber}>
                            ({pmt.referenceNumber})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-emerald-600 font-mono text-xs">
                        {formatCurrency(pmt.amount)}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pmt.allocations.map((a: any) => (
                          <Link
                            key={a.id}
                            href={`/fee-bills/${a.feeBill.id}`}
                            className="bg-blue-50 text-[#0052CC] hover:bg-[#0052CC] hover:text-white px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-200/70 transition-colors whitespace-nowrap inline-flex items-center gap-1"
                          >
                            <span className="max-w-[100px] truncate">{a.feeBill.billNumber}:</span>
                            <span className="font-bold">{formatCurrency(a.amountAllocated)}</span>
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap pr-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadReceipt(pmt)}
                        leftIcon={<Download className="w-3.5 h-3.5 text-slate-600" />}
                        className="text-xs px-2.5 py-1 font-semibold"
                      >
                        Receipt
                      </Button>
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
              Loading payment records...
            </div>
          ) : payments.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              No payment records found.
            </div>
          ) : (
            payments.map((pmt) => (
              <div key={pmt.id} className="p-4 space-y-3">
                {/* Header: Student & Receipt # */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{pmt.student.fullName}</h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                      <span>{pmt.student.studentCode}</span>
                      <span>•</span>
                      <span className="text-[#0052CC] font-bold">{pmt.receiptNumber}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-mono">
                    {formatCurrency(pmt.amount)}
                  </span>
                </div>

                {/* Details Box */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Payment Method:</span>
                    <span className="font-semibold text-slate-800">{pmt.paymentMethod.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Date:</span>
                    <span className="font-medium text-slate-800">{formatDate(pmt.paymentDate)}</span>
                  </div>
                  {pmt.referenceNumber && (
                    <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                      <span>Ref / Transaction #:</span>
                      <span className="font-mono text-slate-800">{pmt.referenceNumber}</span>
                    </div>
                  )}
                  {pmt.allocations.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-200/60 space-y-1">
                      <span className="text-[11px] text-slate-500 block">Allocated Invoices:</span>
                      <div className="flex flex-wrap gap-1">
                        {pmt.allocations.map((a: any) => (
                          <Link
                            key={a.id}
                            href={`/fee-bills/${a.feeBill.id}`}
                            className="bg-blue-50 text-[#0052CC] px-2 py-0.5 rounded text-[10px] font-medium border border-blue-200"
                          >
                            {a.feeBill.billNumber}: {formatCurrency(a.amountAllocated)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Full-width Download Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadReceipt(pmt)}
                  leftIcon={<Download className="w-4 h-4 text-slate-600" />}
                  className="w-full justify-center text-xs font-semibold py-2"
                >
                  Download Receipt Voucher (PDF)
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            <strong className="text-slate-900">{pagination.total}</strong> receipts
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

      {/* Record Payment Modal */}
      {selectedStudentForModal && (
        <RecordPaymentModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedStudentForModal(null);
          }}
          studentId={selectedStudentForModal.id}
          studentName={selectedStudentForModal.fullName}
          onSuccess={() => {
            fetchPayments();
          }}
        />
      )}
    </div>
  );
}
