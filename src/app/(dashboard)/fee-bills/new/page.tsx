'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  GraduationCap,
  BookOpen,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { formatCurrency, formatDate } from '@/lib/utils';
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

function FeeBillFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedStudentId = searchParams?.get('studentId') || '';
  const preselectedCourseId = searchParams?.get('courseId') || '';
  const queryMode = searchParams?.get('mode') || '';

  // Data
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});

  // Dynamic Student Billing Intelligence State
  const [activeEnrollments, setActiveEnrollments] = useState<any[]>([]);
  const [unbilledEnrollments, setUnbilledEnrollments] = useState<any[]>([]);
  const [billedEnrollments, setBilledEnrollments] = useState<any[]>([]);
  const [courseFilterMode, setCourseFilterMode] = useState<'UNBILLED_ONLY' | 'ALL_ACTIVE'>('UNBILLED_ONLY');
  const [billIntent, setBillIntent] = useState<'MONTHLY_CYCLE' | 'NEW_COURSE'>('MONTHLY_CYCLE');
  const [unpaidBills, setUnpaidBills] = useState<any[]>([]);
  const [existingBills, setExistingBills] = useState<any[]>([]);
  const [installmentInfo, setInstallmentInfo] = useState<string | null>(null);
  const [isAutoLoadedCourses, setIsAutoLoadedCourses] = useState(false);

  // Form State
  const [selectedStudentId, setSelectedStudentId] = useState(preselectedStudentId);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [previousOutstanding, setPreviousOutstanding] = useState(0);

  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Dynamic period calculation based on billingMode and duration
  const itemDurationsKey = items.map((i) => `${i.courseId}:${i.durationValue}:${i.billingMode}`).join('|');
  useEffect(() => {
    if (!startDate) return;
    try {
      const parts = startDate.split('-').map(Number);
      if (parts.length !== 3) return;
      const [y, m, d] = parts;
      const start = new Date(y, m - 1, d);
      if (isNaN(start.getTime())) return;

      const newEnd = new Date(start);
      if (billingMode === 'ONE_TIME') {
        const maxDuration = Math.max(1, ...items.map((it) => Number(it.durationValue) || 1));
        newEnd.setMonth(newEnd.getMonth() + maxDuration);
        newEnd.setDate(newEnd.getDate() - 1);
      } else {
        newEnd.setMonth(newEnd.getMonth() + 1);
        newEnd.setDate(newEnd.getDate() - 1);
      }

      const yr = newEnd.getFullYear();
      const mo = String(newEnd.getMonth() + 1).padStart(2, '0');
      const da = String(newEnd.getDate()).padStart(2, '0');
      setEndDate(`${yr}-${mo}-${da}`);
    } catch (e) {
      console.error('Error calculating period end date:', e);
    }
  }, [billingMode, startDate, itemDurationsKey]);

  // Load Initial Reference Data
  useEffect(() => {
    fetch('/api/students?limit=200')
      .then((res) => res.json())
      .then((d) => setStudents(d.data || []))
      .catch(() => {});

    fetch('/api/courses?limit=100')
      .then((res) => res.json())
      .then((d) => {
        const cList = d.data || [];
        setCourses(cList);
        if (cList.length > 0 && items.length === 0) {
          const matchedCourse = preselectedCourseId
            ? cList.find((c: any) => c.id === preselectedCourseId)
            : null;
          if (matchedCourse) {
            const isSingle = isCourseSingleMonth(matchedCourse);
            const initialMode = isSingle ? 'ONE_TIME' : (matchedCourse.billingMode || 'MONTHLY');
            setItems([
              {
                courseId: matchedCourse.id,
                defaultPrice: Number(matchedCourse.defaultPrice),
                overridePrice: '',
                billingMode: initialMode,
                durationValue: isSingle ? 1 : (matchedCourse.durationValue || 1),
              },
            ]);
            setBillingMode(initialMode);
          } else {
            setItems([
              {
                courseId: '',
                defaultPrice: 0,
                overridePrice: '',
                billingMode: 'MONTHLY',
                durationValue: 1,
              },
            ]);
          }
        }
      })
      .catch(() => {});

    fetch('/api/settings')
      .then((res) => res.json())
      .then((d) => {
        if (d.settings?.tax_name) setTaxName(d.settings.tax_name);
        setSettings(d.settings || {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedStudentId) {
      setSelectedStudent(null);
      setActiveEnrollments([]);
      setUnbilledEnrollments([]);
      setBilledEnrollments([]);
      setCourseFilterMode('UNBILLED_ONLY');
      setUnpaidBills([]);
      setExistingBills([]);
      setInstallmentInfo(null);
      setPreviousOutstanding(0);
      setIsAutoLoadedCourses(false);
      return;
    }

    const stu = students.find((s) => s.id === selectedStudentId);
    setSelectedStudent(stu || null);

    // Fetch full student intelligence (enrollments, fee bills history, and outstanding balances)
    Promise.all([
      fetch(`/api/students/${selectedStudentId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/fee-bills/student/${selectedStudentId}/outstanding`).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([studentData, outstandingData]) => {
        const fullStudent = studentData?.student;

        // 1. Previous Outstanding Balance
        const prevBal = outstandingData?.totalOutstanding || 0;
        setPreviousOutstanding(prevBal);

        if (fullStudent) {
          const enrollments: any[] = fullStudent.enrollments || [];
          const activeEnrs = enrollments.filter(
            (e) => e.status === 'ACTIVE' || e.status === 'PENDING'
          );
          setActiveEnrollments(activeEnrs);

          const feeBills: any[] = fullStudent.feeBills || [];
          const validBills = feeBills.filter((b) => b.status !== 'CANCELLED');
          setExistingBills(validBills);

          const unpaid = validBills.filter(
            (b) =>
              ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(b.status) &&
              Number(b.remainingAmount) > 0
          );
          setUnpaidBills(unpaid);

          // Map courses to their fee bills to detect already-billed vs newly enrolled courses
          const courseBillMap = new Map<string, any[]>();
          validBills.forEach((b: any) => {
            (b.items || []).forEach((item: any) => {
              if (item.courseId) {
                const list = courseBillMap.get(item.courseId) || [];
                list.push(b);
                courseBillMap.set(item.courseId, list);
              }
            });
          });

          const unbilled = activeEnrs.filter((e) => !courseBillMap.has(e.courseId));
          const billed = activeEnrs.filter((e) => courseBillMap.has(e.courseId));
          setUnbilledEnrollments(unbilled);
          setBilledEnrollments(billed);

          // 2. Auto-Populate Enrolled Courses:
          // If student has newly enrolled courses that haven't been billed yet, prioritize billing ONLY the new course(s)!
          // Otherwise, if all active courses are already billed (e.g. monthly installment cycle), load all active courses.
          if (activeEnrs.length > 0 && !preselectedCourseId) {
            const targetEnrs = unbilled.length > 0 ? unbilled : activeEnrs;
            setCourseFilterMode(unbilled.length > 0 ? 'UNBILLED_ONLY' : 'ALL_ACTIVE');

            const mappedItems = targetEnrs.map((enr) => {
              const c = enr.course || courses.find((crs) => crs.id === enr.courseId);
              const isSingle = isCourseSingleMonth(c || enr);
              return {
                courseId: enr.courseId,
                defaultPrice: Number(enr.course?.defaultPrice || 0),
                overridePrice: '',
                billingMode: (isSingle
                  ? 'ONE_TIME'
                  : enr.billingMode || enr.course?.billingMode || 'MONTHLY') as
                  | 'ONE_TIME'
                  | 'MONTHLY',
                durationValue: isSingle ? 1 : (enr.durationValue || enr.course?.durationValue || 1),
              };
            });
            setItems(mappedItems);
            setIsAutoLoadedCourses(true);

            const allSingle = mappedItems.every((it) => {
              const c = courses.find((crs) => crs.id === it.courseId) || targetEnrs.find((e) => e.courseId === it.courseId)?.course;
              return isCourseSingleMonth(c);
            });

            const primaryMode = allSingle
              ? 'ONE_TIME'
              : ((targetEnrs[0].billingMode ||
                targetEnrs[0].course?.billingMode ||
                'MONTHLY') as 'ONE_TIME' | 'MONTHLY');
            setBillingMode(primaryMode);
          } else if (activeEnrs.length === 0) {
            setIsAutoLoadedCourses(false);
            setCourseFilterMode('ALL_ACTIVE');
          }

          // 3. Dynamic Monthly Installment Rolling Dates & Tracker
          const monthlyBills = validBills.filter((b) => b.billingMode === 'MONTHLY');
          if (monthlyBills.length > 0) {
            // Find most recent monthly bill by latest endDate
            const sortedMonthly = monthlyBills.slice().sort((a, b) => {
              const aTime = new Date(a.endDate || a.billDate).getTime();
              const bTime = new Date(b.endDate || b.billDate).getTime();
              return bTime - aTime;
            });
            const latestBill = sortedMonthly[0];
            const maxDuration =
              activeEnrs[0]?.durationValue || activeEnrs[0]?.course?.durationValue || 6;
            const currentInstallmentNum = monthlyBills.length + 1;

            setInstallmentInfo(`Installment ${currentInstallmentNum} of ${maxDuration}`);

            if (latestBill.endDate) {
              const datePart = String(latestBill.endDate).split('T')[0];
              const [y, m, d] = datePart.split('-').map(Number);
              const lastEnd = new Date(y, m - 1, d);

              // Next cycle starts exactly 1 day after previous bill ended!
              // e.g. If previous ended on 10 July, next cycle starts on 11 July!
              const nextStart = new Date(lastEnd);
              nextStart.setDate(nextStart.getDate() + 1);

              const nextEnd = new Date(nextStart);
              nextEnd.setMonth(nextEnd.getMonth() + 1);
              nextEnd.setDate(nextEnd.getDate() - 1);

              const nextDue = new Date(nextStart);
              nextDue.setDate(nextDue.getDate() + 7);

              const formatYMD = (date: Date) => {
                const yr = date.getFullYear();
                const mo = String(date.getMonth() + 1).padStart(2, '0');
                const da = String(date.getDate()).padStart(2, '0');
                return `${yr}-${mo}-${da}`;
              };

              setStartDate(formatYMD(nextStart));
              setEndDate(formatYMD(nextEnd));
              setDueDate(formatYMD(nextDue));
            }
          } else {
            setInstallmentInfo(null);
          }
        }
      })
      .catch((err) => {
        console.error('Error detecting student billing details:', err);
      });
  }, [selectedStudentId, students, preselectedCourseId]);

  const studentOptions = useMemo(() => {
    return students.map((s) => ({
      value: s.id,
      label: s.fullName,
      sublabel: `${s.studentCode} • ${s.phone}`,
      badge: s.status,
      searchTerms: `${s.email || ''} ${s.guardianName || ''} ${s.cnic || ''}`,
    }));
  }, [students]);

  const courseOptions = useMemo(() => {
    return courses.map((c) => {
      const isSelected = items.some((it) => it.courseId === c.id);
      return {
        value: c.id,
        label: isSelected ? `${c.name} (Already in Invoice)` : c.name,
        sublabel: `${c.courseCode} • ${c.durationValue} ${c.durationUnit?.toLowerCase()}`,
        badge: isSelected ? 'Selected' : formatCurrency(c.defaultPrice),
        searchTerms: `${c.description || ''} ${c.billingMode || ''}`,
      };
    });
  }, [courses, items]);

  const handleLoadUnbilledOnly = () => {
    if (unbilledEnrollments.length === 0) return;
    setCourseFilterMode('UNBILLED_ONLY');
    const mapped = unbilledEnrollments.map((enr) => {
      const c = enr.course || courses.find((crs) => crs.id === enr.courseId);
      const isSingle = isCourseSingleMonth(c || enr);
      return {
        courseId: enr.courseId,
        defaultPrice: Number(enr.course?.defaultPrice || 0),
        overridePrice: '',
        billingMode: (isSingle
          ? 'ONE_TIME'
          : enr.billingMode || enr.course?.billingMode || 'MONTHLY') as
          | 'ONE_TIME'
          | 'MONTHLY',
        durationValue: isSingle ? 1 : (enr.durationValue || enr.course?.durationValue || 1),
      };
    });
    setItems(mapped);
    setIsAutoLoadedCourses(true);

    const allSingle = mapped.every((it) => {
      const c = courses.find((crs) => crs.id === it.courseId) || unbilledEnrollments.find((e) => e.courseId === it.courseId)?.course;
      return isCourseSingleMonth(c);
    });
    if (allSingle) {
      setBillingMode('ONE_TIME');
    }
  };

  const handleLoadAllActive = () => {
    if (activeEnrollments.length === 0) return;
    setCourseFilterMode('ALL_ACTIVE');
    const mapped = activeEnrollments.map((enr) => {
      const c = enr.course || courses.find((crs) => crs.id === enr.courseId);
      const isSingle = isCourseSingleMonth(c || enr);
      return {
        courseId: enr.courseId,
        defaultPrice: Number(enr.course?.defaultPrice || 0),
        overridePrice: '',
        billingMode: (isSingle
          ? 'ONE_TIME'
          : enr.billingMode || enr.course?.billingMode || 'MONTHLY') as
          | 'ONE_TIME'
          | 'MONTHLY',
        durationValue: isSingle ? 1 : (enr.durationValue || enr.course?.durationValue || 1),
      };
    });
    setItems(mapped);
    setIsAutoLoadedCourses(true);

    const allSingle = mapped.every((it) => {
      const c = courses.find((crs) => crs.id === it.courseId) || activeEnrollments.find((e) => e.courseId === it.courseId)?.course;
      return isCourseSingleMonth(c);
    });
    if (allSingle) {
      setBillingMode('ONE_TIME');
    }
  };

  const handleAddCourseRow = () => {
    // Add a fresh, blank row with nothing pre-written or pre-selected
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

  const handleRemoveCourseRow = (index: number) => {
    if (items.length <= 1) return;
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

    // Duplicate prevention: do not allow selecting the same course multiple times
    const isDuplicate = items.some((it, i) => i !== index && it.courseId === courseId);
    if (isDuplicate) {
      setError('Yeh course pehle se invoice mein shamil hai. Duplicate course allow nahi hai.');
      return;
    }
    setError(null);

    const foundCourse = courses.find((c) => c.id === courseId);
    if (!foundCourse) return;

    const isSingle = isCourseSingleMonth(foundCourse);
    const mode = isSingle ? 'ONE_TIME' : foundCourse.billingMode || billingMode || 'MONTHLY';

    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        courseId,
        defaultPrice: Number(foundCourse.defaultPrice),
        overridePrice: '',
        billingMode: mode,
        durationValue: isSingle ? 1 : (foundCourse.durationValue || 1),
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

  const handleMasterBillingModeChange = (mode: 'ONE_TIME' | 'MONTHLY') => {
    if (isSingleMonthCourseActive && mode === 'MONTHLY') {
      return; // Locked for 1-month courses
    }
    setBillingMode(mode);
    setItems((prev) =>
      prev.map((it) => {
        const c = courses.find((crs) => crs.id === it.courseId);
        if (isCourseSingleMonth(c)) {
          return { ...it, billingMode: 'ONE_TIME', durationValue: 1 };
        }
        return {
          ...it,
          billingMode: mode,
        };
      })
    );
    if (startDate) {
      const parts = startDate.split('-').map(Number);
      if (parts.length === 3) {
        const [y, m, d] = parts;
        const start = new Date(y, m - 1, d);
        const newEnd = new Date(start);
        if (mode === 'ONE_TIME') {
          const maxDur = Math.max(1, ...items.map((it) => Number(it.durationValue) || 1));
          newEnd.setMonth(newEnd.getMonth() + maxDur);
          newEnd.setDate(newEnd.getDate() - 1);
        } else {
          newEnd.setMonth(newEnd.getMonth() + 1);
          newEnd.setDate(newEnd.getDate() - 1);
        }
        const yr = newEnd.getFullYear();
        const mo = String(newEnd.getMonth() + 1).padStart(2, '0');
        const da = String(newEnd.getDate()).padStart(2, '0');
        setEndDate(`${yr}-${mo}-${da}`);
      }
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (!val) return;
    const parts = val.split('-').map(Number);
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const start = new Date(y, m - 1, d);
      const newEnd = new Date(start);
      if (billingMode === 'ONE_TIME') {
        const maxDur = Math.max(1, ...items.map((it) => Number(it.durationValue) || 1));
        newEnd.setMonth(newEnd.getMonth() + maxDur);
        newEnd.setDate(newEnd.getDate() - 1);
      } else {
        newEnd.setMonth(newEnd.getMonth() + 1);
        newEnd.setDate(newEnd.getDate() - 1);
      }
      const yr = newEnd.getFullYear();
      const mo = String(newEnd.getMonth() + 1).padStart(2, '0');
      const da = String(newEnd.getDate()).padStart(2, '0');
      setEndDate(`${yr}-${mo}-${da}`);
    }
  };

  const handleOverridePriceChange = (index: number, val: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], overridePrice: val };
      return copy;
    });
  };

  const handleLineModeChange = (index: number, mode: 'ONE_TIME' | 'MONTHLY') => {
    const item = items[index];
    const c = courses.find((crs) => crs.id === item?.courseId);
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
    const item = items[index];
    const c = courses.find((crs) => crs.id === item?.courseId);
    if (isCourseSingleMonth(c)) {
      return; // Fixed to 1 for 1-month courses
    }
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], durationValue: Math.max(1, duration) };
      return copy;
    });
  };

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

  const calc = calculateFeeBill({
    items: calculationInputs,
    discountType: hasDiscount ? discountType : 'NONE',
    discountValue: hasDiscount ? parseFloat(discountValue) || 0 : 0,
    taxType: hasTax ? taxType : 'NONE',
    taxValue: hasTax ? parseFloat(taxValue) || 0 : 0,
    taxName,
    previousOutstanding,
    paidAmount: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setError('Please select a student');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one course line item');
      return;
    }
    if (items.some((it) => !it.courseId)) {
      setError('Tamam line items mein course select karna zaroori hai ya faaltu empty row delete karein.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        studentId: selectedStudentId,
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

      const res = await fetch('/api/fee-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate fee bill');
      }

      router.push(`/fee-bills/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating fee bill');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/fee-bills"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Invoices</span>
        </Link>
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          leftIcon={<Save className="w-4 h-4" />}
          className="font-semibold shadow-sm"
        >
          Generate & Save Fee Bill
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* NEXT MONTH SHORTCUT BANNER */}
      {queryMode === 'NEXT_MONTH' && installmentInfo && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700 shrink-0">
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                ⚡ Auto-Configured for Next Month ({installmentInfo})
              </p>
              <p className="text-indigo-800 mt-0.5">
                Billing dates set to <strong className="underline">{formatDate(startDate)} – {formatDate(endDate)}</strong> and ongoing courses loaded. Any unpaid balance from previous months is automatically included.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SMART ALERT: Unpaid / Outstanding Invoices */}
      {unpaidBills.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-amber-950 text-sm flex items-center gap-2">
                Student Has {unpaidBills.length} Unpaid Invoice{unpaidBills.length > 1 ? 's' : ''}
                <span className="text-[11px] font-semibold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                  Outstanding: {formatCurrency(previousOutstanding)}
                </span>
              </p>
              <p className="text-amber-800 mt-1 leading-relaxed">
                <span className="font-semibold text-slate-900">{selectedStudent?.fullName}</span> has an active unpaid invoice (
                <span className="font-mono font-bold text-amber-950">#{unpaidBills[0].billNumber}</span>) with{' '}
                <span className="font-bold text-rose-700">{formatCurrency(unpaidBills[0].remainingAmount)}</span> remaining
                (Due: <span className="font-medium">{formatDate(unpaidBills[0].dueDate)}</span>).
                This balance is <span className="underline font-semibold">automatically carried forward</span> into &quot;Previous Outstanding&quot; below.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
            <Link
              href={`/fee-bills/${unpaidBills[0].id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-900 rounded-lg font-bold text-xs transition-colors shadow-xs"
            >
              <span>View Unpaid Bill</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <Link
              href={`/fee-bills/${unpaidBills[0].id}/edit`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200/80 text-amber-950 rounded-lg font-bold text-xs transition-colors shadow-xs border border-amber-300"
            >
              <span>+ Add Course to Existing Bill</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* TOP SECTION: Student Selection & Dates Card */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-200 pb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0052CC] flex items-center justify-center font-bold">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                1. Student Selection & Billing Dates
              </h2>
              <p className="text-xs text-slate-500">
                Pick a student to automatically detect personal details, enrolled courses and carry-forward balances
              </p>
            </div>
          </div>

          {installmentInfo && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg shadow-xs">
              <Clock className="w-3.5 h-3.5" />
              {installmentInfo}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <SearchableSelect
              label="Select Student"
              value={selectedStudentId}
              onChange={(val) => setSelectedStudentId(val)}
              options={studentOptions}
              placeholder="-- Choose a registered student --"
              searchPlaceholder="Search by name, student code (GT-STU-...), phone..."
              pageSize={6}
              required
            />

            {selectedStudent && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2.5">
                <div className="flex justify-between font-semibold text-slate-800">
                  <span className="text-slate-500">Student ID:</span>
                  <span className="font-mono text-[#0052CC]">{selectedStudent.studentCode}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span className="text-slate-500">Phone:</span>
                  <span>{selectedStudent.phone}</span>
                </div>
                {selectedStudent.guardianName && (
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span className="text-slate-500">Guardian:</span>
                    <span>{selectedStudent.guardianName}</span>
                  </div>
                )}

                {/* Enrolled Courses Indicator */}
                <div className="flex justify-between items-center text-slate-600 font-medium pt-1.5 border-t border-slate-200">
                  <span className="text-slate-500">Enrolled In:</span>
                  {activeEnrollments.length > 0 ? (
                    <span
                      className="font-bold text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 max-w-[170px] truncate"
                      title={activeEnrollments.map((e) => e.course?.name).join(', ')}
                    >
                      {activeEnrollments.map((e) => e.course?.name).join(', ')}
                    </span>
                  ) : (
                    <span className="italic text-slate-400">Direct Invoice (No Enrollment)</span>
                  )}
                </div>

                {/* Billing Cycle Tracker */}
                {installmentInfo && (
                  <div className="flex justify-between items-center text-slate-600 font-medium">
                    <span className="text-slate-500">Billing Cycle:</span>
                    <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-600" />
                      {installmentInfo}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-800">Previous Outstanding:</span>
                  {previousOutstanding > 0 ? (
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {formatCurrency(previousOutstanding)}
                    </span>
                  ) : (
                    <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Rs. 0.00 (Clear)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* Student Billing Workflow Question Box when student already has active enrollments */}
            {selectedStudent && activeEnrollments.length > 0 && (
              <div className="p-4 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200/90 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0052CC]" />
                  <span className="font-bold text-slate-900 text-xs">
                    Enrollment Workflow: What fee bill would you like to create for {selectedStudent.fullName}?
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBillIntent('MONTHLY_CYCLE');
                      handleLoadAllActive();
                    }}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      billIntent === 'MONTHLY_CYCLE'
                        ? 'bg-white border-[#0052CC] shadow-xs ring-2 ring-[#0052CC]/20'
                        : 'bg-white/70 border-slate-200 hover:bg-white text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">
                        1. Bill Scheduled Monthly Cycle
                      </span>
                      {installmentInfo && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {installmentInfo}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Loads currently enrolled course(s) and advances dates for the upcoming installment.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBillIntent('NEW_COURSE');
                      setItems([
                        {
                          courseId: '',
                          defaultPrice: 0,
                          overridePrice: '',
                          billingMode: 'MONTHLY',
                          durationValue: 1,
                        },
                      ]);
                      setIsAutoLoadedCourses(false);
                    }}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      billIntent === 'NEW_COURSE'
                        ? 'bg-white border-[#0052CC] shadow-xs ring-2 ring-[#0052CC]/20'
                        : 'bg-white/70 border-slate-200 hover:bg-white text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">
                        2. Add &amp; Bill a New Course
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        + New Course
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Allows picking an additional or new course for this student without re-billing previous course fees.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {installmentInfo && (
              <div className="p-2.5 bg-indigo-50/80 border border-indigo-100 rounded-lg text-indigo-900 text-xs font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <strong>Dynamic Period:</strong> Dates automatically shifted for{' '}
                  <strong className="text-indigo-950 underline">{installmentInfo}</strong> based on the student&apos;s previous invoice cycle.
                </span>
              </div>
            )}

            {/* Master Fee Bill Plan / Billing Mode Selector */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Fee Bill Plan / Billing Mode *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isSingleMonthCourseActive}
                  onClick={() => handleMasterBillingModeChange('MONTHLY')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    isSingleMonthCourseActive
                      ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                      : billingMode === 'MONTHLY'
                      ? 'bg-blue-50/90 border-[#0052CC] ring-2 ring-[#0052CC]/20 shadow-xs cursor-pointer'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 cursor-pointer'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSingleMonthCourseActive
                        ? 'bg-slate-200 text-slate-400'
                        : billingMode === 'MONTHLY'
                        ? 'bg-[#0052CC] text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900">
                        Monthly Installment Plan
                      </span>
                      {isSingleMonthCourseActive ? (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
                          Not available for 1-Mo Course
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                          1 Month Cycle
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {isSingleMonthCourseActive
                        ? 'Disabled: single-month courses complete in 1 term without recurring installments.'
                        : 'Splits course fee into monthly installments. Advance dates cycle-by-cycle.'}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleMasterBillingModeChange('ONE_TIME')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    billingMode === 'ONE_TIME'
                      ? 'bg-blue-50/90 border-[#0052CC] ring-2 ring-[#0052CC]/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      billingMode === 'ONE_TIME'
                        ? 'bg-[#0052CC] text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900">
                        One-Time (Full Course Fee)
                      </span>
                      {isSingleMonthCourseActive ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
                          🔒 Auto-Locked (1-Month Course)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                          Full Duration
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {isSingleMonthCourseActive
                        ? 'Selected automatically: Course is 1 month only, full fee billed upfront.'
                        : 'Billed once for the entire course duration upfront (e.g. 6 Months).'}
                    </p>
                  </div>
                </button>
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Issue Date *
                </label>
                <input
                  type="date"
                  required
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Billing Period Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Billing Period End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                />
              </div>
            </div>

            {/* Calculated Period Duration Summary */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700">Calculated Period Duration:</span>
              <span className="font-bold text-[#0052CC] font-mono flex items-center gap-1.5 flex-wrap">
                <span>{formatDate(startDate, 'dd MMM yyyy')}</span>
                <span className="text-slate-400">&rarr;</span>
                <span>{formatDate(endDate, 'dd MMM yyyy')}</span>
                {(() => {
                  const maxDur = Math.max(1, ...items.map((it) => Number(it.durationValue) || 1));
                  const durUnit = maxDur === 1 ? 'Month' : 'Months';
                  return (
                    <span className="font-sans font-semibold text-slate-700 text-[11px] bg-blue-100/70 border border-blue-200/80 px-2.5 py-0.5 rounded-md">
                      {billingMode === 'ONE_TIME'
                        ? `${maxDur} ${durUnit} (Full Course Duration)`
                        : '1 Month Cycle (Monthly Installment)'}
                    </span>
                  );
                })()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE SECTION: Course Line Items */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0052CC] flex items-center justify-center font-bold shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-900">
                  2. Course Line Items
                </h2>
                {isAutoLoadedCourses && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Auto-synced from student enrollment
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Add multiple courses, configure installment durations, or override prices for this invoice
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddCourseRow}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Course Row
          </Button>
        </div>

        {/* Dynamic Course Billing Status Switcher when student has newly enrolled course(s) alongside previously billed course(s) */}
        {unbilledEnrollments.length > 0 && billedEnrollments.length > 0 && (
          <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0052CC] shrink-0" />
                <span className="font-bold text-slate-900">
                  New Course Detected: Student has {unbilledEnrollments.length} new unbilled course and {billedEnrollments.length} previously billed course.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleLoadUnbilledOnly}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    courseFilterMode === 'UNBILLED_ONLY'
                      ? 'bg-[#0052CC] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  ✓ Bill Only New Course ({unbilledEnrollments.length})
                </button>
                <button
                  type="button"
                  onClick={handleLoadAllActive}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    courseFilterMode === 'ALL_ACTIVE'
                      ? 'bg-[#0052CC] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  + Combine All Courses ({activeEnrollments.length})
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-600 flex-wrap">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded border border-emerald-200">
                ⚡ New (Unbilled): {unbilledEnrollments.map((e) => e.course?.name).join(', ')}
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-600 bg-white px-2.5 py-0.5 rounded border border-slate-200">
                ✓ Already Billed: {billedEnrollments.map((e) => e.course?.name).join(', ')}
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[200px]">Course</th>
                <th className="py-2.5 px-3 w-32">Default Price</th>
                <th className="py-2.5 px-3 w-36">Rate Override (PKR)</th>
                <th className="py-2.5 px-3 w-32">Billing Mode</th>
                <th className="py-2.5 px-3 w-28">Duration (Mo)</th>
                <th className="py-2.5 px-3 w-32 text-right">Line Amount</th>
                <th className="py-2.5 px-3 w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row, index) => {
                const calculatedItem = calc.items[index];
                return (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-center font-medium text-slate-400">
                      {index + 1}
                    </td>

                    <td className="py-2.5 px-3 min-w-[240px]">
                      <SearchableSelect
                        value={row.courseId}
                        onChange={(val) => handleCourseChange(index, val)}
                        options={courseOptions}
                        placeholder="-- Select course --"
                        searchPlaceholder="Search course name or code..."
                        pageSize={5}
                        required
                      />
                    </td>

                    <td className="py-2.5 px-3 text-slate-600 font-medium">
                      {formatCurrency(row.defaultPrice)}
                    </td>

                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={row.overridePrice}
                        onChange={(e) => handleOverridePriceChange(index, e.target.value)}
                        placeholder={`e.g. ${row.defaultPrice}`}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-900"
                      />
                    </td>

                    <td className="py-2.5 px-3">
                      {(() => {
                        const courseObj = courses.find((c) => c.id === row.courseId);
                        const isRowSingle = isCourseSingleMonth(courseObj);
                        if (isRowSingle) {
                          return (
                            <div className="space-y-1">
                              <select
                                value="ONE_TIME"
                                disabled
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-700 font-semibold cursor-not-allowed text-xs"
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
                            value={row.billingMode}
                            onChange={(e) =>
                              handleLineModeChange(index, e.target.value as 'ONE_TIME' | 'MONTHLY')
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                          >
                            <option value="MONTHLY">Monthly</option>
                            <option value="ONE_TIME">One-Time</option>
                          </select>
                        );
                      })()}
                    </td>

                    <td className="py-2.5 px-3">
                      {(() => {
                        const courseObj = courses.find((c) => c.id === row.courseId);
                        const isRowSingle = isCourseSingleMonth(courseObj);
                        return (
                          <input
                            type="number"
                            min="1"
                            max="36"
                            disabled={row.billingMode === 'ONE_TIME' || isRowSingle}
                            value={isRowSingle ? 1 : row.durationValue}
                            onChange={(e) =>
                              handleDurationChange(index, parseInt(e.target.value) || 1)
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-400 font-medium"
                          />
                        );
                      })()}
                    </td>

                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                      {formatCurrency(calculatedItem?.lineTotal || 0)}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        disabled={items.length <= 1}
                        onClick={() => handleRemoveCourseRow(index)}
                        className="text-slate-400 hover:text-rose-600 p-1 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOWER SECTION: Discounts, Taxes, and Grand Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-5">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2">
            Discounts & Taxes
          </h2>

          {/* Discount Section */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                <span>Apply Discount</span>
              </label>
              <input
                type="checkbox"
                checked={hasDiscount}
                onChange={(e) => setHasDiscount(e.target.checked)}
                className="w-4 h-4 text-[#0052CC] rounded border-slate-300 focus:ring-[#0052CC]"
              />
            </div>

            {hasDiscount && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                    Discount Type
                  </span>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'FIXED' | 'PERCENTAGE')}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="FIXED">Fixed Amount (Rs.)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                    Value
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="e.g. 500 or 10"
                    className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tax / GST Section */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                <span>Apply Tax / GST</span>
              </label>
              <input
                type="checkbox"
                checked={hasTax}
                onChange={(e) => setHasTax(e.target.checked)}
                className="w-4 h-4 text-[#0052CC] rounded border-slate-300 focus:ring-[#0052CC]"
              />
            </div>

            {hasTax && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                    Tax Name
                  </span>
                  <input
                    type="text"
                    value={taxName}
                    onChange={(e) => setTaxName(e.target.value)}
                    placeholder="GST"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                    Tax Type
                  </span>
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value as 'FIXED' | 'PERCENTAGE')}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (Rs.)</option>
                  </select>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                    Rate / Value
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxValue}
                    onChange={(e) => setTaxValue(e.target.value)}
                    placeholder="e.g. 18"
                    className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Invoice Remarks / Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Approved discount for batch 12 / sponsored"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
            />
          </div>
        </div>

        {/* Right Column: Live Ledger Totals Summary */}
        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm border border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs uppercase font-semibold tracking-wider text-slate-300">
                Live Balance Breakdown
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal (Courses Total):</span>
                <span className="font-semibold text-white">{formatCurrency(calc.subtotal)}</span>
              </div>

              {hasDiscount && calc.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400 font-medium">
                  <span>Discount ({discountType}):</span>
                  <span>- {formatCurrency(calc.discountAmount)}</span>
                </div>
              )}

              {hasTax && calc.taxAmount > 0 && (
                <div className="flex justify-between text-blue-300 font-medium">
                  <span>{taxName || 'Tax'} ({taxType}):</span>
                  <span>+ {formatCurrency(calc.taxAmount)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-bold text-white">
                <span>Current Invoice Total:</span>
                <span className="text-base text-emerald-400">{formatCurrency(calc.grandTotal)}</span>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex justify-between text-xs text-amber-300 font-medium">
                <span>Previous Outstanding Carried:</span>
                <span>{formatCurrency(calc.previousOutstanding)}</span>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between text-base font-bold text-white">
                <span>Net Total Payable:</span>
                <span className="text-xl text-blue-400">
                  {formatCurrency(calc.netPayable)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <Link href="/fee-bills">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800"
              >
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="bg-[#0052CC] text-white hover:bg-[#0041A8] font-semibold border-0"
            >
              Finalize & Save Bill
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default function NewFeeBillPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-slate-400">Loading invoice studio...</div>}>
      <FeeBillFormInner />
    </Suspense>
  );
}
