import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { EnrollmentStatus } from '@prisma/client';
import { requireAuth, safeError } from '@/lib/security';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;
    const body = await request.json();
    const { status, completionDate, notes } = body;

    const updated = await prisma.enrollment.update({
      where: { id },
      data: {
        status: status as EnrollmentStatus,
        completionDate: completionDate ? new Date(completionDate) : null,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return safeError(error, 'Failed to update enrollment');
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
    await prisma.enrollment.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Enrollment deleted' });
  } catch (error) {
    return safeError(error, 'Failed to delete enrollment');
  }
}
