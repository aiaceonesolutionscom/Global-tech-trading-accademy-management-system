'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  MapPin,
  CreditCard,
  FileText,
  BookOpen,
  Receipt,
  Eye,
  Edit,
  Trash2,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RecordPaymentModal } from '@/components/fee-bills/RecordPaymentModal';
import { DeleteFeeBillModal } from '@/components/fee-bills/DeleteFeeBillModal';
import { EnrollStudentModal } from '@/components/enrollments/EnrollStudentModal';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [studentData, setStudentData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'courses' | 'bills' | 'payments'>('bills');
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [deleteModalBill, setDeleteModalBill] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [navigatingEnrollmentId, setNavigatingEnrollmentId] = useState<string | null>(null);

  const handleOpenCourseFeeBill = async (enrollmentId: string, directBillId?: string) => {
    if (directBillId) {
      router.push(`/fee-bills/${directBillId}`);
      return;
    }
    setNavigatingEnrollmentId(enrollmentId);
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}/fee-bill`);
      const data = await res.json();
      if (data.feeBillId) {
        router.push(`/fee-bills/${data.feeBillId}`);
      }
    } catch {
      // ignore
    } finally {
      setNavigatingEnrollmentId(null);
    }
  };

  const fetchStudent = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/students/${id}`);
      if (res.ok) {
        const json = await res.json();
        setStudentData(json);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchStudent();
  }, [id]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-500">Student record not found.</p>
        <Link href="/students">
          <Button variant="primary" size="sm" className="mt-4">
            Back to Students
          </Button>
        </Link>
      </div>
    );
  }

  const { student, summary } = studentData;

  return (
    <div className="space-y-6 pb-8">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Students Directory</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link href={`/fee-bills/new?studentId=${student.id}`}>
            <Button variant="outline" size="sm" leftIcon={<FileText className="w-3.5 h-3.5" />}>
              Generate Bill
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsPaymentModalOpen(true)}
            leftIcon={<CreditCard className="w-3.5 h-3.5" />}
            className="font-bold"
          >
            Record Payment
          </Button>
        </div>
      </div>

      {/* Student Profile Header & Outstanding Balance Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded-md">
                  {student.studentCode}
                </span>
                <h1 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
                  {student.fullName}
                </h1>
                {student.guardianName && (
                  <p className="text-xs text-slate-500">S/D/O {student.guardianName}</p>
                )}
              </div>
              <Badge status={student.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{student.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{student.email || 'No email provided'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Reg: {formatDate(student.registrationDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{student.address || 'Address not recorded'}</span>
              </div>
            </div>

            {student.notes && (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100">
                <span className="font-semibold text-slate-700">Notes:</span> {student.notes}
              </div>
            )}
          </div>
        </div>

        {/* Financial Outstanding Summary Card */}
        <div className="bg-[#001B48] text-white rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">
              Account Ledger Summary
            </span>
            <div className="mt-3">
              <p className="text-xs text-blue-100/70">Total Outstanding Due</p>
              <h2 className="text-3xl font-extrabold text-rose-400 tracking-tight mt-0.5 font-mono">
                {formatCurrency(summary.totalOutstanding)}
              </h2>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-xs">
              <div className="flex justify-between text-blue-100">
                <span>Current Bill Due:</span>
                <span className="font-semibold text-white font-mono">
                  {formatCurrency(summary.currentOutstanding)}
                </span>
              </div>
              <div className="flex justify-between text-blue-100">
                <span>Previous Balance Carried:</span>
                <span className="font-semibold text-amber-300 font-mono">
                  {formatCurrency(summary.previousOutstanding)}
                </span>
              </div>
              <div className="flex justify-between text-blue-100">
                <span>Total Amount Collected:</span>
                <span className="font-semibold text-emerald-300 font-mono">
                  {formatCurrency(summary.totalPaid)}
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsPaymentModalOpen(true)}
            leftIcon={<CreditCard className="w-3.5 h-3.5" />}
            className="w-full mt-5 bg-white text-[#001B48] hover:bg-blue-50 font-bold"
          >
            Record Payment
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-xl p-1.5 border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-1">
        <button
          onClick={() => setActiveTab('bills')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'bills'
              ? 'bg-[#001B48] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Fee Bills ({student.feeBills?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'courses'
              ? 'bg-[#001B48] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Enrolled Courses ({student.enrollments?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'payments'
              ? 'bg-[#001B48] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payment History ({student.payments?.length || 0})</span>
        </button>
      </div>

      {/* Tab Content: Fee Bills */}
      {activeTab === 'bills' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Billing Date</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Total Billed</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Remaining</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {student.feeBills?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No fee bills issued yet for this student.
                    </td>
                  </tr>
                ) : (
                  student.feeBills?.map((bill: any) => (
                    <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {bill.billNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatDate(bill.billDate)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {bill.startDate && bill.endDate
                          ? `${formatDate(bill.startDate, 'dd MMM')} → ${formatDate(bill.endDate, 'dd MMM')}`
                          : bill.billingMode}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                        {formatCurrency(bill.grandTotal)}
                      </td>
                      <td className="py-3 px-4 text-emerald-600 font-semibold font-mono">
                        {formatCurrency(bill.paidAmount)}
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-600 font-mono">
                        {formatCurrency(bill.remainingAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge status={bill.status} />
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          href={`/fee-bills/${bill.id}`}
                          className="inline-flex items-center gap-1 font-semibold text-[#0052CC] hover:bg-blue-50 px-2 py-1 rounded-md"
                          title="View Invoice"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </Link>
                        <Link
                          href={`/fee-bills/${bill.id}/edit`}
                          className="inline-flex items-center gap-1 font-semibold text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-md"
                          title="Edit Invoice"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Link>
                        <button
                          onClick={() => {
                            setDeleteModalBill({
                              id: bill.id,
                              billNumber: bill.billNumber,
                              studentName: student.fullName,
                              grandTotal: bill.grandTotal,
                              paidAmount: bill.paidAmount,
                              remainingAmount: bill.remainingAmount,
                            });
                            setIsDeleteModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-md cursor-pointer"
                          title="Delete Invoice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Enrolled Courses */}
      {activeTab === 'courses' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Enrolled Course Batches
            </span>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsEnrollModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="font-bold"
            >
              Enroll in Course
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Course Name</th>
                  <th className="py-3 px-4">Instructor / Trainer</th>
                  <th className="py-3 px-4">Enrollment Date</th>
                  <th className="py-3 px-4">Billing Mode</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {student.enrollments?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No course enrollments registered yet.
                    </td>
                  </tr>
                ) : (
                  student.enrollments?.map((enr: any) => (
                    <tr key={enr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {enr.course.name}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {enr.trainer?.name || 'Assigned Instructor'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatDate(enr.enrollmentDate)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#0052CC]">
                        {enr.billingMode.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {enr.durationValue} {enr.durationUnit.toLowerCase()}
                      </td>
                      <td className="py-3 px-4">
                        <Badge status={enr.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(() => {
                          const matchingBill =
                            student.feeBills?.find((b: any) =>
                              b.items?.some((it: any) => it.courseId === enr.course.id)
                            ) || student.feeBills?.[0];

                          if (matchingBill) {
                            return (
                              <Link
                                href={`/fee-bills/${matchingBill.id}`}
                                className="font-bold text-[#0052CC] bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200 inline-flex items-center gap-1.5 transition-colors text-xs"
                                title="View Fee Bill"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View Bill</span>
                              </Link>
                            );
                          }

                          return (
                            <button
                              type="button"
                              onClick={() => handleOpenCourseFeeBill(enr.id)}
                              disabled={navigatingEnrollmentId === enr.id}
                              className="font-bold text-[#0052CC] bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200 inline-flex items-center gap-1.5 transition-colors text-xs cursor-pointer disabled:opacity-50"
                              title="View Fee Bill"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View Bill</span>
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Payment History */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Allocated Invoices</th>
                  <th className="py-3 px-4">Reference #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {student.payments?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  student.payments?.map((pmt: any) => (
                    <tr key={pmt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {pmt.receiptNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatDate(pmt.paymentDate)}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-600 font-mono">
                        {formatCurrency(pmt.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-semibold text-slate-700">
                          {pmt.paymentMethod.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {pmt.allocations?.map((a: any) => (
                          <span
                            key={a.id}
                            className="inline-block bg-blue-50 text-[#0052CC] border border-blue-100 rounded px-1.5 py-0.5 text-[10px] mr-1 mb-0.5 font-semibold"
                          >
                            {a.feeBill.billNumber}: {formatCurrency(a.amountAllocated)}
                          </span>
                        ))}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {pmt.referenceNumber || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        studentId={student.id}
        studentName={student.fullName}
        currentBillId={student.feeBills?.[0]?.id}
        currentBillNumber={student.feeBills?.[0]?.billNumber}
        currentBillTotal={Number(student.feeBills?.[0]?.grandTotal || 0)}
        currentBillPaid={Number(student.feeBills?.[0]?.paidAmount || 0)}
        currentBillRemaining={Number(student.feeBills?.[0]?.remainingAmount || 0)}
        onSuccess={() => {
          fetchStudent();
        }}
      />

      {/* Delete Fee Bill Modal */}
      <DeleteFeeBillModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        feeBill={deleteModalBill}
        onSuccess={() => {
          fetchStudent();
        }}
      />

      {/* Enroll in Course Modal */}
      <EnrollStudentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        onSuccess={() => {
          fetchStudent();
        }}
        preselectedStudentId={student.id}
      />
    </div>
  );
}
