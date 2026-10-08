'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth-context';
import { useDashboardWebSocket } from './websocket-context';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Stethoscope,
  Star,
  HeartPulse,
  Receipt,
  LogOut,
  ShieldCheck,
  Building2,
  Menu,
  X,
  Bell,
  Volume2,
  Radio,
  CheckCircle2,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Request Queue', href: '/requests', icon: ClipboardList },
  { name: 'Caregivers & Nurses', href: '/caregivers', icon: Users },
  { name: 'Services & Pricing', href: '/services', icon: Stethoscope },
  { name: 'Finance & Payments', href: '/billing', icon: Receipt },
  { name: 'Reviews & Quality', href: '/reviews', icon: Star },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isConnected, notifications, unreadCount, markAllAsRead, clearNotifications, playAlertSound } = useDashboardWebSocket();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <main className="min-h-screen bg-slate-900">{children}</main>;
  }

  const roleLabel = user?.role ? user.role.replace('_', ' ') : 'OPERATOR';

  return (
    <div className="min-h-screen flex bg-[#F7F8F7] text-[#151A19]">
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar (Responsive Drawer on Mobile, Fixed Sidebar on Desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-white border-r border-[#E6E9E8] flex flex-col transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#E6E9E8]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0F6B5C] flex items-center justify-center text-white shadow-sm">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-[#151A19]">Home Care</h1>
              <p className="text-xs text-[#5A6360]">Addis Ababa HQ</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#0F6B5C] text-white shadow-sm'
                    : 'text-[#5A6360] hover:text-[#0F6B5C] hover:bg-[#F1F3F2]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#5A6360]'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-[#E6E9E8] bg-[#FAFBFA]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#0F6B5C]/15 text-[#0F6B5C] font-bold text-xs flex items-center justify-center shrink-0">
                {user?.full_name?.slice(0, 2).toUpperCase() || 'AD'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#151A19] truncate">
                  {user?.full_name || 'Admin User'}
                </p>
                <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  {roleLabel}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 w-full lg:pl-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-[#E6E9E8] flex items-center justify-between px-4 sm:px-8 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3">
            {/* Hamburger Button for Mobile */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#2D3748] truncate">
                Dispatch Desk Live
              </span>
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Radio className={`w-3 h-3 ${isConnected ? 'text-emerald-600' : 'text-amber-500 animate-pulse'}`} />
                {isConnected ? 'WebSocket Real-Time' : 'Connecting WS...'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs text-[#5A6360]">
            {/* Test Alert Sound Button */}
            <button
              onClick={playAlertSound}
              title="Test Dispatch Chime Audio"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 transition"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#0F6B5C]" />
              <span className="hidden md:inline font-medium text-[11px]">Test Sound</span>
            </button>

            {/* Notification Bell with Badge & Dropdown */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                title="Notifications"
                className="relative p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 transition"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Panel */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-2 duration-150">
                  <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#0F6B5C]" />
                      <span className="font-bold text-xs text-gray-900">Live Notifications</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {notifications.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-[11px] text-[#0F6B5C] hover:underline font-medium"
                        >
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={clearNotifications}
                        className="text-[11px] text-gray-400 hover:text-gray-600"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-xs">
                        No notifications yet. Waiting for live events...
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 text-xs transition ${
                            n.read ? 'bg-white opacity-80' : 'bg-emerald-50/40 border-l-2 border-[#0F6B5C]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900">{n.title}</span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-gray-600 mt-0.5">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-md text-gray-700 font-medium">
              <Building2 className="w-3.5 h-3.5 text-gray-500" />
              <span>11 Sub-Cities</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2 sm:px-2.5 py-1 rounded-md font-medium border border-emerald-200 text-[11px] sm:text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>AES-256</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
