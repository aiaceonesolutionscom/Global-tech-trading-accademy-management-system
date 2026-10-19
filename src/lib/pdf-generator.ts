import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from './utils';

export interface PoppinsFontsData {
  regular?: string | null;
  bold?: string | null;
}

export interface FeeBillPDFData {
  billNumber: string;
  billDate: string | Date;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  dueDate?: string | Date | null;
  billingMode: string;
  notes?: string | null;
  includePaymentHistory?: boolean;
  student: {
    studentCode: string;
    fullName: string;
    guardianName?: string | null;
    phone: string;
    email?: string | null;
    address?: string | null;
  };
  items: Array<{
    course: { name: string; courseCode?: string };
    defaultPrice: number;
    overridePrice?: number | null;
    billingMode: string;
    durationValue: number;
    durationUnit: string;
    lineTotal: number;
  }>;
  subtotal: number;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  taxName?: string | null;
  taxType: string;
  taxValue: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
  previousOutstanding: number;
  status: string;
  allocations?: Array<{
    payment: {
      receiptNumber: string;
      paymentDate: string | Date;
      paymentMethod: string;
      amount?: number;
      siblingAllocations?: Array<{
        feeBillId: string;
        billNumber: string;
        amountAllocated: number;
        remainingAmount?: number;
        status?: string;
      }>;
    };
    amountAllocated: number;
  }>;
  includePreviousHistory?: boolean;
  previousBills?: any[];
}

export interface PaymentReceiptPDFData {
  receiptNumber: string;
  paymentDate: string | Date;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string | null;
  notes?: string | null;
  student: {
    studentCode: string;
    fullName: string;
    phone: string;
    email?: string | null;
    address?: string | null;
  };
  allocations: Array<{
    feeBill: { billNumber: string; grandTotal: number; status: string };
    amountAllocated: number;
  }>;
  totalRemainingBalance?: number;
}

let cachedPoppins: PoppinsFontsData | null = null;

/**
 * Loads Poppins font binaries from public/fonts on demand in the browser.
 * Caches in memory so subsequent generations are instant.
 */
