'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CreditCard, CheckCircle2, AlertTriangle, ArrowRight, DollarSign } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  currentBillId?: string;
  currentBillNumber?: string;
  currentBillTotal?: number;
  currentBillPaid?: number;
  currentBillRemaining?: number;
  onSuccess: () => void;
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  currentBillId,
  currentBillNumber,
  currentBillTotal = 0,
  currentBillPaid = 0,
  currentBillRemaining = 0,
  onSuccess,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Outstanding bills for student
  const [outstandingBills, setOutstandingBills] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<{ [billId: string]: string }>({});

  useEffect(() => {
    if (isOpen && studentId) {
      setError(null);
      // Fetch all outstanding bills for this student
      fetch(`/api/fee-bills/student/${studentId}/outstanding`)
        .then((res) => res.json())
        .then((data) => {
          const bills = data.bills || [];
          setOutstandingBills(bills);

          // Default amount to current bill remaining (or first available)
          if (currentBillRemaining > 0) {
            setAmount(String(currentBillRemaining));
            setAllocations({ [currentBillId || '']: String(currentBillRemaining) });
          } else if (bills.length > 0) {
            setAmount(String(bills[0].remainingAmount));
            setAllocations({ [bills[0].id]: String(bills[0].remainingAmount) });
          }
        })
        .catch(() => {});
    }
  }, [isOpen, studentId, currentBillId, currentBillRemaining]);

  // Auto-distribute amount across bills (oldest to newest)
  const handleAmountChange = (val: string) => {
    setAmount(val);
    const num = parseFloat(val) || 0;
    if (num <= 0) {
      setAllocations({});
      return;
    }

    let left = num;
    const newAlloc: { [billId: string]: string } = {};

    // Sort: if currentBillId exists, prioritize older bills first if they exist, or current bill
    for (const b of outstandingBills) {
      if (left <= 0) break;
      const rem = Number(b.remainingAmount);
      const alloc = Math.min(left, rem);
      newAlloc[b.id] = String(Math.round((alloc + Number.EPSILON) * 100) / 100);
      left = Math.round((left - alloc + Number.EPSILON) * 100) / 100;
    }

    setAllocations(newAlloc);
  };

  const handleAllocationChange = (billId: string, val: string) => {
    const updated = { ...allocations, [billId]: val };
    setAllocations(updated);

    // Sum allocations to update total amount
    const total = Object.values(updated).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    setAmount(String(Math.round((total + Number.EPSILON) * 100) / 100));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive payment amount');
      return;
    }

    const allocList = Object.entries(allocations)
      .map(([billId, amt]) => ({
        feeBillId: billId,
        amount: parseFloat(amt) || 0,
      }))
      .filter((a) => a.amount > 0);

    if (allocList.length === 0) {
      setError('At least one bill must be allocated an amount');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          amount: numAmount,
          paymentMethod,
          paymentDate,
          referenceNumber,
          notes,
          allocations: allocList,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const totalOutstanding = outstandingBills.reduce(
    (sum, b) => sum + Number(b.remainingAmount || 0),
    0
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Fee Payment"
      subtitle={`Student: ${studentName}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Balance Overview Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">
              Current Bill
            </span>
            <p className="text-sm font-bold text-slate-800">
              {currentBillNumber || 'N/A'}
            </p>
            <p className="text-xs text-slate-500">
              Rem: {formatCurrency(currentBillRemaining)}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">
              Total Outstanding
            </span>
            <p className="text-sm font-bold text-rose-600">
              {formatCurrency(totalOutstanding)}
            </p>
            <p className="text-[10px] text-slate-400">Across {outstandingBills.length} bills</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">
              Payment Amount
            </span>
            <p className="text-sm font-bold text-emerald-600">
              {formatCurrency(parseFloat(amount) || 0)}
            </p>
            <p className="text-[10px] text-slate-400">To be applied</p>
          </div>
        </div>

        {/* Amount & Method Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Amount (PKR) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                Rs.
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                max={totalOutstanding}
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Method *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
            >
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="ONLINE">Online / Easypaisa / JazzCash</option>
              <option value="CHEQUE">Cheque / Pay Order</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Date *
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
            />
          </div>
        </div>

        {/* Ref / Tx ID & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Transaction / Reference #
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. TX-9847294 or Cheque # 104"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes or remarks"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
            />
          </div>
        </div>

        {/* Bill Allocation Breakdown Table (Section 16 & 17) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Payment Allocation Breakdown
            </label>
            <span className="text-[11px] text-slate-500">
              Allocates to selected bills without exceeding remaining balance
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
            {outstandingBills.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No outstanding bills found for this student.
              </div>
            ) : (
              outstandingBills.map((b) => {
                const rem = Number(b.remainingAmount);
                const currentAlloc = parseFloat(allocations[b.id] || '0');
                const isSelected = currentAlloc > 0;

                return (
                  <div
                    key={b.id}
                    className={`p-3 flex items-center justify-between gap-3 text-xs ${
                      isSelected ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{b.billNumber}</span>
                        {b.id === currentBillId && (
                          <span className="bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.2 rounded">
                            Current Bill
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Date: {formatDate(b.billDate)} • Total: {formatCurrency(b.grandTotal)}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase block">
                          Remaining
                        </span>
                        <span className="font-semibold text-rose-600">
                          {formatCurrency(rem)}
                        </span>
                      </div>

                      <div className="w-32">
                        <span className="text-[10px] text-slate-400 uppercase block">
                          Allocate (PKR)
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={rem}
                          value={allocations[b.id] || ''}
                          onChange={(e) => handleAllocationChange(b.id, e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1 text-xs font-semibold rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            leftIcon={<CreditCard className="w-4 h-4" />}
          >
            Confirm & Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
