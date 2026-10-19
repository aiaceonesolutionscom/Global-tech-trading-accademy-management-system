'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X, Ban, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';

interface DeleteFeeBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  feeBill: {
    id: string;
    billNumber: string;
    studentName?: string;
    grandTotal: number;
    paidAmount: number;
    remainingAmount?: number;
  } | null;
}

export function DeleteFeeBillModal({
  isOpen,
  onClose,
  onSuccess,
  feeBill,
}: DeleteFeeBillModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !feeBill || !mounted) return null;

  const hasPayments = Number(feeBill.paidAmount) > 0;

  const handleDelete = async (mode: 'delete' | 'cancel' | 'force') => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/fee-bills/${feeBill.id}`;
      if (mode === 'cancel') {
        url += '?action=cancel';
      } else if (mode === 'force') {
        url += '?force=true';
      }

      const res = await fetch(url, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process invoice request');
      }

      onSuccess(data.message);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting');
    } finally {
      setIsLoading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-900">
                Delete Fee Bill / Invoice
              </h3>
              <p className="text-[11px] text-rose-700 font-mono">
                {feeBill.billNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Student:</span>
              <span className="font-semibold text-slate-800">
                {feeBill.studentName || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Amount:</span>
              <span className="font-bold text-slate-900">
                {formatCurrency(feeBill.grandTotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Paid Amount:</span>
              <span
                className={`font-bold ${
                  hasPayments ? 'text-emerald-600' : 'text-slate-600'
                }`}
              >
                {formatCurrency(feeBill.paidAmount)}
              </span>
            </div>
          </div>

          {hasPayments ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Notice: Payments Recorded</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This invoice already has{' '}
                <strong>{formatCurrency(feeBill.paidAmount)}</strong> in recorded
                payments. You can either <strong>Cancel</strong> the invoice
                (keeps payment audit history) or <strong>Permanently Delete</strong>{' '}
                it (removes this invoice and its allocations).
              </p>
            </div>
          ) : (
            <p className="text-slate-600 leading-relaxed">
              Are you sure you want to delete invoice{' '}
              <strong className="text-slate-800 font-mono">
                {feeBill.billNumber}
              </strong>
              ? This action is permanent and cannot be undone.
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            Close / Cancel
          </Button>

          {hasPayments ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete('cancel')}
                disabled={isLoading}
                leftIcon={<Ban className="w-3.5 h-3.5 text-amber-600" />}
                className="text-amber-800 border-amber-300 hover:bg-amber-50"
              >
                Mark as Cancelled
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete('force')}
                disabled={isLoading}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                {isLoading ? 'Deleting...' : 'Force Delete'}
              </Button>
            </>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDelete('delete')}
              disabled={isLoading}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              {isLoading ? 'Deleting...' : 'Delete Invoice'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