export async function loadPoppinsFonts(): Promise<PoppinsFontsData | null> {
  if (typeof window === 'undefined') return null;
  if (cachedPoppins) return cachedPoppins;

  try {
    const toBase64 = (blob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = (reader.result as string) || '';
          const b64 = res.includes(',') ? res.split(',')[1] : res;
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

    const [regRes, boldRes] = await Promise.all([
      fetch('/fonts/Poppins-Regular.ttf'),
      fetch('/fonts/Poppins-Bold.ttf'),
    ]);

    if (!regRes.ok || !boldRes.ok) return null;

    const [regBlob, boldBlob] = await Promise.all([regRes.blob(), boldRes.blob()]);
    const [regB64, boldB64] = await Promise.all([toBase64(regBlob), toBase64(boldBlob)]);

    cachedPoppins = { regular: regB64, bold: boldB64 };
    return cachedPoppins;
  } catch (err) {
    console.warn('Could not load Poppins fonts:', err);
    return null;
  }
}

/**
 * Registers Poppins fonts into jsPDF if available.
 */
function applyPoppinsFonts(doc: jsPDF, poppins?: PoppinsFontsData | null): string {
  if (poppins?.regular && poppins?.bold) {
    try {
      doc.addFileToVFS('Poppins-Regular.ttf', poppins.regular);
      doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal');

      doc.addFileToVFS('Poppins-Bold.ttf', poppins.bold);
      doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold');
      return 'Poppins';
    } catch {
      return 'helvetica';
    }
  }
  return 'helvetica';
}

/**
 * Safely renders a key-value row inside a metadata column.
 * Dynamically scales down font size for long values to prevent overlap.
 */
function renderMetaRow(
  doc: jsPDF,
  label: string,
  value: string,
  startX: number,
  endX: number,
  y: number,
  valueColor: [number, number, number] = [0, 27, 72],
  fontName: string = 'Poppins'
) {
  doc.setFont(fontName, 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(label, startX, y);

  const labelWidth = doc.getTextWidth(label);
  const safeGap = 3.5; // mm
  const maxValWidth = Math.max(16, endX - (startX + labelWidth + safeGap));

  doc.setFont(fontName, 'bold');
  let currentFontSize = 6.8;
  doc.setFontSize(currentFontSize);
  while (doc.getTextWidth(value) > maxValWidth && currentFontSize > 4.2) {
    currentFontSize -= 0.2;
    doc.setFontSize(currentFontSize);
  }

  doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
  doc.text(value, endX, y, { align: 'right' });
}

/**
 * Renders the pre-footer official instructions, verification policy, and academy branding.
 * Dynamically adapts between:
 *  - Mode A: Full Executive Card (when available height >= 16mm)
 *  - Mode B: 2-Row Structured Layout (when available height >= 9mm)
 *  - Mode C: Single Centered Line (when available height < 9mm)
 * GUARANTEES zero text overlap / collision regardless of content height.
 */
function renderPreFooterBlock(
  doc: jsPDF,
  pw: number,
  margin: number,
  contentEndY: number,
  fontName: string,
  kind: 'INVOICE' | 'RECEIPT' | 'STATEMENT' = 'INVOICE',
  settings?: Record<string, string> | null
): void {
  const bottomLimit = 204.0; // Clean 6mm margin from bottom of A5 (210mm) with footer removed
  const availableSpace = bottomLimit - contentEndY;

  if (availableSpace < 4) {
    return;
  }

  const primaryAccent: [number, number, number] =
    kind === 'RECEIPT' ? [5, 150, 105] : [0, 102, 255]; // Emerald for Receipt, Blue for Invoice

  if (availableSpace >= 14) {
    // ----------------------------------------------------
    // Mode A: Full Executive Card (Spacious, 2 Columns with Divider)
    // ----------------------------------------------------
    const cardH = Math.min(22, Math.max(14, availableSpace - 2.5));
    const cardY = bottomLimit - cardH - 1.5;

    // Card Background & Border
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, cardY, pw - margin * 2, cardH, 2, 2, 'FD');

    // Middle Vertical Divider Line
    const midX = pw / 2 + 5; // ~79mm
    doc.setDrawColor(226, 232, 240);
    doc.line(midX, cardY + 2.2, midX, cardY + cardH - 2.2);

    // Left Column: Policy & Instructions (bounded strictly by midX - 3)
    const leftX = margin + 3.5;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(0, 27, 72);
    const leftTitle =
      kind === 'RECEIPT'
        ? 'Payment Acknowledgement & Notes:'
        : kind === 'STATEMENT'
        ? 'Ledger Verification & Terms:'
        : (settings?.policy_title || 'Official Instructions & Policy:');
    doc.text(leftTitle, leftX, cardY + 4.4);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(4.7);
    doc.setTextColor(100, 116, 139);

    if (kind === 'RECEIPT') {
      doc.text('1. Payment confirmed & credited towards specified bill.', leftX, cardY + 7.8);
      doc.text('2. Please retain this receipt for fee ledger reconciliation.', leftX, cardY + 11.0);
      doc.text('3. Official computer-generated receipt issued by Finance Dept.', leftX, cardY + 14.2);
      if (cardH >= 19 && settings?.company_tax_id) {
        doc.setFontSize(4.4);
        doc.text(`Tax Reg / NTN: ${settings.company_tax_id}`, leftX, cardY + 17.4);
      }
    } else if (kind === 'STATEMENT') {
      doc.text('1. All payment receipts listed are verified in academy accounts.', leftX, cardY + 7.8);
      doc.text('2. Keep this comprehensive statement for your financial records.', leftX, cardY + 11.0);
      const email = settings?.company_email?.trim();
      doc.text(
        email ? `3. For queries: ${email}` : '3. Official computer-generated statement issued by Finance Dept.',
        leftX,
        cardY + 14.2
      );
      if (cardH >= 19 && settings?.company_tax_id?.trim()) {
        doc.setFontSize(4.4);
        doc.text(`Tax Reg / NTN: ${settings.company_tax_id.trim()}`, leftX, cardY + 17.4);
      }
    } else {
      const getPolicyLines = (s?: any): string[] => {
        if (s?.policy_lines_json) {
          try {
            const parsed = JSON.parse(s.policy_lines_json);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const valid = parsed.filter((l: any) => typeof l === 'string' && l.trim() !== '');
              if (valid.length > 0) return valid;
            }
          } catch {}
        }
        const legacy = [s?.policy_line_1, s?.policy_line_2, s?.policy_line_3].filter(
          (l: any) => typeof l === 'string' && l.trim() !== ''
        );
        if (legacy.length > 0) return legacy;
        const email = s?.company_email?.trim();
        return [
          '1. Fee deposited is non-refundable & non-transferable.',
          '2. Computer-verified voucher. Valid without physical stamp.',
          email ? `3. Accounts helpdesk: ${email}` : '3. Official computerized voucher.',
        ];
      };

      const policyLines = getPolicyLines(settings);
      const hasTaxId = Boolean(settings?.company_tax_id?.trim());
      const totalLeftLines = policyLines.length + (cardH >= 18 && hasTaxId ? 1 : 0);
      const step =
        totalLeftLines <= 3
          ? 3.2
          : Math.min(3.2, Math.max(2.1, (cardH - 6.5) / totalLeftLines));
      const dynamicFontSize = totalLeftLines <= 3 ? 4.7 : Math.max(3.8, 4.7 - (totalLeftLines - 3) * 0.25);
      doc.setFontSize(dynamicFontSize);

      policyLines.forEach((pLine, idx) => {
        const lineY = cardY + 7.5 + idx * step;
        if (lineY <= cardY + cardH - 1.5) {
          doc.text(pLine, leftX, lineY);
        }
      });

      if (cardH >= 18 && hasTaxId) {
        const taxY = cardY + 7.5 + policyLines.length * step;
        if (taxY <= cardY + cardH - 1.2) {
          doc.setFontSize(Math.min(dynamicFontSize, 4.4));
          doc.text(`Tax Reg / NTN: ${settings!.company_tax_id.trim()}`, leftX, taxY);
        }
      }
    }

    // Right Column: Academy Branding (right-aligned, dynamically distributed without gaps)
    const rightX = pw - margin - 3.5;

    interface RightColumnItem {
      text: string;
      fontStyle: 'bold' | 'normal';
      fontSize: number;
      textColor: [number, number, number];
    }

    const rightItems: RightColumnItem[] = [];

    // 1. Right Greeting (Always present)
    const rightGreeting =
      kind === 'RECEIPT'
        ? (settings?.receipt_greeting?.trim() || 'Thank You For Your Payment!')
        : (settings?.company_greeting?.trim() || 'Thank You For Your Business!');
    rightItems.push({
      text: rightGreeting,
      fontStyle: 'bold',
      fontSize: 7.6,
      textColor: primaryAccent,
    });

    // 2. Division / Subtitle (Only if non-empty)
    const divisionText = settings?.company_division?.trim();
    if (divisionText) {
      rightItems.push({
        text: divisionText,
        fontStyle: 'normal',
        fontSize: 5.0,
        textColor: [71, 85, 105],
      });
    }

    // 3. Contact Helpdesk Phone & City (Only if at least one is present)
    const phone = settings?.company_phone?.trim();
    const city = settings?.company_city?.trim();
    let contactText = '';
    if (phone && city) {
      contactText = `${phone}  •  ${city}`;
    } else if (phone) {
      contactText = phone;
    } else if (city) {
      contactText = city;
    }
    if (contactText) {
      const dynamicPhoneFont = contactText.length > 50 ? 3.7 : contactText.length > 35 ? 4.1 : 4.6;
      rightItems.push({
        text: contactText,
        fontStyle: 'normal',
        fontSize: dynamicPhoneFont,
        textColor: [100, 116, 139],
      });
    }

    // 4. Official Website URL (ONLY IF NON-EMPTY, never use hardcoded dummy URL)
    const website = settings?.company_website?.trim();
    if (website) {
      rightItems.push({
        text: website,
        fontStyle: 'bold',
        fontSize: 5.0,
        textColor: [0, 27, 72],
      });
    }

    // 5. Campus / Head Office Address (ONLY IF NON-EMPTY)
    const address = settings?.company_address?.trim();
    if (address && cardH >= 17) {
      const dynamicAddressFont = address.length > 45 ? 3.8 : 4.3;
      rightItems.push({
        text: address.length > 75 ? address.slice(0, 72) + '...' : address,
        fontStyle: 'normal',
        fontSize: dynamicAddressFont,
        textColor: [148, 163, 184],
      });
    }

    // Dynamically distribute right column items vertically inside cardH
    const totalRightItems = rightItems.length;
    if (totalRightItems === 1) {
      const itm = rightItems[0];
      doc.setFont(fontName, itm.fontStyle);
      doc.setFontSize(itm.fontSize);
      doc.setTextColor(itm.textColor[0], itm.textColor[1], itm.textColor[2]);
      doc.text(itm.text, rightX, cardY + cardH / 2 + 1.5, { align: 'right' });
    } else if (totalRightItems > 1) {
      const topPadding = 4.4;
      const bottomPadding = 2.4;
      const availableH = cardH - topPadding - bottomPadding;
      const naturalStep = availableH / (totalRightItems - 1);
      const step = Math.min(4.2, Math.max(2.6, naturalStep));
      const usedH = (totalRightItems - 1) * step;
      const startY = cardY + topPadding + (availableH - usedH) / 2;

      rightItems.forEach((itm, idx) => {
        const itemY = startY + idx * step;
        doc.setFont(fontName, itm.fontStyle);
        doc.setFontSize(itm.fontSize);
        doc.setTextColor(itm.textColor[0], itm.textColor[1], itm.textColor[2]);
        doc.text(itm.text, rightX, itemY, { align: 'right' });
      });
    }
  } else if (availableSpace >= 9) {
    // ----------------------------------------------------
    // Mode B: 2-Row Structured Layout (Guaranteed non-overlapping rows)
    // ----------------------------------------------------
    const sepY = contentEndY + 2.0;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, sepY, pw - margin, sepY);

    // Row 1
    const row1Y = sepY + 3.8;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(5.0);
    doc.setTextColor(100, 116, 139);
    const getFirstPolicyLine = (s?: any): string => {
      if (s?.policy_lines_json) {
        try {
          const parsed = JSON.parse(s.policy_lines_json);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.trim()) return parsed[0].trim();
        } catch {}
      }
      return s?.policy_line_1?.trim() || 'Fee once paid is non-refundable & non-transferable.';
    };
    const row1Left =
      kind === 'RECEIPT'
        ? 'Note: Payment acknowledged & verified in ledger.'
        : `Note: ${getFirstPolicyLine(settings)}`;
    doc.text(row1Left, margin, row1Y);

    doc.setFont(fontName, 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(primaryAccent[0], primaryAccent[1], primaryAccent[2]);
    const row1Right =
      kind === 'RECEIPT'
        ? (settings?.receipt_greeting?.trim() || 'Thank You For Your Payment!')
        : (settings?.company_greeting?.trim() || 'Thank You For Your Business!');
    doc.text(row1Right, pw - margin, row1Y, { align: 'right' });

    // Row 2
    const row2Y = sepY + 7.4;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(4.6);
    doc.setTextColor(148, 163, 184); // Slate-400
    const row2Phone = settings?.company_phone?.trim();
    const row2Left = row2Phone
      ? `Computer-generated official voucher  •  Helpdesk: ${row2Phone}`
      : 'Computer-generated official voucher';
    doc.text(row2Left, margin, row2Y);

    const row2Web = settings?.company_website?.trim();
    if (row2Web) {
      doc.setFont(fontName, 'bold');
      doc.setFontSize(5.2);
      doc.setTextColor(0, 27, 72);
      doc.text(row2Web, pw - margin, row2Y, { align: 'right' });
    }
  } else {
    // ----------------------------------------------------
    // Mode C: Single Centered Line (Minimal Space, Zero Collision)
    // ----------------------------------------------------
    const sepY = contentEndY + 1.2;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, sepY, pw - margin, sepY);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(4.8);
    doc.setTextColor(100, 116, 139);
    const parts = ['Official System-Verified Document'];
    const phone = settings?.company_phone?.trim();
    const web = settings?.company_website?.trim();
    if (phone) parts.push(`Helpdesk: ${phone}`);
    if (web) parts.push(web);

    doc.text(
      parts.join('  •  '),
      pw / 2,
      sepY + 3.4,
      { align: 'center' }
    );
  }
}

