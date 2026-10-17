'use client';

import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Archive, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';

interface DeleteCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  course: {
    id: string;
    courseCode: string;
    name: string;
    defaultPrice: number;
    billingMode: string;
    enrollmentsCount?: number;
  } | null;
}

export function DeleteCourseModal({
  isOpen,
  onClose,
  onSuccess,
  course,
}: DeleteCourseModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !course) return null;

  const hasHistory = (course.enrollmentsCount || 0) > 0;

  const handleDelete = async (mode: 'delete' | 'archive' | 'force') => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/courses/${course.id}`;
      if (mode === 'archive') {
        url += '?action=archive';
      } else if (mode === 'force') {
        url += '?force=true';
      }

      const res = await fetch(url, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete course');
      }

      onSuccess(data.message);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-900">
                Delete Course
              </h3>
              <p className="text-[11px] text-rose-700 font-mono break-all max-w-[260px]">
                {course.courseCode}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 shrink-0">Course Code:</span>
              <span className="font-mono font-semibold text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 break-all text-right">
                {course.courseCode}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 shrink-0">Course Name:</span>
              <span className="font-semibold text-slate-800 text-right">{course.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Standard Fee:</span>
              <span className="font-bold text-slate-900">
                {formatCurrency(course.defaultPrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Billing Mode:</span>
              <span className="font-semibold text-slate-700">
                {course.billingMode === 'MONTHLY' ? 'Monthly Installment' : 'One-Time'}
              </span>
            </div>
            {hasHistory && (
              <div className="flex justify-between">
                <span className="text-slate-500">Active Students:</span>
                <span className="font-bold text-blue-700">
                  {course.enrollmentsCount} student(s)
                </span>
              </div>
            )}
          </div>

          {hasHistory ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Notice: Student Enrollments Exist</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This course has active student enrollments. You can <strong>Archive</strong>{' '}
                the course (removes it from active course offerings while keeping student history),{' '}
                or <strong>Permanently Force Delete</strong> it along with historical enrollments.
              </p>
            </div>
          ) : (
            <p className="text-slate-600 leading-relaxed">
              Are you sure you want to delete course{' '}
              <strong className="text-slate-800 font-semibold">{course.name}</strong>{' '}
              (<span className="font-mono text-slate-600">{course.courseCode}</span>)? This action cannot be undone.
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>

          {hasHistory ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete('archive')}
                disabled={isLoading}
                leftIcon={<Archive className="w-3.5 h-3.5 text-amber-600" />}
                className="text-amber-800 border-amber-300 hover:bg-amber-50"
              >
                Archive Course
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete('force')}
                disabled={isLoading}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                {isLoading ? 'Deleting...' : 'Force Delete'}
              </Button>
            </>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDelete('delete')}
              disabled={isLoading}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              {isLoading ? 'Deleting...' : 'Delete Course'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
