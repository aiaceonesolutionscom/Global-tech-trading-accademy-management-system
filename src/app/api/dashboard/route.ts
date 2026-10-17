import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, safeError } from '@/lib/security';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const now = new Date();

    // 1. KPI Counts
    const [
      totalStudents,
      activeStudents,
      totalCourses,
      totalTrainers,
      totalFeeBills,
      feeBillsAgg,
      partiallyPaidBills,
      overdueBills,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: 'ACTIVE' } }),
      prisma.course.count({ where: { status: 'ACTIVE' } }),
      prisma.trainer.count({ where: { status: 'ACTIVE' } }),
      prisma.feeBill.count(),
      prisma.feeBill.aggregate({
        _sum: {
          grandTotal: true,
          paidAmount: true,
          remainingAmount: true,
        },
      }),
      prisma.feeBill.count({ where: { status: 'PARTIALLY_PAID' } }),
      prisma.feeBill.count({
        where: {
          OR: [
            { status: 'OVERDUE' },
            {
              remainingAmount: { gt: 0 },
              dueDate: { lt: now },
            },
          ],
        },
      }),
    ]);

    const totalCollected = Number(feeBillsAgg._sum.paidAmount || 0);
    const totalOutstanding = Number(feeBillsAgg._sum.remainingAmount || 0);
    const totalBilled = Number(feeBillsAgg._sum.grandTotal || 0);

    // 2. Recent Payments (with student info and bill allocations)
    const recentPayments = await prisma.payment.findMany({
      take: 6,
      orderBy: { paymentDate: 'desc' },
      include: {
        student: { select: { fullName: true, studentCode: true } },
        allocations: {
          include: {
            feeBill: { select: { billNumber: true } },
          },
        },
      },
    });

    // 3. Recent Fee Bills
    const recentFeeBills = await prisma.feeBill.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { fullName: true, studentCode: true } },
      },
    });

    // 4. Overdue / Due Bills
    const upcomingDueBills = await prisma.feeBill.findMany({
      where: {
        remainingAmount: { gt: 0 },
      },
      take: 6,
      orderBy: { dueDate: 'asc' },
      include: {
        student: { select: { fullName: true, phone: true } },
      },
    });

    // 5. Recent Student Registrations
    const recentStudents = await prisma.student.findMany({
      take: 5,
      orderBy: { registrationDate: 'desc' },
      include: {
        enrollments: {
          include: { course: { select: { name: true } } },
        },
      },
    });

    // 6. Monthly Collections Chart data (last 6 calendar months)
    const monthlyTrends: { month: string; billed: number; collected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const monthName = startOfMonth.toLocaleString('default', { month: 'short' });

      const [billedSum, collectedSum] = await Promise.all([
        prisma.feeBill.aggregate({
          where: {
            billDate: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { grandTotal: true },
        }),
        prisma.payment.aggregate({
          where: {
            paymentDate: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amount: true },
        }),
      ]);

      monthlyTrends.push({
        month: monthName,
        billed: Number(billedSum._sum.grandTotal || 0),
        collected: Number(collectedSum._sum.amount || 0),
      });
    }

    return NextResponse.json({
      metrics: {
        totalStudents,
        activeStudents,
        totalCourses,
        totalTrainers,
        totalFeeBills,
        totalCollected,
        totalOutstanding,
        totalBilled,
        partiallyPaidBills,
        overdueBills,
      },
      monthlyTrends,
      recentPayments,
      recentFeeBills,
      upcomingDueBills,
      recentStudents,
    });
  } catch (error) {
    return safeError(error, 'Failed to fetch dashboard metrics');
  }
}