/**
 * Draws the top branded arched wave header on a given page.
 */
function drawTopHeader(
  doc: jsPDF,
  pw: number,
  ph: number,
  margin: number,
  logoDataUrl?: string | null,
  titleText: string = 'INVOICE',
  fontName: string = 'Poppins',
  settings?: Record<string, string> | null
) {
  // Top Vibrant Blue Header Layer (#0066FF)
  doc.setFillColor(0, 102, 255);
  doc.rect(0, 0, pw, 18, 'F');

  // Smooth White Arch Cutting Into the Blue
  doc.setFillColor(255, 255, 255);
  doc.moveTo(0, 16);
  doc.curveTo(pw * 0.25, 4, pw * 0.75, 4, pw, 16);
  doc.lineTo(pw, ph);
  doc.lineTo(0, ph);
  doc.lineTo(0, 16);
  doc.fill();

  // Dark Navy Curved Contour Line (#001B48)
  doc.setDrawColor(0, 27, 72);
  doc.setLineWidth(1.4);
  doc.moveTo(0, 16);
  doc.curveTo(pw * 0.25, 4, pw * 0.75, 4, pw, 16);
  doc.stroke();

  // =========================================================================
  // 🌟 PDF LOGO CONTROLS (Yahan se millimeters mein direct adjust karein) 🌟
  // =========================================================================
  // 👉 1. LOGO KA SIZE (Width & Height in mm - number barhane se logo bara hoga):
  const PDF_LOGO_SIZE_MM = 26; // 👈 Bada size (e.g. 24, 26, 28, 30, 32)

  // 👉 2. UPAR / NEECHAY (Y position in mm - number barhane se neechay, kam karne se upar):
  const PDF_LOGO_Y_MM = 10.5; // 👈 Upar / Neechay (e.g. 8, 10.5, 12, 14)

  // 👉 3. LEFT / RIGHT (X position in mm - number barhane se right, kam karne se left):
  const PDF_LOGO_X_MM = margin; // 👈 Left / Right (e.g. margin, margin + 5, margin + 10)

  let logoDrawn = false;
  if (logoDataUrl) {
    try {
      doc.addImage(
        logoDataUrl,
        'PNG',
        PDF_LOGO_X_MM,
        PDF_LOGO_Y_MM,
        PDF_LOGO_SIZE_MM,
        PDF_LOGO_SIZE_MM
      );
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }

  if (!logoDrawn) {
    doc.setTextColor(0, 27, 72); // Navy
    doc.setFont(fontName, 'bold');
    doc.setFontSize(13);
    doc.text((settings?.company_name_main || 'GLOBAL TECH').toUpperCase(), margin, 24);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text((settings?.company_name_sub || 'INTERNATIONAL ACADEMY').toUpperCase(), margin, 28);
  }

  // Top Right Title
  doc.setFont(fontName, 'bold');
  doc.setFontSize(titleText.length > 12 ? 16 : 22);
  doc.setTextColor(0, 102, 255); // Electric Blue #0066FF
  doc.text(titleText, pw - margin, 27, { align: 'right' });
}

/**
 * Generates an executive, designer-quality Global Tech Fee Bill in standard A5 size (148mm x 210mm)
 * styled with the official Poppins font family, zero text overlap, and a luxury multi-tone footer.
 */
export function generateFeeBillPDF(
  data: FeeBillPDFData,
  logoDataUrl?: string | null,
  poppinsFonts?: PoppinsFontsData | null,
  settings?: Record<string, string> | null
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5', // Standard A5: 148mm x 210mm
  });

  const fontName = applyPoppinsFonts(doc, poppinsFonts);

  const pw = 148;
  const ph = 210;
  const margin = 10;

  // ----------------------------------------------------
  // 1. Top Decorative Curved Wave & Header
  // ----------------------------------------------------
  drawTopHeader(doc, pw, ph, margin, logoDataUrl, 'INVOICE', fontName, settings);

  // ----------------------------------------------------
  // 2. Client Greeting & Invoice Meta Block (No Overlap)
  // ----------------------------------------------------
  const infoY = 37;
  const student = data.student || (data as any);
  const studentName = student?.fullName || (data as any).student_name || 'Valued Student';
  const studentCode = student?.studentCode || (data as any).student_code || 'N/A';
  const guardianName = student?.guardianName || (data as any).guardian_name || null;
  const phone = student?.phone || (data as any).phone || '+92 300 0000000';
  const email = student?.email || (data as any).email || null;

  const billNumber = data.billNumber || (data as any).bill_number || 'FB-0000';
  const billDate = data.billDate || (data as any).bill_date || (data as any).issue_date || new Date();
  const dueDate = data.dueDate || (data as any).due_date || null;
  const billingMode = (data.billingMode || (data as any).billing_mode || 'STANDARD').replace('_', ' ');

  // Left Side: "Dear [Student Name]" (dynamically scaled for safety)
  doc.setFont(fontName, 'bold');
  let studentNameFontSize = 10;
  doc.setFontSize(studentNameFontSize);
  const maxStudentNameWidth = pw - 72;
  while (doc.getTextWidth(`Dear ${studentName}`) > maxStudentNameWidth && studentNameFontSize > 7) {
    studentNameFontSize -= 0.5;
    doc.setFontSize(studentNameFontSize);
  }
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`Dear ${studentName}`, margin, infoY);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Student ID: ${studentCode}`, margin, infoY + 4.2);

  if (guardianName) {
    doc.text(`Guardian: ${guardianName}`, margin, infoY + 8.4);
    doc.text(`Phone: ${phone}`, margin, infoY + 12.6);
    if (email) {
      doc.text(`Email: ${email}`, margin, infoY + 16.8);
    }
  } else {
    doc.text(`Phone: ${phone}`, margin, infoY + 8.4);
    if (email) {
      doc.text(`Email: ${email}`, margin, infoY + 12.6);
    }
    if (student?.address) {
      doc.text(`Address: ${student.address.slice(0, 36)}`, margin, infoY + 16.8);
    } else if (data.startDate && data.endDate) {
      doc.setFont(fontName, 'bold');
      doc.setTextColor(0, 102, 255);
      doc.text(`Period: ${formatDate(data.startDate)} – ${formatDate(data.endDate)}`, margin, infoY + 16.8);
    }
  }

  // Dynamic Billing Period Calculation
  const isOneTime = (data.billingMode || '').toUpperCase() === 'ONE_TIME';
  const startPeriodDate = data.startDate || billDate;
  let endPeriodDate: any = data.endDate;

  if (!endPeriodDate) {
    const s = new Date(startPeriodDate);
    const e = new Date(s);
    if (isOneTime) {
      const dur = Number(data.items?.[0]?.durationValue) || 6;
      e.setMonth(e.getMonth() + dur);
      e.setDate(e.getDate() - 1);
    } else {
      e.setMonth(e.getMonth() + 1);
      e.setDate(e.getDate() - 1);
    }
    endPeriodDate = e;
  }

  const periodStr = `${formatDate(startPeriodDate)} – ${formatDate(endPeriodDate)}`;

  // Right Side: Safe Metadata Rows with Dynamic Font Sizing
  const metaStartX = pw - 66; // 82mm
  const metaEndX = pw - margin; // 138mm

  renderMetaRow(doc, 'Invoice #', billNumber, metaStartX, metaEndX, infoY, [0, 27, 72], fontName);
  renderMetaRow(doc, 'Issue Date', formatDate(billDate), metaStartX, metaEndX, infoY + 3.8, [15, 23, 42], fontName);
  renderMetaRow(doc, 'Billing Period', periodStr, metaStartX, metaEndX, infoY + 7.6, [0, 102, 255], fontName);
  renderMetaRow(
    doc,
    'Due Date',
    dueDate ? formatDate(dueDate) : 'On Receipt',
    metaStartX,
    metaEndX,
    infoY + 11.4,
    [225, 29, 72],
    fontName
  );
  renderMetaRow(doc, 'Billing Mode', billingMode, metaStartX, metaEndX, infoY + 15.2, [0, 102, 255], fontName);

  const rawStatus = (data.status || 'UNPAID').toUpperCase();
  const statusColor: [number, number, number] =
    rawStatus === 'PAID'
      ? [5, 150, 105] // Emerald
      : rawStatus === 'PARTIAL' || rawStatus === 'PARTIALLY_PAID'
      ? [217, 119, 6] // Amber
      : [225, 29, 72]; // Rose

  renderMetaRow(doc, 'Status', rawStatus.replace('_', ' '), metaStartX, metaEndX, infoY + 19.0, statusColor, fontName);

  // Subtle separator line before table
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.3);
  doc.line(margin, 57, pw - margin, 57);

  // ----------------------------------------------------
  // 3. Line Items Table
  // ----------------------------------------------------
  const tableStartY = 60;

  const rawItems =
    data.items && data.items.length > 0
      ? data.items
      : [
          {
            course: { name: (data as any).course_name || (data as any).course || 'Course Enrollment' },
            defaultPrice: Number(data.subtotal || (data as any).total_amount || 0),
            overridePrice: null,
            billingMode: data.billingMode || 'STANDARD',
            durationValue: 1,
            durationUnit: 'MONTHS',
            lineTotal: Number(data.subtotal || (data as any).total_amount || 0),
          },
        ];

  const tableRows = rawItems.map((it: any, idx: number) => {
    const isOverride =
      it.overridePrice !== undefined &&
      it.overridePrice !== null &&
      it.overridePrice !== it.defaultPrice;

    const rateStr = isOverride
      ? `${formatCurrency(it.overridePrice)}*`
      : formatCurrency(it.defaultPrice);

    const durVal = Math.max(1, Number(it.durationValue) || 1);
    const unitStr = durVal === 1 ? 'Month' : 'Months';
    const isMonthly = (it.billingMode || '').toUpperCase() === 'MONTHLY';
    const durationLabel = `${durVal} ${unitStr}\n(${isMonthly ? 'Monthly' : 'One-Time'})`;

    const courseTitle = `${it.course?.name || it.description || 'Course Tuition Fee'}\n(Period: ${periodStr})`;

    return [
      String(idx + 1),
      courseTitle,
      rateStr,
      durationLabel,
      formatCurrency(it.lineTotal),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [['SL.', 'Course Name', 'Price', 'Duration', 'Total']],
    body: tableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [0, 102, 255], // Electric Blue #0066FF
      textColor: [255, 255, 255],
      font: fontName,
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 2.2,
      halign: 'left',
    },
    styles: {
      font: fontName,
      fontSize: 6.3,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [238, 242, 246],
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // subtle gray
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 54 },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
  });

  const tableEndY = (doc as any).lastAutoTable.finalY + 5;

  // ----------------------------------------------------
  // 4. Bottom Grid (Payment Method / Badges & Totals / Signature)
  // ----------------------------------------------------
  // --- Left Column: Payment Method ---
  doc.setFont(fontName, 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 27, 72);
  doc.text('Payment Method:', margin, tableEndY);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);

  let pmY = tableEndY + 4.2;
  const bankDetails: string[] = [];
  if (settings?.bank_name?.trim()) {
    bankDetails.push(`Bank Name: ${settings.bank_name.trim()}`);
  } else if (!settings) {
    bankDetails.push('Bank Name: Meezan Bank Ltd');
  }

  if (settings?.bank_account_name?.trim()) {
    bankDetails.push(`Account Name: ${settings.bank_account_name.trim()}`);
  } else if (!settings) {
    bankDetails.push('Account Name: Global Tech Academy');
  }

  if (settings?.bank_account_number?.trim()) {
    bankDetails.push(`Account Number: ${settings.bank_account_number.trim()}`);
  } else if (!settings) {
    bankDetails.push('Account Number: 0102-0105849301');
  }

  if (settings?.bank_iban?.trim()) {
    bankDetails.push(`IBAN: ${settings.bank_iban.trim()}`);
  } else if (!settings) {
    bankDetails.push('IBAN: PK45MEZN0001020105849301');
  }

  if (bankDetails.length === 0) {
    bankDetails.push('Payment Deposit: Academy Finance Counter');
  }

  bankDetails.forEach((line) => {
    doc.text(line, margin, pmY);
    pmY += 3.8;
  });

  if (data.notes) {
    pmY += 0.4;
    doc.setFont(fontName, 'bold');
    doc.setTextColor(0, 102, 255);
    doc.text('Notes:', margin, pmY);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(data.notes.slice(0, 40), margin + 10, pmY);
  }


  // --- Right Column: Financial Calculations Summary ---
  const totLabelX = pw - 62; // 86mm - gives ample space (52mm width) so labels and values never collide
  const totValX = pw - margin; // 138mm

  const subtotalVal = Number(data.subtotal ?? (data as any).total_amount ?? 0);
  const discountVal = Number(data.discountAmount ?? (data as any).discount_amount ?? 0);
  const taxVal = Number(data.taxAmount ?? (data as any).tax_amount ?? 0);
  const grandTotalVal = Number(
    data.grandTotal ?? (data as any).total_amount ?? subtotalVal - discountVal + taxVal
  );
  const paidVal = Number(data.paidAmount ?? (data as any).paid_amount ?? 0);
  const prevDueVal = Number(data.previousOutstanding ?? 0);
  const remainingVal = Number(
    data.remainingAmount ?? (data as any).balance ?? Math.max(0, grandTotalVal + prevDueVal - paidVal)
  );

  let totY = tableEndY;
  doc.setFont(fontName, 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);

  doc.text('Subtotal', totLabelX, totY);
  doc.setFont(fontName, 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(subtotalVal), totValX, totY, { align: 'right' });

  if (discountVal > 0) {
    totY += 4.2;
    doc.setFont(fontName, 'normal');
    doc.setTextColor(5, 150, 105); // emerald
    const discLabel =
      (data.discountType || '').toUpperCase() === 'PERCENTAGE'
        ? Number(data.discountValue) > 0
          ? `Discount (${data.discountValue}%)`
          : 'Discount (%)'
        : 'Discount';
    doc.text(discLabel, totLabelX, totY);
    doc.setFont(fontName, 'bold');
    doc.text(`- ${formatCurrency(discountVal)}`, totValX, totY, { align: 'right' });
  }

  if (taxVal > 0) {
    totY += 4.2;
    doc.setFont(fontName, 'normal');
    doc.setTextColor(0, 102, 255);
    const taxLabel =
      (data.taxType || '').toUpperCase() === 'PERCENTAGE'
        ? Number(data.taxValue) > 0
          ? `${data.taxName || 'Tax'} (${data.taxValue}%)`
          : `${data.taxName || 'Tax'} (%)`
        : (data.taxName || 'Tax');
    doc.text(taxLabel, totLabelX, totY);
    doc.setFont(fontName, 'bold');
    doc.text(`+ ${formatCurrency(taxVal)}`, totValX, totY, { align: 'right' });
  }

  totY += 4.8;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(totLabelX, totY - 1.5, totValX, totY - 1.5);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 27, 72);
  doc.text('Grand Total', totLabelX, totY + 1.8);
  doc.text(formatCurrency(grandTotalVal), totValX, totY + 1.8, { align: 'right' });

  if (prevDueVal > 0) {
    totY += 5;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(217, 119, 6);
    doc.text('Previous Due', totLabelX, totY);
    doc.setFont(fontName, 'bold');
    doc.text(formatCurrency(prevDueVal), totValX, totY, { align: 'right' });
  }

  totY += 4.8;
  doc.setFont(fontName, 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(5, 150, 105);
  doc.text('Amount Paid', totLabelX, totY);
  doc.setFont(fontName, 'bold');
  doc.text(formatCurrency(paidVal), totValX, totY, { align: 'right' });

  totY += 5.2;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(225, 29, 72); // rose red
  doc.text('Balance Due', totLabelX, totY);
  doc.text(formatCurrency(remainingVal), totValX, totY, { align: 'right' });

  const maxContentY = Math.max(pmY, totY) + 4;

  // ----------------------------------------------------
  // 5. Payment Transactions & Allocations History (If Toggled ON)
  // ----------------------------------------------------
  const shouldShowHistory = Boolean(
    data.includePaymentHistory && data.allocations && data.allocations.length > 0
  );

  const allocRows: any[] = [];
  const isJointPrevious = Boolean(data.includePreviousHistory);

  if (isJointPrevious) {
    (data.allocations || []).forEach((a: any) => {
      allocRows.push([
        a.payment?.receiptNumber || 'N/A',
        formatDate(a.payment?.paymentDate || new Date()),
        (a.payment?.paymentMethod || 'CASH').replace('_', ' '),
        `This (${billNumber})`,
        formatCurrency(a.amountAllocated || 0),
        formatCurrency(a.payment?.amount || a.amountAllocated || 0),
      ]);

      (a.payment?.siblingAllocations || []).forEach((sa: any) => {
        allocRows.push([
          a.payment?.receiptNumber || 'N/A',
          formatDate(a.payment?.paymentDate || new Date()),
          (a.payment?.paymentMethod || 'CASH').replace('_', ' '),
          `Prev (${sa.billNumber})`,
          formatCurrency(sa.amountAllocated || 0),
          formatCurrency(a.payment?.amount || 0),
        ]);
      });
    });

    (data.previousBills || []).forEach((pb: any) => {
      (pb.allocations || []).forEach((pa: any) => {
        const already = allocRows.some(
          (r) => r[0] === pa.payment?.receiptNumber && r[3]?.includes(pb.billNumber)
        );
        if (!already) {
          allocRows.push([
            pa.payment?.receiptNumber || 'N/A',
            formatDate(pa.payment?.paymentDate || new Date()),
            (pa.payment?.paymentMethod || 'CASH').replace('_', ' '),
            `Prev (${pb.billNumber})`,
            formatCurrency(pa.amountAllocated || 0),
            formatCurrency(pa.payment?.amount || pa.amountAllocated || 0),
          ]);
        }
      });
    });
  } else {
    (data.allocations || []).forEach((a: any) => {
      allocRows.push([
        a.payment?.receiptNumber || 'N/A',
        formatDate(a.payment?.paymentDate || new Date()),
        (a.payment?.paymentMethod || 'CASH').replace('_', ' '),
        formatCurrency(a.amountAllocated || 0),
        formatCurrency(a.payment?.amount || a.amountAllocated || 0),
      ]);
    });
  }

  const p1Head = isJointPrevious
    ? [['Receipt #', 'Date', 'Method', 'Target Invoice', 'Allocated', 'Total Receipt']]
    : [['Receipt #', 'Payment Date', 'Method', 'Allocated', 'Total Receipt']];

  const p1ColStyles: any = isJointPrevious
    ? {
        0: { cellWidth: 26, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 26, fontStyle: 'bold', textColor: [0, 82, 204] },
        4: { cellWidth: 20, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
        5: { cellWidth: 18, halign: 'right' },
      }
    : {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 21, halign: 'center' },
        3: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
        4: { cellWidth: 25, halign: 'right' },
      };

  const p2Head = isJointPrevious
    ? [['Receipt #', 'Payment Date', 'Method', 'Target Invoice / Category', 'Allocated', 'Total Receipt Amount']]
    : [['Receipt #', 'Payment Date', 'Method', 'Allocated To This Bill', 'Total Receipt Amount']];

  const p2ColStyles: any = isJointPrevious
    ? {
        0: { cellWidth: 26, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 26, fontStyle: 'bold', textColor: [0, 82, 204] },
        4: { cellWidth: 20, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
        5: { cellWidth: 18, halign: 'right' },
      }
    : {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 21, halign: 'center' },
        3: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
        4: { cellWidth: 25, halign: 'right' },
      };

  const estimatedHistHeight = 7 + 6 + allocRows.length * 4.6;
  const spaceAvailableOnPage1 = 196 - maxContentY;
  const histFitsOnPage1 = shouldShowHistory && estimatedHistHeight <= spaceAvailableOnPage1;

  if (shouldShowHistory && histFitsOnPage1) {
    const histTitleY = maxContentY + 4;

    doc.setFillColor(0, 102, 255);
    doc.roundedRect(margin, histTitleY - 2.6, 3.5, 3.5, 0.6, 0.6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(4.8);
    doc.text('$', margin + 1.75, histTitleY - 0.3, { align: 'center' });

    doc.setFont(fontName, 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(0, 27, 72);
    doc.text(
      isJointPrevious
        ? 'PAYMENT & PREVIOUS SETTLEMENT ALLOCATIONS HISTORY'
        : 'PAYMENT TRANSACTIONS & ALLOCATIONS HISTORY',
      margin + 5.2,
      histTitleY
    );

    autoTable(doc, {
      startY: histTitleY + 2.5,
      margin: { left: margin, right: margin },
      head: p1Head,
      body: allocRows,
      theme: 'plain',
      headStyles: {
        fillColor: [0, 27, 72],
        textColor: [255, 255, 255],
        font: fontName,
        fontSize: 6,
        fontStyle: 'bold',
        cellPadding: 1.8,
        halign: 'left',
      },
      styles: {
        font: fontName,
        fontSize: 5.6,
        cellPadding: 1.8,
        textColor: [30, 41, 59],
        lineColor: [238, 242, 246],
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      columnStyles: p1ColStyles,
    });

    const payHistEndY = (doc as any).lastAutoTable.finalY;
    renderPreFooterBlock(doc, pw, margin, payHistEndY, fontName, 'INVOICE', settings);
  } else {
    renderPreFooterBlock(doc, pw, margin, maxContentY, fontName, 'INVOICE', settings);

    if (shouldShowHistory) {
      doc.addPage('a5', 'portrait');

      drawTopHeader(
        doc,
        pw,
        ph,
        margin,
        logoDataUrl,
        isJointPrevious ? 'PAYMENT & LEDGER' : 'PAYMENT HISTORY',
        fontName,
        settings
      );

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, 35, pw - margin * 2, 13, 2, 2, 'FD');

      doc.setFont(fontName, 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Student: ${studentName} (${studentCode})`, margin + 3, 40);

      doc.setFont(fontName, 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text(`Invoice Ref: ${billNumber}  |  Billing Mode: ${billingMode}`, margin + 3, 44.5);

      if (isJointPrevious && prevDueVal > 0) {
        doc.setFont(fontName, 'bold');
        doc.setFontSize(6.4);
        doc.setTextColor(0, 27, 72);
        doc.text(`This Bill Due: ${formatCurrency(remainingVal)}`, pw - margin - 3, 39.5, { align: 'right' });

        doc.setFont(fontName, 'bold');
        doc.setTextColor(217, 119, 6);
        doc.text(`Prev Due: ${formatCurrency(prevDueVal)}  |  Total: ${formatCurrency(remainingVal + prevDueVal)}`, pw - margin - 3, 44.5, { align: 'right' });
      } else {
        doc.setFont(fontName, 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(0, 27, 72);
        doc.text(`Grand Total: ${formatCurrency(grandTotalVal)}`, pw - margin - 3, 39.5, { align: 'right' });

        doc.setFont(fontName, 'bold');
        doc.setTextColor(225, 29, 72);
        doc.text(`Balance Due: ${formatCurrency(remainingVal)}`, pw - margin - 3, 44.5, { align: 'right' });
      }

      autoTable(doc, {
        startY: 52,
        margin: { left: margin, right: margin },
        head: p2Head,
        body: allocRows,
        theme: 'plain',
        headStyles: {
          fillColor: [0, 102, 255],
          textColor: [255, 255, 255],
          font: fontName,
          fontSize: 6.8,
          fontStyle: 'bold',
          cellPadding: 2.4,
          halign: 'left',
        },
        styles: {
          font: fontName,
          fontSize: 6.3,
          cellPadding: 2.4,
          textColor: [30, 41, 59],
          lineColor: [238, 242, 246],
          lineWidth: 0.2,
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251],
        },
        columnStyles: p2ColStyles,
      });

      const p2TableEndY = (doc as any).lastAutoTable.finalY;
      renderPreFooterBlock(doc, pw, margin, p2TableEndY, fontName, 'STATEMENT', settings);
    }
  }

  return doc;
}

