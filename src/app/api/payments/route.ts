import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PaymentMethod, BillStatus, EnrollmentStatus } from '@prisma/client';
import { roundToTwoDecimals } from '@/lib/calculations';
import { requireAuth, safeError } from '@/lib/security';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const studentId = searchParams.get('studentId') || '';
    const paymentMethod = searchParams.get('paymentMethod') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { receiptNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { student: { fullName: { contains: search, mode: 'insensitive' } } },
        { student: { studentCode: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (studentId) {
      where.studentId = studentId;
    }
    if (paymentMethod && paymentMethod !== 'ALL') {
      where.paymentMethod = paymentMethod as PaymentMethod;
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          student: {
            select: { id: true, studentCode: true, fullName: true, phone: true },
          },
          allocations: {
            include: {
              feeBill: {
                select: { id: true, billNumber: true, grandTotal: true, status: true },
              },
            },
          },
        },
      }),
    ]);

    const formattedPayments = payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      allocations: p.allocations.map((a) => ({
        ...a,
        amountAllocated: Number(a.amountAllocated),
        feeBill: {
          ...a.feeBill,
          grandTotal: Number(a.feeBill.grandTotal),
        },
      })),
    }));

    return NextResponse.json({
      data: formattedPayments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return safeError(error, 'Failed to fetch payments');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const {
      studentId,
      amount,
      paymentMethod = 'CASH',
      paymentDate = new Date().toISOString(),
      referenceNumber,
      notes,
      allocations, // Array of { feeBillId: string, amount: number }
      autoAllocate = false, // If true and allocations not provided, allocates oldest to newest
    } = body;

    const numAmount = roundToTwoDecimals(parseFloat(amount));
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than zero' },
        { status: 400 }
      );
    }

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // Prepare allocations
    let finalAllocations: { feeBillId: string; amount: number }[] = [];

    if (allocations && allocations.length > 0) {
      finalAllocations = allocations.map((a: any) => ({
        feeBillId: a.feeBillId,
        amount: roundToTwoDecimals(parseFloat(a.amount)),
      })).filter((a: any) => a.amount > 0);
    } else {
      // Auto-allocation: Find all unpaid/partially paid bills for student in chronological order
      const unpaidBills = await prisma.feeBill.findMany({
        where: {
          studentId,
          remainingAmount: { gt: 0 },
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        orderBy: { billDate: 'asc' },
      });

      let remainingToAllocate = numAmount;
      for (const bill of unpaidBills) {
        if (remainingToAllocate <= 0) break;
        const billRemaining = Number(bill.remainingAmount);
        const alloc = Math.min(remainingToAllocate, billRemaining);
        finalAllocations.push({
          feeBillId: bill.id,
          amount: roundToTwoDecimals(alloc),
        });
        remainingToAllocate = roundToTwoDecimals(remainingToAllocate - alloc);
      }
    }

    // Verify sum of allocations matches payment amount (within 0.01 tolerance)
    const sumAllocated = roundToTwoDecimals(
      finalAllocations.reduce((sum, a) => sum + a.amount, 0)
    );

    if (Math.abs(sumAllocated - numAmount) > 0.01) {
      return NextResponse.json(
        {
          error: `Sum of bill allocations (${sumAllocated}) does not match payment amount (${numAmount})`,
        },
        { status: 400 }
      );
    }

    // Execute atomic PostgreSQL ACID transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate Receipt Number: GT-REC-YYYY-XXXX
      const year = new Date().getFullYear();
      const paymentCount = await tx.payment.count();
      const receiptNumber = `GT-REC-${year}-${String(paymentCount + 1).padStart(4, '0')}`;

      // 2. Create Payment Record
      const payment = await tx.payment.create({
        data: {
          receiptNumber,
          studentId,
          paymentDate: new Date(paymentDate),
          amount: numAmount,
          paymentMethod: paymentMethod as PaymentMethod,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
        },
      });

      // 3. Process each allocation
      for (const alloc of finalAllocations) {
        const bill = await tx.feeBill.findUnique({
          where: { id: alloc.feeBillId },
          include: {
            items: { include: { course: true } },
          },
        });

        if (!bill) {
          throw new Error(`Fee bill not found: ${alloc.feeBillId}`);
        }

        const currentPaid = Number(bill.paidAmount);
        const grandTotal = Number(bill.grandTotal);
        const currentRemaining = Number(bill.remainingAmount);

        if (alloc.amount > currentRemaining + 0.01) {
          throw new Error(
            `Allocated amount (${alloc.amount}) exceeds remaining balance (${currentRemaining}) on bill ${bill.billNumber}`
          );
        }

        const newPaid = roundToTwoDecimals(currentPaid + alloc.amount);
        const newRemaining = Math.max(0, roundToTwoDecimals(grandTotal - newPaid));
        const newStatus: BillStatus =
          newRemaining === 0 ? BillStatus.PAID : BillStatus.PARTIALLY_PAID;

        // Record Allocation
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            feeBillId: bill.id,
            amountAllocated: alloc.amount,
          },
        });

        // Update Fee Bill balances and status
        await tx.feeBill.update({
          where: { id: bill.id },
          data: {
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            status: newStatus,
          },
        });

        // 4. Automatic Course Enrollment & Activation (Business rule Section 18)
        // If qualifying payment is made, activate pending enrollment or enroll student in the bill's courses without duplicate
        for (const item of bill.items) {
          const existingEnrollment = await tx.enrollment.findFirst({
            where: {
              studentId: bill.studentId,
              courseId: item.courseId,
              status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING] },
            },
          });

          if (existingEnrollment) {
            // If enrollment was awaiting payment, flip status to ACTIVE upon payment!
            if (existingEnrollment.status === EnrollmentStatus.PENDING) {
              await tx.enrollment.update({
                where: { id: existingEnrollment.id },
                data: {
                  status: EnrollmentStatus.ACTIVE,
                  notes: existingEnrollment.notes
                    ? `${existingEnrollment.notes} | Activated upon payment receipt ${receiptNumber}`
                    : `Activated upon payment receipt ${receiptNumber}`,
                },
              });
            }
          } else {
            const count = await tx.enrollment.count();
            const enrollmentCode = `GT-ENR-${String(count + 1).padStart(4, '0')}`;
            await tx.enrollment.create({
              data: {
                enrollmentCode,
                studentId: bill.studentId,
                courseId: item.courseId,
                trainerId: item.course.trainerId,
                enrollmentDate: new Date(),
                billingMode: item.billingMode,
                durationValue: item.durationValue,
                durationUnit: item.durationUnit,
                status: EnrollmentStatus.ACTIVE,
                notes: `Auto-enrolled upon payment receipt ${receiptNumber} against bill ${bill.billNumber}`,
              },
            });
          }
        }
      }

      // 5. Create Audit Log
      await tx.auditLog.create({
        data: {
          action: 'PAYMENT_RECORDED',
          entity: 'Payment',
          entityId: payment.id,
          userId: auth.user.id,
          details: `Recorded payment ${receiptNumber} of Rs. ${numAmount} across ${finalAllocations.length} bills`,
        },
      });

      return payment;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return safeError(error, 'Payment transaction failed and was rolled back');
  }
}
