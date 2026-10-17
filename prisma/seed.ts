import { PrismaClient, Role, Status, BillingMode, DurationUnit, DiscountType, TaxType, BillStatus, EnrollmentStatus, PaymentMethod } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Settings
  const defaultSettings = [
    { key: 'company_name', value: 'Global Tech International Academy', group: 'COMPANY' },
    { key: 'company_name_main', value: 'GLOBAL TECH', group: 'COMPANY' },
    { key: 'company_name_sub', value: 'INTERNATIONAL ACADEMY', group: 'COMPANY' },
    { key: 'company_tagline', value: 'Global Trading, Investment & Education', group: 'COMPANY' },
    { key: 'company_division', value: 'Global Tech International Academy — Finance Division', group: 'COMPANY' },
    { key: 'company_greeting', value: 'Thank You For Your Business!', group: 'COMPANY' },
    { key: 'receipt_greeting', value: 'Thank You For Your Payment!', group: 'COMPANY' },
    { key: 'company_phone', value: '0345 3191304 | 0311 8317978 | 0314 0039852', group: 'COMPANY' },
    { key: 'company_email', value: 'accounts@globaltech.edu.pk', group: 'COMPANY' },
    { key: 'company_city', value: 'Karachi, Pakistan', group: 'COMPANY' },
    { key: 'company_website', value: 'www.globaltech.edu.pk', group: 'COMPANY' },
    { key: 'company_address', value: 'B-156, Block 6, Gulshan-e-Iqbal, Karachi', group: 'COMPANY' },
    { key: 'company_tax_id', value: 'NTN-8947291-0', group: 'COMPANY' },
    { key: 'bank_name', value: 'Meezan Bank Ltd', group: 'PAYMENT' },
    { key: 'bank_account_name', value: 'Global Tech Academy', group: 'PAYMENT' },
    { key: 'bank_account_number', value: '0102-0105849301', group: 'PAYMENT' },
    { key: 'bank_iban', value: 'PK45MEZN0001020105849301', group: 'PAYMENT' },
    { key: 'policy_title', value: 'Official Instructions & Policy:', group: 'POLICY' },
    { key: 'policy_line_1', value: '1. Fee deposited is non-refundable & non-transferable.', group: 'POLICY' },
    { key: 'policy_line_2', value: '2. Computer-verified voucher. Valid without physical stamp.', group: 'POLICY' },
    { key: 'policy_line_3', value: '3. Accounts helpdesk: accounts@globaltech.edu.pk', group: 'POLICY' },
    { key: 'invoice_prefix', value: 'GT-INV-', group: 'BILLING' },
    { key: 'receipt_prefix', value: 'GT-REC-', group: 'BILLING' },
    { key: 'currency_symbol', value: 'Rs.', group: 'BILLING' },
    { key: 'default_billing_mode', value: 'MONTHLY', group: 'BILLING' },
    { key: 'duration_options', value: JSON.stringify([1, 2, 3, 4, 6, 12]), group: 'BILLING' },
    { key: 'tax_name', value: 'GST', group: 'TAX' },
    { key: 'default_tax_rate', value: '0', group: 'TAX' },
    { key: 'tax_enabled', value: 'true', group: 'TAX' },
    { key: 'due_days_threshold', value: '5', group: 'NOTIFICATIONS' },
    { key: 'auto_reminders_enabled', value: 'true', group: 'NOTIFICATIONS' },
  ];

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value, group: s.group },
      create: s,
    });
  }

  // 2. Admin User
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@globaltrading.com' },
    update: {},
    create: {
      name: 'Super Administrator',
      email: 'admin@globaltrading.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });
  console.log('Admin user initialized:', admin.email);

  // 3. Trainers
  const trainer1 = await prisma.trainer.upsert({
    where: { trainerCode: 'GT-TRN-001' },
    update: {},
    create: {
      trainerCode: 'GT-TRN-001',
      name: 'Farhan Khan',
      phone: '+92 312 9876543',
      email: 'farhan@globaltrading.com',
      specialization: 'Price Action & Technical Analysis',
      status: Status.ACTIVE,
      notes: 'Lead instructor with 8+ years experience in Forex & Commodities.',
    },
  });

  const trainer2 = await prisma.trainer.upsert({
    where: { trainerCode: 'GT-TRN-002' },
    update: {},
    create: {
      trainerCode: 'GT-TRN-002',
      name: 'Ayesha Malik',
      phone: '+92 321 4567890',
      email: 'ayesha@globaltrading.com',
      specialization: 'Crypto Derivatives & Algorithmic Trading',
      status: Status.ACTIVE,
      notes: 'Specialist in quantitative models and crypto risk mitigation.',
    },
  });

  const trainer3 = await prisma.trainer.upsert({
    where: { trainerCode: 'GT-TRN-003' },
    update: {},
    create: {
      trainerCode: 'GT-TRN-003',
      name: 'Tariq Mehmood',
      phone: '+92 333 5551234',
      email: 'tariq@globaltrading.com',
      specialization: 'Equities & Portfolio Valuation',
      status: Status.ACTIVE,
      notes: 'Senior equities advisor and portfolio manager.',
    },
  });

  // 4. Courses
  const course1 = await prisma.course.upsert({
    where: { courseCode: 'GT-CRS-001' },
    update: {},
    create: {
      courseCode: 'GT-CRS-001',
      name: 'Trading Mastery',
      description: 'Comprehensive 6-month masterclass covering price action, liquidity concepts, risk engineering, and live prop desk sessions.',
      trainerId: trainer1.id,
      defaultPrice: 35000.00,
      durationValue: 6,
      durationUnit: DurationUnit.MONTHS,
      billingMode: BillingMode.MONTHLY,
      status: Status.ACTIVE,
    },
  });

  const course2 = await prisma.course.upsert({
    where: { courseCode: 'GT-CRS-002' },
    update: {},
    create: {
      courseCode: 'GT-CRS-002',
      name: 'Advanced Forex & Scalping',
      description: 'Hands-on intraday execution strategies on major currency pairs.',
      trainerId: trainer1.id,
      defaultPrice: 24000.00,
      durationValue: 3,
      durationUnit: DurationUnit.MONTHS,
      billingMode: BillingMode.MONTHLY,
      status: Status.ACTIVE,
    },
  });

  const course3 = await prisma.course.upsert({
    where: { courseCode: 'GT-CRS-003' },
    update: {},
    create: {
      courseCode: 'GT-CRS-003',
      name: 'Crypto Derivatives & DeFi',
      description: 'Perpetuals trading, funding rate arbitrage, and on-chain intelligence.',
      trainerId: trainer2.id,
      defaultPrice: 18000.00,
      durationValue: 2,
      durationUnit: DurationUnit.MONTHS,
      billingMode: BillingMode.MONTHLY,
      status: Status.ACTIVE,
    },
  });

  const course4 = await prisma.course.upsert({
    where: { courseCode: 'GT-CRS-004' },
    update: {},
    create: {
      courseCode: 'GT-CRS-004',
      name: 'Stock Market & Valuation',
      description: 'Intensive equity valuation, corporate earnings analysis, and portfolio construction.',
      trainerId: trainer3.id,
      defaultPrice: 15000.00,
      durationValue: 1,
      durationUnit: DurationUnit.MONTHS,
      billingMode: BillingMode.ONE_TIME,
      status: Status.ACTIVE,
    },
  });

  // 5. Students
  const student1 = await prisma.student.upsert({
    where: { studentCode: 'GT-STU-2026-0001' },
    update: {},
    create: {
      studentCode: 'GT-STU-2026-0001',
      fullName: 'Ali Raza',
      guardianName: 'Muhammad Raza',
      phone: '+92 300 7891234',
      email: 'ali.raza@example.com',
      cnic: '35201-1234567-1',
      address: 'House 14, Block B, Model Town, Lahore',
      status: Status.ACTIVE,
      notes: 'Interested in becoming a funded prop trader.',
    },
  });

  const student2 = await prisma.student.upsert({
    where: { studentCode: 'GT-STU-2026-0002' },
    update: {},
    create: {
      studentCode: 'GT-STU-2026-0002',
      fullName: 'Bilal Ahmed',
      guardianName: 'Ahmed Din',
      phone: '+92 321 6549870',
      email: 'bilal.ahmed@example.com',
      cnic: '35202-7654321-3',
      address: 'Apartment 4B, Gulberg Heights, Lahore',
      status: Status.ACTIVE,
      notes: 'Evening batch preferred.',
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
