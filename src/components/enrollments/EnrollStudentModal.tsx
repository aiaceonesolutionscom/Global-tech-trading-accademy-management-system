'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { formatCurrency } from '@/lib/utils';
import {
  GraduationCap,
  BookOpen,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react';

interface EnrollStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedStudentId?: string;
  preselectedCourseId?: string;
}

export function EnrollStudentModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedStudentId = '',
  preselectedCourseId = '',
}: EnrollStudentModalProps) {
  const router = useRouter();

  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);

  const [studentId, setStudentId] = useState(preselectedStudentId);
  const [courseId, setCourseId] = useState(preselectedCourseId);
  const [trainerId, setTrainerId] = useState('');
  const [billingMode, setBillingMode] = useState<'ONE_TIME' | 'MONTHLY'>('MONTHLY');
  const [notes, setNotes] = useState('');
  const [markActiveImmediately, setMarkActiveImmediately] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state step
  const [enrolledResult, setEnrolledResult] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setEnrolledResult(null);
      setMarkActiveImmediately(false);
      setStudentId(preselectedStudentId);
      setCourseId(preselectedCourseId);

      // Fetch reference lists
      fetch('/api/students?limit=250')
        .then((res) => res.json())
        .then((d) => setStudents(d.data || []))
        .catch(() => {});

      fetch('/api/courses?limit=100')
        .then((res) => res.json())
        .then((d) => setCourses(d.data || []))
        .catch(() => {});

      fetch('/api/trainers')
        .then((res) => res.json())
        .then((d) => setTrainers(d.data || d.trainers || []))
        .catch(() => {});
    }
  }, [isOpen, preselectedStudentId, preselectedCourseId]);

  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === courseId);
  }, [courses, courseId]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === studentId);
  }, [students, studentId]);

  // When course changes, update billingMode and trainerId defaults
  const handleCourseSelect = (cId: string) => {
    setCourseId(cId);
    const foundCourse = courses.find((c) => c.id === cId);
    if (foundCourse) {
      if (foundCourse.billingMode) setBillingMode(foundCourse.billingMode);
      const trainersList = foundCourse.assignedTrainers || [];
      if (trainersList.length > 0) {
        setTrainerId(trainersList[0].id);
      } else if (foundCourse.trainerId) {
        setTrainerId(foundCourse.trainerId);
      }
    }
  };

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
    return courses.map((c) => ({
      value: c.id,
      label: c.name,
      sublabel: `${c.courseCode} • ${c.durationValue} ${c.durationUnit?.toLowerCase()} • ${c.billingMode}`,
      badge: formatCurrency(c.defaultPrice),
      searchTerms: c.description || '',
    }));
  }, [courses]);

  const trainerOptions = useMemo(() => {
    const assigned = selectedCourse?.assignedTrainers || [];
    const assignedIds = new Set(assigned.map((t: any) => t.id));

    if (assigned.length > 0) {
      const courseTrainersList = assigned.map((t: any) => ({
        value: t.id,
        label: `${t.name} (Assigned Course Instructor)`,
        sublabel: t.specialization || 'Assigned Instructor',
        badge: t.trainerCode || 'Assigned',
        searchTerms: `${t.phone || ''} ${t.email || ''}`,
      }));

      const otherTrainersList = trainers
        .filter((t) => !assignedIds.has(t.id))
        .map((t) => ({
          value: t.id,
          label: t.name,
          sublabel: t.specialization || 'Other Faculty',
          badge: t.trainerCode,
          searchTerms: `${t.phone || ''} ${t.email || ''}`,
        }));

      return [
        { value: '', label: '-- Select Instructor --' },
        ...courseTrainersList,
        ...otherTrainersList,
      ];
    }

    return [
      { value: '', label: '-- Unassigned / Default --' },
      ...trainers.map((t) => ({
        value: t.id,
        label: t.name,
        sublabel: t.specialization || 'Instructor',
        badge: t.trainerCode,
        searchTerms: `${t.phone || ''} ${t.email || ''}`,
      })),
    ];
  }, [trainers, selectedCourse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setError('Please select a student');
      return;
    }
    if (!courseId) {
      setError('Please select a course to enroll');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          courseId,
          trainerId: trainerId || null,
          billingMode,
          notes,
          markActiveImmediately,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create enrollment');
      }

      // Transition to success prompt
      setEnrolledResult(data);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred during enrollment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewFeeBill = () => {
    if (!enrolledResult) return;
    onClose();
    if (enrolledResult.feeBillId) {
      router.push(`/fee-bills/${enrolledResult.feeBillId}`);
    } else {
      router.push(
        `/fee-bills/new?studentId=${enrolledResult.studentId}&courseId=${enrolledResult.courseId}`
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={enrolledResult ? 'Enrollment Successful!' : 'Enroll Student in Course'}
      subtitle={
        enrolledResult
          ? 'Course seat registered and official Fee Bill created.'
          : 'Link student to an academy course batch and optionally proceed to direct billing'
      }
      maxWidth="lg"
    >
      {enrolledResult ? (
        /* STEP 2: SUCCESS & DIRECT FEE BILL PROMPT */
        <div className="p-6 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Enrollment & Fee Bill Created!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Student enrolled and invoice generated. Click below to view the official voucher.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Enrollment Code:</span>
              <span className="font-mono font-bold text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {enrolledResult.enrollmentCode}
              </span>
            </div>
            {enrolledResult.feeBillNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Invoice Number:</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {enrolledResult.feeBillNumber}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Student Name:</span>
              <strong className="text-slate-800">
                {enrolledResult.student?.fullName || selectedStudent?.fullName}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Course:</span>
              <strong className="text-slate-800">
                {enrolledResult.course?.name || selectedCourse?.name}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Billing Mode:</span>
              <span className="font-semibold text-slate-700">
                {enrolledResult.billingMode?.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Action Choice Box */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50/70 border border-blue-200 rounded-xl space-y-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#0052CC] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  View Student's Official Fee Bill
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Click below to open the complete Fee Bill view page for printing, recording payments, or downloading the A5 PDF.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleViewFeeBill}
                leftIcon={<FileText className="w-4 h-4" />}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full sm:w-auto font-bold shadow-md bg-[#0052CC] hover:bg-blue-700"
              >
                View Fee Bill Now
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={onClose}
                className="w-full sm:w-auto text-slate-600 hover:bg-slate-100"
              >
                Close & View Enrollments
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 1: ENROLLMENT FORM */
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Student Selection */}
          <SearchableSelect
            label="Select Student"
            icon={<GraduationCap className="w-3.5 h-3.5 text-[#0052CC]" />}
            value={studentId}
            onChange={(val) => setStudentId(val)}
            options={studentOptions}
            placeholder="-- Choose registered student --"
            searchPlaceholder="Search student name, code, phone..."
            pageSize={6}
            required
          />

          {/* Course Selection */}
          <SearchableSelect
            label="Select Course"
            icon={<BookOpen className="w-3.5 h-3.5 text-[#0052CC]" />}
            value={courseId}
            onChange={(val) => handleCourseSelect(val)}
            options={courseOptions}
            placeholder="-- Choose course to enroll --"
            searchPlaceholder="Search course name or code..."
            pageSize={5}
            required
          />

          {selectedCourse && (
            <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200 text-[11px] text-slate-700 flex items-center justify-between">
              <div>
                <span className="font-bold text-[#0052CC]">{selectedCourse.name}</span>
                <span className="text-slate-500 ml-2">
                  Duration: {selectedCourse.durationValue} {selectedCourse.durationUnit?.toLowerCase()}
                </span>
              </div>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(selectedCourse.defaultPrice)}
              </span>
            </div>
          )}

          {/* Trainer & Billing Mode Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <SearchableSelect
                label="Instructor / Trainer"
                icon={<UserCheck className="w-3.5 h-3.5 text-slate-500" />}
                value={trainerId}
                onChange={(val) => setTrainerId(val)}
                options={trainerOptions}
                placeholder="-- Unassigned / Default --"
                searchPlaceholder="Search instructor name or specialty..."
                pageSize={5}
              />
              {selectedCourse?.assignedTrainers && selectedCourse.assignedTrainers.length > 1 && (
                <div className="mt-2 p-2 bg-blue-50/70 border border-blue-200 rounded-lg text-xs space-y-1.5">
                  <span className="font-semibold text-slate-700 block text-[11px]">
                    Select assigned instructor for this student:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCourse.assignedTrainers.map((t: any) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTrainerId(t.id)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                          trainerId === t.id
                            ? 'bg-[#0052CC] text-white border-[#0052CC] shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {t.name} {trainerId === t.id ? '✓' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Billing Mode</span>
              </label>
              <select
                value={billingMode}
                onChange={(e) => setBillingMode(e.target.value as any)}
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              >
                <option value="MONTHLY">Monthly Installment</option>
                <option value="ONE_TIME">One-Time Fee</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Enrollment Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Batch morning 10 AM, referral discount applied..."
              className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
            />
          </div>

          {/* Admin Override Checkbox: Active without payment */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={markActiveImmediately}
                onChange={(e) => setMarkActiveImmediately(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-[#0052CC] focus:ring-[#0052CC]"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800">
                  Allow immediate Active enrollment without fee payment
                </span>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Default is &apos;Pending (Unpaid)&apos;. Student will automatically become Active when their fee payment is recorded.
                </p>
              </div>
            </label>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isLoading}
              leftIcon={<GraduationCap className="w-4 h-4" />}
              className="font-bold px-5"
            >
              Enroll Student & Proceed
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

