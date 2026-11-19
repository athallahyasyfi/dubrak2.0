'use client';

import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, Eye, EyeOff, LogOut, ShieldCheck } from 'lucide-react';
import type { StaffRole } from '@/lib/security/auth-store';

interface StaffAuthGateProps {
  role: StaffRole;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function StaffAuthGate({ role, title, subtitle, children }: StaffAuthGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeUsername, setActiveUsername] = useState<string>(role);

  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/auth?role=${role}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted) return;
        if (data?.accountInfo?.username) {
          setUsername(data.accountInfo.username);
        }
        if (data?.authenticated) {
          setActiveUsername(data.username || role);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        if (mounted) setIsAuthenticated(false);
      });
    return () => {
      mounted = false;
    };
  }, [role]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          role,
          username: username.trim(),
          password,
          rememberMe,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal masuk. Periksa kembali kredensial Anda.');
      }

      setActiveUsername(data.username);
      setPassword('');
      setIsAuthenticated(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Username atau password salah.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch {
      // Abaikan
    }
    setIsAuthenticated(false);
    setPassword('');
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6F3]">
        <div className="w-5 h-5 border-2 border-[#D9381E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF6F3] flex items-center justify-center p-4 text-[#1C1917]">
        <div className="bg-white w-full max-w-sm rounded-lg p-6 sm:p-7 shadow-sm border border-[#E6DCD5] space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-[#EFE8E2]">
            <div className="w-10 h-10 rounded-md bg-[#FCEAE6] text-[#D9381E] flex items-center justify-center border border-[#F5D0C8] shrink-0">
              {role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <div>
              <h1 className="text-base font-semibold text-[#1C1917]">{title}</h1>
              {subtitle && <p className="text-xs text-[#78716C]">{subtitle}</p>}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium text-[#44403C] block">Username</label>
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-[#DCD2CB] bg-[#FAF6F3] focus:bg-white focus:border-[#D9381E] focus:outline-hidden text-xs font-medium text-[#1C1917] transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-[#44403C] block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 rounded-md border border-[#DCD2CB] bg-[#FAF6F3] focus:bg-white focus:border-[#D9381E] focus:outline-hidden text-xs font-medium text-[#1C1917] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-0.5 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-[#DCD2CB] text-[#D9381E] focus:ring-[#D9381E]"
              />
              <span className="text-xs text-[#57534E]">Ingat saya</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#D9381E] hover:bg-[#C02E16] text-white font-semibold py-2.5 px-4 rounded-md text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <span>{loading ? 'Memverifikasi...' : 'Masuk'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="fixed bottom-3 right-3 z-50 flex items-center gap-1.5">
        <span className="bg-white text-[#1C1917] text-xs font-medium px-3 py-1.5 rounded-md shadow-sm border border-[#DCD2CB]">
          Akun: {activeUsername}
        </span>

        <button
          onClick={handleLogout}
          className="bg-[#1C1917] hover:bg-[#292524] text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-sm flex items-center gap-1.5 transition"
          title="Keluar dari Sesi"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </div>

      {children}
    </div>
  );
}
