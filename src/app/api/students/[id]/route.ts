import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Status } from '@prisma/client';
import { requireAuth, safeError } from '@/lib/security';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: {
            course: true,
            trainer: true,
          },
          orderBy: { enrollmentDate: 'desc' },
        },
        feeBills: {
          include: {
            items: { include: { course: true } },
            allocations: {
              include: { payment: true },
            },
          },
          orderBy: { billDate: 'desc' },
        },
        payments: {
          include: {
            allocations: {
              include: { feeBill: { select: { billNumber: true } } },
            },
          },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Compute balance details
    const totalBilled = student.feeBills.reduce(
      (sum, b) => sum + Number(b.grandTotal || 0),
      0
    );
    const totalPaid = student.payments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );
    const totalOutstanding = student.feeBills.reduce(
      (sum, b) => sum + Number(b.remainingAmount || 0),
      0
    );

    // Most recent bill vs previous bills
    const currentBill = student.feeBills[0];
    const currentOutstanding = currentBill ? Number(currentBill.remainingAmount || 0) : 0;
    const previousOutstanding = Math.max(0, totalOutstanding - currentOutstanding);

    return NextResponse.json({
      student,
      summary: {
        totalBilled,
        totalPaid,
        totalOutstanding,
        currentOutstanding,
        previousOutstanding,
      },
    });
  } catch (error) {
    return safeError(error, 'Failed to fetch student details');
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

    const updated = await prisma.student.update({
      where: { id },
      data: {
        fullName: body.fullName?.trim(),
        guardianName: body.guardianName ? body.guardianName.trim() : null,
        phone: body.phone?.trim(),
        email: body.email ? body.email.toLowerCase().trim() : null,
        cnic: body.cnic ? body.cnic.trim() : null,
        address: body.address ? body.address.trim() : null,
        dob: body.dob ? new Date(body.dob) : null,
        notes: body.notes ? body.notes.trim() : null,
        status: body.status as Status,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return safeError(error, 'Failed to update student');
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
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Only administrators are allowed to force-delete ledger records
    if (force && auth.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden. Only administrators can permanently delete students and ledger records.' },
        { status: 403 }
      );
    }

    // Check financial safeguard
    const [billCount, paymentCount] = await Promise.all([
      prisma.feeBill.count({ where: { studentId: id } }),
      prisma.payment.count({ where: { studentId: id } }),
    ]);

    if ((billCount > 0 || paymentCount > 0) && !force) {
      // Cannot hard delete due to financial ledger history without explicit force
      await prisma.student.update({
        where: { id },
        data: { status: Status.INACTIVE },
      });
      return NextResponse.json({
        success: true,
        message: 'Student has associated financial records. Status changed to INACTIVE to preserve ledger records.',
        archived: true,
      });
    }

    if (force) {
      await prisma.$transaction(async (tx) => {
        const bills = await tx.feeBill.findMany({
          where: { studentId: id },
          select: { id: true },
        });
        const billIds = bills.map((b) => b.id);

        const payments = await tx.payment.findMany({
          where: { studentId: id },
          select: { id: true },
        });
        const paymentIds = payments.map((p) => p.id);

        if (billIds.length > 0 || paymentIds.length > 0) {
          await tx.paymentAllocation.deleteMany({
            where: {
              OR: [
                { feeBillId: { in: billIds } },
                { paymentId: { in: paymentIds } },
              ],
            },
          });
        }

        await tx.feeBill.deleteMany({ where: { studentId: id } });
        await tx.payment.deleteMany({ where: { studentId: id } });
        await tx.enrollment.deleteMany({ where: { studentId: id } });
        await tx.notification.deleteMany({ where: { studentId: id } });
        await tx.student.delete({ where: { id } });
      });

      return NextResponse.json({ success: true, message: 'Student and all related records deleted completely.' });
    }

    // Default clean delete (no bills/payments)
    await prisma.student.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    return safeError(error, 'Failed to delete student');
  }
}
