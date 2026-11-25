'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, ArrowRight, Lock, User, ShieldCheck } from 'lucide-react';

const RAW_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://130.210.55.231.sslip.io';
const BACKEND_URL = typeof window !== 'undefined' && window.location.protocol === 'https:'
  ? RAW_BACKEND_URL.replace(/^http:\/\//i, 'https://')
  : RAW_BACKEND_URL;

export default function LoginPage() {
  const router = useRouter();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg('');
    setIsLoading(true);

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (isLoginMode) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('userId', data.user.id || data.user._id);
        router.push('/');
      } else {
        setIsLoginMode(true);
        setFeedbackMsg('Account created successfully. You can now log in.');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFeedbackMsg(err.message);
      } else {
        setFeedbackMsg('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[#111b21] text-[#e9edef] p-4 sm:p-6 font-sans select-none">
      <div className="w-full max-w-sm bg-[#202c33] border border-[#222e35] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="space-y-1.5 text-center">
          <div className="w-12 h-12 rounded-full bg-[#00a884] text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#00a884]/20">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-[#e9edef] tracking-tight">
            {isLoginMode ? 'Sign In to Chat' : 'Create an Account'}
          </h1>
          <p className="text-xs text-[#8696a0]">
            {isLoginMode
              ? 'Enter your username and password to start chatting'
              : 'Sign up to connect in real-time over PostgreSQL'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {feedbackMsg && (
            <div
              className={`p-2.5 rounded-lg text-xs font-medium text-center border ${
                feedbackMsg.includes('successfully')
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                  : 'bg-red-950/40 text-red-300 border-red-800/60'
              }`}
            >
              {feedbackMsg}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-[#8696a0]" />
              <Input
                disabled={isLoading}
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="pl-9 h-10 bg-[#111b21] border-[#222e35] text-sm text-[#e9edef] placeholder:text-[#8696a0] rounded-xl focus-visible:ring-[#00a884]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-[#8696a0]" />
              <Input
                disabled={isLoading}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-9 h-10 bg-[#111b21] border-[#222e35] text-sm text-[#e9edef] placeholder:text-[#8696a0] rounded-xl focus-visible:ring-[#00a884]"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 bg-[#00a884] hover:bg-[#029070] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-[#00a884]/20 gap-1.5 mt-2"
          >
            <span>{isLoading ? 'Connecting...' : isLoginMode ? 'Sign In' : 'Create Account'}</span>
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </Button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setFeedbackMsg('');
              }}
              className="text-xs text-[#00a884] hover:underline transition-colors font-medium"
            >
              {isLoginMode
                ? "Don't have an account? Sign up now"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>

        <div className="pt-3 border-t border-[#222e35] text-center flex items-center justify-center gap-1.5 text-[11px] text-[#8696a0]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" /> End-to-End Encrypted • Bun + PostgreSQL
        </div>

      </div>
    </div>
  );
}
