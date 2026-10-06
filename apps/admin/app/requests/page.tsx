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

interface CaregiverOption {
  id: string;
  full_name: string;
  phone_e164: string;
  professional_title: string;
  rating_avg?: number;
  is_available: boolean;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [caregivers, setCaregivers] = useState<CaregiverOption[]>([]);
  
  // Assign modal state
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string>('');
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

  const loadData = async () => {
    setLoading(true);
    const [reqsRes, cgRes] = await Promise.all([
      apiFetch<RequestItem[]>('/admin/requests'),
      apiFetch<CaregiverOption[]>('/admin/caregivers'),
    ]);

    if (reqsRes.data) {
      setRequests(reqsRes.data);
    }
    if (cgRes.data) {
      setCaregivers(cgRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAssignModal = (appointmentId: string) => {
    setSelectedAppointment(appointmentId);
    if (caregivers.length > 0 && caregivers[0]) {
      setSelectedCaregiverId(caregivers[0].id);
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
                  <td colSpan={7} className="px-5 py-12 text-center text-[#5A6360]">
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
                              onClick={() => handleOpenAssignModal(req.appointment_id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F6B5C] text-white font-semibold text-xs hover:bg-[#0A4F44] transition shadow-sm"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              {req.caregiver_name ? 'Reassign' : 'Assign'}
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

      {/* Assignment Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#0F6B5C]" />
                <h3 className="font-bold text-base text-[#151A19]">Dispatch Caregiver / Nurse</h3>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-gray-700">
                Select Certified Field Professional
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {caregivers.map((cg) => (
                  <label
                    key={cg.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                      selectedCaregiverId === cg.id
                        ? 'border-[#0F6B5C] bg-[#0F6B5C]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="caregiver"
                        value={cg.id}
                        checked={selectedCaregiverId === cg.id}
                        onChange={(e) => setSelectedCaregiverId(e.target.value)}
                        className="text-[#0F6B5C] focus:ring-[#0F6B5C]"
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-900">{cg.full_name}</p>
                        <p className="text-[11px] text-gray-500">{cg.professional_title} • {cg.phone_e164}</p>
                      </div>
                    </div>
                    {cg.is_available ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                        Available
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        Busy
                      </span>
                    )}
                  </label>
                ))}
              </div>
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
