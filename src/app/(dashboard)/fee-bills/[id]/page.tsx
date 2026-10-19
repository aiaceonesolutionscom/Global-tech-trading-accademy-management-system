'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Printer,
  FileDown,
  Pencil,
  Trash2,
  CreditCard,
  GraduationCap,
  Phone,
  Mail,
  Calendar,
  BookOpen,
  Landmark,
  Receipt,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RecordPaymentModal } from '@/components/fee-bills/RecordPaymentModal';
import { DeleteFeeBillModal } from '@/components/fee-bills/DeleteFeeBillModal';
import { generateFeeBillPDF, loadPoppinsFonts } from '@/lib/pdf-generator';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function FeeBillDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [billData, setBillData] = useState<any>(null);
  const [previousBills, setPreviousBills] = useState<any[]>([]);
  const [relatedBills, setRelatedBills] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [includePaymentHistory, setIncludePaymentHistory] = useState(true);
  const [includePreviousHistory, setIncludePreviousHistory] = useState(false);

  const fetchBill = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/fee-bills/${id}`);
      if (res.ok) {
        const json = await res.json();
        setBillData(json.feeBill);
        setPreviousBills(json.previousBills || []);
        setRelatedBills(json.relatedBills || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchBill();

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setSettings(data.settings);
        }
      })
      .catch(() => {});
  }, [id]);

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

  const getPolicyLines = (s: any): string[] => {
    if (s?.policy_lines_json) {
      try {
        const parsed = JSON.parse(s.policy_lines_json);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    const legacy = [s?.policy_line_1, s?.policy_line_2, s?.policy_line_3].filter(
      (l: any) => typeof l === 'string' && l.trim() !== ''
    );
    if (legacy.length > 0) return legacy;
    const email = s?.company_email?.trim();
    return [
      '1. Fee deposited is non-refundable & non-transferable.',
      '2. Computer-verified voucher. Valid without physical stamp.',
      email ? `3. Accounts helpdesk: ${email}` : '3. Official computerized voucher.',
    ];
  };

  const handleDownloadPDF = async () => {
    if (!billData) return;
    const [logoUrl, poppinsFonts, freshSettingsRes] = await Promise.all([
      loadLogoBase64(),
      loadPoppinsFonts(),
      fetch('/api/settings', { cache: 'no-store' })
        .then((r) => r.json())
        .catch(() => null),
    ]);

    const activeSettings = freshSettingsRes?.settings || settings;

    const doc = generateFeeBillPDF(
      {
        billNumber: billData.billNumber,
        billDate: billData.billDate,
        startDate: billData.startDate,
        endDate: billData.endDate,
        dueDate: billData.dueDate,
        billingMode: billData.billingMode,
        notes: billData.notes,
        student: billData.student,
        items: billData.items,
        subtotal: billData.subtotal,
        discountType: billData.discountType,
        discountValue: Number(billData.discountValue || 0),
        discountAmount: billData.discountAmount,
        taxName: billData.taxName,
        taxType: billData.taxType,
        taxValue: Number(billData.taxValue || 0),
        taxAmount: billData.taxAmount,
        grandTotal: billData.grandTotal,
        paidAmount: billData.paidAmount,
        remainingAmount: billData.remainingAmount,
        previousOutstanding: billData.previousOutstanding,
        status: billData.status,
        allocations: billData.allocations,
        includePaymentHistory: includePaymentHistory,
        includePreviousHistory: includePreviousHistory,
        previousBills: previousBills,
      },
      logoUrl,
      poppinsFonts,
      activeSettings
    );
    doc.save(`${billData.billNumber}_Fee_Invoice_A5.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Joint allocations list for history table (merges current and previous bills when enabled)
  const jointAllocationsList = useMemo(() => {
    if (!billData) return [];
    if (!includePreviousHistory) {
      return (billData.allocations || []).map((a: any) => ({
        id: a.id,
        receiptNumber: a.payment.receiptNumber,
        paymentDate: a.payment.paymentDate,
        paymentMethod: a.payment.paymentMethod,
        amountAllocated: a.amountAllocated,
        totalPaymentAmount: a.payment.amount,
        targetType: 'THIS_INVOICE' as const,
        targetBillNumber: billData.billNumber,
        targetRemaining: billData.remainingAmount,
        targetStatus: billData.status,
      }));
    }

    const list: any[] = [];

    // 1. This bill's direct allocations
    (billData.allocations || []).forEach((a: any) => {
      list.push({
        id: a.id,
        receiptNumber: a.payment.receiptNumber,
        paymentDate: a.payment.paymentDate,
        paymentMethod: a.payment.paymentMethod,
        amountAllocated: a.amountAllocated,
        totalPaymentAmount: a.payment.amount,
        targetType: 'THIS_INVOICE' as const,
        targetBillNumber: billData.billNumber,
        targetRemaining: billData.remainingAmount,
        targetStatus: billData.status,
      });

      // Sibling allocations on other / previous bills from this same payment
      (a.payment?.siblingAllocations || []).forEach((sa: any) => {
        list.push({
          id: `sibling-${sa.id}`,
          receiptNumber: a.payment.receiptNumber,
          paymentDate: a.payment.paymentDate,
          paymentMethod: a.payment.paymentMethod,
          amountAllocated: sa.amountAllocated,
          totalPaymentAmount: a.payment.amount,
          targetType: 'PREVIOUS_INVOICE' as const,
          targetBillNumber: sa.billNumber,
          targetRemaining: sa.remainingAmount,
          targetStatus: sa.status,
        });
      });
    });

    // 2. Any additional previous bills allocations for this student not in sibling list
    (previousBills || []).forEach((pb: any) => {
      (pb.allocations || []).forEach((pa: any) => {
        const alreadyInList = list.some(
          (item) => item.receiptNumber === pa.payment.receiptNumber && item.targetBillNumber === pb.billNumber
        );
        if (!alreadyInList) {
          list.push({
            id: `prev-${pa.id}`,
            receiptNumber: pa.payment.receiptNumber,
            paymentDate: pa.payment.paymentDate,
            paymentMethod: pa.payment.paymentMethod,
            amountAllocated: pa.amountAllocated,
            totalPaymentAmount: pa.payment.amount,
            targetType: 'PREVIOUS_INVOICE' as const,
            targetBillNumber: pb.billNumber,
            targetRemaining: pb.remainingAmount,
            targetStatus: pb.status,
          });
        }
      });
    });

    return list;
  }, [billData, includePreviousHistory, previousBills]);

  const previousSummary = useMemo(() => {
    if (!billData) return { originalDue: 0, paid: 0, remaining: 0 };
    const originalDue = Number(billData.previousOutstanding || 0);

    const prevAllocated = jointAllocationsList
      .filter((x: any) => x.targetType === 'PREVIOUS_INVOICE')
      .reduce((sum: number, x: any) => sum + Number(x.amountAllocated || 0), 0);

    const remaining = Math.max(0, originalDue - prevAllocated);

    return {
      originalDue,
      paid: prevAllocated,
      remaining,
    };
  }, [billData, jointAllocationsList]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-slate-200 rounded-lg" />
        <div className="h-96 bg-white rounded-xl border border-slate-200" />
      </div>
    );
  }

  if (!billData) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
        <p className="text-slate-500 font-medium">Invoice not found.</p>
        <Link href="/fee-bills">
          <Button variant="primary" size="sm" className="mt-4">
            Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Print-specific A5 page styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A5 portrait;
            margin: 6mm;
          }
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 11px !important;
          }
          header,
          aside,
          .no-print {
            display: none !important;
          }
          .print-sheet {
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 8px !important;
            margin: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Top Header Actions */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/fee-bills"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm w-fit transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Invoices</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="w-3.5 h-3.5 text-slate-600" />}
          >
            Print
          </Button>

          {billData.allocations?.length > 0 && (
            <button
              type="button"
              onClick={() => setIncludePaymentHistory(!includePaymentHistory)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all shadow-sm ${
                includePaymentHistory
                  ? 'bg-blue-50/90 border-[#0066FF] text-[#0066FF]'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="Toggle whether Payment Transactions & Allocations History is included in the downloaded PDF invoice"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>History in PDF:</span>
              <span
                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  includePaymentHistory ? 'bg-[#0066FF]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    includePaymentHistory ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </span>
              <span className="font-mono text-[10px] font-bold">
                {includePaymentHistory ? 'ON' : 'OFF'}
              </span>
            </button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            leftIcon={<FileDown className="w-3.5 h-3.5 text-rose-500" />}
          >
            Download PDF
          </Button>

          <Link href={`/fee-bills/${id}/edit`}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Pencil className="w-3.5 h-3.5 text-amber-600" />}
              className="text-amber-800 border-amber-300 hover:bg-amber-50"
            >
              Edit Invoice
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
            className="text-rose-600 border-rose-200 hover:bg-rose-50"
          >
            Delete
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsPaymentModalOpen(true)}
            leftIcon={<CreditCard className="w-4 h-4" />}
            className="font-semibold shadow-sm"
          >
            Record Payment
          </Button>
        </div>
      </div>

      {/* Main Official Invoice Container Sheet (A5 Template Design) */}
      <div className="print-sheet bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-4xl mx-auto">
        {/* Top Decorative Arched Wave matching user template */}
        <div className="relative w-full h-10 sm:h-12 bg-[#0066FF] overflow-hidden">
          <svg
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full text-white fill-current"
          >
            <path d="M 0,0 L 0,100 L 1000,100 L 1000,0 Q 500,90 0,0 Z" />
          </svg>
          <svg
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full text-[#001B48] fill-none stroke-current"
            strokeWidth="4"
          >
            <path d="M 0,0 Q 500,90 1000,0" />
          </svg>
        </div>

        {/* ========================================================================= */}
        {/* 🌟 LOGO ADJUSTMENT CONTROLS (Yahan se numbers change karke adjust karein) 🌟 */}
        {/* ========================================================================= */}
        {(() => {
          // 👉 1. LOGO KA SIZE (Height in pixels - number barhane se logo bara hoga):
          const LOGO_HEIGHT_PX = 160; // 👈 Bada size (e.g. 140, 160, 180, 200, 220)

          // 👉 2. UPAR / NEECHAY (Y-axis - plus (+) karne se neechay, minus (-) se upar):
          const LOGO_UP_DOWN_PX = 0; // 👈 Upar / Neechay (e.g. -15, 0, +15)

          // 👉 3. LEFT / RIGHT (X-axis - plus (+) karne se right, minus (-) se left):
          const LOGO_LEFT_RIGHT_PX = 0; // 👈 Left / Right (e.g. -20, 0, +20)

          return (
            <div className="px-6 sm:px-10 pt-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div
                className="flex items-center shrink-0"
                style={{
                  transform: `translate(${LOGO_LEFT_RIGHT_PX}px, ${LOGO_UP_DOWN_PX}px)`,
                }}
              >
                <img
                  src="/logo-sm.png"
                  alt="Global Tech International Academy"
                  style={{
                    height: `${LOGO_HEIGHT_PX}px`,
                    width: 'auto',
                    objectFit: 'contain',
                  }}
                  className="shrink-0 drop-shadow-xs"
                />
              </div>

              <div className="text-left sm:text-right">
                <span className="text-4xl sm:text-5xl font-black text-[#0066FF] tracking-tight block">
                  INVOICE
                </span>
              </div>
            </div>
          );
        })()}

        {/* Client Greeting & Invoice Meta Grid */}
        <div className="px-6 sm:px-10 pt-4 pb-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Dear {billData.student.fullName}
            </h2>
            <div className="mt-1 space-y-1 text-xs text-slate-600">
              <p className="font-semibold text-[#0052CC]">
                Student ID: {billData.student.studentCode}
              </p>
              {billData.student.guardianName && (
                <p>Guardian: {billData.student.guardianName}</p>
              )}
              <p>Phone: {billData.student.phone}</p>
              {billData.student.email && <p>Email: {billData.student.email}</p>}
            </div>
          </div>

          <div className="space-y-1 text-xs md:text-right">
            <div className="flex justify-between md:justify-end gap-3">
              <span className="text-slate-500">Invoice #:</span>
              <span className="font-bold text-[#001B48] font-mono">{billData.billNumber}</span>
            </div>
            <div className="flex justify-between md:justify-end gap-3">
              <span className="text-slate-500">Issue Date:</span>
              <span className="font-semibold text-slate-800">{formatDate(billData.billDate)}</span>
            </div>
            {billData.startDate && billData.endDate && (
              <div className="flex justify-between md:justify-end gap-3">
                <span className="text-slate-500">Billing Period:</span>
                <span className="font-semibold text-slate-700">
                  {formatDate(billData.startDate)} – {formatDate(billData.endDate)}
                </span>
              </div>
            )}
            <div className="flex justify-between md:justify-end gap-3">
              <span className="text-slate-500">Due Date:</span>
              <span className="font-bold text-rose-600">
                {billData.dueDate ? formatDate(billData.dueDate) : 'On Receipt'}
              </span>
            </div>
            <div className="flex justify-between md:justify-end gap-3">
              <span className="text-slate-500">Billing Mode:</span>
              <span className="font-semibold text-[#0066FF]">
                {billData.billingMode.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-2 inline-block">
              <Badge status={billData.status} />
            </div>
          </div>
        </div>

        {/* Itemized Line Items Table with Blue Header */}
        <div className="p-6 sm:p-10">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0066FF] text-white uppercase font-bold tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">SL.</th>
                  <th className="py-2.5 px-4">Course Name</th>
                  <th className="py-2.5 px-4">Duration</th>
                  <th className="py-2.5 px-4 text-right">Price</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billData.items.map((it: any, idx: number) => {
                  const isOverridden =
                    it.overridePrice !== null && it.overridePrice !== it.defaultPrice;
                  return (
                    <tr key={it.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{it.course.name}</div>
                        <div className="text-[11px] text-slate-500">
                          Mode: {it.billingMode.replace('_', ' ')} • Instructor: {it.course.trainer?.name || 'Assigned'}
                        </div>
                        {billData.startDate && billData.endDate && (
                          <div className="text-[11px] font-medium text-[#0066FF] mt-0.5">
                            Period: {formatDate(billData.startDate)} – {formatDate(billData.endDate)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div className="font-semibold text-slate-800">
                          {it.durationValue || 1} {Number(it.durationValue || 1) === 1 ? 'Month' : 'Months'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {it.billingMode === 'MONTHLY' ? '(Monthly Plan)' : '(Full / One-Time)'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {isOverridden ? (
                          <div>
                            <span className="font-semibold text-[#0052CC]">
                              {formatCurrency(it.overridePrice)}
                            </span>
                            <span className="text-[10px] text-slate-400 block line-through">
                              {formatCurrency(it.defaultPrice)}
                            </span>
                          </div>
                        ) : (
                          formatCurrency(it.defaultPrice)
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(it.lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Grid: Payment Method & Policy on Left, Calculations & Branding on Right */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left: Payment Method & Official Instructions / Policy */}
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="font-bold text-[#001B48] text-sm mb-2">
                  Payment Method:
                </h3>
                <div className="space-y-1 text-slate-600 bg-slate-50/70 p-3 rounded-lg border border-slate-200">
                  <p><span className="text-slate-500">Bank Name:</span> <strong className="text-slate-800">{settings.bank_name || 'Meezan Bank Ltd'}</strong></p>
                  <p><span className="text-slate-500">Account Name:</span> <strong className="text-slate-800">{settings.bank_account_name || 'Global Tech Academy'}</strong></p>
                  <p><span className="text-slate-500">Account Number:</span> <strong className="text-slate-800 font-mono">{settings.bank_account_number || '0102-0105849301'}</strong></p>
                  <p><span className="text-slate-500">IBAN:</span> <strong className="text-slate-800 font-mono">{settings.bank_iban || 'PK45MEZN0001020105849301'}</strong></p>
                </div>
              </div>

              {/* Official Instructions & Policy */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <h4 className="font-bold text-[#001B48] text-xs">
                  {settings.policy_title || 'Official Instructions & Policy:'}
                </h4>
                <div className="space-y-1 text-[11px] text-slate-600">
                  {getPolicyLines(settings).map((line, idx) => (
                    <p key={idx}>{line}</p>
                  ))}
                </div>
              </div>

              {billData.notes && (
                <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100">
                  <span className="font-bold text-[#0052CC]">Remarks:</span>{' '}
                  <span className="text-slate-700">{billData.notes}</span>
                </div>
              )}
            </div>

            {/* Right: Financial Breakdown & Academy Branding */}
            <div className="space-y-5 text-xs md:text-right">
              <div className="space-y-1.5 md:ml-auto md:w-64">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(billData.subtotal)}</span>
                </div>

                {billData.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>
                      {billData.discountType === 'PERCENTAGE'
                        ? Number(billData.discountValue) > 0
                          ? `Discount (${billData.discountValue}%):`
                          : 'Discount (%):'
                        : 'Discount:'}
                    </span>
                    <span>- {formatCurrency(billData.discountAmount)}</span>
                  </div>
                )}

                {billData.taxAmount > 0 && (
                  <div className="flex justify-between text-[#0066FF] font-medium">
                    <span>
                      {billData.taxType === 'PERCENTAGE'
                        ? Number(billData.taxValue) > 0
                          ? `${billData.taxName || 'Tax'} (${billData.taxValue}%):`
                          : `${billData.taxName || 'Tax'} (%):`
                        : `${billData.taxName || 'Tax'}:`}
                    </span>
                    <span>+ {formatCurrency(billData.taxAmount)}</span>
                  </div>
                )}

                <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-sm text-[#001B48]">
                  <span>Grand Total:</span>
                  <span>{formatCurrency(billData.grandTotal)}</span>
                </div>

                {billData.previousOutstanding > 0 && (
                  <div className="flex justify-between text-amber-700 font-medium">
                    <span>Previous Outstanding:</span>
                    <span>{formatCurrency(billData.previousOutstanding)}</span>
                  </div>
                )}

                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Amount Paid:</span>
                  <span>{formatCurrency(billData.paidAmount)}</span>
                </div>

                <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-base text-rose-600">
                  <span>Balance Due:</span>
                  <span>{formatCurrency(billData.remainingAmount)}</span>
                </div>

                {/* Academy Branding & Thank You Card */}
                <div className="pt-4 border-t border-slate-200 space-y-1 text-right">
                  <h4 className="text-sm font-bold text-[#0066FF]">
                    {settings.company_greeting || 'Thank You For Your Business!'}
                  </h4>
                  {settings.company_division && (
                    <p className="text-[11px] font-semibold text-slate-800">
                      {settings.company_division}
                    </p>
                  )}
                  {(settings.company_phone || settings.company_city) && (
                    <p className="text-[11px] text-slate-600 font-medium">
                      {[settings.company_phone ? `Helpdesk: ${settings.company_phone}` : '', settings.company_city].filter(Boolean).join(' • ')}
                    </p>
                  )}
                  {settings.company_website && (
                    <p className="text-[11px] font-mono font-medium text-[#001B48]">
                      {settings.company_website}
                    </p>
                  )}
                  {settings.company_address && (
                    <p className="text-[11px] text-slate-500 font-medium">
                      {settings.company_address}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History & Allocations Section */}
        {(billData.allocations?.length > 0 || (previousBills?.length > 0 && billData.previousOutstanding > 0)) && (
          <div className="p-6 sm:p-8 border-t border-slate-200 bg-slate-50/50">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <Receipt className="w-4 h-4 text-[#0052CC]" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Payment Transactions & Allocations History
                </h3>

                {/* Toggle 1: Include in PDF Export */}
                <button
                  type="button"
                  onClick={() => setIncludePaymentHistory(!includePaymentHistory)}
                  className={`no-print inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold transition-all shadow-xs cursor-pointer select-none ${
                    includePaymentHistory
                      ? 'bg-[#0066FF] border-[#0066FF] text-white hover:bg-blue-700 shadow-sm'
                      : 'bg-slate-200 border-slate-300 text-slate-700 hover:bg-slate-300'
                  }`}
                  title="Toggle whether payment history is included in the downloaded PDF invoice"
                >
                  <span className="text-[11px] font-semibold">PDF Export:</span>
                  <span
                    className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      includePaymentHistory ? 'bg-white/30' : 'bg-slate-400'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        includePaymentHistory ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </span>
                  <span className="font-mono text-[10px] font-black uppercase">
                    {includePaymentHistory ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Toggle 2: Include Previous Invoice Allocations / Balance */}
                <button
                  type="button"
                  onClick={() => setIncludePreviousHistory(!includePreviousHistory)}
                  className={`no-print inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold transition-all shadow-xs cursor-pointer select-none ${
                    includePreviousHistory
                      ? 'bg-amber-600 border-amber-600 text-white hover:bg-amber-700 shadow-sm'
                      : 'bg-slate-200 border-slate-300 text-slate-700 hover:bg-slate-300'
                  }`}
                  title="Toggle joint view of previous invoices and settled balances"
                >
                  <span className="text-[11px] font-semibold">Previous Invoices:</span>
                  <span
                    className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      includePreviousHistory ? 'bg-white/30' : 'bg-slate-400'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        includePreviousHistory ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </span>
                  <span className="font-mono text-[10px] font-black uppercase">
                    {includePreviousHistory ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              <div className="no-print text-[11px] text-slate-500 font-medium hidden sm:block">
                {includePreviousHistory
                  ? 'Showing joint current & previous invoice settlement'
                  : 'Showing this invoice transactions only'}
              </div>
            </div>

            {/* Previous vs Current Settlement Cards (Shown when Previous Invoices is ON) */}
            {includePreviousHistory && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {/* Card 1: Previous Invoices Balance */}
                <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-amber-900 uppercase text-[10px] tracking-wider">
                      Previous Invoice(s) Balance
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 text-amber-900">
                      {previousSummary.remaining === 0 ? 'SETTLED' : 'OUTSTANDING'}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Brought Forward:</span>
                      <span className="font-semibold">{formatCurrency(previousSummary.originalDue)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Paid Towards Previous:</span>
                      <span>{formatCurrency(previousSummary.paid)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-amber-900 pt-1 border-t border-amber-200/60">
                      <span>Previous Baqi:</span>
                      <span>{formatCurrency(previousSummary.remaining)}</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: This Invoice Balance */}
                <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[#001B48] uppercase text-[10px] tracking-wider">
                      This Invoice ({billData.billNumber})
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        billData.remainingAmount === 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-[#0052CC]'
                      }`}
                    >
                      {billData.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Invoice Total:</span>
                      <span className="font-semibold">{formatCurrency(billData.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Paid Towards This:</span>
                      <span>{formatCurrency(billData.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[#001B48] pt-1 border-t border-blue-200/60">
                      <span>This Invoice Baqi:</span>
                      <span className={billData.remainingAmount > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                        {formatCurrency(billData.remainingAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Combined Net Position */}
                <div className="p-3.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                      Combined Net Settlement
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                      TOTAL
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Total Original Due:</span>
                      <span className="font-semibold">
                        {formatCurrency(previousSummary.originalDue + billData.grandTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Total Paid So Far:</span>
                      <span>{formatCurrency(previousSummary.paid + billData.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-300">
                      <span>Net Balance Due:</span>
                      <span
                        className={
                          previousSummary.remaining + billData.remainingAmount > 0
                            ? 'text-rose-600'
                            : 'text-emerald-700'
                        }
                      >
                        {formatCurrency(previousSummary.remaining + billData.remainingAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Differentiated Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Receipt #</th>
                    <th className="py-2.5 px-3">Payment Date</th>
                    <th className="py-2.5 px-3">Method</th>
                    {includePreviousHistory && (
                      <th className="py-2.5 px-3">Target Invoice / Category</th>
                    )}
                    <th className="py-2.5 px-3">
                      {includePreviousHistory ? 'Allocated Amount' : 'Allocated To This Bill'}
                    </th>
                    {includePreviousHistory && (
                      <th className="py-2.5 px-3">Target Invoice Baqi</th>
                    )}
                    <th className="py-2.5 px-3">Total Receipt Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jointAllocationsList.map((row: any) => {
                    const isPrev = row.targetType === 'PREVIOUS_INVOICE';
                    return (
                      <tr
                        key={row.id}
                        className={isPrev ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50'}
                      >
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                          {row.receiptNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {formatDate(row.paymentDate)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          {row.paymentMethod.replace('_', ' ')}
                        </td>
                        {includePreviousHistory && (
                          <td className="py-2.5 px-3">
                            {isPrev ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Previous Invoice ({row.targetBillNumber})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#0052CC] border border-blue-200">
                                This Invoice ({row.targetBillNumber})
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-2.5 px-3 font-semibold text-emerald-600">
                          {formatCurrency(row.amountAllocated)}
                        </td>
                        {includePreviousHistory && (
                          <td className="py-2.5 px-3 font-medium text-slate-700">
                            {formatCurrency(row.targetRemaining || 0)}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-slate-600 font-medium">
                          {formatCurrency(row.totalPaymentAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Related Invoices Navigation Bar */}
        {relatedBills.length > 0 && (
          <div className="no-print p-4 sm:p-6 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-800">
              Other Invoices for this Student:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {relatedBills.map((rb) => (
                <Link
                  key={rb.id}
                  href={`/fee-bills/${rb.id}`}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:border-[#0052CC] hover:text-[#0052CC] text-slate-800 font-mono text-[11px] font-medium shadow-sm transition-colors"
                >
                  {rb.billNumber} ({formatCurrency(rb.remainingAmount)})
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        studentId={billData.studentId}
        studentName={billData.student.fullName}
        currentBillId={billData.id}
        currentBillNumber={billData.billNumber}
        currentBillTotal={billData.grandTotal}
        currentBillPaid={billData.paidAmount}
        currentBillRemaining={billData.remainingAmount}
        onSuccess={() => {
          fetchBill();
        }}
      />

      {/* Delete Fee Bill Modal */}
      <DeleteFeeBillModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        feeBill={{
          id: billData.id,
          billNumber: billData.billNumber,
          studentName: billData.student?.fullName,
          grandTotal: billData.grandTotal,
          paidAmount: billData.paidAmount,
          remainingAmount: billData.remainingAmount,
        }}
        onSuccess={() => {
          router.push('/fee-bills');
        }}
      />
    </div>
  );
}
