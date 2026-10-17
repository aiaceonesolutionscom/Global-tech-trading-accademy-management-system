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
        { fullName: { contains: search, mode: 'insensitive' } },
        { studentCode: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cnic: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status !== 'ALL') {
      where.status = status as Status;
    }

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { registrationDate: 'desc' },
        include: {
          _count: {
            select: { enrollments: true, feeBills: true },
          },
          feeBills: {
            select: { remainingAmount: true },
          },
        },
      }),
    ]);

    // Calculate total outstanding for each student
    const formattedStudents = students.map((s) => {
      const totalOutstanding = s.feeBills.reduce(
        (sum, b) => sum + Number(b.remainingAmount || 0),
        0
      );
      const { feeBills, ...rest } = s;
      return {
        ...rest,
        totalOutstanding,
      };
    });

    return NextResponse.json({
      data: formattedStudents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return safeError(error, 'Failed to fetch students');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const {
      fullName,
      guardianName,
      phone,
      email,
      cnic,
      address,
      dob,
      notes,
      status = 'ACTIVE',
    } = body;

    if (!fullName || !phone) {
      return NextResponse.json(
        { error: 'Full name and phone are required' },
        { status: 400 }
      );
    }

    // Generate unique Student Code: GT-STU-YYYY-XXXX
    const year = new Date().getFullYear();
    const count = await prisma.student.count();
    const studentCode = `GT-STU-${year}-${String(count + 1).padStart(4, '0')}`;

    const student = await prisma.student.create({
      data: {
        studentCode,
        fullName: fullName.trim(),
        guardianName: guardianName ? guardianName.trim() : null,
        phone: phone.trim(),
        email: email ? email.toLowerCase().trim() : null,
        cnic: cnic ? cnic.trim() : null,
        address: address ? address.trim() : null,
        dob: dob ? new Date(dob) : null,
        notes: notes ? notes.trim() : null,
        status: status as Status,
      },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    return safeError(error, 'Failed to create student');
  }
}
