import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Status, BillingMode, DurationUnit } from '@prisma/client';
import { requireAuth, safeError } from '@/lib/security';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const trainerId = searchParams.get('trainerId') || '';
    const billingMode = searchParams.get('billingMode') || '';
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { courseCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (trainerId && trainerId !== 'ALL') {
      where.OR = [
        { trainerId },
        { trainers: { some: { trainerId } } },
      ];
    }
    if (billingMode && billingMode !== 'ALL') {
      where.billingMode = billingMode as BillingMode;
    }
    if (status && status !== 'ALL') {
      where.status = status as Status;
    }

    const [total, courses] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          trainer: {
            select: { id: true, name: true, trainerCode: true, specialization: true },
          },
          trainers: {
            include: {
              trainer: {
                select: { id: true, name: true, trainerCode: true, specialization: true },
              },
            },
          },
          _count: {
            select: { enrollments: true },
          },
        },
      }),
    ]);

    const formattedCourses = courses.map((c) => {
      const trainerMap = new Map<string, any>();
      if (c.trainer) {
        trainerMap.set(c.trainer.id, c.trainer);
      }
      if (Array.isArray(c.trainers)) {
        c.trainers.forEach((ct: any) => {
          if (ct.trainer) {
            trainerMap.set(ct.trainer.id, ct.trainer);
          }
        });
      }
      const assignedTrainers = Array.from(trainerMap.values());
      const trainerIds = assignedTrainers.map((t) => t.id);

      return {
        ...c,
        defaultPrice: Number(c.defaultPrice),
        assignedTrainers,
        trainerIds,
      };
    });

    return NextResponse.json({
      data: formattedCourses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return safeError(error, 'Failed to fetch courses');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const {
      name,
      description,
      trainerId,
      trainerIds,
      defaultPrice,
      durationValue = 1,
      durationUnit = 'MONTHS',
      billingMode = 'ONE_TIME',
      notes,
      status = 'ACTIVE',
    } = body;

    if (!name || defaultPrice === undefined || defaultPrice === null) {
      return NextResponse.json(
        { error: 'Course name and default price are required' },
        { status: 400 }
      );
    }

    let assignedIds: string[] = [];
    if (Array.isArray(trainerIds)) {
      assignedIds = trainerIds.filter(Boolean);
    } else if (trainerId) {
      assignedIds = [trainerId];
    }
    assignedIds = Array.from(new Set(assignedIds));
    const primaryTrainerId = assignedIds[0] || null;

    const count = await prisma.course.count();
    const courseCode = `GT-CRS-${String(count + 1).padStart(3, '0')}`;

    const course = await prisma.course.create({
      data: {
        courseCode,
        name: name.trim(),
        description: description ? description.trim() : null,
        trainerId: primaryTrainerId,
        defaultPrice: parseFloat(defaultPrice),
        durationValue: parseInt(durationValue) || 1,
        durationUnit: durationUnit as DurationUnit,
        billingMode: billingMode as BillingMode,
        notes: notes ? notes.trim() : null,
        status: status as Status,
        trainers: {
          create: assignedIds.map((tid) => ({
            trainerId: tid,
          })),
        },
      },
      include: {
        trainer: true,
        trainers: {
          include: { trainer: true },
        },
      },
    });

    const trainerMap = new Map<string, any>();
    if (course.trainer) trainerMap.set(course.trainer.id, course.trainer);
    if (Array.isArray(course.trainers)) {
      course.trainers.forEach((ct: any) => {
        if (ct.trainer) trainerMap.set(ct.trainer.id, ct.trainer);
      });
    }
    const assignedTrainers = Array.from(trainerMap.values());

    return NextResponse.json(
      {
        ...course,
        assignedTrainers,
        trainerIds: assignedTrainers.map((t) => t.id),
      },
      { status: 201 }
    );
  } catch (error) {
    return safeError(error, 'Failed to create course');
  }
}
