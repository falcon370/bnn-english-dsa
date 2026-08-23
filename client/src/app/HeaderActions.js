'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/context/AuthContext';

// mobile prop — renders a compact version for the mobile header slot
export default function HeaderActions({ mobile = false }) {
  const { user, loading, logout } = useAuthContext();
  const router = useRouter();

  if (loading) {
    return (
      <div
        className={`rounded-md bg-blue-400 animate-pulse ${mobile ? 'h-8 w-16' : 'h-10 w-24'
          }`}
      />
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {!mobile && (
          <div className="flex gap-2">
            {user.role === 'admin' && (
              <Link
                href="/admin/dashboard"
                className="h-9 px-4 rounded-md bg-white text-[#1A56C4] text-xs font-bold tracking-wide hover:bg-blue-50 transition flex items-center justify-center shadow-sm"
              >
                Dashboard
              </Link>
            )}
            <Link
              href="/profile"
              className="h-9 px-4 rounded-md bg-white text-[#1A56C4] text-xs font-bold tracking-wide hover:bg-blue-50 transition flex items-center justify-center shadow-sm"
            >
              Profile
            </Link>
          </div>
        )}
        <button
          onClick={() => { logout(); router.push('/'); }}
          className={`rounded-md border border-white/50 text-white font-bold tracking-wide hover:bg-white hover:text-[#1A56C4] transition flex items-center justify-center ${mobile
              ? 'h-8 px-3 text-[10px]'
              : 'h-9 px-4 text-xs'
            }`}
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Not logged in — show Subscribe button (blue filled)
  return (
    <button
      onClick={() => router.push('/admin/login')}
      className={`font-bold tracking-wide transition flex items-center justify-center ${mobile
          ? 'h-8 px-4 text-[10px] rounded-md bg-[#2563eb] text-white hover:bg-[#1d4ed8]'
          : 'h-9 px-6 text-xs rounded-md bg-[#2563eb] text-white hover:bg-[#1d4ed8] shadow-sm'
        }`}
    >
      Sign In
    </button>
  );
}
