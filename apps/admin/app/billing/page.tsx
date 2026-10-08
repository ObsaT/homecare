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
  CreditCard,
  Settings,
  Sparkles,
  Users,
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

interface CaregiverRegistrationPayment {
  id: string;
  amount_santim: number | string;
  amount_etb: number | string;
  method: string;
  provider: string;
  status: string;
  provider_reference: string | null;
  customer_reference: string | null;
  notes: string | null;
  created_at: string;
  caregiver_id: string;
  caregiver_name: string;
  caregiver_phone: string;
  professional_title: string;
  qualification_level: string | null;
  approval_status: string;
}

interface RegistrationFeeSetting {
  fee_etb: number;
  fee_santim: number;
  currency: string;
  description: string;
}

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<'claims' | 'caregiver_reg'>('claims');
  const [payments, setPayments] = useState<PaymentClaim[]>([]);
  const [caregiverPayments, setCaregiverPayments] = useState<CaregiverRegistrationPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Registration Fee configuration state
  const [feeSetting, setFeeSetting] = useState<RegistrationFeeSetting>({
    fee_etb: 500,
    fee_santim: 50000,
    currency: 'ETB',
    description: 'Standard Caregiver Clinical Onboarding & Telebirr Verification Fee',
  });
  const [feeInput, setFeeInput] = useState<string>('500');
  const [feeDescInput, setFeeDescInput] = useState<string>('');
  const [savingFee, setSavingFee] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [claimsRes, cgRes, feeRes] = await Promise.all([
      apiFetch<PaymentClaim[]>('/admin/payments'),
      apiFetch<CaregiverRegistrationPayment[]>('/admin/caregiver-registration-payments'),
      apiFetch<RegistrationFeeSetting>('/admin/settings/registration-fee'),
    ]);

    if (claimsRes.data) setPayments(claimsRes.data);
    if (cgRes.data) setCaregiverPayments(cgRes.data);
    if (feeRes.data) {
      setFeeSetting(feeRes.data);
      setFeeInput(String(feeRes.data.fee_etb || 500));
      setFeeDescInput(feeRes.data.description || '');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
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
      loadData();
    }
  };

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(feeInput);
    if (isNaN(val) || val <= 0) {
      setMsg({ type: 'error', text: 'Please enter a valid fee amount in ETB' });
      return;
    }

    setSavingFee(true);
    setMsg(null);

    const res = await apiFetch<RegistrationFeeSetting>('/admin/settings/registration-fee', {
      method: 'POST',
      body: JSON.stringify({
        fee_etb: val,
        description: feeDescInput || feeSetting.description,
      }),
    });

    setSavingFee(false);

    if (res.error) {
      setMsg({ type: 'error', text: res.error.message || 'Failed to update registration fee' });
    } else if (res.data) {
      setFeeSetting(res.data);
      setMsg({
        type: 'success',
        text: `Caregiver Onboarding Fee successfully updated to ETB ${res.data.fee_etb}! New caregiver signups will be charged this amount via Telebirr.`,
      });
    }
  };

  const totalCgRevenue = caregiverPayments.reduce((acc, curr) => acc + (Number(curr.amount_etb) || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#151A19]">Finance & Reconciliation</h1>
          <p className="text-sm text-[#5A6360] mt-0.5">
            Audit customer payments, manage Caregiver Telebirr Onboarding Fees, and review registration records
          </p>
        </div>
        <button
          onClick={loadData}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">Customer Claims</span>
          <p className="text-2xl font-extrabold text-amber-700 mt-2">
            {payments.filter((p) => p.status === 'CLAIMED' || p.status === 'PENDING_CONFIRMATION').length} Pending
          </p>
          <p className="text-[11px] text-[#5A6360] mt-1">Requires bank transaction verification</p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">Telebirr Caregiver Signups</span>
          <p className="text-2xl font-extrabold text-blue-700 mt-2">
            {caregiverPayments.length} Paid
          </p>
          <p className="text-[11px] text-[#5A6360] mt-1">ETB {totalCgRevenue.toLocaleString()} onboarding revenue</p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">Active Caregiver Fee</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-2">
            ETB {feeSetting.fee_etb}
          </p>
          <p className="text-[11px] text-[#5A6360] mt-1">Telebirr onboarding charge</p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">Payment Rails</span>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[11px] font-bold">Telebirr</span>
            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[11px] font-bold">CBE Birr</span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-bold">Bank</span>
          </div>
          <p className="text-[11px] text-[#5A6360] mt-1.5">Commercial banking rails</p>
        </div>
      </div>

      {/* Admin Setting: Caregiver Registration Fee Configuration */}
      <div className="p-5 bg-gradient-to-r from-blue-50/70 via-white to-emerald-50/70 rounded-xl border border-blue-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-[#0072BC] text-white rounded-lg">
                <CreditCard className="w-4 h-4" />
              </span>
              <h2 className="font-bold text-sm text-[#151A19]">Caregiver Registration Fee Setting (Admin Pricing Control)</h2>
            </div>
            <p className="text-xs text-[#5A6360] mt-1 max-w-2xl">
              Configure the onboarding fee collected when a new caregiver registers. Caregivers pay this amount via the sample Telebirr checkout during mobile account creation.
            </p>
          </div>

          <form onSubmit={handleSaveFee} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-500">ETB</span>
              <input
                type="number"
                min="0"
                step="50"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                placeholder="500"
                className="w-32 pl-12 pr-3 py-2 text-sm font-bold border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0072BC]"
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingFee}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0072BC] text-white text-xs font-bold hover:bg-[#005B94] transition shadow-sm disabled:opacity-50"
            >
              <Settings className={`w-3.5 h-3.5 ${savingFee ? 'animate-spin' : ''}`} />
              {savingFee ? 'Saving...' : 'Update Fee Amount'}
            </button>
          </form>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="border-b border-[#E6E9E8] flex gap-4">
        <button
          onClick={() => setActiveTab('claims')}
          className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
            activeTab === 'claims'
              ? 'border-[#0F6B5C] text-[#0F6B5C]'
              : 'border-transparent text-[#5A6360] hover:text-[#151A19]'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Customer Invoices & Claims ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab('caregiver_reg')}
          className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
            activeTab === 'caregiver_reg'
              ? 'border-[#0072BC] text-[#0072BC]'
              : 'border-transparent text-[#5A6360] hover:text-[#151A19]'
          }`}
        >
          <Users className="w-4 h-4" />
          Caregiver Telebirr Onboarding Payments ({caregiverPayments.length})
        </button>
      </div>

      {/* Tab Content: Customer Claims */}
      {activeTab === 'claims' && (
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
                      {loading ? 'Loading payment records...' : 'No customer payment claims found.'}
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
      )}

      {/* Tab Content: Caregiver Telebirr Onboarding Payments */}
      {activeTab === 'caregiver_reg' && (
        <div className="bg-white rounded-xl border border-[#E6E9E8] shadow-sm overflow-hidden">
          <div className="p-4 bg-blue-50/40 border-b border-blue-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-[#0072BC] uppercase tracking-wider">
                Caregiver Onboarding (Telebirr Sample) Transactions
              </h3>
              <p className="text-[11px] text-[#5A6360] mt-0.5">
                Caregivers pay this fee during self-service mobile registration before undergoing license verification.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
              Total: ETB {totalCgRevenue.toLocaleString()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFBFA] border-b border-[#E6E9E8] text-[#5A6360] font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Caregiver Name</th>
                  <th className="px-5 py-3.5">Phone Number</th>
                  <th className="px-5 py-3.5">Professional Title</th>
                  <th className="px-5 py-3.5">Amount Paid</th>
                  <th className="px-5 py-3.5">Telebirr Reference</th>
                  <th className="px-5 py-3.5">License Status</th>
                  <th className="px-5 py-3.5">Payment Status</th>
                  <th className="px-5 py-3.5 text-right">Registered On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E9E8]">
                {caregiverPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-[#5A6360]">
                      {loading ? 'Loading caregiver payments...' : 'No caregiver registration payments recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  caregiverPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F9FAFB] transition">
                      <td className="px-5 py-4 font-semibold text-[#151A19]">
                        {p.caregiver_name}
                      </td>
                      <td className="px-5 py-4 text-[#5A6360] font-mono text-[11px]">
                        {p.caregiver_phone}
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-[11px] font-medium">
                          {p.professional_title || 'Caregiver'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-blue-900">
                        ETB {Number(p.amount_etb || (Number(p.amount_santim) / 100)).toFixed(2)}
                      </td>
                      <td className="px-5 py-4 font-mono text-[11px] text-[#0072BC] font-semibold">
                        {p.provider_reference || p.customer_reference || 'N/A'}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.approval_status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {p.approval_status || 'PENDING_REVIEW'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          <CheckCircle className="w-3 h-3 text-blue-600" />
                          {p.method} {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-[11px] text-[#5A6360]">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
