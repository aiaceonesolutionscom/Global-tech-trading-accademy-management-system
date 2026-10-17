import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateFeeBill } from '@/lib/calculations';
import { BillStatus, BillingMode, DiscountType, TaxType, DurationUnit } from '@prisma/client';
import { requireAuth, safeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;

    const feeBill = await prisma.feeBill.findUnique({
      where: { id },
      include: {
        student: true,
        items: {
          include: {
            course: {
              include: { trainer: true },
            },
          },
        },
        allocations: {
          include: {
            payment: {
              include: {
                allocations: {
                  include: {
                    feeBill: {
                      select: {
                        id: true,
                        billNumber: true,
                        billDate: true,
                        grandTotal: true,
                        paidAmount: true,
                        remainingAmount: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!feeBill) {
      return NextResponse.json({ error: 'Fee Bill not found' }, { status: 404 });
    }

    // Previous bills for this student (for previous balance & payment history comparison)
    const previousBills = await prisma.feeBill.findMany({
      where: {
        studentId: feeBill.studentId,
        id: { not: id },
        billDate: { lte: feeBill.billDate },
      },
      include: {
        allocations: {
          include: {
            payment: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { billDate: 'desc' },
    });

    // Also fetch other bills for this student for navigation/audit
    const relatedBills = await prisma.feeBill.findMany({
      where: {
        studentId: feeBill.studentId,
        id: { not: id },
      },
      select: {
        id: true,
        billNumber: true,
        billDate: true,
        grandTotal: true,
        remainingAmount: true,
        status: true,
      },
      orderBy: { billDate: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      feeBill: {
        ...feeBill,
        subtotal: Number(feeBill.subtotal),
        discountAmount: Number(feeBill.discountAmount),
        taxAmount: Number(feeBill.taxAmount),
        grandTotal: Number(feeBill.grandTotal),
        paidAmount: Number(feeBill.paidAmount),
        remainingAmount: Number(feeBill.remainingAmount),
        previousOutstanding: Number(feeBill.previousOutstanding),
        items: feeBill.items.map((it) => ({
          ...it,
          defaultPrice: Number(it.defaultPrice),
          overridePrice: it.overridePrice !== null ? Number(it.overridePrice) : null,
          lineTotal: Number(it.lineTotal),
        })),
        allocations: feeBill.allocations.map((a) => ({
          ...a,
          amountAllocated: Number(a.amountAllocated),
          payment: {
            ...a.payment,
            amount: Number(a.payment.amount),
            siblingAllocations: ((a.payment as any).allocations || [])
              .filter((sa: any) => sa.feeBillId !== id)
              .map((sa: any) => ({
                id: sa.id,
                feeBillId: sa.feeBillId,
                billNumber: sa.feeBill?.billNumber || 'Previous Bill',
                amountAllocated: Number(sa.amountAllocated),
                grandTotal: Number(sa.feeBill?.grandTotal || 0),
                paidAmount: Number(sa.feeBill?.paidAmount || 0),
                remainingAmount: Number(sa.feeBill?.remainingAmount || 0),
                status: sa.feeBill?.status,
              })),
          },
        })),
      },
      previousBills: previousBills.map((pb) => ({
        id: pb.id,
        billNumber: pb.billNumber,
        billDate: pb.billDate,
        grandTotal: Number(pb.grandTotal),
        paidAmount: Number(pb.paidAmount),
        remainingAmount: Number(pb.remainingAmount),
        status: pb.status,
        allocations: pb.allocations.map((a) => ({
          id: a.id,
          amountAllocated: Number(a.amountAllocated),
          payment: {
            id: a.payment.id,
            receiptNumber: a.payment.receiptNumber,
            paymentDate: a.payment.paymentDate,
            paymentMethod: a.payment.paymentMethod,
            amount: Number(a.payment.amount),
          },
        })),
      })),
      relatedBills: relatedBills.map((rb) => ({
        ...rb,
        grandTotal: Number(rb.grandTotal),
        remainingAmount: Number(rb.remainingAmount),
      })),
    });
  } catch (error) {
    return safeError(error, 'Failed to fetch fee bill details');
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.feeBill.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Fee Bill not found' }, { status: 404 });
    }

    const paidAmount = Number(existing.paidAmount || 0);

    // If items are provided in request, do a full recalculation and item replacement
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      const courseIds = body.items.map((it: any) => it.courseId);
      const dbCourses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
      });
      const courseMap = new Map(dbCourses.map((c) => [c.id, c]));

      const calculationItems = body.items.map((it: any) => {
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
      const resolvedBillingMode = (allSingleMonth ? 'ONE_TIME' : (body.billingMode || existing.billingMode)) as BillingMode;

      const discountType = (body.discountType || existing.discountType) as DiscountType;
      const discountValue =
        body.discountValue !== undefined
          ? parseFloat(body.discountValue) || 0
          : Number(existing.discountValue);

      const taxType = (body.taxType || existing.taxType) as TaxType;
      const taxName = body.taxName !== undefined ? body.taxName : existing.taxName || 'GST';
      const taxValue =
        body.taxValue !== undefined
          ? parseFloat(body.taxValue) || 0
          : Number(existing.taxValue);

      const calc = calculateFeeBill({
        items: calculationItems,
        discountType,
        discountValue,
        taxType,
        taxValue,
        taxName,
        previousOutstanding: Number(existing.previousOutstanding),
        paidAmount,
      });

      // Prevent grandTotal from becoming less than already paid amount
      if (calc.grandTotal < paidAmount) {
        return NextResponse.json(
          {
            error: `Grand total (Rs. ${calc.grandTotal.toLocaleString()}) cannot be less than already recorded paid amount (Rs. ${paidAmount.toLocaleString()})`,
          },
          { status: 400 }
        );
      }

      const newRemaining = Math.max(0, calc.grandTotal - paidAmount);

      let newStatus: BillStatus = existing.status;
      if (existing.status !== BillStatus.CANCELLED) {
        if (newRemaining <= 0) {
          newStatus = BillStatus.PAID;
        } else if (paidAmount > 0) {
          newStatus = BillStatus.PARTIALLY_PAID;
        } else {
          const dueDateObj = body.dueDate ? new Date(body.dueDate) : existing.dueDate;
          if (dueDateObj && dueDateObj < new Date()) {
            newStatus = BillStatus.OVERDUE;
          } else {
            newStatus = BillStatus.UNPAID;
          }
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        // Delete old items
        await tx.feeBillItem.deleteMany({ where: { feeBillId: id } });

        // Insert updated items
        await tx.feeBillItem.createMany({
          data: calc.items.map((li) => {
            const orig = calculationItems.find((c: any) => c.courseId === li.courseId) || {
              defaultPrice: li.effectiveBasePrice,
              overridePrice: null,
            };
            return {
              feeBillId: id,
              courseId: li.courseId,
              defaultPrice: orig.defaultPrice,
              overridePrice: orig.overridePrice,
              billingMode: li.billingMode as BillingMode,
              durationValue: li.durationValue,
              durationUnit: (courseMap.get(li.courseId)?.durationUnit || DurationUnit.MONTHS) as DurationUnit,
              lineTotal: li.lineTotal,
            };
          }),
        });

        // Update fee bill header
        const updatedBill = await tx.feeBill.update({
          where: { id },
          data: {
            billDate: body.billDate ? new Date(body.billDate) : existing.billDate,
            startDate: body.startDate ? new Date(body.startDate) : existing.startDate,
            endDate: body.endDate ? new Date(body.endDate) : existing.endDate,
            dueDate: body.dueDate ? new Date(body.dueDate) : existing.dueDate,
            billingMode: resolvedBillingMode,
            subtotal: calc.subtotal,
            discountType,
            discountValue,
            discountAmount: calc.discountAmount,
            taxName,
            taxType,
            taxValue,
            taxAmount: calc.taxAmount,
            grandTotal: calc.grandTotal,
            remainingAmount: newRemaining,
            status: body.status ? (body.status as BillStatus) : newStatus,
            notes: body.notes !== undefined ? body.notes : existing.notes,
          },
          include: {
            items: {
              include: { course: true },
            },
            student: true,
          },
        });

        return updatedBill;
      });

      return NextResponse.json({
        success: true,
        feeBill: {
          ...result,
          subtotal: Number(result.subtotal),
          discountAmount: Number(result.discountAmount),
          taxAmount: Number(result.taxAmount),
          grandTotal: Number(result.grandTotal),
          paidAmount: Number(result.paidAmount),
          remainingAmount: Number(result.remainingAmount),
          previousOutstanding: Number(result.previousOutstanding),
        },
      });
    }

    // Otherwise, perform partial metadata update (dates, notes, status)
    const updated = await prisma.feeBill.update({
      where: { id },
      data: {
        billDate: body.billDate ? new Date(body.billDate) : existing.billDate,
        startDate: body.startDate ? new Date(body.startDate) : existing.startDate,
        endDate: body.endDate ? new Date(body.endDate) : existing.endDate,
        dueDate: body.dueDate ? new Date(body.dueDate) : existing.dueDate,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        status: body.status ? (body.status as BillStatus) : existing.status,
      },
      include: {
        items: true,
        student: true,
      },
    });

    return NextResponse.json({ success: true, feeBill: updated });
  } catch (error) {
    return safeError(error, 'Failed to update fee bill');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === 'true';
    const action = url.searchParams.get('action'); // 'cancel' or 'delete'

    // Only administrators can force delete invoices with payments
    if (force && auth.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden. Only administrators can force delete fee bills with payment history.' },
        { status: 403 }
      );
    }

    const existing = await prisma.feeBill.findUnique({
      where: { id },
      include: { allocations: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Fee Bill not found' }, { status: 404 });
    }

    const hasAllocations = existing.allocations.length > 0 || Number(existing.paidAmount) > 0;

    // Explicit cancel request
    if (action === 'cancel') {
      await prisma.feeBill.update({
        where: { id },
        data: { status: BillStatus.CANCELLED },
      });
      return NextResponse.json({
        success: true,
        message: `Invoice #${existing.billNumber} has been marked as CANCELLED.`,
        cancelled: true,
      });
    }

    // If payments exist and not force delete, prompt user or default to soft cancellation
    if (hasAllocations && !force) {
      return NextResponse.json(
        {
          error: `Invoice #${existing.billNumber} has recorded payments of Rs. ${Number(existing.paidAmount).toLocaleString()}. Please confirm if you wish to cancel or force delete.`,
          hasPayments: true,
          paidAmount: Number(existing.paidAmount),
          allocationsCount: existing.allocations.length,
        },
        { status: 400 }
      );
    }

    // Full hard delete
    await prisma.$transaction(async (tx) => {
      // 1. Remove notifications referencing this bill
      await tx.notification.deleteMany({ where: { feeBillId: id } });
      // 2. Remove allocations
      await tx.paymentAllocation.deleteMany({ where: { feeBillId: id } });
      // 3. Remove bill items
      await tx.feeBillItem.deleteMany({ where: { feeBillId: id } });
      // 4. Delete bill
      await tx.feeBill.delete({ where: { id } });
    });

    return NextResponse.json({
      success: true,
      message: `Invoice #${existing.billNumber} has been permanently deleted.`,
    });
  } catch (error) {
    return safeError(error, 'Failed to delete fee bill');
  }
}
