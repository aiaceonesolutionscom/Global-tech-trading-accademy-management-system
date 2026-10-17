import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Status, BillingMode, DurationUnit } from '@prisma/client';
import { requireAuth, safeError } from '@/lib/security';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        trainer: true,
        trainers: {
          include: { trainer: true },
        },
        enrollments: {
          include: { student: true },
          orderBy: { enrollmentDate: 'desc' },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const trainerMap = new Map<string, any>();
    if (course.trainer) trainerMap.set(course.trainer.id, course.trainer);
    if (Array.isArray(course.trainers)) {
      course.trainers.forEach((ct: any) => {
        if (ct.trainer) trainerMap.set(ct.trainer.id, ct.trainer);
      });
    }
    const assignedTrainers = Array.from(trainerMap.values());

    return NextResponse.json({
      ...course,
      assignedTrainers,
      trainerIds: assignedTrainers.map((t) => t.id),
    });
  } catch (error) {
    return safeError(error, 'Failed to fetch course');
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

    let assignedIds: string[] | undefined = undefined;
    if (Array.isArray(body.trainerIds)) {
      assignedIds = Array.from(new Set(body.trainerIds.filter(Boolean)));
    } else if (body.trainerId !== undefined) {
      assignedIds = body.trainerId ? [body.trainerId] : [];
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (assignedIds !== undefined) {
        await tx.courseTrainer.deleteMany({ where: { courseId: id } });
        if (assignedIds.length > 0) {
          await tx.courseTrainer.createMany({
            data: assignedIds.map((tid) => ({
              courseId: id,
              trainerId: tid,
            })),
          });
        }
      }

      return tx.course.update({
        where: { id },
        data: {
          name: body.name?.trim(),
          description: body.description !== undefined ? (body.description ? body.description.trim() : null) : undefined,
          trainerId: assignedIds !== undefined ? (assignedIds[0] || null) : (body.trainerId !== undefined ? (body.trainerId || null) : undefined),
          defaultPrice: body.defaultPrice !== undefined ? parseFloat(body.defaultPrice) : undefined,
          durationValue: body.durationValue !== undefined ? (parseInt(body.durationValue) || 1) : undefined,
          durationUnit: body.durationUnit ? (body.durationUnit as DurationUnit) : undefined,
          billingMode: body.billingMode ? (body.billingMode as BillingMode) : undefined,
          notes: body.notes !== undefined ? (body.notes ? body.notes.trim() : null) : undefined,
          status: body.status ? (body.status as Status) : undefined,
        },
        include: {
          trainer: true,
          trainers: {
            include: { trainer: true },
          },
        },
      });
    });

    const trainerMap = new Map<string, any>();
    if (updated.trainer) trainerMap.set(updated.trainer.id, updated.trainer);
    if (Array.isArray(updated.trainers)) {
      updated.trainers.forEach((ct: any) => {
        if (ct.trainer) trainerMap.set(ct.trainer.id, ct.trainer);
      });
    }
    const assignedTrainers = Array.from(trainerMap.values());

    return NextResponse.json({
      ...updated,
      assignedTrainers,
      trainerIds: assignedTrainers.map((t) => t.id),
    });
  } catch (error) {
    return safeError(error, 'Failed to update course');
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
    const action = url.searchParams.get('action'); // 'archive' or 'delete'

    // Only administrators can force delete courses
    if (force && auth.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden. Only administrators can force delete courses.' },
        { status: 403 }
      );
    }

    const course = await prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (action === 'archive') {
      await prisma.course.update({
        where: { id },
        data: { status: Status.ARCHIVED },
      });
      return NextResponse.json({
        success: true,
        message: `Course "${course.name}" has been marked as ARCHIVED.`,
        archived: true,
      });
    }

    const [enrollmentCount, billItemCount] = await Promise.all([
      prisma.enrollment.count({ where: { courseId: id } }),
      prisma.feeBillItem.count({ where: { courseId: id } }),
    ]);

    const hasHistory = enrollmentCount > 0 || billItemCount > 0;

    if (hasHistory && !force) {
      return NextResponse.json(
        {
          error: `Course "${course.name}" is associated with ${enrollmentCount} enrollment(s) and ${billItemCount} fee invoice item(s). Please choose to archive it or permanently force delete.`,
          hasHistory: true,
          enrollmentCount,
          billItemCount,
        },
        { status: 400 }
      );
    }

    // Hard delete
    await prisma.$transaction(async (tx) => {
      if (force) {
        await tx.feeBillItem.deleteMany({ where: { courseId: id } });
        await tx.enrollment.deleteMany({ where: { courseId: id } });
      }
      await tx.course.delete({ where: { id } });
    });

    return NextResponse.json({
      success: true,
      message: `Course "${course.name}" deleted successfully.`,
    });
  } catch (error) {
    return safeError(error, 'Failed to delete course');
  }
}
