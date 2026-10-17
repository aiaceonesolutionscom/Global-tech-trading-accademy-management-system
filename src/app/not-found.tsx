import Link from 'next/link';
import Image from 'next/image';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 text-white">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center shadow-2xl space-y-6">
        <div className="w-16 h-16 mx-auto relative rounded-xl bg-white p-2.5 flex items-center justify-center shadow">
          <Image
            src="/logo.png"
            alt="Global Tech Logo"
            width={48}
            height={48}
            className="object-contain"
          />
        </div>

        <div>
          <span className="font-mono text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider inline-block mb-3">
            404 Error
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            The page you are looking for does not exist or has been relocated within the academy portal.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-5 rounded-lg bg-[#0052CC] hover:bg-[#0041A8] text-white font-semibold text-sm shadow transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

