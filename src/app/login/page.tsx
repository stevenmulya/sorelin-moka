'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAction } from '@/app/actions';
import { Lock, User } from 'lucide-react';

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
      setError(result.error || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#FFFDF9] rounded-3xl shadow-lg border border-[#EADBCC] overflow-hidden">
        <div className="p-8 text-center bg-[#4A2E1B] text-[#FFFDF9]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/sorelin-secondary-lockup.png" 
            alt="Sorelin" 
            className="w-36 h-auto mx-auto mb-3 drop-shadow-sm filter brightness-0 invert" 
          />
          <h1 className="text-xl font-bold tracking-tight">Point of Sale System</h1>
          <p className="text-[#EADBCC] mt-1 text-xs">Sign in as Cashier or Administrator</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-xs font-semibold border border-red-200">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#3B2314] mb-1.5 uppercase tracking-wider">Username</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6251]" />
                <input 
                  name="username"
                  type="text" 
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF7F2] border border-[#E2D6C6] rounded-xl text-sm text-[#3B2314] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B] focus:bg-white transition-all"
                  placeholder="Enter username"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-[#3B2314] mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6251]" />
                <input 
                  name="password"
                  type="password" 
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF7F2] border border-[#E2D6C6] rounded-xl text-sm text-[#3B2314] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B] focus:bg-white transition-all"
                  placeholder="Enter password"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl font-bold hover:bg-[#3D2413] transition-all shadow-sm disabled:opacity-60 flex items-center justify-center text-sm cursor-pointer active:scale-[0.99]"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="pt-2 text-center border-t border-[#F0EAE1]">
            <a 
              href="/kiosk" 
              className="text-xs text-[#7A6251] hover:text-[#3B2314] font-medium transition-colors"
            >
              Customer ordering? Go to Kiosk Mode →
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
