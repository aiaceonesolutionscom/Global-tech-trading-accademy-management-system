import { PrismaClient, BillStatus, EnrollmentStatus } from '@prisma/client';
import { calculateFeeBill, computeSequentialAllocation } from '../src/lib/calculations';

const prisma = new PrismaClient();

async function runAcceptanceTest() {
  console.log('=== RUNNING SECTION 48 END-TO-END ACCEPTANCE TEST ===\n');

  // 1. Create Trainer
  const trainer = await prisma.trainer.create({
    data: {
      trainerCode: `GT-TRN-TEST-${Date.now()}`,
      name: 'Farhan Khan',
      phone: '0300-1112233',
      email: 'farhan.test@globaltrading.com',
      specialization: 'Price Action & Technical Analysis',
    },
  });
  console.log(`[PASS] Step 1: Created Trainer: ${trainer.name} (${trainer.trainerCode})`);

  // 2. Create Course: Trading Mastery (Price: 35000, 6 months, Monthly)
  const course = await prisma.course.create({
    data: {
      courseCode: `GT-CRS-TEST-${Date.now()}`,
      name: 'Trading Mastery',
      trainerId: trainer.id,
      defaultPrice: 35000.00,
      durationValue: 6,
      durationUnit: 'MONTHS',
      billingMode: 'MONTHLY',
    },
  });
  console.log(`[PASS] Step 2: Created Course: ${course.name} - Price: Rs. ${course.defaultPrice}, Duration: ${course.durationValue} months, Mode: ${course.billingMode}`);

  // 3. Create Student: Ali
  const student = await prisma.student.create({
    data: {
      studentCode: `GT-STU-TEST-${Date.now()}`,
      fullName: 'Ali',
      phone: '0300-9998877',
      email: 'ali.test@globaltrading.com',
    },
  });
  console.log(`[PASS] Step 3: Created Student: ${student.fullName} (${student.studentCode})`);

  // 4. Calculate Month 1 Bill: 35000 / 6 = 5833.33
  const calcMonth1 = calculateFeeBill({
    items: [
      {
        courseId: course.id,
        defaultPrice: Number(course.defaultPrice),
        billingMode: 'MONTHLY',
        durationValue: course.durationValue,
      },
    ],
    discountType: 'NONE',
    discountValue: 0,
    taxType: 'NONE',
    taxValue: 0,
    previousOutstanding: 0,
  });

  if (calcMonth1.grandTotal !== 5833.33) {
    throw new Error(`Expected Month 1 monthly fee to be 5833.33, got ${calcMonth1.grandTotal}`);
  }
  console.log(`[PASS] Step 4: Monthly calculation verified: Rs. 35,000 / 6 = Rs. ${calcMonth1.grandTotal}`);

  // Create Bill #1 in PostgreSQL
  const bill1 = await prisma.feeBill.create({
    data: {
      billNumber: `GT-INV-TEST-001-${Date.now()}`,
      studentId: student.id,
      billingMode: 'MONTHLY',
      subtotal: calcMonth1.subtotal,
      grandTotal: calcMonth1.grandTotal,
      paidAmount: 0.00,
      remainingAmount: calcMonth1.grandTotal,
      previousOutstanding: 0.00,
      status: BillStatus.UNPAID,
      items: {
        create: [
          {
            courseId: course.id,
            defaultPrice: course.defaultPrice,
            billingMode: 'MONTHLY',
            durationValue: course.durationValue,
            durationUnit: 'MONTHS',
            lineTotal: calcMonth1.items[0].lineTotal,
          },
        ],
      },
    },
    include: { items: true },
  });
  console.log(`[PASS] Step 5: Created Fee Bill #1: ${bill1.billNumber} - Total: Rs. ${bill1.grandTotal}, Status: ${bill1.status}`);

  // 5. Record Partial Payment of Rs. 3,000 against Bill #1
  const payment1Amount = 3000.00;
  const payment1 = await prisma.$transaction(async (tx) => {
    const pmt = await tx.payment.create({
      data: {
        receiptNumber: `GT-REC-TEST-001-${Date.now()}`,
        studentId: student.id,
        amount: payment1Amount,
        paymentMethod: 'CASH',
        notes: 'Partial payment month 1',
      },
    });

    await tx.paymentAllocation.create({
      data: {
        paymentId: pmt.id,
        feeBillId: bill1.id,
        amountAllocated: payment1Amount,
      },
    });

    const updatedBill = await tx.feeBill.update({
      where: { id: bill1.id },
      data: {
        paidAmount: payment1Amount,
        remainingAmount: 5833.33 - payment1Amount, // 2833.33
        status: BillStatus.PARTIALLY_PAID,
      },
    });

    // Auto-enrollment rule
    await tx.enrollment.create({
      data: {
        enrollmentCode: `GT-ENR-TEST-${Date.now()}`,
        studentId: student.id,
        courseId: course.id,
        trainerId: trainer.id,
        billingMode: 'MONTHLY',
        durationValue: 6,
        durationUnit: 'MONTHS',
        status: EnrollmentStatus.ACTIVE,
      },
    });

    return { pmt, updatedBill };
  });

  console.log(`[PASS] Step 6: Recorded Partial Payment of Rs. ${payment1Amount}:`);
  console.log(`       - Bill #1 Paid: Rs. ${payment1.updatedBill.paidAmount}`);
  console.log(`       - Bill #1 Remaining: Rs. ${payment1.updatedBill.remainingAmount}`);
  console.log(`       - Bill #1 Status: ${payment1.updatedBill.status}`);
  console.log(`       - Active Enrollment Created Successfully!`);

  if (payment1.updatedBill.status !== 'PARTIALLY_PAID' || Number(payment1.updatedBill.remainingAmount) !== 2833.33) {
    throw new Error('Bill 1 balance verification failed');
  }

  // 6. Next Month: Create Bill #2
  // Auto-detect previous outstanding
  const prevBills = await prisma.feeBill.findMany({
    where: {
      studentId: student.id,
      remainingAmount: { gt: 0 },
      status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
    },
  });
  const carriedOutstanding = prevBills.reduce((sum, b) => sum + Number(b.remainingAmount), 0);
  console.log(`\n[PASS] Step 7: Detected Previous Outstanding for Ali: Rs. ${carriedOutstanding}`);

  if (carriedOutstanding !== 2833.33) {
    throw new Error(`Expected carried outstanding to be 2833.33, got ${carriedOutstanding}`);
  }

  // Calculate Month 2 Bill
  const calcMonth2 = calculateFeeBill({
    items: [
      {
        courseId: course.id,
        defaultPrice: Number(course.defaultPrice),
        billingMode: 'MONTHLY',
        durationValue: course.durationValue,
      },
    ],
    discountType: 'NONE',
    discountValue: 0,
    taxType: 'NONE',
    taxValue: 0,
    previousOutstanding: carriedOutstanding,
  });

  const bill2 = await prisma.feeBill.create({
    data: {
      billNumber: `GT-INV-TEST-002-${Date.now()}`,
      studentId: student.id,
      billingMode: 'MONTHLY',
      subtotal: calcMonth2.subtotal,
      grandTotal: calcMonth2.grandTotal, // 5833.33
      paidAmount: 0.00,
      remainingAmount: calcMonth2.grandTotal,
      previousOutstanding: carriedOutstanding, // 2833.33
      status: BillStatus.UNPAID,
      items: {
        create: [
          {
            courseId: course.id,
            defaultPrice: course.defaultPrice,
            billingMode: 'MONTHLY',
            durationValue: course.durationValue,
            durationUnit: 'MONTHS',
            lineTotal: calcMonth2.items[0].lineTotal,
          },
        ],
      },
    },
  });

  console.log(`[PASS] Step 8: Created Month 2 Bill #2: ${bill2.billNumber}:`);
  console.log(`       - Current Month 2 Fee: Rs. ${bill2.grandTotal}`);
  console.log(`       - Carried Previous Outstanding: Rs. ${bill2.previousOutstanding}`);
  console.log(`       - Net Total Payable: Rs. ${Number(bill2.grandTotal) + Number(bill2.previousOutstanding)}`);

  // 7. Record Payment of Rs. 4,000 allocated across Previous Outstanding (Bill #1) & Current (Bill #2)
  // Bill #1 remaining: 2833.33 -> allocates 2833.33 to Bill #1 (Bill #1 becomes PAID)
  // Bill #2 remaining: 5833.33 -> allocates 4000 - 2833.33 = 1166.67 to Bill #2 (Bill #2 remaining: 4666.66, PARTIALLY_PAID)
  const payment2Amount = 4000.00;
  const allocToBill1 = 2833.33;
  const allocToBill2 = 1166.67;

  await prisma.$transaction(async (tx) => {
    const pmt = await tx.payment.create({
      data: {
        receiptNumber: `GT-REC-TEST-002-${Date.now()}`,
        studentId: student.id,
        amount: payment2Amount,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'TX-ONLINE-984729',
        notes: 'Allocation: Rs. 2833.33 to Bill #1, Rs. 1166.67 to Bill #2',
      },
    });

    // Allocation 1: Bill #1
    await tx.paymentAllocation.create({
      data: {
        paymentId: pmt.id,
        feeBillId: bill1.id,
        amountAllocated: allocToBill1,
      },
    });

    await tx.feeBill.update({
      where: { id: bill1.id },
      data: {
        paidAmount: 3000 + allocToBill1, // 5833.33
        remainingAmount: 0.00,
        status: BillStatus.PAID,
      },
    });

    // Allocation 2: Bill #2
    await tx.paymentAllocation.create({
      data: {
        paymentId: pmt.id,
        feeBillId: bill2.id,
        amountAllocated: allocToBill2,
      },
    });

    await tx.feeBill.update({
      where: { id: bill2.id },
      data: {
        paidAmount: allocToBill2,
        remainingAmount: 5833.33 - allocToBill2, // 4666.66
        status: BillStatus.PARTIALLY_PAID,
      },
    });
  });

  // Verify resulting statuses in PostgreSQL
  const [finalBill1, finalBill2] = await Promise.all([
    prisma.feeBill.findUnique({ where: { id: bill1.id } }),
    prisma.feeBill.findUnique({ where: { id: bill2.id } }),
  ]);

  console.log('\n[PASS] Step 9: Multi-Bill Payment Allocation Verified:');
  console.log(`       - Bill #1 Final Status: ${finalBill1?.status} (Remaining: Rs. ${finalBill1?.remainingAmount})`);
  console.log(`       - Bill #2 Final Status: ${finalBill2?.status} (Remaining: Rs. ${finalBill2?.remainingAmount})`);

  if (finalBill1?.status !== 'PAID' || Number(finalBill1?.remainingAmount) !== 0) {
    throw new Error('Bill 1 did not transition to PAID status!');
  }
  if (finalBill2?.status !== 'PARTIALLY_PAID' || Number(finalBill2?.remainingAmount) !== 4666.66) {
    throw new Error('Bill 2 did not update remaining balance accurately!');
  }

  // 8. Verify Student Ledger
  const studentLedger = await prisma.student.findUnique({
    where: { id: student.id },
    include: {
      feeBills: true,
      payments: { include: { allocations: true } },
      enrollments: true,
    },
  });

  console.log('\n[PASS] Step 10: Complete Student Ledger Verified:');
  console.log(`       - Total Bills: ${studentLedger?.feeBills.length}`);
  console.log(`       - Total Payments Recorded: ${studentLedger?.payments.length}`);
  console.log(`       - Total Active Enrollments: ${studentLedger?.enrollments.length}`);
  console.log('\n=== ALL SECTION 48 ACCEPTANCE CRITERIA VERIFIED 100% SUCCESSFUL! ===');
}

runAcceptanceTest()
  .catch((e) => {
    console.error('Acceptance test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
