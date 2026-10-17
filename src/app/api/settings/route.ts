import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole, safeError } from '@/lib/security';

const DEFAULT_SETTINGS: Record<string, string> = {
  company_name: 'Global Tech International Academy',
  company_tagline: 'Global Trading, Investment & Education',
  company_division: 'Global Tech International Academy — Finance Division',
  company_greeting: 'Thank You For Your Business!',
  receipt_greeting: 'Thank You For Your Payment!',
  company_phone: '0345 3191304 | 0311 8317978 | 0314 0039852',
  company_email: 'accounts@globaltech.edu.pk',
  company_city: 'Karachi, Pakistan',
  company_website: '',
  company_address: 'B-156, Block 6, Gulshan-e-Iqbal, Karachi',
  company_tax_id: 'NTN-8947291-0',

  bank_name: 'Meezan Bank Ltd',
  bank_account_name: 'Global Tech Academy',
  bank_account_number: '0102-0105849301',
  bank_iban: 'PK45MEZN0001020105849301',

  policy_title: 'Official Instructions & Policy:',
  policy_line_1: '1. Fee deposited is non-refundable & non-transferable.',
  policy_line_2: '2. Computer-verified voucher. Valid without physical stamp.',
  policy_line_3: '3. Accounts helpdesk: accounts@globaltech.edu.pk',
  policy_lines_json: JSON.stringify([
    '1. Fee deposited is non-refundable & non-transferable.',
    '2. Computer-verified voucher. Valid without physical stamp.',
    '3. Accounts helpdesk: accounts@globaltech.edu.pk',
  ]),

  invoice_prefix: 'GT-INV-',
  receipt_prefix: 'GT-REC-',
  currency_symbol: 'Rs.',
  default_billing_mode: 'MONTHLY',
  tax_name: 'GST',
  default_tax_rate: '0',
  due_days_threshold: '5',
  auto_reminders_enabled: 'true',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let cachedSettingsMap: Record<string, string> | null = null;
let cachedRawSettings: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // 60 seconds

export async function GET() {
  try {
    if (cachedSettingsMap && Date.now() - lastFetchTime < CACHE_TTL_MS) {
      return NextResponse.json({ settings: cachedSettingsMap, raw: cachedRawSettings });
    }

    const settings = await prisma.setting.findMany();
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS };
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    cachedSettingsMap = settingsMap;
    cachedRawSettings = settings;
    lastFetchTime = Date.now();

    return NextResponse.json(
      { settings: settingsMap, raw: settings },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    return safeError(error, 'Failed to fetch settings');
  }
}

export async function PUT(request: Request) {
  try {
    // Only administrators can modify global system settings
    const auth = await requireRole(['ADMIN'], request);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json(); // { key: value, ... }

    const updates = Object.entries(body).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: {
          key,
          value: String(value),
          group: key.startsWith('company_')
            ? 'COMPANY'
            : key.startsWith('bank_')
            ? 'PAYMENT'
            : key.startsWith('policy_')
            ? 'POLICY'
            : key.startsWith('tax_')
            ? 'TAX'
            : key.startsWith('due_')
            ? 'NOTIFICATIONS'
            : 'BILLING',
        },
      })
    );

    await Promise.all(updates);

    // Invalidate in-memory cache immediately so next GET fetches fresh DB values
    cachedSettingsMap = null;
    cachedRawSettings = null;
    lastFetchTime = 0;

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    return safeError(error, 'Failed to update settings');
  }
}
