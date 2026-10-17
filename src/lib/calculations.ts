/**
 * Centralized Financial Calculation Engine for Global Trading Management System.
 * Ensures strict monetary arithmetic and deterministic rounding.
 */

export interface LineItemInput {
  courseId: string;
  defaultPrice: number;
  overridePrice?: number | null;
  billingMode: 'ONE_TIME' | 'MONTHLY';
  durationValue: number;
  durationUnit?: string;
}

export interface LineItemResult {
  courseId: string;
  effectiveBasePrice: number;
  billingMode: 'ONE_TIME' | 'MONTHLY';
  durationValue: number;
  lineTotal: number;
}

export interface CalculationInput {
  items: LineItemInput[];
  discountType: 'NONE' | 'FIXED' | 'PERCENTAGE';
  discountValue: number;
  taxType: 'NONE' | 'FIXED' | 'PERCENTAGE';
  taxValue: number;
  taxName?: string;
  previousOutstanding?: number;
  paidAmount?: number;
}

export interface CalculationResult {
  items: LineItemResult[];
  subtotal: number;
  discountAmount: number;
  taxableBase: number;
  taxAmount: number;
  grandTotal: number;
  previousOutstanding: number;
  netPayable: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
}

export function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates a single course line item total.
 * If billingMode === 'MONTHLY', divides base price by duration (months).
 */
export function calculateLineItem(item: LineItemInput): LineItemResult {
  const effectiveBasePrice =
    item.overridePrice !== undefined && item.overridePrice !== null && !isNaN(Number(item.overridePrice))
      ? Number(item.overridePrice)
      : Number(item.defaultPrice);

  let lineTotal: number;
  if (item.billingMode === 'MONTHLY') {
    const duration = Math.max(1, Number(item.durationValue) || 1);
    lineTotal = roundToTwoDecimals(effectiveBasePrice / duration);
  } else {
    lineTotal = roundToTwoDecimals(effectiveBasePrice);
  }

  return {
    courseId: item.courseId,
    effectiveBasePrice: roundToTwoDecimals(effectiveBasePrice),
    billingMode: item.billingMode,
    durationValue: item.durationValue,
    lineTotal,
  };
}

/**
 * Master calculation engine for complete Fee Bill financial statement.
 */
export function calculateFeeBill(input: CalculationInput): CalculationResult {
  const items = (input.items || []).map(calculateLineItem);

  const subtotal = roundToTwoDecimals(
    items.reduce((acc, curr) => acc + curr.lineTotal, 0)
  );

  // Discount
  let discountAmount = 0;
  const dVal = Math.max(0, Number(input.discountValue) || 0);
  if (input.discountType === 'FIXED') {
    discountAmount = Math.min(subtotal, roundToTwoDecimals(dVal));
  } else if (input.discountType === 'PERCENTAGE') {
    discountAmount = roundToTwoDecimals((subtotal * Math.min(100, dVal)) / 100);
  }

  const taxableBase = Math.max(0, roundToTwoDecimals(subtotal - discountAmount));

  // Tax
  let taxAmount = 0;
  const tVal = Math.max(0, Number(input.taxValue) || 0);
  if (input.taxType === 'FIXED') {
    taxAmount = roundToTwoDecimals(tVal);
  } else if (input.taxType === 'PERCENTAGE') {
    taxAmount = roundToTwoDecimals((taxableBase * tVal) / 100);
  }

  const grandTotal = roundToTwoDecimals(taxableBase + taxAmount);

  const previousOutstanding = Math.max(0, roundToTwoDecimals(Number(input.previousOutstanding) || 0));
  const netPayable = roundToTwoDecimals(grandTotal + previousOutstanding);

  const paidAmount = Math.max(0, roundToTwoDecimals(Number(input.paidAmount) || 0));
  const remainingAmount = Math.max(0, roundToTwoDecimals(grandTotal - paidAmount));

  let status: CalculationResult['status'] = 'UNPAID';
  if (remainingAmount === 0 && grandTotal > 0) {
    status = 'PAID';
  } else if (paidAmount > 0 && remainingAmount > 0) {
    status = 'PARTIALLY_PAID';
  } else if (grandTotal === 0) {
    status = 'PAID';
  }

  return {
    items,
    subtotal,
    discountAmount,
    taxableBase,
    taxAmount,
    grandTotal,
    previousOutstanding,
    netPayable,
    paidAmount,
    remainingAmount,
    status,
  };
}

/**
 * Validates and allocates payment amount across targeted invoices safely.
 */
export interface BillAllocationTarget {
  id: string;
  billNumber: string;
  remainingAmount: number;
}

export interface AllocationPlanItem {
  feeBillId: string;
  billNumber: string;
  allocatedAmount: number;
  newPaidAmount: number;
  newRemainingAmount: number;
  newStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
}

export function computeSequentialAllocation(
  paymentAmount: number,
  bills: BillAllocationTarget[]
): {
  allocations: AllocationPlanItem[];
  unallocatedRemainder: number;
} {
  let available = roundToTwoDecimals(paymentAmount);
  const allocations: AllocationPlanItem[] = [];

  for (const bill of bills) {
    if (available <= 0) break;
    const remaining = roundToTwoDecimals(bill.remainingAmount);
    if (remaining <= 0) continue;

    const alloc = roundToTwoDecimals(Math.min(available, remaining));
    const newRemaining = roundToTwoDecimals(remaining - alloc);
    const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';

    allocations.push({
      feeBillId: bill.id,
      billNumber: bill.billNumber,
      allocatedAmount: alloc,
      newPaidAmount: alloc, // Incremented in db transaction
      newRemainingAmount: newRemaining,
      newStatus,
    });

    available = roundToTwoDecimals(available - alloc);
  }

  return {
    allocations,
    unallocatedRemainder: available,
  };
}
