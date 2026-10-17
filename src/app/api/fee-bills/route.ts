import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateFeeBill } from '@/lib/calculations';
import { BillStatus, BillingMode, DiscountType, TaxType, DurationUnit } from '@prisma/client';
import { requireAuth, safeError } from '@/lib/security';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const studentId = searchParams.get('studentId') || '';
    const billingMode = searchParams.get('billingMode') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { billNumber: { contains: search, mode: 'insensitive' } },
        { student: { fullName: { contains: search, mode: 'insensitive' } } },
        { student: { studentCode: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status && status !== 'ALL') {
      where.status = status as BillStatus;
    }
    if (studentId) {
      where.studentId = studentId;
    }
    if (billingMode && billingMode !== 'ALL') {
      where.billingMode = billingMode as BillingMode;
    }

    const [total, feeBills] = await Promise.all([
      prisma.feeBill.count({ where }),
      prisma.feeBill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { billDate: 'desc' },
        include: {
          student: {
            select: { id: true, studentCode: true, fullName: true, phone: true, email: true },
          },
          items: {
            include: {
              course: { select: { id: true, name: true, courseCode: true } },
            },
          },
          _count: {
            select: { allocations: true },
          },
        },
      }),
    ]);

    const formattedBills = feeBills.map((b) => ({
      ...b,
      subtotal: Number(b.subtotal),
      discountAmount: Number(b.discountAmount),
      taxAmount: Number(b.taxAmount),
      grandTotal: Number(b.grandTotal),
      paidAmount: Number(b.paidAmount),
      remainingAmount: Number(b.remainingAmount),
      previousOutstanding: Number(b.previousOutstanding),
      items: b.items.map((it) => ({
        ...it,
        defaultPrice: Number(it.defaultPrice),
        overridePrice: it.overridePrice !== null ? Number(it.overridePrice) : null,
        lineTotal: Number(it.lineTotal),
      })),
    }));

    return NextResponse.json({
      data: formattedBills,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return safeError(error, 'Failed to fetch fee bills');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const {
      studentId,
      billDate = new Date().toISOString(),
      startDate,
      endDate,
      dueDate,
      billingMode = 'ONE_TIME',
      items, // array of { courseId, overridePrice, billingMode, durationValue }
      discountType = 'NONE',
      discountValue = 0,
      taxName = 'GST',
      taxType = 'NONE',
      taxValue = 0,
      notes,
    } = body;

    if (!studentId || !items || !items.length) {
      return NextResponse.json(
        { error: 'Student and at least one course line item are required' },
        { status: 400 }
      );
    }

    // 1. Fetch Student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // 2. Fetch all selected courses from database
    const courseIds = items.map((it: any) => it.courseId);
    const dbCourses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
    });
    const courseMap = new Map(dbCourses.map((c) => [c.id, c]));

    // 3. Prepare calculation line inputs using real Course defaults
    const calculationItems = items.map((it: any) => {
      const dbCourse = courseMap.get(it.courseId);
      if (!dbCourse) {
        throw new Error(`Course not found: ${it.courseId}`);
      }
      const isSingleMonth =
        (dbCourse.durationUnit === 'MONTHS' && dbCourse.durationValue <= 1) ||
        (dbCourse.durationUnit === 'WEEKS' && dbCourse.durationValue <= 4) ||
        (dbCourse.durationUnit === 'DAYS' && dbCourse.durationValue <= 31);

      const resolvedMode = isSingleMonth
        ? 'ONE_TIME'
        : ((it.billingMode || dbCourse.billingMode) as 'ONE_TIME' | 'MONTHLY');

      return {
        courseId: it.courseId,
        defaultPrice: Number(dbCourse.defaultPrice),
        overridePrice:
          it.overridePrice !== undefined && it.overridePrice !== null && it.overridePrice !== ''
            ? parseFloat(it.overridePrice)
            : null,
        billingMode: resolvedMode,
        durationValue: isSingleMonth ? 1 : (parseInt(it.durationValue) || dbCourse.durationValue || 1),
        durationUnit: dbCourse.durationUnit,
      };
    });

    const allSingleMonth = calculationItems.every(
      (it: any) =>
        (it.durationUnit === 'MONTHS' && it.durationValue <= 1) ||
        (it.durationUnit === 'WEEKS' && it.durationValue <= 4) ||
        (it.durationUnit === 'DAYS' && it.durationValue <= 31)
    );
    const resolvedBillingMode = (allSingleMonth ? 'ONE_TIME' : billingMode) as BillingMode;

    // 4. Detect Previous Outstanding Balance for this student
    const existingUnpaidBills = await prisma.feeBill.findMany({
      where: {
        studentId,
        remainingAmount: { gt: 0 },
        status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      select: { remainingAmount: true },
    });
    const previousOutstanding = existingUnpaidBills.reduce(
      (sum, b) => sum + Number(b.remainingAmount || 0),
      0
    );

    // 5. Centralized Financial Calculations Engine
    const calc = calculateFeeBill({
      items: calculationItems,
      discountType,
      discountValue: parseFloat(discountValue) || 0,
      taxType,
      taxValue: parseFloat(taxValue) || 0,
      taxName,
      previousOutstanding,
      paidAmount: 0,
    });

    // 6. Generate Invoice Number: GT-INV-YYYY-XXXX
    const year = new Date().getFullYear();
    const billCount = await prisma.feeBill.count();
    const billNumber = `GT-INV-${year}-${String(billCount + 1).padStart(4, '0')}`;

    // 7. Atomic Database Transaction
    const newBill = await prisma.$transaction(async (tx) => {
      const bill = await tx.feeBill.create({
        data: {
          billNumber,
          studentId,
          billDate: new Date(billDate),
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          dueDate: dueDate ? new Date(dueDate) : null,
          billingMode: resolvedBillingMode,
          subtotal: calc.subtotal,
          discountType: discountType as DiscountType,
          discountValue: parseFloat(discountValue) || 0,
          discountAmount: calc.discountAmount,
          taxName: taxName || 'GST',
          taxType: taxType as TaxType,
          taxValue: parseFloat(taxValue) || 0,
          taxAmount: calc.taxAmount,
          grandTotal: calc.grandTotal,
          paidAmount: 0.00,
          remainingAmount: calc.grandTotal,
          previousOutstanding: calc.previousOutstanding,
          status: BillStatus.UNPAID,
          notes: notes || null,
          items: {
            create: calc.items.map((it) => {
              const orig = calculationItems.find((c: any) => c.courseId === it.courseId)!;
              return {
                courseId: it.courseId,
                defaultPrice: orig.defaultPrice,
                overridePrice: orig.overridePrice,
                billingMode: it.billingMode as BillingMode,
                durationValue: it.durationValue,
                durationUnit: (orig.durationUnit as DurationUnit) || DurationUnit.MONTHS,
                lineTotal: it.lineTotal,
              };
            }),
          },
        },
        include: {
          student: true,
          items: { include: { course: true } },
        },
      });

      return bill;
    });

    return NextResponse.json(newBill, { status: 201 });
  } catch (error) {
    return safeError(error, 'Failed to create fee bill');
  }
}
