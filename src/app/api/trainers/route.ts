import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Status } from '@prisma/client';
import { requireAuth, safeError } from '@/lib/security';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { trainerCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { specialization: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status !== 'ALL') {
      where.status = status as Status;
    }

    const [total, trainers] = await Promise.all([
      prisma.trainer.count({ where }),
      prisma.trainer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { courses: true, enrollments: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: trainers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return safeError(error, 'Failed to fetch trainers');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const { name, phone, email, specialization, notes, status = 'ACTIVE' } = body;

    if (!name) {
      return NextResponse.json({ error: 'Trainer name is required' }, { status: 400 });
    }

    const count = await prisma.trainer.count();
    const trainerCode = `GT-TRN-${String(count + 1).padStart(3, '0')}`;

    const trainer = await prisma.trainer.create({
      data: {
        trainerCode,
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        email: email ? email.toLowerCase().trim() : null,
        specialization: specialization ? specialization.trim() : null,
        notes: notes ? notes.trim() : null,
        status: status as Status,
      },
    });

    return NextResponse.json(trainer, { status: 201 });
  } catch (error) {
    return safeError(error, 'Failed to create trainer');
  }
}
