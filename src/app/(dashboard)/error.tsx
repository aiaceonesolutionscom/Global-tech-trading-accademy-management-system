'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk')
    ) {
      const lastReload = sessionStorage.getItem('last_auto_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('last_auto_reload', String(now));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="p-8 max-w-lg mx-auto my-12 bg-white rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
      <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-900">Module Update Detected</h3>
        <p className="text-xs text-slate-500">
          This tab was holding an older cache version. Please click Refresh to update the data.
        </p>
      </div>

      <button
        onClick={() => {
          window.location.reload();
        }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0052CC] hover:bg-[#0041A8] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Refresh View
      </button>
    </div>
  );
}
