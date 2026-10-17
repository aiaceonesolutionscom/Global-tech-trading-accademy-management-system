import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, safeError } from '@/lib/security';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            feeBills: {
              orderBy: { billDate: 'desc' },
              include: { items: true },
            },
          },
        },
        course: true,
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // 1. Check if student already has a fee bill for this course
    const bills = enrollment.student.feeBills || [];
    const existingBill =
      bills.find((b) => b.items.some((it) => it.courseId === enrollment.courseId)) ||
      bills[0] ||
      null;

    if (existingBill) {
      return NextResponse.json({
        feeBillId: existingBill.id,
        billNumber: existingBill.billNumber,
        isExisting: true,
      });
    }

    // 2. If no bill exists yet, generate one automatically
    const course = enrollment.course;
    const defaultPrice = Number(course.defaultPrice);
    const effectiveBillingMode = enrollment.billingMode || course.billingMode;

    const prevBills = await prisma.feeBill.findMany({
      where: { studentId: enrollment.studentId, status: { not: 'PAID' } },
      select: { remainingAmount: true },
    });
    const previousOutstanding = prevBills.reduce((acc, b) => acc + Number(b.remainingAmount), 0);

    const year = new Date().getFullYear();
    const billCount = await prisma.feeBill.count();
    const billNumber = `GT-INV-${year}-${String(billCount + 1).padStart(4, '0')}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const newBill = await prisma.feeBill.create({
      data: {
        billNumber,
        studentId: enrollment.studentId,
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
        notes: `Enrollment: ${enrollment.enrollmentCode}`,
        items: {
          create: [
            {
              courseId: enrollment.courseId,
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

    return NextResponse.json({
      feeBillId: newBill.id,
      billNumber: newBill.billNumber,
      isExisting: false,
    });
  } catch (error) {
    return safeError(error, 'Failed to resolve fee bill');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return GET(request, { params });
}
