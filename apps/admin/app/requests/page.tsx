'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  Search,
  Filter,
  UserCheck,
  CheckCircle,
  Clock,
  X,
  Send,
  AlertCircle,
  RefreshCw,
  Phone,
  UserPlus,
  DollarSign,
  FileEdit,
  ClipboardList,
  Sparkles,
  MapPin,
  Navigation,
  Star,
  Check,
} from 'lucide-react';

interface RequestItem {
  id: string;
  reference: string;
  status: string;
  duration_minutes: number;
  urgency?: string;
  notes?: string;
  review_note?: string;
  preferred_date: string;
  preferred_time: string;
  sub_city_name?: string;
  sub_city_name_am?: string;
  sub_city_id?: string;
  landmark?: string;
  house_number?: string;
  service_code: string;
  service_name_en: string;
  service_name_am: string;
  service_requires_review?: boolean;
  billing_unit?: string;
  customer_name: string;
  customer_phone: string;
  patient_name: string;
  appointment_id: string;
  appointment_status: string;
  price_santim: number | string;
  caregiver_id?: string;
  caregiver_name: string | null;
}

interface CandidateCaregiver {
  id: string;
  full_name: string;
  phone_e164: string;
  professional_title: string;
  qualification_level?: string;
  rating_avg?: number | null;
  rating_count?: number;
  completed_visits?: number;
  is_available: boolean;
  home_sub_city?: string;
  home_sub_city_am?: string;
  notification_radius_km?: number;
  service_area_notes?: string;
  coverage_sub_cities?: Array<{ id: string; name_en: string; name_am: string }>;
  match_tier: 'PRIMARY_LOCAL' | 'COVERAGE_AREA' | 'OUTSIDE_ZONE';
  match_tier_label: string;
  match_score: number;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  
  // Assign modal state
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string>('');
  const [candidates, setCandidates] = useState<CandidateCaregiver[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [filterOnlyLocal, setFilterOnlyLocal] = useState(true);
  const [candidateReqLocation, setCandidateReqLocation] = useState<{
    subCity: string;
    landmark?: string;
    reference: string;
    patientName: string;
    serviceName: string;
  } | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Quote / Review modal state
  const [quotingRequest, setQuotingRequest] = useState<RequestItem | null>(null);
  const [quoteEtb, setQuoteEtb] = useState<string>('');
  const [quoteDuration, setQuoteDuration] = useState<number>(60);
  const [quoteNotes, setQuoteNotes] = useState<string>('');
  const [quotingSubmitting, setQuotingSubmitting] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async (silent?: boolean | unknown) => {
    const isSilent = silent === true;
    if (!isSilent) setLoading(true);
    const reqsRes = await apiFetch<RequestItem[]>('/admin/requests');
    if (reqsRes.data) {
      setRequests(reqsRes.data);
    }
    if (!isSilent) setLoading(false);
  };

  useEffect(() => {
    loadData();

    const handleRealtimeUpdate = (e: Event) => {
      // Instantly refresh requests table when offer accepted or status changed
      loadData(true);
    };

    window.addEventListener('hc-realtime-update', handleRealtimeUpdate);

    // Periodic safety poll every 8s
    const pollInterval = setInterval(() => {
      loadData(true);
    }, 8000);

    return () => {
      window.removeEventListener('hc-realtime-update', handleRealtimeUpdate);
      clearInterval(pollInterval);
    };
  }, []);

  const handleOpenAssignModal = async (req: RequestItem) => {
    setSelectedAppointment(req.appointment_id);
    setCandidateReqLocation({
      subCity: req.sub_city_name || 'Bole',
      landmark: req.landmark,
      reference: req.reference,
      patientName: req.patient_name,
      serviceName: req.service_name_en,
    });
    setCandidatesLoading(true);
    setFilterOnlyLocal(true);
    setSelectedCaregiverId('');

    const res = await apiFetch<{
      appointment: any;
      candidates: CandidateCaregiver[];
      matched_count: number;
      total_count: number;
    }>(`/admin/appointments/${req.appointment_id}/candidates`);

    setCandidatesLoading(false);
    if (res.data?.candidates && res.data.candidates.length > 0) {
      setCandidates(res.data.candidates);
      // Select the highest ranked available candidate
      const topChoice = res.data.candidates.find(c => c.is_available) || res.data.candidates[0];
      setSelectedCaregiverId(topChoice ? topChoice.id : '');
    } else {
      setCandidates([]);
    }
  };

  const handleOpenQuoteModal = (req: RequestItem) => {
    setQuotingRequest(req);
    const initialPrice = req.price_santim ? Number(req.price_santim) / 100 : 500;
    setQuoteEtb(initialPrice.toString());
    setQuoteDuration(req.duration_minutes || 60);
    setQuoteNotes(req.review_note || '');
  };

  const handleAssign = async () => {
    if (!selectedAppointment || !selectedCaregiverId) return;
    setAssigning(true);
    setMsg(null);

    const res = await apiFetch(`/admin/appointments/${selectedAppointment}/assign`, {
      method: 'POST',
      body: JSON.stringify({ caregiver_id: selectedCaregiverId }),
    });

    setAssigning(false);

    if (res.error) {
      setMsg({ type: 'error', text: res.error.message || 'Failed to assign caregiver' });
    } else {
      setMsg({ type: 'success', text: 'Caregiver assigned! Offer sent to caregiver mobile app.' });
      setSelectedAppointment(null);
      loadData();
    }
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotingRequest) return;
    setQuotingSubmitting(true);
    setMsg(null);

    const priceNum = parseFloat(quoteEtb);
    if (isNaN(priceNum) || priceNum <= 0) {
      setMsg({ type: 'error', text: 'Please enter a valid custom price in ETB.' });
      setQuotingSubmitting(false);
      return;
    }

    const res = await apiFetch(`/admin/requests/${quotingRequest.id}/quote`, {
      method: 'POST',
      body: JSON.stringify({
        price_santim: Math.round(priceNum * 100),
        duration_minutes: Number(quoteDuration),
        notes: quoteNotes.trim() || undefined,
      }),
    });

    setQuotingSubmitting(false);

    if (res.error) {
      setMsg({ type: 'error', text: res.error.message || 'Failed to set quote.' });
    } else {
      setMsg({
        type: 'success',
        text: `Custom quote of ETB ${priceNum.toFixed(2)} approved for Request #${quotingRequest.reference}!`,
      });
      setQuotingRequest(null);
      loadData();
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesFilter =
      filterStatus === 'ALL' ||
      (filterStatus === 'REVIEW_NEEDED' && (r.service_code === 'OTHER' || r.service_requires_review)) ||
      r.status === filterStatus;

    const matchesSearch =
      r.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.reference?.toLowerCase().includes(search.toLowerCase()) ||
      r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.service_name_en?.toLowerCase().includes(search.toLowerCase()) ||
      r.notes?.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#151A19]">Care Request & Dispatch Queue</h1>
          <p className="text-sm text-[#5A6360] mt-0.5">
            Review incoming bookings, evaluate specialized care quotes, and dispatch certified caregivers across Addis Ababa.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#E6E9E8] bg-white text-sm font-medium text-[#151A19] hover:bg-[#F1F3F2] transition shadow-sm disabled:opacity-50 self-start"
        >
          <RefreshCw className={`w-4 h-4 text-[#5A6360] ${loading ? 'animate-spin' : ''}`} />
          Refresh Queue
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
            {msg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-[#E6E9E8] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-[#5A6360] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search patient, reference, service, or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-[#E6E9E8] bg-[#FAFBFA] focus:outline-none focus:border-[#0F6B5C] focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-3.5 h-3.5 text-[#5A6360] shrink-0" />
          {[
            { id: 'ALL', label: 'All Requests' },
            { id: 'REVIEW_NEEDED', label: 'Specialized Quote Needed' },
            { id: 'SUBMITTED', label: 'Submitted' },
            { id: 'ASSIGNED', label: 'Assigned' },
            { id: 'IN_PROGRESS', label: 'In Progress' },
            { id: 'COMPLETED', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filterStatus === tab.id
                  ? 'bg-[#0F6B5C] text-white shadow-sm'
                  : 'bg-[#FAFBFA] text-[#5A6360] border border-[#E6E9E8] hover:bg-[#F1F3F2]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-[#E6E9E8] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFBFA] border-b border-[#E6E9E8] text-[#5A6360] font-semibold">
              <tr>
                <th className="px-5 py-3.5">Reference / Patient</th>
                <th className="px-5 py-3.5">Care Service & Price</th>
                <th className="px-5 py-3.5">Location & Landmark</th>
                <th className="px-5 py-3.5">Contact / Family</th>
                <th className="px-5 py-3.5">Requested Timing</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Assigned Caregiver</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E9E8]">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-[#5A6360]">
                    {loading ? 'Fetching dispatch requests...' : 'No care requests matching your filter.'}
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const isOther = req.service_code === 'OTHER' || req.service_requires_review;
                  const priceEtb = req.price_santim ? Number(req.price_santim) / 100 : 0;

                  return (
                    <tr key={req.id} className="hover:bg-[#F9FAFB] transition">
                      <td className="px-5 py-4">
                        <p className="font-bold text-[#151A19] text-sm">{req.patient_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] text-[#5A6360] bg-gray-100 px-1.5 py-0.5 rounded font-bold">
                            {req.reference}
                          </span>
                          {req.urgency && req.urgency !== 'ROUTINE' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                              {req.urgency}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-[#151A19]">{req.service_name_en}</p>
                          {isOther && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Quote Review
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#5A6360]">
                          {req.duration_minutes} min •{' '}
                          <span className="font-semibold text-[#0F6B5C]">ETB {priceEtb.toFixed(2)}</span>
                        </p>
                        {req.notes && (
                          <p className="text-[11px] text-gray-500 italic mt-1 line-clamp-1 max-w-xs">
                            "{req.notes}"
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold">
                            <MapPin className="w-3 h-3 text-[#0F6B5C]" />
                            {req.sub_city_name || 'Addis Ababa'}
                          </span>
                        </div>
                        {req.landmark && (
                          <p className="text-[11px] text-[#5A6360] mt-1 flex items-center gap-1 truncate max-w-[170px]" title={req.landmark}>
                            <Navigation className="w-3 h-3 text-gray-400 shrink-0" />
                            {req.landmark}
                          </p>
                        )}
                        {req.house_number && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{req.house_number}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-[#151A19] font-medium">{req.customer_name}</p>
                        <p className="text-[11px] text-[#5A6360] flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {req.customer_phone}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-[#151A19]">{req.preferred_time || '10:00 AM'}</p>
                        <p className="text-[11px] text-[#5A6360]">
                          {req.preferred_date ? new Date(req.preferred_date).toLocaleDateString() : 'Today'}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            req.status === 'SUBMITTED'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : req.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : req.status === 'ASSIGNED' || req.status === 'ACCEPTED'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : req.status === 'IN_PROGRESS'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : req.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-gray-50 text-gray-800 border-gray-200'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {req.caregiver_name ? (
                          <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{req.caregiver_name}</span>
                          </div>
                        ) : (
                          <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Quote Button for OTHER / Review */}
                          <button
                            onClick={() => handleOpenQuoteModal(req)}
                            title="Review & Set Quote"
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                              isOther
                                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                            {isOther ? 'Quote' : 'Price'}
                          </button>

                          {/* Assign Button */}
                          {req.appointment_id && req.status !== 'COMPLETED' ? (
                            <button
                              onClick={() => handleOpenAssignModal(req)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F6B5C] text-white font-semibold text-xs hover:bg-[#0A4F44] transition shadow-sm"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              {req.caregiver_name ? 'Reassign' : 'Dispatch'}
                            </button>
                          ) : (
                            <span className="text-[#5A6360] text-xs">Locked</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Custom Quote / Request Review */}
      {quotingRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#151A19]">
                    Review & Custom Quote: {quotingRequest.reference}
                  </h3>
                  <p className="text-xs text-[#5A6360]">Set approved ETB price and clinical instructions</p>
                </div>
              </div>
              <button
                onClick={() => setQuotingRequest(null)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5A6360]">Patient:</span>
                <span className="font-bold text-[#151A19]">{quotingRequest.patient_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5A6360]">Service Requested:</span>
                <span className="font-bold text-[#151A19]">{quotingRequest.service_name_en}</span>
              </div>
              {quotingRequest.notes && (
                <div className="pt-2 border-t border-gray-200">
                  <span className="text-[#5A6360] font-medium">Customer Notes / Symptoms:</span>
                  <p className="mt-1 text-gray-800 bg-white p-2 rounded-lg border border-gray-200">
                    {quotingRequest.notes}
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={handleQuoteSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Custom Price (ETB) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5A6360]">ETB</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={quoteEtb}
                      onChange={(e) => setQuoteEtb(e.target.value)}
                      className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C] font-semibold text-sm text-[#0F6B5C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Visit Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    required
                    value={quoteDuration}
                    onChange={(e) => setQuoteDuration(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C] text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                  Clinical Coordinator Review Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Approved for specialized 2-hour wound debridement and aseptic dressing. Nurse must carry sterile set."
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C] text-xs"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setQuotingRequest(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quotingSubmitting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#0F6B5C] text-white text-xs font-bold hover:bg-[#0A4F44] transition flex items-center justify-center gap-2 shadow disabled:opacity-50"
                >
                  {quotingSubmitting ? (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approve & Set Quote
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Modal with Location-Based Dispatch Intelligence */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#0F6B5C]" />
                <div>
                  <h3 className="font-bold text-base text-[#151A19]">Location-Based Care Dispatch</h3>
                  <p className="text-[11px] text-[#5A6360]">Ranked by Addis Ababa sub-city & operating radius</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Visit Destination Location Card */}
            {candidateReqLocation && (
              <div className="p-3 bg-teal-50/70 rounded-2xl border border-teal-200/80 flex items-start justify-between text-xs">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-teal-950">
                    <MapPin className="w-4 h-4 text-[#0F6B5C] shrink-0" />
                    <span>Target Area: {candidateReqLocation.subCity} Sub-City</span>
                  </div>
                  {candidateReqLocation.landmark && (
                    <p className="text-[11px] text-teal-800 mt-0.5 ml-5">
                      Landmark: {candidateReqLocation.landmark}
                    </p>
                  )}
                  <p className="text-[11px] text-teal-700 mt-1 ml-5">
                    Patient: <span className="font-semibold text-teal-900">{candidateReqLocation.patientName}</span> • {candidateReqLocation.serviceName}
                  </p>
                </div>
                <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-teal-200 text-teal-800 font-bold shrink-0">
                  {candidateReqLocation.reference}
                </span>
              </div>
            )}

            {/* Coverage Filter Controls */}
            <div className="flex items-center justify-between pt-1">
              <label className="text-xs font-bold text-gray-700">
                Caregiver Candidates Ranking
              </label>
              <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setFilterOnlyLocal(true)}
                  className={`px-2 py-1 rounded-md font-semibold transition ${
                    filterOnlyLocal ? 'bg-white text-[#0F6B5C] shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Local & Coverage ({candidates.filter(c => c.match_tier !== 'OUTSIDE_ZONE').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOnlyLocal(false)}
                  className={`px-2 py-1 rounded-md font-semibold transition ${
                    !filterOnlyLocal ? 'bg-white text-[#0F6B5C] shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  All ({candidates.length})
                </button>
              </div>
            </div>

            {/* Candidate List */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {candidatesLoading ? (
                <div className="py-12 text-center text-xs text-[#5A6360] space-y-2">
                  <div className="w-6 h-6 border-2 border-[#0F6B5C] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Matching registered caregivers within operating radius...</p>
                </div>
              ) : (
                (() => {
                  const displayCandidates = filterOnlyLocal
                    ? candidates.filter(c => c.match_tier !== 'OUTSIDE_ZONE')
                    : candidates;

                  if (displayCandidates.length === 0) {
                    return (
                      <div className="p-6 text-center text-xs text-[#5A6360] bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                        <p className="font-semibold text-gray-700">No primary coverage caregivers found in this area.</p>
                        <p className="text-[11px] mt-1 text-gray-500">Switch filter to "All" to dispatch caregivers outside their usual zone.</p>
                      </div>
                    );
                  }

                  return displayCandidates.map((cg) => (
                    <label
                      key={cg.id}
                      className={`block p-3 rounded-xl border cursor-pointer transition ${
                        selectedCaregiverId === cg.id
                          ? 'border-[#0F6B5C] bg-[#0F6B5C]/5 ring-1 ring-[#0F6B5C]'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="caregiver"
                            value={cg.id}
                            checked={selectedCaregiverId === cg.id}
                            onChange={(e) => setSelectedCaregiverId(e.target.value)}
                            className="mt-1 text-[#0F6B5C] focus:ring-[#0F6B5C]"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-gray-900">{cg.full_name}</p>
                              {/* Location Match Badges */}
                              {cg.match_tier === 'PRIMARY_LOCAL' && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  ⭐ Base: {cg.home_sub_city}
                                </span>
                              )}
                              {cg.match_tier === 'COVERAGE_AREA' && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-300">
                                  📍 Coverage ({cg.notification_radius_km || 10}km)
                                </span>
                              )}
                              {cg.match_tier === 'OUTSIDE_ZONE' && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                  ⚠️ Outside Zone ({cg.home_sub_city})
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {cg.professional_title} • {cg.phone_e164}
                            </p>
                            {cg.service_area_notes && (
                              <p className="text-[10px] text-gray-600 italic mt-0.5">
                                Zone: {cg.service_area_notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0 gap-1">
                          {cg.is_available ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                              Available
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                              Busy
                            </span>
                          )}
                          <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            {cg.rating_avg ? Number(cg.rating_avg).toFixed(1) : '5.0'}
                          </span>
                        </div>
                      </div>
                    </label>
                  ));
                })()
              )}
            </div>

            <div className="flex items-center gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assigning || !selectedCaregiverId}
                onClick={handleAssign}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#0F6B5C] text-white text-xs font-bold hover:bg-[#0A4F44] transition flex items-center justify-center gap-2 shadow disabled:opacity-50"
              >
                {assigning ? (
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Dispatch Offer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
