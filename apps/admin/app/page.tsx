'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../lib/api';
import {
  Calendar,
  Clock,
  Activity,
  UserCheck,
  CheckCircle2,
  Banknote,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Users,
  ShieldAlert,
} from 'lucide-react';

interface DashboardSummary {
  today_appointments: number;
  pending_requests: number;
  active_visits: number;
  available_caregivers: number;
  completed_visits: number;
  revenue_santim: number;
  revenue_etb: number;
  customer_count: number;
}

interface RecentRequest {
  id: string;
  reference: string;
  status: string;
  service_code: string;
  service_name_en: string;
  service_name_am: string;
  customer_name: string;
  customer_phone: string;
  patient_name: string;
  preferred_date: string;
  preferred_time: string;
  price_santim: number | string;
  caregiver_name: string | null;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async (silent?: boolean | unknown) => {
    const isSilent = silent === true;
    if (!isSilent) setLoading(true);
    const [summaryRes, reqsRes] = await Promise.all([
      apiFetch<DashboardSummary>('/admin/dashboard/summary'),
      apiFetch<RecentRequest[]>('/admin/requests'),
    ]);

    if (summaryRes.data) {
      setSummary(summaryRes.data);
    }
    if (reqsRes.data) {
      setRecentRequests(reqsRes.data);
    }
    if (!isSilent) setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const handleRealtimeUpdate = () => {
      fetchData(true);
    };

    window.addEventListener('hc-realtime-update', handleRealtimeUpdate);

    const pollInterval = setInterval(() => {
      fetchData(true);
    }, 8000);

    return () => {
      window.removeEventListener('hc-realtime-update', handleRealtimeUpdate);
      clearInterval(pollInterval);
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'ASSIGNED':
      case 'ACCEPTED':
      case 'CONFIRMED':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'EN_ROUTE':
      case 'IN_PROGRESS':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#151A19]">Addis Ababa Care Operations</h1>
          <p className="text-sm text-[#5A6360] mt-1">
            Real-time dispatch overview, appointment fulfillment, and field activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E6E9E8] bg-white text-sm font-medium text-[#151A19] hover:bg-[#F1F3F2] transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[#5A6360] ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/requests"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F6B5C] text-sm font-semibold text-white hover:bg-[#0A4F44] transition shadow-sm"
          >
            Dispatch Queue
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Emergency Protocol Advisory */}
      <div className="flex items-start gap-3.5 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Medical Emergency Dispatch Policy: </span>
          Our home health service delivers certified in-home clinical care. For acute life-threatening trauma or emergency resuscitation, dispatchers must immediately instruct callers to dial <strong>907 (Addis Fire & Emergency)</strong> or proceed to the nearest emergency medical centre.
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">Today's Appointments</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#151A19] mt-3">
            {summary?.today_appointments ?? 0}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active field schedule
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">Pending Dispatch</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#151A19] mt-3">
            {summary?.pending_requests ?? 0}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            Requires nurse assignment
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">Available Nurses & CGs</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#151A19] mt-3">
            {summary?.available_caregivers ?? 0}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-blue-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Ready for instant dispatch
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5A6360]">Registered Patients</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#151A19] mt-3">
            {summary?.customer_count ?? 0}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-purple-700 font-medium">
            <span>Addis Ababa Households</span>
          </div>
        </div>
      </div>

      {/* Main Request Queue Table Card */}
      <div className="bg-white rounded-xl border border-[#E6E9E8] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E6E9E8] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#151A19]">Recent Care Requests & Dispatches</h2>
            <p className="text-xs text-[#5A6360] mt-0.5">Live queue from customer mobile apps across Addis Ababa</p>
          </div>
          <Link
            href="/requests"
            className="text-xs font-semibold text-[#0F6B5C] hover:underline inline-flex items-center gap-1"
          >
            View Full Queue
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFBFA] border-b border-[#E6E9E8] text-[#5A6360] font-semibold">
              <tr>
                <th className="px-5 py-3">Reference / Patient</th>
                <th className="px-5 py-3">Service Requested</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Schedule</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Assigned Nurse</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E9E8]">
              {recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[#5A6360]">
                    No care requests found in the current dispatch queue.
                  </td>
                </tr>
              ) : (
                recentRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-[#151A19]">{req.patient_name}</p>
                      <p className="text-[11px] font-mono text-[#5A6360]">{req.reference}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-[#151A19]">{req.service_name_en}</p>
                      <p className="text-[11px] text-[#5A6360]">{req.service_name_am}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[#151A19]">{req.customer_name}</p>
                      <p className="text-[11px] text-[#5A6360]">{req.customer_phone}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[#151A19]">{req.preferred_time || 'Immediate'}</p>
                      <p className="text-[11px] text-[#5A6360]">
                        {req.preferred_date ? new Date(req.preferred_date).toLocaleDateString() : 'Today'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusBadge(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {req.caregiver_name ? (
                        <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{req.caregiver_name}</span>
                        </div>
                      ) : (
                        <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href="/requests"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#0F6B5C]/10 text-[#0F6B5C] font-semibold hover:bg-[#0F6B5C] hover:text-white transition"
                      >
                        Manage
                      </Link>
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
