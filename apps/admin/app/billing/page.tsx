'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  CheckCircle,
  X,
  RefreshCw,
  Receipt,
  FileCheck,
  CreditCard,
  Settings,
  Users,
  SlidersHorizontal,
  Edit3,
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

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  request_id: string | null;
  customer_user_id: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
  currency: string;
  subtotal_santim: number | string;
  surcharge_santim: number | string;
  discount_santim: number | string;
  total_santim: number | string;
  paid_santim: number | string;
  total_etb: number | string;
  paid_etb: number | string;
  discount_etb: number | string;
  surcharge_etb: number | string;
  notes: string | null;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  request_reference: string | null;
  service_name_en: string | null;
  customer_name: string;
  customer_phone: string;
  patient_name: string | null;
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
  const [activeTab, setActiveTab] = useState<'invoices' | 'claims' | 'caregiver_reg'>('invoices');
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentClaim[]>([]);
  const [caregiverPayments, setCaregiverPayments] = useState<CaregiverRegistrationPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Invoice Adjustment Modal State
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRecord | null>(null);
  const [adjTotalEtb, setAdjTotalEtb] = useState<string>('');
  const [adjDiscountEtb, setAdjDiscountEtb] = useState<string>('0');
  const [adjSurchargeEtb, setAdjSurchargeEtb] = useState<string>('0');
  const [adjStatus, setAdjStatus] = useState<'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID'>('ISSUED');
  const [adjNotes, setAdjNotes] = useState<string>('');
  const [savingAdjustment, setSavingAdjustment] = useState(false);

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

  const loadData = async (silent?: boolean | unknown) => {
    const isSilent = silent === true;
    if (!isSilent) setLoading(true);
    const [invRes, claimsRes, cgRes, feeRes] = await Promise.all([
      apiFetch<InvoiceRecord[]>('/admin/invoices'),
      apiFetch<PaymentClaim[]>('/admin/payments'),
      apiFetch<CaregiverRegistrationPayment[]>('/admin/caregiver-registration-payments'),
      apiFetch<RegistrationFeeSetting>('/admin/settings/registration-fee'),
    ]);

    if (invRes.data) setInvoices(invRes.data);
    if (claimsRes.data) setPayments(claimsRes.data);
    if (cgRes.data) setCaregiverPayments(cgRes.data);
    if (feeRes.data) {
      setFeeSetting(feeRes.data);
      if (!isSilent) {
        setFeeInput(String(feeRes.data.fee_etb || 500));
        setFeeDescInput(feeRes.data.description || '');
      }
    }
    if (!isSilent) setLoading(false);
  };

  useEffect(() => {
    loadData();

    const handleRealtimeUpdate = () => {
      loadData(true);
    };

    window.addEventListener('hc-realtime-update', handleRealtimeUpdate);

    const pollInterval = setInterval(() => {
      loadData(true);
    }, 10000);

    return () => {
      window.removeEventListener('hc-realtime-update', handleRealtimeUpdate);
      clearInterval(pollInterval);
    };
  }, []);

  const openAdjustmentModal = (inv: InvoiceRecord) => {
    setEditingInvoice(inv);
    setAdjTotalEtb(String(Math.round(Number(inv.total_santim) / 100)));
    setAdjDiscountEtb(String(Math.round(Number(inv.discount_santim || 0) / 100)));
    setAdjSurchargeEtb(String(Math.round(Number(inv.surcharge_santim || 0) / 100)));
    setAdjStatus(inv.status);
    setAdjNotes(inv.notes || '');
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    setSavingAdjustment(true);
    setMsg(null);

    const res = await apiFetch(`/admin/invoices/${editingInvoice.id}/adjust`, {
      method: 'PATCH',
      body: JSON.stringify({
        total_etb: parseFloat(adjTotalEtb) || 0,
        discount_etb: parseFloat(adjDiscountEtb) || 0,
        surcharge_etb: parseFloat(adjSurchargeEtb) || 0,
        status: adjStatus,
        notes: adjNotes.trim() || undefined,
      }),
    });

    setSavingAdjustment(false);
    if (res.error) {
      setMsg({ type: 'error', text: res.error.message || 'Failed to adjust customer invoice' });
    } else {
      setMsg({
        type: 'success',
        text: `Invoice ${editingInvoice.invoice_number} adjusted (${adjTotalEtb} ETB • ${adjStatus}) and synced to customer in real time.`,
      });
      setEditingInvoice(null);
      loadData(true);
    }
  };

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

  const totalCgRevenue = caregiverPayments.reduce(
    (acc, curr) => acc + (Number(curr.amount_etb) || 0),
    0
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#151A19]">
            Finance, Customer Payment Adjustments & Onboarding
          </h1>
          <p className="text-sm text-[#5A6360] mt-0.5">
            Adjust customer invoices, apply discounts/surcharges, verify Telebirr/CBE claims, and manage caregiver fees
          </p>
        </div>
        <button
          onClick={() => loadData()}
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

      {/* Invoice Adjustment Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E6E9E8] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E9E8] pb-3">
              <div>
                <h3 className="font-bold text-base text-[#151A19]">
                  Adjust Customer Invoice ({editingInvoice.invoice_number})
                </h3>
                <p className="text-xs text-[#5A6360]">
                  Customer: {editingInvoice.customer_name} ({editingInvoice.customer_phone})
                </p>
              </div>
              <button
                onClick={() => setEditingInvoice(null)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#151A19] mb-1">
                  Adjusted Final Total Amount (ETB)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={adjTotalEtb}
                  onChange={(e) => setAdjTotalEtb(e.target.value)}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#5A6360] mb-1">
                    Discount Applied (ETB)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={adjDiscountEtb}
                    onChange={(e) => setAdjDiscountEtb(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5A6360] mb-1">
                    Extra Surcharge (ETB)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={adjSurchargeEtb}
                    onChange={(e) => setAdjSurchargeEtb(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#5A6360] mb-1">Invoice Status</label>
                <select
                  value={adjStatus}
                  onChange={(e) => setAdjStatus(e.target.value as InvoiceRecord['status'])}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]"
                >
                  <option value="ISSUED">ISSUED (Awaiting Customer Payment)</option>
                  <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                  <option value="PAID">PAID (Settled in Full)</option>
                  <option value="VOID">VOID / WAIVED</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#5A6360] mb-1">
                  Adjustment Reason / Audit Note
                </label>
                <input
                  type="text"
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  placeholder="e.g. Extended visit duration +30m or senior citizen discount"
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E9E8]">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="px-4 py-2 rounded-lg border border-[#E6E9E8] font-semibold text-[#5A6360] hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdjustment}
                  className="px-4 py-2 rounded-lg bg-[#0F6B5C] text-white font-bold hover:bg-[#0A4F44] disabled:opacity-50"
                >
                  {savingAdjustment ? 'Saving...' : 'Apply Payment Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">
            Customer Invoices
          </span>
          <p className="text-2xl font-extrabold text-[#151A19] mt-2">{invoices.length} Total</p>
          <p className="text-[11px] text-[#5A6360] mt-1">
            {invoices.filter((i) => i.status === 'ISSUED').length} awaiting payment
          </p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">
            Customer Claims
          </span>
          <p className="text-2xl font-extrabold text-amber-700 mt-2">
            {
              payments.filter(
                (p) => p.status === 'CLAIMED' || p.status === 'PENDING_CONFIRMATION'
              ).length
            }{' '}
            Pending
          </p>
          <p className="text-[11px] text-[#5A6360] mt-1">Requires bank transaction verification</p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">
            Telebirr Caregiver Signups
          </span>
          <p className="text-2xl font-extrabold text-blue-700 mt-2">
            {caregiverPayments.length} Paid
          </p>
          <p className="text-[11px] text-[#5A6360] mt-1">
            ETB {totalCgRevenue.toLocaleString()} onboarding revenue
          </p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">
            Active Caregiver Fee
          </span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-2">
            ETB {feeSetting.fee_etb}
          </p>
          <p className="text-[11px] text-[#5A6360] mt-1">Telebirr onboarding charge</p>
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
              <h2 className="font-bold text-sm text-[#151A19]">
                Caregiver Registration Fee Setting (Admin Pricing Control)
              </h2>
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
      <div className="border-b border-[#E6E9E8] flex gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 shrink-0 ${
            activeTab === 'invoices'
              ? 'border-[#0F6B5C] text-[#0F6B5C]'
              : 'border-transparent text-[#5A6360] hover:text-[#151A19]'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Customer Invoices & Adjustments ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 shrink-0 ${
            activeTab === 'claims'
              ? 'border-[#0F6B5C] text-[#0F6B5C]'
              : 'border-transparent text-[#5A6360] hover:text-[#151A19]'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Payment Claims Verification ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab('caregiver_reg')}
          className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 shrink-0 ${
            activeTab === 'caregiver_reg'
              ? 'border-[#0072BC] text-[#0072BC]'
              : 'border-transparent text-[#5A6360] hover:text-[#151A19]'
          }`}
        >
          <Users className="w-4 h-4" />
          Caregiver Telebirr Onboarding ({caregiverPayments.length})
        </button>
      </div>

      {/* Tab 1: Customer Invoices & Payment Adjustments */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl border border-[#E6E9E8] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFBFA] border-b border-[#E6E9E8] text-[#5A6360] font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Invoice #</th>
                  <th className="px-5 py-3.5">Customer & Patient</th>
                  <th className="px-5 py-3.5">Service / Request</th>
                  <th className="px-5 py-3.5">Total (ETB)</th>
                  <th className="px-5 py-3.5">Discount / Surcharge</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Adjust Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E9E8]">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-[#5A6360]">
                      {loading
                        ? 'Loading customer invoices...'
                        : 'No customer invoices generated yet. Invoices are automatically created when a customer submits a care request.'}
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const totalEtb = Math.round(Number(inv.total_santim) / 100);
                    const discEtb = Math.round(Number(inv.discount_santim || 0) / 100);
                    const surEtb = Math.round(Number(inv.surcharge_santim || 0) / 100);

                    return (
                      <tr key={inv.id} className="hover:bg-[#F9FAFB] transition">
                        <td className="px-5 py-4 font-mono font-bold text-[#151A19]">
                          {inv.invoice_number}
                          {inv.notes && (
                            <p className="font-sans font-normal text-[10px] text-[#5A6360] mt-0.5 max-w-xs truncate">
                              Note: {inv.notes}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-[#151A19]">{inv.customer_name}</p>
                          <p className="text-[11px] text-[#5A6360]">
                            {inv.customer_phone}
                            {inv.patient_name ? ` • Pt: ${inv.patient_name}` : ''}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-[#151A19]">
                            {inv.service_name_en || 'Clinical Home Care'}
                          </p>
                          <p className="text-[11px] font-mono text-[#5A6360]">
                            {inv.request_reference || 'Direct Invoice'}
                          </p>
                        </td>
                        <td className="px-5 py-4 font-extrabold text-emerald-800 text-sm">
                          ETB {totalEtb.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-[11px] text-[#5A6360]">
                          {discEtb > 0 && (
                            <span className="inline-block mr-2 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                              -{discEtb} ETB Disc
                            </span>
                          )}
                          {surEtb > 0 && (
                            <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold">
                              +{surEtb} ETB Extra
                            </span>
                          )}
                          {discEtb === 0 && surEtb === 0 && <span>Standard Rate</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              inv.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : inv.status === 'VOID'
                                  ? 'bg-gray-100 text-gray-600 border-gray-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => openAdjustmentModal(inv)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F6B5C] text-white font-semibold text-xs hover:bg-[#0A4F44] transition shadow-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Adjust Amount / Status
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Customer Claims */}
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

      {/* Tab 3: Caregiver Telebirr Onboarding Payments */}
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
                        ETB {Number(p.amount_etb || Number(p.amount_santim) / 100).toFixed(2)}
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
