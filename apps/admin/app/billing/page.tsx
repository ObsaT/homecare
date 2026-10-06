'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  Banknote,
  CheckCircle,
  Clock,
  ShieldCheck,
  X,
  RefreshCw,
  Phone,
  Receipt,
  FileCheck,
} from 'lucide-react';

interface PaymentClaim {
  id: string;
  amount_santim: number | string;
  method: string;
  status: string;
  customer_reference: string | null;
  provider_reference?: string | null;
  notes: string | null;
  created_at: string;
  invoice_number: string | null;
  customer_name: string;
  customer_phone: string;
}

export default function BillingPage() {
  const [payments, setPayments] = useState<PaymentClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPayments = async () => {
    setLoading(true);
    const res = await apiFetch<PaymentClaim[]>('/admin/payments');
    if (res.data) {
      setPayments(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleConfirm = async (paymentId: string) => {
    setConfirmingId(paymentId);
    setMsg(null);

    const res = await apiFetch(`/admin/payments/${paymentId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ notes: 'Reconciled and confirmed by admin operator.' }),
    });

    setConfirmingId(null);

    if (res.error) {
      setMsg({ type: 'error', text: res.error.message || 'Failed to confirm payment' });
    } else {
      setMsg({ type: 'success', text: 'Payment verified! Invoice status marked as PAID.' });
      loadPayments();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#151A19]">Finance & Reconciliation</h1>
          <p className="text-sm text-[#5A6360] mt-0.5">
            Audit and confirm Telebirr, CBE Birr, and Bank Transfer customer claims in Addis Ababa
          </p>
        </div>
        <button
          onClick={loadPayments}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-[#E6E9E8] text-sm font-medium text-[#151A19] hover:bg-[#F1F3F2] transition shadow-sm disabled:opacity-50 self-start"
        >
          <RefreshCw className={`w-4 h-4 text-[#5A6360] ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">Pending Telebirr / CBE</span>
          <p className="text-2xl font-extrabold text-amber-700 mt-2">
            {payments.filter((p) => p.status === 'CLAIMED' || p.status === 'PENDING_CONFIRMATION').length} Claims
          </p>
          <p className="text-[11px] text-[#5A6360] mt-1">Requires bank transaction verification</p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">Confirmed Payments</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-2">
            {payments.filter((p) => p.status === 'CONFIRMED').length} Records
          </p>
          <p className="text-[11px] text-[#5A6360] mt-1">Reconciled to general ledger</p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">Supported Providers</span>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold">Telebirr</span>
            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-bold">CBE Birr</span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold">Bank Wire</span>
          </div>
          <p className="text-[11px] text-[#5A6360] mt-1.5">Official Ethiopian banking rails</p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-[#E6E9E8] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFBFA] border-b border-[#E6E9E8] text-[#5A6360] font-semibold">
              <tr>
                <th className="px-5 py-3.5">Invoice / Reference</th>
                <th className="px-5 py-3.5">Customer / Contact</th>
                <th className="px-5 py-3.5">Method & Provider</th>
                <th className="px-5 py-3.5">Amount (ETB)</th>
                <th className="px-5 py-3.5">Claim Reference</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E9E8]">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[#5A6360]">
                    {loading ? 'Loading payment records...' : 'No payment records found.'}
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F9FAFB] transition">
                    <td className="px-5 py-4 font-mono font-medium text-[#151A19]">
                      {p.invoice_number || 'INV-PENDING'}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#151A19]">{p.customer_name || 'Customer'}</p>
                      <p className="text-[11px] text-[#5A6360]">{p.customer_phone}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-[#151A19]">{p.method}</span>
                    </td>
                    <td className="px-5 py-4 font-bold text-emerald-800">
                      ETB {(Number(p.amount_santim) / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] text-[#5A6360]">
                      {p.provider_reference || p.customer_reference || 'N/A'}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          p.status === 'CONFIRMED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {p.status !== 'CONFIRMED' ? (
                        <button
                          onClick={() => handleConfirm(p.id)}
                          disabled={confirmingId === p.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F6B5C] text-white font-semibold text-xs hover:bg-[#0A4F44] transition shadow-sm disabled:opacity-50"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          {confirmingId === p.id ? 'Verifying...' : 'Confirm'}
                        </button>
                      ) : (
                        <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Settled
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
