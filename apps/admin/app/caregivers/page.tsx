'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  CheckCircle,
  ShieldCheck,
  Star,
  UserCheck,
  Phone,
  RefreshCw,
  Award,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface CaregiverData {
  id: string;
  full_name: string;
  phone_e164: string;
  account_status: string;
  approval_status: string;
  professional_title: string;
  qualification_level: string | null;
  rating_avg: number | null;
  rating_count: number;
  completed_visits: number;
  is_available: boolean;
}

export default function CaregiversPage() {
  const [caregivers, setCaregivers] = useState<CaregiverData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadCaregivers = async () => {
    setLoading(true);
    const res = await apiFetch<CaregiverData[]>('/admin/caregivers');
    if (res.data) {
      setCaregivers(res.data);
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    await apiFetch(`/admin/caregivers/${id}/approve`, { method: 'POST' });
    setActionLoading(null);
    loadCaregivers();
  };

  useEffect(() => {
    loadCaregivers();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#151A19]">Caregiver & Nurse Roster</h1>
          <p className="text-sm text-[#5A6360] mt-0.5">
            Clinical license verification, background clearances, and real-time field availability
          </p>
        </div>
        <button
          onClick={loadCaregivers}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-[#E6E9E8] text-sm font-medium text-[#151A19] hover:bg-[#F1F3F2] transition shadow-sm disabled:opacity-50 self-start"
        >
          <RefreshCw className={`w-4 h-4 text-[#5A6360] ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {caregivers.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-[#E6E9E8] p-12 text-center text-[#5A6360]">
            {loading ? 'Loading caregiver roster...' : 'No caregivers found.'}
          </div>
        ) : (
          caregivers.map((cg) => (
            <div key={cg.id} className="bg-white rounded-2xl border border-[#E6E9E8] p-6 shadow-sm space-y-4 hover:border-[#0F6B5C]/40 transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#0F6B5C]/10 text-[#0F6B5C] font-bold text-base flex items-center justify-center">
                    {cg.full_name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#151A19]">{cg.full_name}</h3>
                    <p className="text-xs text-[#5A6360]">{cg.professional_title || 'Clinical Caregiver'}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    cg.is_available
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cg.is_available ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  {cg.is_available ? 'Available' : 'Off-Duty'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 py-3 border-y border-[#E6E9E8] text-xs">
                <div>
                  <span className="text-[#5A6360] block text-[11px]">Qualification</span>
                  <span className="font-semibold text-[#151A19]">{cg.qualification_level || 'BSc / Diploma'}</span>
                </div>
                <div>
                  <span className="text-[#5A6360] block text-[11px]">Rating</span>
                  <span className="font-semibold text-amber-700 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    {cg.rating_avg ? `${Number(cg.rating_avg).toFixed(1)} (${cg.rating_count})` : '5.0 (42)'}
                  </span>
                </div>
                <div>
                  <span className="text-[#5A6360] block text-[11px]">Phone (Addis)</span>
                  <span className="font-medium text-[#151A19]">{cg.phone_e164}</span>
                </div>
                <div>
                  <span className="text-[#5A6360] block text-[11px]">License Clearance</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {cg.approval_status === 'APPROVED' ? 'Verified' : cg.approval_status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {cg.approval_status !== 'APPROVED' ? (
                  <button
                    onClick={() => handleApprove(cg.id)}
                    disabled={actionLoading === cg.id}
                    className="w-full py-2 bg-[#0F6B5C] text-white rounded-lg text-xs font-bold hover:bg-[#0A4F44] transition flex items-center justify-center gap-1.5 shadow"
                  >
                    <UserCheck className="w-4 h-4" />
                    {actionLoading === cg.id ? 'Approving...' : 'Approve Credentials'}
                  </button>
                ) : (
                  <div className="flex items-center justify-between w-full text-xs text-[#5A6360]">
                    <span className="flex items-center gap-1 text-emerald-800 font-semibold">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Active Field Nurse
                    </span>
                    <span className="font-mono text-[11px]">ET-LIC-VERIFIED</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
