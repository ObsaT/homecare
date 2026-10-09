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
  MapPin,
  Compass,
  Filter,
} from 'lucide-react';

interface SubCityItem {
  id: string;
  name_en: string;
  name_am: string;
}

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
  home_sub_city_id?: string;
  home_sub_city?: string;
  home_sub_city_am?: string;
  notification_radius_km?: number;
  service_area_notes?: string;
  coverage_sub_cities?: SubCityItem[];
  registration_fee_paid?: boolean;
}


export default function CaregiversPage() {
  const [caregivers, setCaregivers] = useState<CaregiverData[]>([]);
  const [selectedSubCity, setSelectedSubCity] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadCaregivers = async (silent?: boolean | unknown) => {
    const isSilent = silent === true;
    if (!isSilent) setLoading(true);
    const res = await apiFetch<CaregiverData[]>('/admin/caregivers');
    if (res.data) {
      setCaregivers(res.data);
    }
    if (!isSilent) setLoading(false);
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    await apiFetch(`/admin/caregivers/${id}/approve`, { method: 'POST' });
    setActionLoading(null);
    loadCaregivers(true);
  };

  useEffect(() => {
    loadCaregivers();

    const handleRealtimeUpdate = () => {
      loadCaregivers(true);
    };

    window.addEventListener('hc-realtime-update', handleRealtimeUpdate);

    const pollInterval = setInterval(() => {
      loadCaregivers(true);
    }, 10000);

    return () => {
      window.removeEventListener('hc-realtime-update', handleRealtimeUpdate);
      clearInterval(pollInterval);
    };
  }, []);

  const subCitiesList = [
    'ALL',
    'Bole',
    'Yeka',
    'Kirkos',
    'Arada',
    'Addis Ketema',
    'Lemi Kura',
    'Lideta',
    'Gullele',
    'Nifas Silk-Lafto',
  ];

  const filteredCaregivers = caregivers.filter((cg) => {
    if (selectedSubCity === 'ALL') return true;
    const matchesBase = cg.home_sub_city?.toLowerCase() === selectedSubCity.toLowerCase();
    const matchesCoverage = cg.coverage_sub_cities?.some(
      (sc) => sc.name_en.toLowerCase() === selectedSubCity.toLowerCase()
    );
    return matchesBase || matchesCoverage;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#151A19]">Caregiver & Nurse Roster</h1>
          <p className="text-sm text-[#5A6360] mt-0.5">
            Clinical license verification, Addis Ababa service coverage zones, and live dispatch availability
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

      {/* Sub-City Location Filter Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-[#E6E9E8] shadow-sm flex items-center gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A6360] pl-1 pr-2 shrink-0">
          <MapPin className="w-4 h-4 text-[#0F6B5C]" />
          <span>Filter Operating Sub-City:</span>
        </div>
        <div className="flex items-center gap-1.5">
          {subCitiesList.map((sc) => (
            <button
              key={sc}
              onClick={() => setSelectedSubCity(sc)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                selectedSubCity === sc
                  ? 'bg-[#0F6B5C] text-white shadow-xs'
                  : 'bg-[#FAFBFA] text-[#5A6360] border border-[#E6E9E8] hover:bg-[#F1F3F2]'
              }`}
            >
              {sc === 'ALL' ? 'All Sub-Cities' : sc}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCaregivers.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-[#E6E9E8] p-12 text-center text-[#5A6360]">
            {loading ? 'Loading caregiver roster...' : 'No caregivers registered in this sub-city zone.'}
          </div>
        ) : (
          filteredCaregivers.map((cg) => (
            <div key={cg.id} className="bg-white rounded-2xl border border-[#E6E9E8] p-6 shadow-sm space-y-4 hover:border-[#0F6B5C]/40 transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#0F6B5C]/10 text-[#0F6B5C] font-bold text-base flex items-center justify-center">
                    {cg.full_name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#151A19]">{cg.full_name}</h3>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <p className="text-xs text-[#5A6360]">{cg.professional_title || 'Clinical Caregiver'}</p>
                      {cg.registration_fee_paid && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          <CheckCircle className="w-2.5 h-2.5 text-blue-600" />
                          Telebirr Fee Paid
                        </span>
                      )}
                    </div>
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

              {/* Operating Location & Service Area Badges */}
              <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-teal-950 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#0F6B5C]" />
                    Base: {cg.home_sub_city || 'Addis Ababa'}
                  </span>
                  <span className="text-[11px] font-medium text-teal-800 flex items-center gap-1">
                    <Compass className="w-3 h-3 text-teal-600" />
                    {cg.notification_radius_km || 10} km radius
                  </span>
                </div>

                {cg.coverage_sub_cities && cg.coverage_sub_cities.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-teal-800/80 block mb-1">
                      Coverage Sub-Cities
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {cg.coverage_sub_cities.map((sc) => (
                        <span
                          key={sc.id}
                          className="px-2 py-0.5 rounded-md bg-white border border-teal-200 text-teal-900 text-[10px] font-medium"
                        >
                          {sc.name_en}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {cg.service_area_notes && (
                  <p className="text-[11px] text-teal-800/90 italic pt-1 border-t border-teal-100/80">
                    "{cg.service_area_notes}"
                  </p>
                )}
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
