'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAction } from '@/app/actions';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(formData);

    if (result.success) {
      const target = (() => {
        if (result.role === 'kiosk') return '/kiosk';
        const callbackUrl = searchParams.get('callbackUrl');
        const isSafe =
          !!callbackUrl &&
          /^\/(?![/\\])/.test(callbackUrl) &&
          !callbackUrl.startsWith('/login');
        return isSafe ? callbackUrl : '/';
      })();
      router.push(target);
      router.refresh();
    } else {
      setError(result.error || 'Unable to sign in. Please check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF0DA] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#FFFDF8] rounded-2xl border border-[#E5D5BC] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-28 h-auto rounded-xl overflow-hidden mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sorelin-lockup-primary.png"
              alt="Sorelin Bakery"
              className="w-full h-auto object-contain"
            />
          </div>
          <h1 className="text-base font-bold text-[#3F2311]">Point of Sale</h1>
          <p className="text-xs text-[#8E6D53] mt-0.5">Sign in with your account credentials</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200 text-center">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-xs font-medium text-[#3F2311] mb-1.5">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              autoFocus
              placeholder="Enter username"
              className="w-full px-3.5 py-2.5 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#8E6D53]/70 focus:outline-none focus:ring-2 focus:ring-[#6B4227] focus:bg-[#FFFDF8] transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-[#3F2311] mb-1.5">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter password"
              className="w-full px-3.5 py-2.5 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#8E6D53]/70 focus:outline-none focus:ring-2 focus:ring-[#6B4227] focus:bg-[#FFFDF8] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl text-sm font-semibold hover:bg-[#54311B] transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF0DA] flex items-center justify-center text-xs font-medium text-[#6B4227]">
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
