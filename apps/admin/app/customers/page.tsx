'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  Users,
  Phone,
  RefreshCw,
  Ban,
  RotateCcw,
  Trash2,
  HeartPulse,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Database,
} from 'lucide-react';

interface PatientItem {
  id: string;
  full_name: string;
  age_years: number | null;
  gender: string | null;
  mobility: string | null;
}

interface CustomerData {
  id: string;
  full_name: string;
  phone_e164: string;
  email: string | null;
  account_status: string;
  created_at: string;
  patients: PatientItem[];
  total_requests: number;
  total_billed_santim: number | string;
  total_paid_santim: number | string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadCustomers = async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const res = await apiFetch<CustomerData[]>('/admin/customers');
    if (res.data) {
      setCustomers(res.data);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadCustomers();

    const handleRealtimeUpdate = () => loadCustomers(true);
    window.addEventListener('hc-realtime-update', handleRealtimeUpdate);
    const interval = setInterval(() => loadCustomers(true), 12000);
    return () => {
      window.removeEventListener('hc-realtime-update', handleRealtimeUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleStatusChange = async (id: string, status: 'ACTIVE' | 'SUSPENDED', name: string) => {
    setActionLoading(id);
    setBanner(null);
    const res = await apiFetch(`/admin/customers/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    setActionLoading(null);
    if (res.error) {
      setBanner({ type: 'error', text: res.error.message || 'Failed to update status' });
    } else {
      setBanner({
        type: 'success',
        text: `Patient/Customer "${name}" account ${status === 'SUSPENDED' ? 'suspended' : 'reactivated'}.`,
      });
      loadCustomers(true);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`Permanently delete customer/patient "${name}" and all care requests?`)) {
      return;
    }
    setActionLoading(id);
    setBanner(null);
    const res = await apiFetch(`/admin/customers/${id}`, { method: 'DELETE' });
    setActionLoading(null);
    if (res.error) {
      setBanner({ type: 'error', text: res.error.message || 'Failed to delete customer' });
    } else {
      setBanner({ type: 'success', text: `Customer "${name}" and patient records deleted.` });
      loadCustomers(true);
    }
  };

  const handleClearCustomers = async () => {
    if (
      !window.confirm(
        'Clear all Customers, Patients, Care Requests, and Invoices while preserving Caregivers and Admins?'
      )
    ) {
      return;
    }
    setActionLoading('CLEAR');
    setBanner(null);
    const res = await apiFetch<{ message: string }>('/admin/data-management/clear', {
      method: 'POST',
      body: JSON.stringify({ mode: 'CUSTOMERS_AND_REQUESTS_ONLY' }),
    });
    setActionLoading(null);
    if (res.error) {
      setBanner({ type: 'error', text: res.error.message || 'Failed to clear customer data' });
    } else {
      setBanner({ type: 'success', text: res.data?.message || 'Customer data cleared.' });
      loadCustomers(true);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#151A19]">
            Patients & Households Directory
          </h1>
          <p className="text-sm text-[#5A6360] mt-0.5">
            Manage registered customer households, patient clinical profiles, account suspension, and records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearCustomers}
            disabled={loading || actionLoading === 'CLEAR'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 hover:bg-amber-100 transition shadow-xs"
          >
            <Database className="w-3.5 h-3.5 text-amber-700" />
            Clear Patients & Requests Only
          </button>
          <button
            onClick={() => loadCustomers()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-[#E6E9E8] text-xs font-semibold text-[#151A19] hover:bg-[#F1F3F2] transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#5A6360] ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} className="text-xs underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-[#E6E9E8] p-12 text-center space-y-2">
            <p className="text-sm font-semibold text-[#151A19]">
              {loading ? 'Loading patients & households...' : 'No customers or patients registered yet.'}
            </p>
            <p className="text-xs text-[#5A6360]">
              When a customer registers in the Mobile App and books home care, their household and patient profile appear here automatically.
            </p>
          </div>
        ) : (
          customers.map((cust) => {
            const isSuspended = cust.account_status === 'SUSPENDED';
            const billedEtb = Math.round(Number(cust.total_billed_santim || 0) / 100);
            const paidEtb = Math.round(Number(cust.total_paid_santim || 0) / 100);

            return (
              <div
                key={cust.id}
                className={`bg-white rounded-2xl border p-6 shadow-sm space-y-4 transition ${
                  isSuspended
                    ? 'border-red-200 bg-red-50/10'
                    : 'border-[#E6E9E8] hover:border-[#0F6B5C]/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-full font-bold text-sm flex items-center justify-center ${
                        isSuspended ? 'bg-red-100 text-red-700' : 'bg-[#0F6B5C]/10 text-[#0F6B5C]'
                      }`}
                    >
                      {cust.full_name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-[#151A19]">{cust.full_name}</h3>
                      <p className="text-xs text-[#5A6360] flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-[#0F6B5C]" />
                        {cust.phone_e164}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      isSuspended
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {isSuspended ? 'Suspended' : 'Active'}
                  </span>
                </div>

                {/* Household Patients */}
                <div className="p-3 rounded-xl bg-[#FAFBFA] border border-[#E6E9E8] space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#5A6360] flex items-center gap-1">
                    <HeartPulse className="w-3.5 h-3.5 text-[#0F6B5C]" />
                    Household Patients ({cust.patients?.length || 0})
                  </span>
                  {cust.patients && cust.patients.length > 0 ? (
                    <div className="space-y-1.5">
                      {cust.patients.map((pt) => (
                        <div
                          key={pt.id}
                          className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-lg border border-[#E6E9E8]"
                        >
                          <span className="font-semibold text-[#151A19]">{pt.full_name}</span>
                          <span className="text-[11px] text-[#5A6360]">
                            {pt.age_years ? `${pt.age_years} yrs` : 'Adult'} • {pt.mobility || 'Standard'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#5A6360] italic">Self / Primary Account Holder</p>
                  )}
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[#E6E9E8] text-xs text-center">
                  <div>
                    <span className="text-[10px] text-[#5A6360] block">Requests</span>
                    <span className="font-bold text-[#151A19]">{cust.total_requests}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#5A6360] block">Billed</span>
                    <span className="font-bold text-[#151A19]">{billedEtb.toLocaleString()} ETB</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#5A6360] block">Paid</span>
                    <span className="font-bold text-emerald-700">{paidEtb.toLocaleString()} ETB</span>
                  </div>
                </div>

                {/* Actions: Suspend / Reactivate / Delete */}
                <div className="flex items-center gap-2 pt-1">
                  {isSuspended ? (
                    <button
                      onClick={() => handleStatusChange(cust.id, 'ACTIVE', cust.full_name)}
                      disabled={actionLoading === cust.id}
                      className="flex-1 py-2 bg-[#0F6B5C] text-white rounded-lg text-xs font-bold hover:bg-[#0A4F44] transition flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reactivate Account
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(cust.id, 'SUSPENDED', cust.full_name)}
                      disabled={actionLoading === cust.id}
                      className="flex-1 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-bold hover:bg-amber-100 transition flex items-center justify-center gap-1.5"
                    >
                      <Ban className="w-3.5 h-3.5 text-amber-700" />
                      Suspend Patient
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteCustomer(cust.id, cust.full_name)}
                    disabled={actionLoading === cust.id}
                    title="Permanently Delete Customer & Patient Records"
                    className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
