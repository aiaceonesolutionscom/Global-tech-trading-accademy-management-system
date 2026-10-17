'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Layers,
  Loader2,
  UserCheck,
  Users,
  Pencil,
  Trash2,
  Calculator,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { DeleteCourseModal } from '@/components/courses/DeleteCourseModal';
import { formatCurrency } from '@/lib/utils';

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [billingFilter, setBillingFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    trainerIds: string[];
    defaultPrice: string;
    durationValue: string;
    durationUnit: string;
    billingMode: string;
    notes: string;
  }>({
    name: '',
    description: '',
    trainerIds: [],
    defaultPrice: '35000',
    durationValue: '6',
    durationUnit: 'MONTHS',
    billingMode: 'MONTHLY',
    notes: '',
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete Modal State
  const [deleteModalCourse, setDeleteModalCourse] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchCourses = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        billingMode: billingFilter,
      });
      const res = await fetch(`/api/courses?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setCourses(json.data || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrainers = async () => {
    try {
      const res = await fetch('/api/trainers?limit=100');
      if (res.ok) {
        const json = await res.json();
        setTrainers(json.data || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchTrainers();
  }, [search, billingFilter]);

  const handleOpenModal = (course?: any) => {
    if (course) {
      setEditingCourse(course);
      const initialTrainerIds: string[] =
        course.trainerIds && course.trainerIds.length > 0
          ? course.trainerIds
          : course.assignedTrainers?.map((t: any) => t.id) ||
            (course.trainerId ? [course.trainerId] : []);

      setFormData({
        name: course.name,
        description: course.description || '',
        trainerIds: initialTrainerIds,
        defaultPrice: String(course.defaultPrice),
        durationValue: String(course.durationValue),
        durationUnit: course.durationUnit,
        billingMode: course.billingMode,
        notes: course.notes || '',
      });
    } else {
      setEditingCourse(null);
      setFormData({
        name: '',
        description: '',
        trainerIds: trainers[0]?.id ? [trainers[0].id] : [],
        defaultPrice: '35000',
        durationValue: '6',
        durationUnit: 'MONTHS',
        billingMode: 'MONTHLY',
        notes: '',
      });
    }
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);

    try {
      const url = editingCourse ? `/api/courses/${editingCourse.id}` : '/api/courses';
      const method = editingCourse ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save course');
      }

      setIsModalOpen(false);
      fetchCourses();
    } catch (err: any) {
      setModalError(err.message || 'Error occurred');
    } finally {
      setModalLoading(false);
    }
  };

  const previewPrice = parseFloat(formData.defaultPrice) || 0;
  const previewDuration = parseInt(formData.durationValue) || 1;
  const previewMonthly =
    formData.billingMode === 'MONTHLY' && previewDuration > 0
      ? Math.round((previewPrice / previewDuration + Number.EPSILON) * 100) / 100
      : previewPrice;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Trading Courses & Curricula
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure trading programs, durations, flexible pricing and automated monthly installment modes
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => handleOpenModal()}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shrink-0 font-semibold"
        >
          Create New Course
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses by name or code..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC] font-medium text-slate-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-500 font-medium">Mode:</span>
          <select
            value={billingFilter}
            onChange={(e) => setBillingFilter(e.target.value)}
            className="text-xs px-3.5 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
          >
            <option value="ALL">All Modes</option>
            <option value="MONTHLY">Monthly Installment</option>
            <option value="ONE_TIME">One-Time Fee</option>
          </select>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#0052CC] mb-2" />
            Loading courses...
          </div>
        ) : courses.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
            No courses found.
          </div>
        ) : (
          courses.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Responsive Header: Course Code & Billing Mode Badge with guaranteed structure */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                  <span
                    className="text-[11px] font-mono font-semibold text-[#0052CC] bg-blue-50/90 px-2.5 py-1 rounded-md border border-blue-200/90 inline-block break-all shadow-2xs"
                    title={c.courseCode}
                  >
                    {c.courseCode}
                  </span>
                  <Badge
                    variant={c.billingMode === 'MONTHLY' ? 'info' : 'success'}
                    className="shrink-0 text-[10px] font-bold tracking-wide"
                  >
                    {c.billingMode === 'MONTHLY' ? 'Monthly Billing' : 'One-Time'}
                  </Badge>
                </div>

                <h3 className="font-bold text-slate-900 text-base mt-3 tracking-tight">
                  {c.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {c.description || 'Professional financial market & trading curriculum.'}
                </p>

                {/* Price and Duration Highlight Card */}
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Full Course Fee:</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(c.defaultPrice)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Duration:</span>
                    <span className="font-medium text-slate-700">
                      {c.durationValue} {c.durationUnit.toLowerCase()}
                    </span>
                  </div>

                  {c.billingMode === 'MONTHLY' && (
                    <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-[#0052CC]">
                      <span>Monthly Installment:</span>
                      <span className="font-bold">
                        {formatCurrency(c.monthlyAmount)} / mo
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3.5 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-semibold mb-1">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {c.assignedTrainers && c.assignedTrainers.length > 1
                        ? `Faculty / Instructors (${c.assignedTrainers.length})`
                        : 'Instructor'}
                    </span>
                  </div>
                  {c.assignedTrainers && c.assignedTrainers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {c.assignedTrainers.map((t: any) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1 bg-blue-50 text-[#0052CC] font-semibold px-2 py-0.5 rounded text-[11px] border border-blue-200"
                        >
                          <span>{t.name}</span>
                          {t.specialization && (
                            <span className="text-[10px] text-slate-500 font-normal">
                              ({t.specialization})
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : c.trainer?.name ? (
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-[#0052CC] font-semibold px-2 py-0.5 rounded text-[11px] border border-blue-200">
                      {c.trainer.name}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Unassigned</span>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c._count?.enrollments || 0} active students</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenModal(c)}
                    className="font-medium text-slate-700 hover:text-[#0052CC] hover:bg-slate-50 px-2.5 py-1 rounded border border-slate-200 flex items-center gap-1 transition-colors"
                  >
                    <Pencil className="w-3 h-3 text-slate-500" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setDeleteModalCourse({
                        id: c.id,
                        courseCode: c.courseCode,
                        name: c.name,
                        defaultPrice: Number(c.defaultPrice),
                        billingMode: c.billingMode,
                        enrollmentsCount: c._count?.enrollments || 0,
                      });
                      setIsDeleteModalOpen(true);
                    }}
                    className="font-medium text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded border border-rose-200 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Course Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCourse ? 'Edit Course' : 'Create New Course'}
        subtitle="Specify curriculum duration, instructors and billing calculation"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Course Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Trading Mastery"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
            />
          </div>

          {/* Multi-Instructor Assignment */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  Assigned Faculty / Instructors
                </label>
                <p className="text-[11px] text-slate-500">
                  Select one or more instructors to teach this course without duplicating the course.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {formData.trainerIds.length} Assigned
              </span>
            </div>

            {/* Selected Badges */}
            {formData.trainerIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {formData.trainerIds.map((tid) => {
                  const trainer = trainers.find((t) => t.id === tid);
                  if (!trainer) return null;
                  return (
                    <span
                      key={tid}
                      className="inline-flex items-center gap-1.5 bg-white border border-[#0052CC]/40 text-[#0052CC] text-xs font-semibold px-2.5 py-1 rounded-lg shadow-2xs"
                    >
                      <UserCheck className="w-3 h-3 text-[#0052CC]" />
                      <span>{trainer.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            trainerIds: formData.trainerIds.filter((id) => id !== tid),
                          })
                        }
                        className="text-slate-400 hover:text-rose-600 rounded-full w-4 h-4 inline-flex items-center justify-center hover:bg-rose-50 transition-colors ml-0.5"
                        title="Remove instructor"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Quick Add Checklist / Dropdown */}
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Available Faculty Members:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {trainers.map((t) => {
                  const isAssigned = formData.trainerIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (isAssigned) {
                          setFormData({
                            ...formData,
                            trainerIds: formData.trainerIds.filter((id) => id !== t.id),
                          });
                        } else {
                          setFormData({
                            ...formData,
                            trainerIds: [...formData.trainerIds, t.id],
                          });
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                        isAssigned
                          ? 'bg-blue-50/80 border-[#0052CC] text-[#0052CC] font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 font-medium'
                      }`}
                    >
                      <div>
                        <div>{t.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal font-mono">
                          {t.trainerCode} {t.specialization ? `• ${t.specialization}` : ''}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          isAssigned
                            ? 'bg-[#0052CC] text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isAssigned ? '✓' : '+'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Course Price (PKR) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="100"
                value={formData.defaultPrice}
                onChange={(e) => setFormData({ ...formData, defaultPrice: e.target.value })}
                className="w-full px-3.5 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Billing Mode *
              </label>
              <select
                value={formData.billingMode}
                onChange={(e) => setFormData({ ...formData, billingMode: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              >
                <option value="MONTHLY">Monthly Installment</option>
                <option value="ONE_TIME">One-Time Full Payment</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duration (Number) *
              </label>
              <input
                type="number"
                required
                min="1"
                max="60"
                value={formData.durationValue}
                onChange={(e) => setFormData({ ...formData, durationValue: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duration Unit *
              </label>
              <select
                value={formData.durationUnit}
                onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              >
                <option value="MONTHS">Months</option>
                <option value="WEEKS">Weeks</option>
                <option value="DAYS">Days</option>
              </select>
            </div>
          </div>

          {/* Live Automatic Calculation Formula Preview */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <span className="font-semibold text-slate-800 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-[#0052CC]" />
              Live Billing Calculation Preview
            </span>
            {formData.billingMode === 'MONTHLY' ? (
              <p className="text-slate-600">
                Formula: {formatCurrency(previewPrice)} ÷ {previewDuration}{' '}
                {formData.durationUnit.toLowerCase()} ={' '}
                <span className="font-bold text-[#0052CC]">
                  {formatCurrency(previewMonthly)} per installment
                </span>
              </p>
            ) : (
              <p className="text-slate-600">
                One-time upfront fee of{' '}
                <span className="font-bold text-[#0052CC]">
                  {formatCurrency(previewPrice)}
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Syllabus outline, strategies taught..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={modalLoading}>
              {editingCourse ? 'Update Course' : 'Create Course'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete / Archive Course Modal */}
      <DeleteCourseModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        course={deleteModalCourse}
        onSuccess={() => {
          fetchCourses();
        }}
      />
    </div>
  );
}
