'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { ShieldCheck, Lock, Phone, KeyRound, ArrowRight, UserCheck, AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { loginWithPassword, requestOtp, verifyOtp } = useAuth();

  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [phone, setPhone] = useState('+251911000001');
  const [password, setPassword] = useState('Admin@Addis2026!');
  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await loginWithPassword(phone, password);
    setLoading(false);

    if (res.success) {
      router.push('/');
    } else {
      setError(res.error || 'Failed to authenticate');
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await requestOtp(phone);
    setLoading(false);

    if (res.success && res.challengeId) {
      setOtpChallengeId(res.challengeId);
    } else {
      setError(res.error || 'Could not send verification code');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpChallengeId) return;
    setError(null);
    setLoading(true);

    const res = await verifyOtp(otpChallengeId, otpCode);
    setLoading(false);

    if (res.success) {
      router.push('/');
    } else {
      setError(res.error || 'Invalid code');
    }
  };

  const fillDemoUser = (demoPhone: string, demoPass: string) => {
    setPhone(demoPhone);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100">
      {/* Left Branding Column */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 border-r border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Addis Home Care</h1>
              <p className="text-xs text-emerald-400 font-medium">Operations & Clinical Control Desk</p>
            </div>
          </div>

          <div className="mt-20 max-w-md">
            <h2 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Clinical Quality & Dispatch Operations in Addis Ababa
            </h2>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              Enterprise management dashboard for dispatching certified caregivers, verifying nurse licenses, monitoring vital signs, and reconciling Telebirr/CBE transactions.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-2xl font-bold text-emerald-400">11</p>
                <p className="text-xs text-slate-400 mt-1">Sub-Cities Covered</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-2xl font-bold text-emerald-400">100%</p>
                <p className="text-xs text-slate-400 mt-1">Encrypted PHI Records</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          © 2026 Home Care Addis Ababa • Secure Clinical Portal v1.0
        </div>
      </div>

      {/* Right Form Column */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">Administrator Sign In</h2>
            <p className="text-xs text-slate-400">
              Access the dispatch queue, patient rosters, and billing controls.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
            <button
              type="button"
              onClick={() => { setMode('password'); setOtpChallengeId(null); setError(null); }}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                mode === 'password'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('otp'); setError(null); }}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                mode === 'otp'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Phone OTP Login
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold">{error}</p>
              </div>
            </div>
          )}

          {mode === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Ethiopian Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+251 91 100 0001 or 0911000001"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50 shadow-md shadow-emerald-900/30"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    Sign In to Console
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {!otpChallengeId ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Phone for SMS Code</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+251 91 100 0001"
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {loading ? 'Sending SMS...' : 'Request 6-Digit OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Enter 6-Digit OTP</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 pl-9 text-xs text-white placeholder-slate-500 tracking-widest text-center font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">Sent to {phone}. In development environment, enter any 6 digits.</p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify & Enter'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 1-Click Demo Profiles */}
          <div className="border-t border-slate-800 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Quick 1-Click Demo Access
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => fillDemoUser('+251911000001', 'Admin@Addis2026!')}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 p-2.5 text-left hover:border-emerald-500/50 hover:bg-slate-800 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                    MD
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Dr. Meron Tadesse</p>
                    <p className="text-[10px] text-slate-400">System Admin • +251 91 100 0001</p>
                  </div>
                </div>
                <UserCheck className="h-4 w-4 text-emerald-400" />
              </button>

              <button
                type="button"
                onClick={() => fillDemoUser('+251911000002', 'Admin@Addis2026!')}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 p-2.5 text-left hover:border-emerald-500/50 hover:bg-slate-800 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                    SB
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Sister Bethlehem Haile</p>
                    <p className="text-[10px] text-slate-400">Clinical Supervisor • +251 91 100 0002</p>
                  </div>
                </div>
                <UserCheck className="h-4 w-4 text-blue-400" />
              </button>

              <button
                type="button"
                onClick={() => fillDemoUser('+251911000003', 'Admin@Addis2026!')}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 p-2.5 text-left hover:border-emerald-500/50 hover:bg-slate-800 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">
                    YA
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Yonas Alemu</p>
                    <p className="text-[10px] text-slate-400">Dispatch Coordinator • +251 91 100 0003</p>
                  </div>
                </div>
                <UserCheck className="h-4 w-4 text-amber-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
