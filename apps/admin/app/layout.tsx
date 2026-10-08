import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '../lib/auth-context';
import { WebSocketProvider } from '../lib/websocket-context';
import { AuthGuard } from '../lib/auth-guard';
import { AdminShell } from '../lib/admin-shell';

export const metadata: Metadata = {
  title: 'Home Care Ops — Addis Ababa Admin Control Desk',
  description: 'Operations, dispatch, caregiver vetting, and billing platform for Addis Ababa home health care',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F7F8F7] text-[#151A19]">
        <AuthProvider>
          <WebSocketProvider>
            <AuthGuard>
              <AdminShell>{children}</AdminShell>
            </AuthGuard>
          </WebSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
