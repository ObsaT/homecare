'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  CheckCircle,
  ShieldCheck,
  Star,
  UserCheck,
  RefreshCw,
  MapPin,
  Compass,
  Ban,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Database,
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
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmClearModal, setConfirmClearModal] = useState<
    'CAREGIVERS_ONLY' | 'ALL_NON_ADMIN' | null
  >(null);

  const loadCaregivers = async (silent?: boolean | unknown) => {
    const isSilent = silent === true;
    if (!isSilent) setLoading(true);
    const res = await apiFetch<CaregiverData[]>('/admin/caregivers');
    if (res.data) {
      setCaregivers(res.data);
    }
    if (!isSilent) setLoading(false);
  };

  const handleStatusChange = async (
    id: string,
    status: 'APPROVED' | 'SUSPENDED' | 'REJECTED',
    name: string
  ) => {
    setActionLoading(id);
    setBanner(null);
    const res = await apiFetch(`/admin/caregivers/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    setActionLoading(null);
    if (res.error) {
      setBanner({ type: 'error', text: res.error.message || 'Failed to update caregiver status' });
    } else {
      setBanner({
        type: 'success',
        text: `${name} status updated to ${status}.`,
      });
      loadCaregivers(true);
    }
  };

  const handleDeleteCaregiver = async (id: string, name: string) => {
    if (!window.confirm(`Permanently delete caregiver "${name}" and their history?`)) return;
    setActionLoading(id);
    setBanner(null);
    const res = await apiFetch(`/admin/caregivers/${id}`, { method: 'DELETE' });
    setActionLoading(null);
    if (res.error) {
      setBanner({ type: 'error', text: res.error.message || 'Failed to delete caregiver' });
    } else {
      setBanner({ type: 'success', text: `Caregiver "${name}" permanently removed.` });
      loadCaregivers(true);
    }
  };

  const handleClearData = async (mode: 'CAREGIVERS_ONLY' | 'ALL_NON_ADMIN') => {
    setActionLoading('CLEAR');
    setBanner(null);
    const res = await apiFetch<{ message: string }>('/admin/data-management/clear', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
    setActionLoading(null);
    setConfirmClearModal(null);
    if (res.error) {
      setBanner({ type: 'error', text: res.error.message || 'Failed to clear data' });
    } else {
      setBanner({
        type: 'success',
        text: res.data?.message || 'Data cleared successfully.',
      });
      loadCaregivers(true);
    }
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#151A19]">
            Caregiver & Nurse Roster
          </h1>
          <p className="text-sm text-[#5A6360] mt-0.5">
            Clinical license verification, Addis Ababa service coverage zones, suspension, and roster management
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setConfirmClearModal('CAREGIVERS_ONLY')}
            disabled={loading || actionLoading === 'CLEAR'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 hover:bg-amber-100 transition shadow-xs"
          >
            <Database className="w-3.5 h-3.5 text-amber-700" />
            Clear Caregivers Only
          </button>
          <button
            onClick={() => setConfirmClearModal('ALL_NON_ADMIN')}
            disabled={loading || actionLoading === 'CLEAR'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-800 hover:bg-red-100 transition shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            Reset All Non-Admin Data
          </button>
          <button
            onClick={() => loadCaregivers()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-[#E6E9E8] text-xs font-semibold text-[#151A19] hover:bg-[#F1F3F2] transition shadow-xs disabled:opacity-50"
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

      {/* Confirmation Modal for Selective Data Clearing */}
      {confirmClearModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E6E9E8] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-700">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#151A19]">
                  {confirmClearModal === 'CAREGIVERS_ONLY'
                    ? 'Clear Only Caregivers & Nurses?'
                    : 'Reset All Non-Admin Data?'}
                </h3>
                <p className="text-xs text-[#5A6360]">Production Data Governance Action</p>
              </div>
            </div>

            <p className="text-xs text-[#5A6360] leading-relaxed">
              {confirmClearModal === 'CAREGIVERS_ONLY'
                ? 'This will remove all Caregiver & Nurse accounts, profiles, assignments, and onboarding fee records while preserving all Customers, Patients, Care Requests, Service Catalogs, and Admin accounts.'
                : 'This will remove all Caregivers, Customers, Patients, Care Requests, Appointments, and Invoices so you can test from a 100% clean slate. Only Admin/Dispatcher logins and your Service Catalog will be kept.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmClearModal(null)}
                className="px-4 py-2 rounded-lg border border-[#E6E9E8] text-xs font-semibold text-[#5A6360] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleClearData(confirmClearModal)}
                disabled={actionLoading === 'CLEAR'}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === 'CLEAR' ? 'Clearing...' : 'Confirm & Clear Data'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div className="col-span-full bg-white rounded-2xl border border-[#E6E9E8] p-12 text-center space-y-2">
            <p className="text-sm font-semibold text-[#151A19]">
              {loading ? 'Loading caregiver roster...' : 'No caregivers or nurses in roster.'}
            </p>
            <p className="text-xs text-[#5A6360]">
              New caregivers who register via the Mobile App with Telebirr verification will appear here in real time.
            </p>
          </div>
        ) : (
          filteredCaregivers.map((cg) => {
            const isSuspended =
              cg.approval_status === 'SUSPENDED' || cg.account_status === 'SUSPENDED';
            const isApproved = cg.approval_status === 'APPROVED' && !isSuspended;

            return (
              <div
                key={cg.id}
                className={`bg-white rounded-2xl border p-6 shadow-sm space-y-4 transition ${
                  isSuspended
                    ? 'border-red-200 bg-red-50/10'
                    : 'border-[#E6E9E8] hover:border-[#0F6B5C]/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full font-bold text-base flex items-center justify-center ${
                        isSuspended
                          ? 'bg-red-100 text-red-700'
                          : 'bg-[#0F6B5C]/10 text-[#0F6B5C]'
                      }`}
                    >
                      {cg.full_name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-[#151A19]">{cg.full_name}</h3>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <p className="text-xs text-[#5A6360]">
                          {cg.professional_title || 'Clinical Caregiver'}
                        </p>
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
                      isSuspended
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : cg.is_available
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSuspended
                          ? 'bg-red-600'
                          : cg.is_available
                            ? 'bg-emerald-500'
                            : 'bg-gray-400'
                      }`}
                    />
                    {isSuspended ? 'Suspended' : cg.is_available ? 'Available' : 'Off-Duty'}
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
                    <span className="font-semibold text-[#151A19]">
                      {cg.qualification_level || 'BSc / Diploma'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#5A6360] block text-[11px]">Rating</span>
                    <span className="font-semibold text-amber-700 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      {cg.rating_avg
                        ? `${Number(cg.rating_avg).toFixed(1)} (${cg.rating_count})`
                        : 'New (0)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#5A6360] block text-[11px]">Phone (Addis)</span>
                    <span className="font-medium text-[#151A19]">{cg.phone_e164}</span>
                  </div>
                  <div>
                    <span className="text-[#5A6360] block text-[11px]">License Status</span>
                    <span
                      className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                        isSuspended
                          ? 'text-red-700'
                          : isApproved
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {isSuspended ? 'SUSPENDED' : isApproved ? 'Verified' : cg.approval_status}
                    </span>
                  </div>
                </div>

                {/* Action Controls: Approve / Suspend / Reactivate / Delete */}
                <div className="flex items-center gap-2 pt-1">
                  {!isApproved ? (
                    <button
                      onClick={() => handleStatusChange(cg.id, 'APPROVED', cg.full_name)}
                      disabled={actionLoading === cg.id}
                      className="flex-1 py-2 bg-[#0F6B5C] text-white rounded-lg text-xs font-bold hover:bg-[#0A4F44] transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      {isSuspended ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          Approve License
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(cg.id, 'SUSPENDED', cg.full_name)}
                      disabled={actionLoading === cg.id}
                      className="flex-1 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-bold hover:bg-amber-100 transition flex items-center justify-center gap-1.5"
                    >
                      <Ban className="w-3.5 h-3.5 text-amber-700" />
                      Suspend Caregiver
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteCaregiver(cg.id, cg.full_name)}
                    disabled={actionLoading === cg.id}
                    title="Permanently Delete Caregiver"
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
