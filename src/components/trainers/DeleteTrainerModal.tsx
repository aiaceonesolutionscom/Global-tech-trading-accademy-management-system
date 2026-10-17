'use client';

import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, UserX } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface DeleteTrainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  trainer: {
    id: string;
    trainerCode: string;
    name: string;
    specialization?: string;
    coursesCount?: number;
  } | null;
}

export function DeleteTrainerModal({
  isOpen,
  onClose,
  onSuccess,
  trainer,
}: DeleteTrainerModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !trainer) return null;

  const hasCourses = (trainer.coursesCount || 0) > 0;

  const handleDelete = async (mode: 'delete' | 'deactivate' | 'force') => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/trainers/${trainer.id}`;
      if (mode === 'deactivate') {
        url += '?action=deactivate';
      } else if (mode === 'force') {
        url += '?force=true';
      }

      const res = await fetch(url, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete trainer');
      }

      onSuccess(data.message);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-900">
                Delete Instructor / Trainer
              </h3>
              <p className="text-[11px] text-rose-700 font-mono">
                {trainer.trainerCode}
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
              <span className="text-slate-500">Instructor Name:</span>
              <span className="font-semibold text-slate-800">{trainer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Specialization:</span>
              <span className="font-semibold text-slate-700">
                {trainer.specialization || 'Financial Markets'}
              </span>
            </div>
            {hasCourses && (
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Courses:</span>
                <span className="font-bold text-blue-700">
                  {trainer.coursesCount} course(s)
                </span>
              </div>
            )}
          </div>

          {hasCourses ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Notice: Active Courses Assigned</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This trainer is currently assigned to {trainer.coursesCount} active course(s).
                You can <strong>Deactivate</strong> the trainer (keeps course assignments intact),
                or <strong>Permanently Force Delete</strong> them (courses will remain and become unassigned).
              </p>
            </div>
          ) : (
            <p className="text-slate-600 leading-relaxed">
              Are you sure you want to delete instructor{' '}
              <strong className="text-slate-800 font-semibold">{trainer.name}</strong>{' '}
              (<span className="font-mono text-slate-600">{trainer.trainerCode}</span>)? This action cannot be undone.
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
            Cancel
          </Button>

          {hasCourses ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete('deactivate')}
                disabled={isLoading}
                leftIcon={<UserX className="w-3.5 h-3.5 text-amber-600" />}
                className="text-amber-800 border-amber-300 hover:bg-amber-50"
              >
                Deactivate Trainer
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
              {isLoading ? 'Deleting...' : 'Delete Trainer'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
