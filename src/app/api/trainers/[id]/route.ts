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
    const trainer = await prisma.trainer.findUnique({
      where: { id },
      include: {
        courses: { include: { _count: { select: { enrollments: true } } } },
        enrollments: { include: { student: true, course: true } },
      },
    });

    if (!trainer) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }

    return NextResponse.json(trainer);
  } catch (error) {
    return safeError(error, 'Failed to fetch trainer');
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

    const updated = await prisma.trainer.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        phone: body.phone ? body.phone.trim() : null,
        email: body.email ? body.email.toLowerCase().trim() : null,
        specialization: body.specialization ? body.specialization.trim() : null,
        notes: body.notes ? body.notes.trim() : null,
        status: body.status as Status,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return safeError(error, 'Failed to update trainer');
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
    const action = url.searchParams.get('action'); // 'deactivate' or 'delete'

    // Only administrators can force delete trainers
    if (force && auth.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden. Only administrators can force delete trainers.' },
        { status: 403 }
      );
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id },
    });

    if (!trainer) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }

    if (action === 'deactivate') {
      await prisma.trainer.update({
        where: { id },
        data: { status: Status.INACTIVE },
      });
      return NextResponse.json({
        success: true,
        message: `Trainer "${trainer.name}" has been marked as INACTIVE.`,
        deactivated: true,
      });
    }

    // Check if courses are assigned
    const courseCount = await prisma.course.count({ where: { trainerId: id } });

    if (courseCount > 0 && !force) {
      return NextResponse.json(
        {
          error: `Trainer "${trainer.name}" is assigned to ${courseCount} course(s). Please choose to deactivate or force delete.`,
          hasCourses: true,
          courseCount,
        },
        { status: 400 }
      );
    }

    // Hard delete
    await prisma.$transaction(async (tx) => {
      // Unassign courses
      await tx.course.updateMany({
        where: { trainerId: id },
        data: { trainerId: null },
      });
      // Unassign enrollments
      await tx.enrollment.updateMany({
        where: { trainerId: id },
        data: { trainerId: null },
      });
      // Delete trainer
      await tx.trainer.delete({ where: { id } });
    });

    return NextResponse.json({
      success: true,
      message: `Trainer "${trainer.name}" deleted successfully.`,
    });
  } catch (error) {
    return safeError(error, 'Failed to delete trainer');
  }
}
