'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Receipt,
  AlertTriangle,
  DollarSign,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Printer,
  BookOpen,
  Users,
  Phone,
  Mail,
  GraduationCap,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('TRAINERS');
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Reference lists for dropdown filters
  const [trainers, setTrainers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [trainerId, setTrainerId] = useState('ALL');
  const [courseId, setCourseId] = useState('ALL');
  const [enrollmentStatus, setEnrollmentStatus] = useState('ALL');
  const [billStatus, setBillStatus] = useState('ALL');
  const [billingMode, setBillingMode] = useState('ALL');
  const [paymentMethod, setPaymentMethod] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch reference lists
  useEffect(() => {
    fetch('/api/trainers?limit=100')
      .then((res) => res.json())
      .then((d) => setTrainers(d.data || []))
      .catch(() => {});

    fetch('/api/courses?limit=100')
      .then((res) => res.json())
      .then((d) => setCourses(d.data || []))
      .catch(() => {});
  }, []);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        type: reportType,
        page: String(pagination.page),
        limit: String(pagination.limit),
        search,
        trainerId,
        courseId,
        enrollmentStatus,
        billStatus,
        billingMode,
        paymentMethod,
        dateFrom,
        dateTo,
      });

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setSummary(json.summary || {});
        setPagination(json.pagination || pagination);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [
    reportType,
    pagination.page,
    trainerId,
    courseId,
    enrollmentStatus,
    billStatus,
    billingMode,
    paymentMethod,
  ]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchReport();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).filter(
      (k) => k !== 'id' && typeof data[0][k] !== 'object'
    );
    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((fieldName) => {
            const val = row[fieldName];
            return JSON.stringify(val ?? '');
          })
          .join(',')
      ),
    ];

    const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${reportType}_Report_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reportTabs = [
    { id: 'TRAINERS', label: 'Faculty & Course Assignments', Icon: UserCheck },
    { id: 'ENROLLMENTS', label: 'Student Course Enrollments', Icon: GraduationCap },
    { id: 'COURSE_REVENUE', label: 'Course Revenue & Faculty', Icon: DollarSign },
    { id: 'FEE_BILLS', label: 'Fee Bills Ledger', Icon: FileText },
    { id: 'PAYMENTS', label: 'Payment Collections', Icon: Receipt },
    { id: 'OUTSTANDING', label: 'Outstanding Dues', Icon: AlertTriangle },
  ];

  const currentTab = reportTabs.find((t) => t.id === reportType);

  return (
    <div className="space-y-6 pb-8 print:p-0 print:space-y-4">
      {/* Print-Only Official Letterhead Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              GLOBAL TRADING ACADEMY
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              Official Institutional Report • Faculty, Courses & Student Registry
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>Printed Date: {new Date().toLocaleDateString()}</div>
            <div>Time: {new Date().toLocaleTimeString()}</div>
          </div>
        </div>
        <div className="mt-3 p-2 bg-slate-100 rounded text-xs flex justify-between font-semibold text-slate-800">
          <span>REPORT: {currentTab?.label?.toUpperCase()}</span>
          <span>TOTAL RECORDS: {pagination.total}</span>
        </div>
      </div>

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Academic & Financial Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete institutional audit: Faculty teaching assignments, student enrollment rosters, and financial ledgers
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="md"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4 text-[#0052CC]" />}
            className="font-bold border-[#0052CC]/30 text-[#0052CC] hover:bg-blue-50"
          >
            Print Report
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={handleExportCSV}
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
            className="font-semibold"
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-sm flex flex-wrap gap-2 print:hidden">
        {reportTabs.map((tab) => {
          const Icon = tab.Icon;
          const isActive = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setReportType(tab.id);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                isActive
                  ? 'bg-[#0052CC] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Filter Controls */}
      <form
        onSubmit={handleFilterSubmit}
        className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4 print:hidden"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Keyword Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Search Keywords
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, code, phone..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>
          </div>

          {/* Instructor Filter */}
          {(reportType === 'TRAINERS' ||
            reportType === 'ENROLLMENTS' ||
            reportType === 'COURSE_REVENUE') && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Filter by Instructor / Faculty
              </label>
              <select
                value={trainerId}
                onChange={(e) => setTrainerId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              >
                <option value="ALL">All Instructors</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.trainerCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Course Filter */}
          {(reportType === 'ENROLLMENTS' ||
            reportType === 'COURSE_REVENUE' ||
            reportType === 'FEE_BILLS') && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Filter by Course
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              >
                <option value="ALL">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.courseCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Enrollment Status Filter */}
          {reportType === 'ENROLLMENTS' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Enrollment Status
              </label>
              <select
                value={enrollmentStatus}
                onChange={(e) => setEnrollmentStatus(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active (In Training)</option>
                <option value="PENDING">Pending (Unpaid)</option>
                <option value="COMPLETED">Completed (Graduated)</option>
                <option value="DROPPED">Dropped</option>
              </select>
            </div>
          )}

          {/* Fee Bill Status Filter */}
          {reportType === 'FEE_BILLS' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Bill Status
              </label>
              <select
                value={billStatus}
                onChange={(e) => setBillStatus(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              >
                <option value="ALL">All Statuses</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>
          )}

          {/* Payment Method Filter */}
          {reportType === 'PAYMENTS' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              >
                <option value="ALL">All Methods</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="ONLINE">Online Wallet</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          )}

          {/* Date Range */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
            />
          </div>
        </div>

        {/* Summary Metric Ribbon & Filter Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-slate-200 gap-3">
          <div className="text-xs text-slate-600 font-medium flex flex-wrap gap-4">
            {summary.totalFaculty !== undefined && (
              <span>
                Faculty Members: <strong className="text-slate-900 font-bold">{summary.totalFaculty}</strong>
              </span>
            )}
            {summary.totalCoursesTaught !== undefined && (
              <span>
                Total Course Assignments: <strong className="text-[#0052CC] font-bold">{summary.totalCoursesTaught}</strong>
              </span>
            )}
            {summary.totalActiveStudents !== undefined && (
              <span>
                Active Students: <strong className="text-emerald-600 font-bold">{summary.totalActiveStudents}</strong>
              </span>
            )}
            {summary.totalEnrollments !== undefined && (
              <span>
                Total Enrollments: <strong className="text-slate-900 font-bold">{summary.totalEnrollments}</strong>
              </span>
            )}
            {summary.activeEnrollments !== undefined && (
              <span>
                Active: <strong className="text-emerald-600 font-bold">{summary.activeEnrollments}</strong>
              </span>
            )}
            {summary.completedEnrollments !== undefined && (
              <span>
                Completed: <strong className="text-blue-600 font-bold">{summary.completedEnrollments}</strong>
              </span>
            )}
            {summary.totalGrand !== undefined && (
              <span>
                Total Billed: <strong className="text-slate-900 font-bold">{formatCurrency(summary.totalGrand)}</strong>
              </span>
            )}
            {summary.totalPaid !== undefined && (
              <span>
                Total Paid: <strong className="text-emerald-600 font-bold">{formatCurrency(summary.totalPaid)}</strong>
              </span>
            )}
            {summary.totalRemaining !== undefined && (
              <span>
                Outstanding: <strong className="text-rose-600 font-bold">{formatCurrency(summary.totalRemaining)}</strong>
              </span>
            )}
            {summary.totalCollected !== undefined && (
              <span>
                Total Collected: <strong className="text-emerald-600 font-bold">{formatCurrency(summary.totalCollected)}</strong>
              </span>
            )}
            {summary.totalRevenue !== undefined && (
              <span>
                Gross Course Revenue: <strong className="text-emerald-600 font-bold">{formatCurrency(summary.totalRevenue)}</strong>
              </span>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Apply Filters
          </Button>
        </div>
      </form>

      {/* REPORT CONTENT AREA */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        {/* ========================================================= */}
        {/* TAB 1: TRAINERS (FACULTY & COURSE ASSIGNMENTS & ROSTER) */}
        {/* ========================================================= */}
        {reportType === 'TRAINERS' && (
          <div className="p-4 space-y-6">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Loading faculty & course assignments...
              </div>
            ) : data.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No faculty members match your filter criteria.
              </div>
            ) : (
              data.map((trainer) => (
                <div
                  key={trainer.id}
                  className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs print:border-slate-400 print:shadow-none break-inside-avoid"
                >
                  {/* Instructor Header Banner */}
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#0052CC] text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {trainer.name
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-base">{trainer.name}</h3>
                          <span className="font-mono text-[10px] font-bold text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {trainer.trainerCode}
                          </span>
                          <Badge status={trainer.status} />
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 mt-1">
                          <span>Specialization: <strong className="text-slate-700">{trainer.specialization}</strong></span>
                          {trainer.phone && trainer.phone !== '-' && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" /> {trainer.phone}
                            </span>
                          )}
                          {trainer.email && trainer.email !== '-' && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" /> {trainer.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Instructor Statistics */}
                    <div className="flex items-center gap-3 shrink-0 text-xs">
                      <div className="text-center px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Courses Taught</div>
                        <div className="font-bold text-[#0052CC] text-sm">{trainer.totalAssignedCourses}</div>
                      </div>
                      <div className="text-center px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Students</div>
                        <div className="font-bold text-emerald-600 text-sm">{trainer.activeStudents}</div>
                      </div>
                      <div className="text-center px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Taught</div>
                        <div className="font-bold text-slate-700 text-sm">{trainer.totalStudents}</div>
                      </div>
                    </div>
                  </div>

                  {/* Courses Taught by this Instructor */}
                  <div className="p-3.5 bg-blue-50/40 border-b border-slate-200 text-xs">
                    <span className="font-bold text-slate-700 mr-2 inline-flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-[#0052CC]" />
                      Assigned Teaching Curricula ({trainer.totalAssignedCourses}):
                    </span>
                    {trainer.coursesList && trainer.coursesList.length > 0 ? (
                      <div className="inline-flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                        {trainer.coursesList.map((c: any) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1.5 bg-white text-[#0052CC] font-semibold px-2.5 py-1 rounded-md border border-blue-200 text-[11px]"
                          >
                            <span>{c.name}</span>
                            <span className="font-mono text-[10px] text-slate-400">({c.code})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">No courses currently assigned to this instructor.</span>
                    )}
                  </div>

                  {/* Student Enrollment Roster Table under this Instructor */}
                  <div className="p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        Students Enrolled Under {trainer.name} ({trainer.studentsList?.length || 0})
                      </h4>
                    </div>

                    {trainer.studentsList?.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                        No students currently enrolled with this instructor.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
                          <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px]">
                            <tr>
                              <th className="py-2.5 px-3">Enrollment #</th>
                              <th className="py-2.5 px-3">Student Name</th>
                              <th className="py-2.5 px-3">Phone</th>
                              <th className="py-2.5 px-3">Enrolled Course</th>
                              <th className="py-2.5 px-3">Enrollment Date</th>
                              <th className="py-2.5 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {trainer.studentsList.map((st: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50/70">
                                <td className="py-2 px-3 font-mono font-semibold text-[#0052CC]">
                                  {st.enrollmentCode}
                                </td>
                                <td className="py-2 px-3">
                                  <div className="font-semibold text-slate-900">{st.studentName}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{st.studentCode}</div>
                                </td>
                                <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                                  {st.studentPhone}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="font-medium text-slate-900">{st.courseName}</span>
                                  <span className="text-[10px] font-mono text-slate-400 ml-1">({st.courseCode})</span>
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  {formatDate(st.enrollmentDate)}
                                </td>
                                <td className="py-2 px-3">
                                  <Badge status={st.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: STUDENT COURSE ENROLLMENTS */}
        {/* ========================================================= */}
        {reportType === 'ENROLLMENTS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Enrollment #</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Assigned Instructor</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Fee Status</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      Querying enrollment records...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500">
                      No enrollments found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold text-[#0052CC] whitespace-nowrap">
                        <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {r.enrollmentCode}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{r.studentName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{r.studentCode}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {r.studentPhone}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 leading-tight">{r.courseName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{r.courseCode}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-[#0052CC] font-semibold px-2 py-0.5 rounded border border-blue-200 text-xs">
                          <UserCheck className="w-3 h-3 text-[#0052CC]" />
                          <span>{r.trainerName}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(r.enrollmentDate)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <div>{r.duration}</div>
                        <div className="text-[10px] text-slate-400">{r.billingMode}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {r.feeStatus === 'PAID' ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Paid
                          </span>
                        ) : r.feeStatus === 'PARTIALLY_PAID' ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Partial ({formatCurrency(r.feeRemaining)} Due)
                          </span>
                        ) : r.feeStatus === 'UNPAID' ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            Unpaid ({formatCurrency(r.feeRemaining)} Due)
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">No Bill</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: COURSE REVENUE & FACULTY */}
        {/* ========================================================= */}
        {reportType === 'COURSE_REVENUE' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Course Code</th>
                  <th className="py-3 px-4">Course Name</th>
                  <th className="py-3 px-4">Assigned Faculty / Instructors</th>
                  <th className="py-3 px-4">Base Fee</th>
                  <th className="py-3 px-4">Billing Mode</th>
                  <th className="py-3 px-4 text-center">Enrolled Seats</th>
                  <th className="py-3 px-4 text-right">Gross Billed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Calculating course revenue...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      No course data found.
                    </td>
                  </tr>
                ) : (
                  data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold text-[#0052CC] whitespace-nowrap">
                        {r.courseCode}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{r.name}</td>
                      <td className="py-3 px-4">
                        {r.instructorNamesList && r.instructorNamesList.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.instructorNamesList.map((name: string, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 bg-blue-50 text-[#0052CC] font-semibold px-2 py-0.5 rounded text-[11px] border border-blue-200"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">{r.trainerName}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {formatCurrency(r.defaultPrice)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{r.billingMode}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">
                        {r.totalStudents}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                        {formatCurrency(r.totalBilled)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: FEE BILLS LEDGER */}
        {/* ========================================================= */}
        {reportType === 'FEE_BILLS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Courses</th>
                  <th className="py-3 px-4">Bill Date</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Remaining</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Querying invoices...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      No invoices found.
                    </td>
                  </tr>
                ) : (
                  data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold text-[#0052CC] whitespace-nowrap">
                        {r.billNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{r.studentName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{r.studentCode}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{r.courses}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{formatDate(r.billDate)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(r.grandTotal)}
                      </td>
                      <td className="py-3 px-4 text-emerald-600 font-semibold whitespace-nowrap">
                        {formatCurrency(r.paidAmount)}
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-600 whitespace-nowrap">
                        {formatCurrency(r.remainingAmount)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: PAYMENTS */}
        {/* ========================================================= */}
        {reportType === 'PAYMENTS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Allocated To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Querying receipts...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      No payments found.
                    </td>
                  </tr>
                ) : (
                  data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-700 whitespace-nowrap">
                        {r.receiptNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{r.studentName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{r.studentCode}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{formatDate(r.paymentDate)}</td>
                      <td className="py-3 px-4 font-bold text-emerald-600 whitespace-nowrap">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {r.paymentMethod.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                        {r.referenceNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{r.allocations}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: OUTSTANDING DUES */}
        {/* ========================================================= */}
        {reportType === 'OUTSTANDING' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Total Billed</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Querying outstanding balances...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      No overdue balances found!
                    </td>
                  </tr>
                ) : (
                  data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold text-[#0052CC] whitespace-nowrap">
                        {r.billNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{r.studentName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{r.studentCode}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{r.phone}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {r.dueDate ? formatDate(r.dueDate) : 'Immediate'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {formatCurrency(r.grandTotal)}
                      </td>
                      <td className="py-3 px-4 text-emerald-600 font-medium whitespace-nowrap">
                        {formatCurrency(r.paidAmount)}
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-600 whitespace-nowrap">
                        {formatCurrency(r.remainingAmount)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <div>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            <strong className="text-slate-900">{pagination.total}</strong> records
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
    </div>
  );
}
