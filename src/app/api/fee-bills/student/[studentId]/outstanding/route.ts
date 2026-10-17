import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, safeError } from '@/lib/security';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { studentId } = await params;

    const outstandingBills = await prisma.feeBill.findMany({
      where: {
        studentId,
        remainingAmount: { gt: 0 },
        status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      orderBy: { billDate: 'asc' },
      select: {
        id: true,
        billNumber: true,
        billDate: true,
        dueDate: true,
        grandTotal: true,
        paidAmount: true,
        remainingAmount: true,
        status: true,
        billingMode: true,
      },
    });

    const totalOutstanding = outstandingBills.reduce(
      (sum, b) => sum + Number(b.remainingAmount || 0),
      0
    );

    return NextResponse.json({
      bills: outstandingBills.map((b) => ({
        ...b,
        grandTotal: Number(b.grandTotal),
        paidAmount: Number(b.paidAmount),
        remainingAmount: Number(b.remainingAmount),
      })),
      totalOutstanding: Math.round((totalOutstanding + Number.EPSILON) * 100) / 100,
    });
  } catch (error) {
    return safeError(error, 'Failed to fetch outstanding bills');
  }
}
