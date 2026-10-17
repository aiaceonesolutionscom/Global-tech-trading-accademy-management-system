import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { EnrollmentStatus, BillingMode, DurationUnit } from '@prisma/client';
import { requireAuth, safeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const courseId = searchParams.get('courseId') || '';
    const studentId = searchParams.get('studentId') || '';
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { enrollmentCode: { contains: search, mode: 'insensitive' } },
        { student: { fullName: { contains: search, mode: 'insensitive' } } },
        { course: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (courseId && courseId !== 'ALL') where.courseId = courseId;
    if (studentId) where.studentId = studentId;
    if (status && status !== 'ALL') where.status = status as EnrollmentStatus;

    const [total, enrollments] = await Promise.all([
      prisma.enrollment.count({ where }),
      prisma.enrollment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { enrollmentDate: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              studentCode: true,
              fullName: true,
              phone: true,
              feeBills: {
                orderBy: { billDate: 'desc' },
                select: {
                  id: true,
                  billNumber: true,
                  remainingAmount: true,
                  status: true,
                  items: { select: { courseId: true } },
                },
              },
            },
          },
          course: { select: { id: true, courseCode: true, name: true, defaultPrice: true } },
          trainer: { select: { id: true, name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      data: enrollments.map((e) => {
        const bills = e.student?.feeBills || [];
        const matchingBill =
          bills.find((b) => b.items.some((it) => it.courseId === e.courseId)) ||
          bills[0] ||
          null;

        return {
          ...e,
          course: {
            ...e.course,
            defaultPrice: Number(e.course.defaultPrice),
          },
          feeBillId: matchingBill?.id || null,
          feeBillNumber: matchingBill?.billNumber || null,
          feeBillStatus: matchingBill?.status || null,
          feeBillRemaining: matchingBill ? Number(matchingBill.remainingAmount) : 0,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return safeError(error, 'Failed to fetch enrollments');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const { studentId, courseId, trainerId, billingMode, notes, markActiveImmediately = false } = body;

    if (!studentId || !courseId) {
      return NextResponse.json(
        { error: 'Student ID and Course ID are required' },
        { status: 400 }
      );
    }

    // Check duplicate active enrollment (Section 18)
    const existing = await prisma.enrollment.findFirst({
      where: {
        studentId,
        courseId,
        status: { in: ['ACTIVE', 'PENDING'] },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Student is already actively enrolled in this course' },
        { status: 400 }
      );
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const count = await prisma.enrollment.count();
    const enrollmentCode = `GT-ENR-${String(count + 1).padStart(4, '0')}`;

    const effectiveBillingMode = (billingMode as BillingMode) || course.billingMode;
    const defaultPrice = Number(course.defaultPrice);

    // Calculate previous outstanding
    const prevBills = await prisma.feeBill.findMany({
      where: { studentId, status: { not: 'PAID' } },
      select: { remainingAmount: true },
    });
    const previousOutstanding = prevBills.reduce((acc, b) => acc + Number(b.remainingAmount), 0);

    const year = new Date().getFullYear();
    const billCount = await prisma.feeBill.count();
    const billNumber = `GT-INV-${year}-${String(billCount + 1).padStart(4, '0')}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    // Atomic transaction: create enrollment AND fee bill
    const result = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: {
          enrollmentCode,
          studentId,
          courseId,
          trainerId: trainerId || course.trainerId || null,
          enrollmentDate: new Date(),
          billingMode: effectiveBillingMode,
          durationValue: course.durationValue,
          durationUnit: course.durationUnit,
          status: markActiveImmediately ? EnrollmentStatus.ACTIVE : EnrollmentStatus.PENDING,
          notes: notes || null,
        },
        include: {
          student: true,
          course: true,
          trainer: true,
        },
      });

      const feeBill = await tx.feeBill.create({
        data: {
          billNumber,
          studentId,
          billDate: new Date(),
          dueDate,
          billingMode: effectiveBillingMode,
          subtotal: defaultPrice,
          discountType: 'NONE',
          discountValue: 0,
          discountAmount: 0,
          taxName: 'GST',
          taxType: 'NONE',
          taxValue: 0,
          taxAmount: 0,
          grandTotal: defaultPrice,
          paidAmount: 0,
          remainingAmount: defaultPrice,
          previousOutstanding,
          status: 'UNPAID',
          notes: notes || `Auto-generated on enrollment (${enrollmentCode})`,
          items: {
            create: [
              {
                courseId,
                defaultPrice,
                billingMode: effectiveBillingMode,
                durationValue: course.durationValue,
                durationUnit: course.durationUnit,
                lineTotal: defaultPrice,
              },
            ],
          },
        },
      });

      return {
        ...enrollment,
        feeBillId: feeBill.id,
        feeBillNumber: feeBill.billNumber,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return safeError(error, 'Failed to create enrollment');
  }
}
