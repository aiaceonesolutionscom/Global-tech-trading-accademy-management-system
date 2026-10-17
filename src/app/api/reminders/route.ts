import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, safeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

let cachedRemindersData: any = null;
let lastRemindersFetch = 0;
const REMINDERS_CACHE_TTL = 15000; // 15 seconds

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    if (cachedRemindersData && Date.now() - lastRemindersFetch < REMINDERS_CACHE_TTL) {
      return NextResponse.json(cachedRemindersData);
    }

    const now = new Date();

    // 1. Fetch setting for threshold days
    const thresholdSetting = await prisma.setting.findUnique({
      where: { key: 'due_days_threshold' },
    });
    const dueThresholdDays = parseInt(thresholdSetting?.value || '5');

    const upcomingLimit = new Date();
    upcomingLimit.setDate(now.getDate() + dueThresholdDays);

    // 2. Fetch overdue, upcoming, and partial bills in parallel
    const [overdueBills, upcomingBills, partialBills] = await Promise.all([
      prisma.feeBill.findMany({
        where: {
          remainingAmount: { gt: 0 },
          dueDate: { lt: now },
          status: { not: 'CANCELLED' },
        },
        select: {
          id: true,
          billNumber: true,
          studentId: true,
          remainingAmount: true,
          dueDate: true,
          student: { select: { fullName: true } },
        },
        take: 20,
      }),
      prisma.feeBill.findMany({
        where: {
          remainingAmount: { gt: 0 },
          dueDate: { gte: now, lte: upcomingLimit },
          status: { not: 'CANCELLED' },
        },
        select: {
          id: true,
          billNumber: true,
          studentId: true,
          remainingAmount: true,
          dueDate: true,
          student: { select: { fullName: true } },
        },
        take: 20,
      }),
      prisma.feeBill.findMany({
        where: {
          status: 'PARTIALLY_PAID',
          remainingAmount: { gt: 0 },
        },
        select: {
          id: true,
          billNumber: true,
          studentId: true,
          remainingAmount: true,
          dueDate: true,
          student: { select: { fullName: true } },
        },
        take: 20,
      }),
    ]);

    // Construct unified dynamic reminder objects
    const reminders: any[] = [];

    overdueBills.forEach((b) => {
      reminders.push({
        id: `overdue-${b.id}`,
        type: 'OVERDUE',
        title: 'Overdue Fee Bill',
        message: `${b.student.fullName} has an overdue balance of Rs. ${Number(b.remainingAmount).toLocaleString()} on Bill #${b.billNumber}.`,
        studentId: b.studentId,
        studentName: b.student.fullName,
        feeBillId: b.id,
        billNumber: b.billNumber,
        amount: Number(b.remainingAmount),
        dueDate: b.dueDate,
        urgency: 'high',
      });
    });

    upcomingBills.forEach((b) => {
      reminders.push({
        id: `upcoming-${b.id}`,
        type: 'UPCOMING_DUE',
        title: 'Payment Due Soon',
        message: `${b.student.fullName}'s payment of Rs. ${Number(b.remainingAmount).toLocaleString()} for Bill #${b.billNumber} is due on ${b.dueDate ? new Date(b.dueDate).toLocaleDateString() : 'N/A'}.`,
        studentId: b.studentId,
        studentName: b.student.fullName,
        feeBillId: b.id,
        billNumber: b.billNumber,
        amount: Number(b.remainingAmount),
        dueDate: b.dueDate,
        urgency: 'medium',
      });
    });

    partialBills.forEach((b) => {
      // Avoid duplicate if already in overdue
      if (!overdueBills.some((o) => o.id === b.id)) {
        reminders.push({
          id: `partial-${b.id}`,
          type: 'PARTIAL_REMAINING',
          title: 'Partial Balance Remaining',
          message: `${b.student.fullName} has a partial outstanding balance of Rs. ${Number(b.remainingAmount).toLocaleString()} on Bill #${b.billNumber}.`,
          studentId: b.studentId,
          studentName: b.student.fullName,
          feeBillId: b.id,
          billNumber: b.billNumber,
          amount: Number(b.remainingAmount),
          dueDate: b.dueDate,
          urgency: 'low',
        });
      }
    });

    const result = {
      reminders,
      count: reminders.length,
      highUrgencyCount: reminders.filter((r) => r.urgency === 'high').length,
    };

    cachedRemindersData = result;
    lastRemindersFetch = Date.now();

    return NextResponse.json(result);
  } catch (error) {
    return safeError(error, 'Failed to fetch reminders');
  }
}
