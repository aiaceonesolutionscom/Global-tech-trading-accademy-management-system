'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  Calendar,
  BookOpen,
  Plus,
  Trash2,
  Tag,
  Percent,
  FileText,
  Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { formatCurrency } from '@/lib/utils';
import { calculateFeeBill, LineItemInput } from '@/lib/calculations';

function isCourseSingleMonth(course?: {
  durationValue?: number | null;
  durationUnit?: string | null;
  billingMode?: string | null;
} | null): boolean {
  if (!course) return false;
  const unit = String(course.durationUnit || 'MONTHS').toUpperCase();
  const val = Number(course.durationValue ?? 1);
  if (unit === 'MONTHS' && val <= 1) return true;
  if (unit === 'WEEKS' && val <= 4) return true;
  if (unit === 'DAYS' && val <= 31) return true;
  return false;
}

export default function EditFeeBillPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  // Data
  const [courses, setCourses] = useState<any[]>([]);
  const [billData, setBillData] = useState<any>(null);

  // Form State
  const [billDate, setBillDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [billingMode, setBillingMode] = useState<'ONE_TIME' | 'MONTHLY'>('MONTHLY');

  // Line items
  const [items, setItems] = useState<
    Array<{
      courseId: string;
      defaultPrice: number;
      overridePrice: string;
      billingMode: 'ONE_TIME' | 'MONTHLY';
      durationValue: number;
    }>
  >([]);

  // Adjustments
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
  const [discountValue, setDiscountValue] = useState<string>('0');

  const [hasTax, setHasTax] = useState(false);
  const [taxName, setTaxName] = useState('GST');
  const [taxType, setTaxType] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE');
  const [taxValue, setTaxValue] = useState<string>('0');

  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string>('UNPAID');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Single-month course intelligence: if all selected course items are 1-month courses, lock to ONE_TIME
  const isSingleMonthCourseActive = useMemo(() => {
    const validItems = items.filter((it) => it.courseId);
    if (validItems.length === 0) return false;
    return validItems.every((it) => {
      const c = courses.find((crs) => crs.id === it.courseId);
      return isCourseSingleMonth(c);
    });
  }, [items, courses]);

  // Auto-enforce ONE_TIME whenever 1-month course is selected
  useEffect(() => {
    if (isSingleMonthCourseActive && billingMode !== 'ONE_TIME') {
      setBillingMode('ONE_TIME');
      setItems((prev) =>
        prev.map((it) => {
          const c = courses.find((crs) => crs.id === it.courseId);
          if (isCourseSingleMonth(c)) {
            return { ...it, billingMode: 'ONE_TIME', durationValue: 1 };
          }
          return it;
        })
      );
    }
  }, [isSingleMonthCourseActive, billingMode, courses]);

  // Load Initial Reference Data & Existing Fee Bill
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [cRes, bRes] = await Promise.all([
          fetch('/api/courses?limit=100'),
          fetch(`/api/fee-bills/${id}`),
        ]);

        let fetchedCourses: any[] = [];
        if (cRes.ok) {
          const cData = await cRes.json();
          fetchedCourses = cData.data || [];
          setCourses(fetchedCourses);
        }

        if (bRes.ok) {
          const bData = await bRes.json();
          const bill = bData.feeBill;
          setBillData(bill);

          // Populate form fields
          setBillDate(bill.billDate ? bill.billDate.split('T')[0] : '');
          setStartDate(bill.startDate ? bill.startDate.split('T')[0] : '');
          setEndDate(bill.endDate ? bill.endDate.split('T')[0] : '');
          setDueDate(bill.dueDate ? bill.dueDate.split('T')[0] : '');
          setNotes(bill.notes || '');
          setStatus(bill.status || 'UNPAID');

          // Discounts
          if (bill.discountType && bill.discountType !== 'NONE') {
            setHasDiscount(true);
            setDiscountType(bill.discountType);
            setDiscountValue(String(bill.discountValue || 0));
          } else {
            setHasDiscount(false);
            setDiscountValue('0');
          }

          // Taxes
          if (bill.taxType && bill.taxType !== 'NONE') {
            setHasTax(true);
            setTaxName(bill.taxName || 'GST');
            setTaxType(bill.taxType);
            setTaxValue(String(bill.taxValue || 0));
          } else {
            setHasTax(false);
            setTaxValue('0');
          }

          // Line items
          if (bill.items && bill.items.length > 0) {
            const mappedItems = bill.items.map((it: any) => {
              const c = it.course || fetchedCourses.find((crs: any) => crs.id === it.courseId);
              const isSingle = isCourseSingleMonth(c || it);
              return {
                courseId: it.courseId,
                defaultPrice: Number(it.defaultPrice),
                overridePrice:
                  it.overridePrice !== null && it.overridePrice !== undefined
                    ? String(it.overridePrice)
                    : '',
                billingMode: (isSingle ? 'ONE_TIME' : it.billingMode) as 'ONE_TIME' | 'MONTHLY',
                durationValue: isSingle ? 1 : (it.durationValue || 1),
              };
            });
            setItems(mappedItems);

            const allSingle = mappedItems.every((it: any) => {
              const c = fetchedCourses.find((crs: any) => crs.id === it.courseId) || it;
              return isCourseSingleMonth(c);
            });
            setBillingMode(allSingle ? 'ONE_TIME' : (bill.billingMode || 'MONTHLY'));
          } else {
            setBillingMode(bill.billingMode || 'MONTHLY');
          }
        }
      } catch (err: any) {
        setError('Failed to load fee bill data for editing');
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      loadData();
    }
  }, [id]);

  // Handle adding line item
  const handleAddLine = () => {
    // Add clean empty line with nothing pre-filled or duplicated
    setItems((prev) => [
      ...prev,
      {
        courseId: '',
        defaultPrice: 0,
        overridePrice: '',
        billingMode: billingMode || 'MONTHLY',
        durationValue: 1,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (items.length <= 1) {
      setError('Invoice must have at least one course line item');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleCourseChange = (index: number, courseId: string) => {
    if (!courseId) {
      setItems((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          courseId: '',
          defaultPrice: 0,
          overridePrice: '',
        };
        return copy;
      });
      return;
    }

    // Duplicate check: do not allow selecting the same course multiple times
    const isDuplicate = items.some((it, i) => i !== index && it.courseId === courseId);
    if (isDuplicate) {
      setError('Yeh course pehle se invoice mein shamil hai. Duplicate course allow nahi hai.');
      return;
    }
    setError(null);

    const found = courses.find((c) => c.id === courseId);
    if (!found) return;

    const isSingle = isCourseSingleMonth(found);
    const mode = isSingle ? 'ONE_TIME' : found.billingMode;

    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        courseId,
        defaultPrice: Number(found.defaultPrice),
        billingMode: mode,
        durationValue: isSingle ? 1 : (found.durationValue || 1),
      };

      const validItems = copy.filter((it) => it.courseId);
      const allSingle = validItems.length > 0 && validItems.every((it) => {
        const c = courses.find((crs) => crs.id === it.courseId);
        return isCourseSingleMonth(c);
      });
      if (allSingle) {
        setBillingMode('ONE_TIME');
      }

      return copy;
    });
  };

  const handleOverridePriceChange = (index: number, priceStr: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], overridePrice: priceStr };
      return copy;
    });
  };

  const handleLineModeChange = (index: number, mode: 'ONE_TIME' | 'MONTHLY') => {
    const it = items[index];
    const c = courses.find((crs) => crs.id === it?.courseId);
    if (isCourseSingleMonth(c)) {
      return; // Locked for 1-month courses
    }
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], billingMode: mode };
      return copy;
    });
  };

  const handleDurationChange = (index: number, duration: number) => {
    const it = items[index];
    const c = courses.find((crs) => crs.id === it?.courseId);
    if (isCourseSingleMonth(c)) {
      return; // Fixed to 1 for 1-month courses
    }
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], durationValue: Math.max(1, duration) };
      return copy;
    });
  };

  const courseOptions = useMemo(() => {
    return courses.map((c) => {
      const isSelected = items.some((it) => it.courseId === c.id);
      return {
        value: c.id,
        label: isSelected ? `${c.name} (Already in Invoice)` : c.name,
        sublabel: `${c.courseCode} • ${c.durationValue || 1} ${c.durationUnit?.toLowerCase() || 'months'}`,
        badge: isSelected ? 'Selected' : formatCurrency(c.defaultPrice),
        searchTerms: `${c.description || ''} ${c.billingMode || ''}`,
      };
    });
  }, [courses, items]);

  // Centralized calculations
  const calculationInputs: LineItemInput[] = items.map((it) => {
    const c = courses.find((crs) => crs.id === it.courseId);
    const isSingle = isCourseSingleMonth(c);
    return {
      courseId: it.courseId,
      defaultPrice: it.defaultPrice,
      overridePrice: it.overridePrice !== '' ? parseFloat(it.overridePrice) : null,
      billingMode: isSingle ? 'ONE_TIME' : it.billingMode,
      durationValue: isSingle ? 1 : it.durationValue,
    };
  });

  const paidAmount = Number(billData?.paidAmount || 0);

  const calc = calculateFeeBill({
    items: calculationInputs,
    discountType: hasDiscount ? discountType : 'NONE',
    discountValue: hasDiscount ? parseFloat(discountValue) || 0 : 0,
    taxType: hasTax ? taxType : 'NONE',
    taxValue: hasTax ? parseFloat(taxValue) || 0 : 0,
    taxName,
    previousOutstanding: Number(billData?.previousOutstanding || 0),
    paidAmount,
  });

  const remaining = Math.max(0, calc.grandTotal - paidAmount);
  const isGrandTotalInvalid = calc.grandTotal < paidAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setError('Please add at least one course line item');
      return;
    }
    if (items.some((it) => !it.courseId)) {
      setError('Tamam line items mein course select karna zaroori hai ya faaltu empty row delete karein.');
      return;
    }
    if (isGrandTotalInvalid) {
      setError(
        `Grand Total (${formatCurrency(calc.grandTotal)}) cannot be less than the already recorded payment (${formatCurrency(paidAmount)})`
      );
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        billDate,
        startDate,
        endDate,
        dueDate,
        billingMode: isSingleMonthCourseActive ? 'ONE_TIME' : billingMode,
        items: items.map((it) => {
          const c = courses.find((crs) => crs.id === it.courseId);
          const isSingle = isCourseSingleMonth(c);
          return {
            courseId: it.courseId,
            overridePrice: it.overridePrice !== '' ? parseFloat(it.overridePrice) : null,
            billingMode: isSingle ? 'ONE_TIME' : it.billingMode,
            durationValue: isSingle ? 1 : it.durationValue,
          };
        }),
        discountType: hasDiscount ? discountType : 'NONE',
        discountValue: hasDiscount ? parseFloat(discountValue) || 0 : 0,
        taxName,
        taxType: hasTax ? taxType : 'NONE',
        taxValue: hasTax ? parseFloat(taxValue) || 0 : 0,
        notes,
      };

      const res = await fetch(`/api/fee-bills/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update fee bill');
      }

      setSuccessMsg('Fee bill updated successfully!');
      setTimeout(() => {
        router.push(`/fee-bills/${id}`);
      }, 700);
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating the invoice');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-lg" />
        <div className="h-32 bg-white rounded-xl border border-slate-200" />
        <div className="h-64 bg-white rounded-xl border border-slate-200" />
      </div>
    );
  }

  if (!billData) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-sm max-w-lg mx-auto">
        <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900">Invoice Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          The requested fee bill voucher does not exist or has been removed.
        </p>
        <Link href="/fee-bills">
          <Button variant="primary" size="sm" className="font-semibold">
            Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/fee-bills/${id}`}
            className="w-9 h-9 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:text-slate-900 hover:border-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Edit Fee Bill
              </h1>
              <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0052CC] border border-blue-200">
                {billData.billNumber}
              </span>
              <Badge status={billData.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Modify course line items, schedule periods, discounts, taxes, and balance breakdown
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href={`/fee-bills/${id}`}>
            <Button variant="outline" size="sm" className="font-semibold">
              Cancel
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSaving}
            disabled={isGrandTotalInvalid}
            leftIcon={<Save className="w-4 h-4" />}
            className="font-semibold shadow-sm"
          >
            Save Changes
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {paidAmount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <span className="font-bold text-slate-900">Notice: Payments Already Recorded!</span>{' '}
              Received {formatCurrency(paidAmount)}. The revised Grand Total cannot be less than this amount.
            </div>
          </div>
          <div className="font-bold font-mono text-emerald-700 bg-white px-3 py-1.5 rounded-lg border border-amber-200 shrink-0">
            Paid: {formatCurrency(paidAmount)}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Student Information Reference Card */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0052CC] flex items-center justify-center font-bold">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Student Profile Reference
              </h2>
              <p className="text-[11px] text-slate-500">
                Primary enrollee details associated with this voucher
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5 font-semibold uppercase text-[10px] tracking-wider">
                Student Name
              </span>
              <span className="font-bold text-slate-900 text-sm">{billData.student?.fullName}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-semibold uppercase text-[10px] tracking-wider">
                Student Code
              </span>
              <span className="font-mono font-semibold text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
                {billData.student?.studentCode}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-semibold uppercase text-[10px] tracking-wider">
                Phone Contact
              </span>
              <span className="font-medium text-slate-700">{billData.student?.phone}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-semibold uppercase text-[10px] tracking-wider">
                Previous Outstanding
              </span>
              <span className="font-bold text-rose-600 font-mono text-sm">
                {formatCurrency(billData.previousOutstanding || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Dates and Billing Period Settings */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0052CC] flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Billing Dates & Schedule
              </h2>
              <p className="text-[11px] text-slate-500">
                Adjust issuance date, period span, and settlement deadline
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Issue Date *
              </label>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC] text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC] text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC] text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Due Date *
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC] text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Course Line Items */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0052CC] flex items-center justify-center font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Course Line Items ({items.length})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Update courses, custom fee pricing overrides, or billing tenures
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLine}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="font-semibold text-[#0052CC]"
            >
              Add Course Line
            </Button>
          </div>

          {isSingleMonthCourseActive && (
            <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl text-blue-900 text-xs font-medium flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-[#0052CC] text-white flex items-center justify-center shrink-0 text-xs font-bold">
                🔒
              </span>
              <span>
                <strong>1-Month Course Auto-Lock:</strong> This course duration is 1 month only. Monthly recurring installments are not applicable, so the billing mode is automatically locked to <strong>One-Time Payment</strong>.
              </span>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[240px]">Course Program</th>
                  <th className="py-2.5 px-3 w-32">Standard Fee</th>
                  <th className="py-2.5 px-3 w-36">Override Fee (PKR)</th>
                  <th className="py-2.5 px-3 w-36">Billing Mode</th>
                  <th className="py-2.5 px-3 w-28">Duration</th>
                  <th className="py-2.5 px-3 w-36 text-right">Line Total</th>
                  <th className="py-2.5 px-3 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => {
                  const lineCalc = calc.items[idx];
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 min-w-[240px]">
                        <SearchableSelect
                          value={it.courseId}
                          onChange={(val) => handleCourseChange(idx, val)}
                          options={courseOptions}
                          placeholder="-- Select course --"
                          searchPlaceholder="Search course name or code..."
                          pageSize={5}
                          required
                        />
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-600 font-mono">
                        {formatCurrency(it.defaultPrice)}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          placeholder="Standard"
                          value={it.overridePrice}
                          onChange={(e) => handleOverridePriceChange(idx, e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        {(() => {
                          const courseObj = courses.find((c) => c.id === it.courseId);
                          const isRowSingle = isCourseSingleMonth(courseObj);
                          if (isRowSingle) {
                            return (
                              <div className="space-y-1">
                                <select
                                  value="ONE_TIME"
                                  disabled
                                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-700 font-semibold cursor-not-allowed"
                                  title="1-Month Course: Locked to One-Time payment"
                                >
                                  <option value="ONE_TIME">One-Time (Locked)</option>
                                </select>
                                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 block text-center">
                                  🔒 1-Mo (One-Time)
                                </span>
                              </div>
                            );
                          }
                          return (
                            <select
                              value={it.billingMode}
                              onChange={(e) =>
                                handleLineModeChange(
                                  idx,
                                  e.target.value as 'ONE_TIME' | 'MONTHLY'
                                )
                              }
                              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                            >
                              <option value="MONTHLY">Monthly</option>
                              <option value="ONE_TIME">One-Time (Full)</option>
                            </select>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3">
                        {(() => {
                          const courseObj = courses.find((c) => c.id === it.courseId);
                          const isRowSingle = isCourseSingleMonth(courseObj);
                          if (isRowSingle || it.billingMode !== 'MONTHLY') {
                            return (
                              <span className="text-slate-500 font-medium text-[11px] bg-slate-100 px-2 py-1 rounded border border-slate-200 inline-block">
                                {isRowSingle ? '1 Mo (Single Term)' : 'Full program'}
                              </span>
                            );
                          }
                          return (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                value={it.durationValue}
                                onChange={(e) =>
                                  handleDurationChange(idx, parseInt(e.target.value) || 1)
                                }
                                className="w-16 text-xs px-2 py-1.5 rounded-lg border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                              />
                              <span className="text-[11px] text-slate-400">mo</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900 font-mono text-xs">
                        {formatCurrency(lineCalc?.lineTotal || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={items.length <= 1}
                          className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed mx-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Adjustments (Discounts & Taxes) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Discount Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Discount Concession
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#0052CC]">
                <input
                  type="checkbox"
                  checked={hasDiscount}
                  onChange={(e) => setHasDiscount(e.target.checked)}
                  className="rounded text-[#0052CC] focus:ring-[#0052CC] w-4 h-4 cursor-pointer"
                />
                <span>Apply Discount</span>
              </label>
            </div>

            {hasDiscount && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Concession Mode
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) =>
                      setDiscountType(e.target.value as 'FIXED' | 'PERCENTAGE')
                    }
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                  >
                    <option value="FIXED">Fixed Amount (PKR)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Discount Value
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC] font-semibold text-emerald-700 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tax Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-[#0052CC]" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Tax / GST Levy
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#0052CC]">
                <input
                  type="checkbox"
                  checked={hasTax}
                  onChange={(e) => setHasTax(e.target.checked)}
                  className="rounded text-[#0052CC] focus:ring-[#0052CC] w-4 h-4 cursor-pointer"
                />
                <span>Apply Tax</span>
              </label>
            </div>

            {hasTax && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tax Label
                  </label>
                  <input
                    type="text"
                    value={taxName}
                    onChange={(e) => setTaxName(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Type
                  </label>
                  <select
                    value={taxType}
                    onChange={(e) =>
                      setTaxType(e.target.value as 'FIXED' | 'PERCENTAGE')
                    }
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (PKR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Rate / Value
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={taxValue}
                    onChange={(e) => setTaxValue(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC] font-semibold text-[#0052CC] font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes & Financial Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-[#0052CC]" />
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Invoice Terms & Notes
              </label>
            </div>
            <textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Official Global Tech International Academy fee voucher. Non-refundable once course commences."
              className="w-full text-xs p-3.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC] leading-relaxed"
            />
          </div>

          {/* Financial Totals Breakdown Card */}
          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm border border-slate-800 space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Recalculated Ledger Summary
                </h3>
              </div>
              <span className="text-[10px] uppercase font-semibold text-blue-300 bg-blue-900/40 px-2.5 py-0.5 rounded-full border border-blue-700/40">
                Live Compute
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
              <span>Gross Tuition Subtotal:</span>
              <span className="font-semibold font-mono text-white text-sm">
                {formatCurrency(calc.subtotal)}
              </span>
            </div>

            {calc.discountAmount > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-800 text-emerald-400 font-medium">
                <span>Concession ({discountType}):</span>
                <span className="font-mono">-{formatCurrency(calc.discountAmount)}</span>
              </div>
            )}

            {calc.taxAmount > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-800 text-blue-300 font-medium">
                <span>
                  {taxName} ({taxType}):
                </span>
                <span className="font-mono">+{formatCurrency(calc.taxAmount)}</span>
              </div>
            )}

            <div className="flex justify-between py-2 border-b border-slate-800 text-sm font-bold">
              <span className="text-white">Revised Grand Total:</span>
              <span className="text-emerald-400 font-mono text-base">
                {formatCurrency(calc.grandTotal)}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
              <span>Already Settled / Paid:</span>
              <span className="font-semibold font-mono text-blue-300">
                {formatCurrency(paidAmount)}
              </span>
            </div>

            <div className="flex justify-between pt-1 text-base font-bold">
              <span className="text-white">Remaining Net Payable:</span>
              <span
                className={`font-mono text-lg ${
                  remaining > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {formatCurrency(remaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Link href={`/fee-bills/${id}`}>
            <Button variant="outline" size="md" className="font-semibold">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSaving}
            disabled={isGrandTotalInvalid}
            leftIcon={<Save className="w-4 h-4" />}
            className="font-semibold shadow-sm px-6"
          >
            Update Fee Bill
          </Button>
        </div>
      </form>
    </div>
  );
}
