import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { BillStatus, BillingMode, PaymentMethod, EnrollmentStatus } from '@prisma/client';
import { requireAuth, safeError } from '@/lib/security';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'FEE_BILLS'; // FEE_BILLS | PAYMENTS | ENROLLMENTS | STUDENTS | OUTSTANDING | COURSE_REVENUE | TRAINERS
    const search = searchParams.get('search') || '';
    const studentId = searchParams.get('studentId') || '';
    const courseId = searchParams.get('courseId') || '';
    const trainerId = searchParams.get('trainerId') || '';
    const billStatus = searchParams.get('billStatus') || '';
    const billingMode = searchParams.get('billingMode') || '';
    const paymentMethod = searchParams.get('paymentMethod') || '';
    const enrollmentStatus = searchParams.get('enrollmentStatus') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '10')));
    const skip = (page - 1) * limit;

    let resultData: any[] = [];
    let totalCount = 0;
    let summary: any = {};

    if (reportType === 'FEE_BILLS') {
      const where: any = {};
      if (search) {
        where.OR = [
          { billNumber: { contains: search, mode: 'insensitive' } },
          { student: { fullName: { contains: search, mode: 'insensitive' } } },
        ];
      }
      if (studentId) where.studentId = studentId;
      if (courseId) where.items = { some: { courseId } };
      if (billStatus && billStatus !== 'ALL') where.status = billStatus as BillStatus;
      if (billingMode && billingMode !== 'ALL') where.billingMode = billingMode as BillingMode;
      if (dateFrom || dateTo) {
        where.billDate = {};
        if (dateFrom) where.billDate.gte = new Date(dateFrom);
        if (dateTo) where.billDate.lte = new Date(new Date(dateTo).setHours(23, 59, 59));
      }

      const [total, bills, agg] = await Promise.all([
        prisma.feeBill.count({ where }),
        prisma.feeBill.findMany({
          where,
          skip,
          take: limit,
          orderBy: { billDate: 'desc' },
          include: {
            student: { select: { fullName: true, studentCode: true, phone: true } },
            items: { include: { course: { select: { name: true } } } },
          },
        }),
        prisma.feeBill.aggregate({
          where,
          _sum: { grandTotal: true, paidAmount: true, remainingAmount: true },
        }),
      ]);

      totalCount = total;
      resultData = bills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        studentName: b.student.fullName,
        studentCode: b.student.studentCode,
        billDate: b.billDate,
        dueDate: b.dueDate,
        billingMode: b.billingMode,
        courses: b.items.map((it) => it.course.name).join(', '),
        grandTotal: Number(b.grandTotal),
        paidAmount: Number(b.paidAmount),
        remainingAmount: Number(b.remainingAmount),
        status: b.status,
      }));

      summary = {
        totalGrand: Number(agg._sum.grandTotal || 0),
        totalPaid: Number(agg._sum.paidAmount || 0),
        totalRemaining: Number(agg._sum.remainingAmount || 0),
      };
    } else if (reportType === 'PAYMENTS') {
      const where: any = {};
      if (search) {
        where.OR = [
          { receiptNumber: { contains: search, mode: 'insensitive' } },
          { referenceNumber: { contains: search, mode: 'insensitive' } },
          { student: { fullName: { contains: search, mode: 'insensitive' } } },
        ];
      }
      if (studentId) where.studentId = studentId;
      if (paymentMethod && paymentMethod !== 'ALL') where.paymentMethod = paymentMethod as PaymentMethod;
      if (dateFrom || dateTo) {
        where.paymentDate = {};
        if (dateFrom) where.paymentDate.gte = new Date(dateFrom);
        if (dateTo) where.paymentDate.lte = new Date(new Date(dateTo).setHours(23, 59, 59));
      }

      const [total, payments, agg] = await Promise.all([
        prisma.payment.count({ where }),
        prisma.payment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { paymentDate: 'desc' },
          include: {
            student: { select: { fullName: true, studentCode: true } },
            allocations: {
              include: { feeBill: { select: { billNumber: true } } },
            },
          },
        }),
        prisma.payment.aggregate({
          where,
          _sum: { amount: true },
        }),
      ]);

      totalCount = total;
      resultData = payments.map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber,
        studentName: p.student.fullName,
        studentCode: p.student.studentCode,
        paymentDate: p.paymentDate,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        referenceNumber: p.referenceNumber || '-',
        allocations: p.allocations.map((a) => `${a.feeBill.billNumber}: Rs. ${Number(a.amountAllocated)}`).join('; ') || 'Direct',
      }));

      summary = {
        totalCollected: Number(agg._sum.amount || 0),
      };
    } else if (reportType === 'ENROLLMENTS') {
      const where: any = {};
      if (search) {
        where.OR = [
          { enrollmentCode: { contains: search, mode: 'insensitive' } },
          { student: { fullName: { contains: search, mode: 'insensitive' } } },
          { student: { studentCode: { contains: search, mode: 'insensitive' } } },
          { course: { name: { contains: search, mode: 'insensitive' } } },
          { course: { courseCode: { contains: search, mode: 'insensitive' } } },
        ];
      }
      if (studentId) where.studentId = studentId;
      if (courseId && courseId !== 'ALL') where.courseId = courseId;
      if (trainerId && trainerId !== 'ALL') where.trainerId = trainerId;
      if (enrollmentStatus && enrollmentStatus !== 'ALL') where.status = enrollmentStatus as EnrollmentStatus;
      if (dateFrom || dateTo) {
        where.enrollmentDate = {};
        if (dateFrom) where.enrollmentDate.gte = new Date(dateFrom);
        if (dateTo) where.enrollmentDate.lte = new Date(new Date(dateTo).setHours(23, 59, 59));
      }

      const [total, enrollments, activeCount, completedCount] = await Promise.all([
        prisma.enrollment.count({ where }),
        prisma.enrollment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { enrollmentDate: 'desc' },
          include: {
            student: {
              select: {
                fullName: true,
                studentCode: true,
                phone: true,
                feeBills: {
                  orderBy: { billDate: 'desc' },
                  select: { status: true, remainingAmount: true, items: { select: { courseId: true } } },
                },
              },
            },
            course: { select: { id: true, courseCode: true, name: true, defaultPrice: true } },
            trainer: { select: { id: true, name: true, trainerCode: true } },
          },
        }),
        prisma.enrollment.count({ where: { ...where, status: 'ACTIVE' } }),
        prisma.enrollment.count({ where: { ...where, status: 'COMPLETED' } }),
      ]);

      totalCount = total;
      resultData = enrollments.map((e) => {
        const matchingBill =
          e.student.feeBills.find((b) => b.items.some((it) => it.courseId === e.course.id)) ||
          e.student.feeBills[0];

        return {
          id: e.id,
          enrollmentCode: e.enrollmentCode,
          studentName: e.student.fullName,
          studentCode: e.student.studentCode,
          studentPhone: e.student.phone || '-',
          courseCode: e.course.courseCode,
          courseName: e.course.name,
          trainerName: e.trainer?.name || 'Unassigned',
          trainerCode: e.trainer?.trainerCode || '-',
          enrollmentDate: e.enrollmentDate,
          billingMode: e.billingMode,
          duration: `${e.durationValue} ${e.durationUnit.toLowerCase()}`,
          feeStatus: matchingBill?.status || 'NO_BILL',
          feeRemaining: matchingBill ? Number(matchingBill.remainingAmount) : 0,
          status: e.status,
        };
      });

      summary = {
        totalEnrollments: total,
        activeEnrollments: activeCount,
        completedEnrollments: completedCount,
      };
    } else if (reportType === 'TRAINERS') {
      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { trainerCode: { contains: search, mode: 'insensitive' } },
          { specialization: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (trainerId && trainerId !== 'ALL') where.id = trainerId;

      const [total, trainersList] = await Promise.all([
        prisma.trainer.count({ where }),
        prisma.trainer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            courseTrainers: {
              include: {
                course: {
                  select: { id: true, courseCode: true, name: true, defaultPrice: true, billingMode: true },
                },
              },
            },
            courses: {
              select: { id: true, courseCode: true, name: true, defaultPrice: true, billingMode: true },
            },
            enrollments: {
              include: {
                student: { select: { fullName: true, studentCode: true, phone: true } },
                course: { select: { courseCode: true, name: true } },
              },
              orderBy: { enrollmentDate: 'desc' },
            },
          },
        }),
      ]);

      totalCount = total;

      let grandTotalActiveStudents = 0;
      let grandTotalCoursesTaught = 0;

      resultData = trainersList.map((t) => {
        // Collect courses from both CourseTrainer and direct courses
        const courseMap = new Map<string, any>();
        if (t.courses) {
          t.courses.forEach((c) => courseMap.set(c.id, c));
        }
        if (t.courseTrainers) {
          t.courseTrainers.forEach((ct) => {
            if (ct.course) courseMap.set(ct.course.id, ct.course);
          });
        }
        const assignedCourses = Array.from(courseMap.values());
        grandTotalCoursesTaught += assignedCourses.length;

        const activeStudentsCount = t.enrollments.filter((e) => e.status === 'ACTIVE').length;
        grandTotalActiveStudents += activeStudentsCount;

        return {
          id: t.id,
          trainerCode: t.trainerCode,
          name: t.name,
          specialization: t.specialization || 'Trading Faculty',
          phone: t.phone || '-',
          email: t.email || '-',
          status: t.status,
          totalAssignedCourses: assignedCourses.length,
          coursesList: assignedCourses.map((c) => ({
            id: c.id,
            code: c.courseCode,
            name: c.name,
            billingMode: c.billingMode,
          })),
          courseNames: assignedCourses.map((c) => `${c.name} (${c.courseCode})`).join(', ') || 'No Courses Assigned',
          totalStudents: t.enrollments.length,
          activeStudents: activeStudentsCount,
          completedStudents: t.enrollments.filter((e) => e.status === 'COMPLETED').length,
          studentsList: t.enrollments.map((e) => ({
            enrollmentCode: e.enrollmentCode,
            studentName: e.student.fullName,
            studentCode: e.student.studentCode,
            studentPhone: e.student.phone || '-',
            courseName: e.course.name,
            courseCode: e.course.courseCode,
            enrollmentDate: e.enrollmentDate,
            status: e.status,
          })),
        };
      });

      summary = {
        totalFaculty: total,
        totalActiveStudents: grandTotalActiveStudents,
        totalCoursesTaught: grandTotalCoursesTaught,
      };
    } else if (reportType === 'OUTSTANDING') {
      const where: any = {
        remainingAmount: { gt: 0 },
        status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      };
      if (search) {
        where.OR = [
          { billNumber: { contains: search, mode: 'insensitive' } },
          { student: { fullName: { contains: search, mode: 'insensitive' } } },
        ];
      }
      if (studentId) where.studentId = studentId;

      const [total, bills, agg] = await Promise.all([
        prisma.feeBill.count({ where }),
        prisma.feeBill.findMany({
          where,
          skip,
          take: limit,
          orderBy: { dueDate: 'asc' },
          include: {
            student: { select: { fullName: true, studentCode: true, phone: true } },
          },
        }),
        prisma.feeBill.aggregate({
          where,
          _sum: { remainingAmount: true, grandTotal: true, paidAmount: true },
        }),
      ]);

      totalCount = total;
      resultData = bills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        studentName: b.student.fullName,
        studentCode: b.student.studentCode,
        phone: b.student.phone,
        dueDate: b.dueDate,
        grandTotal: Number(b.grandTotal),
        paidAmount: Number(b.paidAmount),
        remainingAmount: Number(b.remainingAmount),
        status: b.status,
      }));

      summary = {
        totalOutstanding: Number(agg._sum.remainingAmount || 0),
        totalBilled: Number(agg._sum.grandTotal || 0),
      };
    } else if (reportType === 'COURSE_REVENUE') {
      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { courseCode: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (courseId && courseId !== 'ALL') where.id = courseId;
      if (trainerId && trainerId !== 'ALL') {
        where.OR = [
          { trainerId },
          { trainers: { some: { trainerId } } },
        ];
      }

      const courses = await prisma.course.findMany({
        where,
        include: {
          trainer: { select: { id: true, name: true, trainerCode: true } },
          trainers: {
            include: {
              trainer: { select: { id: true, name: true, trainerCode: true } },
            },
          },
          feeBillItems: {
            include: { feeBill: { select: { paidAmount: true, grandTotal: true } } },
          },
          _count: { select: { enrollments: true } },
        },
      });

      totalCount = courses.length;
      resultData = courses.map((c) => {
        const totalBilled = c.feeBillItems.reduce((sum, item) => sum + Number(item.lineTotal), 0);
        const instructorNamesList = [
          ...new Set([
            c.trainer?.name,
            ...(c.trainers?.map((ct: any) => ct.trainer?.name) || []),
          ].filter(Boolean)),
        ];

        return {
          id: c.id,
          courseCode: c.courseCode,
          name: c.name,
          trainerName: instructorNamesList.join(', ') || 'Unassigned',
          instructorNamesList,
          defaultPrice: Number(c.defaultPrice),
          billingMode: c.billingMode,
          totalStudents: c._count.enrollments,
          totalBilled,
        };
      });

      const totalRevenue = resultData.reduce((acc, c) => acc + c.totalBilled, 0);
      const totalSeats = resultData.reduce((acc, c) => acc + c.totalStudents, 0);
      summary = {
        totalCourses: courses.length,
        totalSeats,
        totalRevenue,
      };
    }

    return NextResponse.json({
      reportType,
      data: resultData,
      summary,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    return safeError(error, 'Failed to generate report');
  }
}