/**
 * Generates an executive, matching Global Tech Payment Receipt in A5 size.
 */
export function generateReceiptPDF(
  data: PaymentReceiptPDFData,
  logoDataUrl?: string | null,
  poppinsFonts?: PoppinsFontsData | null,
  settings?: Record<string, string> | null
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  });

  const fontName = applyPoppinsFonts(doc, poppinsFonts);

  const pw = 148;
  const ph = 210;
  const margin = 10;

  // ----------------------------------------------------
  // 1. Top Wave Header
  // ----------------------------------------------------
  doc.setFillColor(0, 102, 255);
  doc.rect(0, 0, pw, 18, 'F');

  doc.setFillColor(255, 255, 255);
  doc.moveTo(0, 16);
  doc.curveTo(pw * 0.25, 4, pw * 0.75, 4, pw, 16);
  doc.lineTo(pw, ph);
  doc.lineTo(0, ph);
  doc.lineTo(0, 16);
  doc.fill();

  doc.setDrawColor(0, 27, 72);
  doc.setLineWidth(1.4);
  doc.moveTo(0, 16);
  doc.curveTo(pw * 0.25, 4, pw * 0.75, 4, pw, 16);
  doc.stroke();

  // =========================================================================
  // 🌟 RECEIPT PDF LOGO CONTROLS (Yahan se millimeters mein direct adjust karein) 🌟
  // =========================================================================
  const PDF_REC_LOGO_SIZE_MM = 26; // 👈 Bada size (e.g. 24, 26, 28, 30, 32)
  const PDF_REC_LOGO_Y_MM = 10.5; // 👈 Upar / Neechay (e.g. 8, 10.5, 12, 14)
  const PDF_REC_LOGO_X_MM = margin; // 👈 Left / Right (e.g. margin, margin + 5)

  let logoDrawn = false;
  if (logoDataUrl) {
    try {
      doc.addImage(
        logoDataUrl,
        'PNG',
        PDF_REC_LOGO_X_MM,
        PDF_REC_LOGO_Y_MM,
        PDF_REC_LOGO_SIZE_MM,
        PDF_REC_LOGO_SIZE_MM
      );
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }

  if (!logoDrawn) {
    doc.setTextColor(0, 27, 72);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(13);
    doc.text((settings?.company_name_main || 'GLOBAL TECH').toUpperCase(), margin, 24);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105);
    doc.text((settings?.company_name_sub || 'INTERNATIONAL ACADEMY').toUpperCase(), margin, 28);
  }

  doc.setFont(fontName, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(5, 150, 105); // Emerald Green for Payment Receipt
  doc.text('PAYMENT RECEIPT', pw - margin, 27, { align: 'right' });

  // ----------------------------------------------------
  // 2. Student and Receipt Metadata
  // ----------------------------------------------------
  const infoY = 37;

  doc.setFont(fontName, 'bold');
  let nameFontSize = 10;
  doc.setFontSize(nameFontSize);
  const maxNameW = pw - 72;
  while (doc.getTextWidth(`Received From: ${data.student.fullName}`) > maxNameW && nameFontSize > 7) {
    nameFontSize -= 0.5;
    doc.setFontSize(nameFontSize);
  }
  doc.setTextColor(15, 23, 42);
  doc.text(`Received From: ${data.student.fullName}`, margin, infoY);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Student ID: ${data.student.studentCode}`, margin, infoY + 4.2);
  doc.text(`Phone: ${data.student.phone}`, margin, infoY + 8.4);
  if (data.student.email) {
    doc.text(`Email: ${data.student.email}`, margin, infoY + 12.6);
  } else if (data.student.address) {
    doc.text(`Address: ${data.student.address.slice(0, 36)}`, margin, infoY + 12.6);
  }

  const metaStartX = pw - 66;
  const metaEndX = pw - margin;

  renderMetaRow(doc, 'Receipt #', data.receiptNumber, metaStartX, metaEndX, infoY, [0, 27, 72], fontName);
  renderMetaRow(doc, 'Payment Date', formatDate(data.paymentDate), metaStartX, metaEndX, infoY + 4.2, [15, 23, 42], fontName);
  renderMetaRow(
    doc,
    'Method',
    data.paymentMethod.replace('_', ' '),
    metaStartX,
    metaEndX,
    infoY + 8.4,
    [0, 102, 255],
    fontName
  );
  if (data.referenceNumber) {
    renderMetaRow(doc, 'Ref / Txn #', data.referenceNumber, metaStartX, metaEndX, infoY + 12.6, [71, 85, 105], fontName);
  } else {
    renderMetaRow(doc, 'Status', 'CLEARED / VERIFIED', metaStartX, metaEndX, infoY + 12.6, [5, 150, 105], fontName);
  }

  // ----------------------------------------------------
  // 3. Amount Received Banner
  // ----------------------------------------------------
  const amtY = infoY + 16;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(margin, amtY, pw - margin * 2, 11, 2, 2, 'FD');

  doc.setTextColor(6, 95, 70);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(8);
  doc.text('AMOUNT RECEIVED IN FULL / CLEARED:', margin + 4, amtY + 7);

  doc.setFontSize(11);
  doc.text(formatCurrency(data.amount), pw - margin - 4, amtY + 7.5, { align: 'right' });

  // ----------------------------------------------------
  // 4. Allocations Table
  // ----------------------------------------------------
  const tableRows = data.allocations.map((a) => [
    a.feeBill.billNumber,
    formatCurrency(a.feeBill.grandTotal),
    formatCurrency(a.amountAllocated),
    a.feeBill.status.replace('_', ' '),
  ]);

  autoTable(doc, {
    startY: amtY + 15,
    margin: { left: margin, right: margin },
    head: [['Allocated Bill #', 'Bill Total', 'Amount Allocated', 'Bill Status']],
    body: tableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [0, 102, 255],
      textColor: [255, 255, 255],
      font: fontName,
      fontSize: 6.8,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      font: fontName,
      fontSize: 6.3,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [238, 242, 246],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
      3: { halign: 'center' },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // ----------------------------------------------------
  // 5. Pre-Footer Payment Acknowledgement & Footer
  // ----------------------------------------------------
  const maxContentY = finalY;

  renderPreFooterBlock(doc, pw, margin, maxContentY, fontName, 'RECEIPT', settings);

  return doc;
}
