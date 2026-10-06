'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  Stethoscope,
  Clock,
  ShieldCheck,
  Tag,
  RefreshCw,
  Plus,
  Edit3,
  Search,
  Check,
  X,
  AlertCircle,
  Power,
  Sliders,
  DollarSign,
  FileText,
  BadgeAlert,
  ChevronRight,
} from 'lucide-react';

export interface ServiceRecord {
  id: string;
  code: string;
  name_en: string;
  name_am: string;
  description_en: string;
  description_am: string;
  billing_unit: string;
  default_duration_minutes: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  requires_licence: boolean;
  required_qualification: string | null;
  price_santim: number;
  is_active?: boolean;
  requires_review?: boolean;
}

interface ServiceFormData {
  code: string;
  name_en: string;
  name_am: string;
  description_en: string;
  description_am: string;
  billing_unit: string;
  default_duration_minutes: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  requires_licence: boolean;
  required_qualification: string;
  price_etb: string;
  requires_review: boolean;
  is_active: boolean;
}

const initialFormData: ServiceFormData = {
  code: '',
  name_en: '',
  name_am: '',
  description_en: '',
  description_am: '',
  billing_unit: 'PER_HOUR',
  default_duration_minutes: 120,
  min_duration_minutes: 60,
  max_duration_minutes: 480,
  requires_licence: false,
  required_qualification: '',
  price_etb: '500',
  requires_review: false,
  is_active: true,
};

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'LICENSE'>('ALL');
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(initialFormData);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadServices = async () => {
    setLoading(true);
    const res = await apiFetch<ServiceRecord[]>('/admin/services');
    if (res.data) {
      setServices(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadServices();
  }, []);

  const openCreateModal = () => {
    setFormData(initialFormData);
    setMsg(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (svc: ServiceRecord) => {
    setEditingService(svc);
    setFormData({
      code: svc.code,
      name_en: svc.name_en || '',
      name_am: svc.name_am || '',
      description_en: svc.description_en || '',
      description_am: svc.description_am || '',
      billing_unit: svc.billing_unit || 'PER_HOUR',
      default_duration_minutes: svc.default_duration_minutes || 60,
      min_duration_minutes: svc.min_duration_minutes || 30,
      max_duration_minutes: svc.max_duration_minutes || 480,
      requires_licence: !!svc.requires_licence,
      required_qualification: svc.required_qualification || '',
      price_etb: (svc.price_santim / 100).toString(),
      requires_review: !!svc.requires_review,
      is_active: svc.is_active !== false,
    });
    setMsg(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    const priceNum = parseFloat(formData.price_etb);
    if (isNaN(priceNum) || priceNum <= 0) {
      setMsg({ type: 'error', text: 'Please enter a valid price in ETB.' });
      setSubmitting(false);
      return;
    }

    const payload = {
      code: formData.code.toUpperCase().replace(/\s+/g, '_'),
      name_en: formData.name_en.trim(),
      name_am: formData.name_am.trim(),
      description_en: formData.description_en.trim(),
      description_am: formData.description_am.trim(),
      billing_unit: formData.billing_unit,
      default_duration_minutes: Number(formData.default_duration_minutes),
      min_duration_minutes: Number(formData.min_duration_minutes),
      max_duration_minutes: Number(formData.max_duration_minutes),
      requires_licence: formData.requires_licence,
      required_qualification: formData.required_qualification.trim() || undefined,
      requires_review: formData.requires_review,
      price_santim: Math.round(priceNum * 100),
    };

    const res = await apiFetch('/admin/services', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (res.error) {
      setMsg({ type: 'error', text: res.error.message || 'Failed to create service.' });
    } else {
      setMsg({ type: 'success', text: `Service "${formData.name_en}" created successfully!` });
      setIsCreateOpen(false);
      loadServices();
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setSubmitting(true);
    setMsg(null);

    const priceNum = parseFloat(formData.price_etb);
    if (isNaN(priceNum) || priceNum <= 0) {
      setMsg({ type: 'error', text: 'Please enter a valid price in ETB.' });
      setSubmitting(false);
      return;
    }

    const payload = {
      name_en: formData.name_en.trim(),
      name_am: formData.name_am.trim(),
      description_en: formData.description_en.trim(),
      description_am: formData.description_am.trim(),
      billing_unit: formData.billing_unit,
      default_duration_minutes: Number(formData.default_duration_minutes),
      min_duration_minutes: Number(formData.min_duration_minutes),
      max_duration_minutes: Number(formData.max_duration_minutes),
      requires_licence: formData.requires_licence,
      required_qualification: formData.required_qualification.trim() || undefined,
      requires_review: formData.requires_review,
      is_active: formData.is_active,
      price_santim: Math.round(priceNum * 100),
    };

    const res = await apiFetch(`/admin/services/${editingService.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (res.error) {
      setMsg({ type: 'error', text: res.error.message || 'Failed to update service.' });
    } else {
      setMsg({ type: 'success', text: `Service "${formData.name_en}" updated successfully!` });
      setEditingService(null);
      loadServices();
    }
  };

  const handleToggleActive = async (svc: ServiceRecord) => {
    const nextState = !svc.is_active;
    const res = await apiFetch(`/admin/services/${svc.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: nextState }),
    });
    if (!res.error) {
      setServices((prev) =>
        prev.map((item) => (item.id === svc.id ? { ...item, is_active: nextState } : item))
      );
    }
  };

  const filteredServices = services.filter((svc) => {
    const matchesSearch =
      svc.name_en.toLowerCase().includes(search.toLowerCase()) ||
      svc.name_am.toLowerCase().includes(search.toLowerCase()) ||
      svc.code.toLowerCase().includes(search.toLowerCase()) ||
      svc.description_en.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterActive === 'ACTIVE') return svc.is_active !== false;
    if (filterActive === 'INACTIVE') return svc.is_active === false;
    if (filterActive === 'LICENSE') return svc.requires_licence;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#151A19]">Service Catalog & Rates</h1>
          <p className="text-sm text-[#5A6360] mt-0.5">
            Manage clinical service packages, professional qualifications, pricing in ETB, and review policies.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={loadServices}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-[#E6E9E8] text-sm font-medium text-[#151A19] hover:bg-[#F1F3F2] transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[#5A6360] ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F6B5C] text-white text-sm font-semibold hover:bg-[#0B5246] transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Service
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {msg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {msg.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="p-1 hover:bg-black/5 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border border-[#E6E9E8] p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A6360]" />
          <input
            type="text"
            placeholder="Search service name, code, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-[#E6E9E8] focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C] bg-[#FAFBFA]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(
            [
              { id: 'ALL', label: `All Services (${services.length})` },
              { id: 'ACTIVE', label: `Active (${services.filter((s) => s.is_active !== false).length})` },
              { id: 'LICENSE', label: `Licensed Only (${services.filter((s) => s.requires_licence).length})` },
              { id: 'INACTIVE', label: `Inactive (${services.filter((s) => s.is_active === false).length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterActive(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filterActive === tab.id
                  ? 'bg-[#0F6B5C] text-white shadow-sm'
                  : 'bg-[#F1F3F2] text-[#5A6360] hover:bg-[#E6E9E8]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-[#E6E9E8] p-12 text-center text-[#5A6360]">
            {loading ? 'Loading catalog services...' : 'No services match your search and filter criteria.'}
          </div>
        ) : (
          filteredServices.map((svc) => {
            const isActive = svc.is_active !== false;
            return (
              <div
                key={svc.id}
                className={`bg-white rounded-2xl border p-6 shadow-sm flex flex-col justify-between transition group relative ${
                  isActive ? 'border-[#E6E9E8] hover:border-[#0F6B5C]/50' : 'border-dashed border-gray-300 bg-gray-50/70 opacity-80'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-[#F1F3F2] text-[#5A6360]">
                          {svc.code}
                        </span>
                        {!isActive && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                            Inactive
                          </span>
                        )}
                        {svc.requires_review && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            Custom / Review
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-[#151A19] mt-1 group-hover:text-[#0F6B5C] transition">
                        {svc.name_en}
                      </h3>
                      <p className="text-xs text-[#0F6B5C] font-medium font-amharic">{svc.name_am}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-xl text-sm font-bold bg-[#0F6B5C]/10 text-[#0F6B5C] inline-block">
                        ETB {(svc.price_santim / 100).toFixed(2)}
                      </span>
                      <p className="text-[10px] text-[#5A6360] mt-0.5">{svc.billing_unit.replace('_', ' ')}</p>
                    </div>
                  </div>

                  <p className="text-xs text-[#5A6360] leading-relaxed line-clamp-3">
                    {svc.description_en}
                  </p>
                  {svc.description_am && (
                    <p className="text-xs text-[#5A6360]/80 italic line-clamp-2 font-amharic">
                      {svc.description_am}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#E6E9E8] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5A6360] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Duration Bounds:
                    </span>
                    <span className="font-semibold text-[#151A19]">
                      {svc.default_duration_minutes}m ({svc.min_duration_minutes}m - {svc.max_duration_minutes}m)
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#5A6360] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Qualification:
                    </span>
                    <span
                      className={`font-semibold text-[11px] px-2 py-0.5 rounded truncate max-w-[170px] ${
                        svc.requires_licence ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'
                      }`}
                      title={svc.required_qualification || ''}
                    >
                      {svc.required_qualification || (svc.requires_licence ? 'Licensed Nurse' : 'General Caregiver')}
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleToggleActive(svc)}
                      title={isActive ? 'Deactivate service' : 'Activate service'}
                      className={`p-1.5 rounded-lg border text-xs font-medium transition ${
                        isActive
                          ? 'border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-rose-600'
                          : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(svc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F1F3F2] hover:bg-[#0F6B5C] hover:text-white text-[#151A19] text-xs font-semibold transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit & Price
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create Service */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#E6E9E8] shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 my-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-[#E6E9E8] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0F6B5C]/10 flex items-center justify-center text-[#0F6B5C]">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#151A19]">Add New Service Package</h2>
                  <p className="text-xs text-[#5A6360]">Configure service metadata, professional constraints, and initial pricing</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Service Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INFUSION_THERAPY"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C] font-mono text-xs uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Base Price in ETB <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5A6360]">ETB</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="500.00"
                      value={formData.price_etb}
                      onChange={(e) => setFormData({ ...formData, price_etb: e.target.value })}
                      className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C] font-semibold text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    English Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Infusion & IV Therapy"
                    value={formData.name_en}
                    onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Amharic Name (የአገልግሎት ስም) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. የደም ስር መድሃኒት አገልግሎት"
                    value={formData.name_am}
                    onChange={(e) => setFormData({ ...formData, name_am: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    English Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Clinical details, scope of practice, and materials provided..."
                    value={formData.description_en}
                    onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Amharic Description (የአገልግሎቱ ዝርዝር)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="ስለ አገልግሎቱ አጭር ማብራሪያ..."
                    value={formData.description_am}
                    onChange={(e) => setFormData({ ...formData, description_am: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Billing Unit
                  </label>
                  <select
                    value={formData.billing_unit}
                    onChange={(e) => setFormData({ ...formData, billing_unit: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9E8] text-xs font-medium focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C]"
                  >
                    <option value="PER_HOUR">PER_HOUR</option>
                    <option value="PER_VISIT">PER_VISIT</option>
                    <option value="PER_SESSION">PER_SESSION</option>
                    <option value="PER_DAY">PER_DAY</option>
                    <option value="PER_WEEK">PER_WEEK</option>
                    <option value="PER_MONTH">PER_MONTH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Default (min)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={formData.default_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, default_duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9E8] text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Min (min)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={formData.min_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, min_duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9E8] text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Max (min)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={formData.max_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, max_duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9E8] text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="p-4 bg-[#F8FAFA] rounded-2xl border border-[#E6E9E8] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-[#151A19]">Requires Professional License</span>
                    <p className="text-[11px] text-[#5A6360]">Must be performed by licensed nurse, doctor, or certified PT</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.requires_licence}
                    onChange={(e) => setFormData({ ...formData, requires_licence: e.target.checked })}
                    className="w-5 h-5 rounded text-[#0F6B5C] focus:ring-[#0F6B5C]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Required Qualification Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Registered Nurse (BSc / Diploma)"
                    value={formData.required_qualification}
                    onChange={(e) => setFormData({ ...formData, required_qualification: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E9E8] text-xs bg-white"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E6E9E8]">
                  <div>
                    <span className="font-bold text-xs text-[#151A19]">Requires Clinical Review ("OTHER" Mode)</span>
                    <p className="text-[11px] text-[#5A6360]">Requests for this service must receive quote approval from coordinator</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.requires_review}
                    onChange={(e) => setFormData({ ...formData, requires_review: e.target.checked })}
                    className="w-5 h-5 rounded text-[#0F6B5C] focus:ring-[#0F6B5C]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E6E9E8]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E6E9E8] text-sm font-semibold text-[#5A6360] hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0F6B5C] text-white text-sm font-semibold hover:bg-[#0B5246] transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Creating Service...' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Service & Price */}
      {editingService && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#E6E9E8] shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 my-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-[#E6E9E8] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0F6B5C]/10 flex items-center justify-center text-[#0F6B5C]">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#151A19]">Edit Service: {editingService.code}</h2>
                  <p className="text-xs text-[#5A6360]">Update service specifications, rates, and licensing criteria</p>
                </div>
              </div>
              <button
                onClick={() => setEditingService(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Service Code
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formData.code}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9E8] bg-gray-100 font-mono text-xs uppercase text-gray-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Rate in ETB (Santim converted) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5A6360]">ETB</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={formData.price_etb}
                      onChange={(e) => setFormData({ ...formData, price_etb: e.target.value })}
                      className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C] font-semibold text-sm text-[#0F6B5C]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    English Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name_en}
                    onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Amharic Name (የአገልግሎት ስም) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name_am}
                    onChange={(e) => setFormData({ ...formData, name_am: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    English Description
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description_en}
                    onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Amharic Description (የአገልግሎቱ ዝርዝር)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description_am}
                    onChange={(e) => setFormData({ ...formData, description_am: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E6E9E8] focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Billing Unit
                  </label>
                  <select
                    value={formData.billing_unit}
                    onChange={(e) => setFormData({ ...formData, billing_unit: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9E8] text-xs font-medium focus:ring-2 focus:ring-[#0F6B5C]/20 focus:border-[#0F6B5C]"
                  >
                    <option value="PER_HOUR">PER_HOUR</option>
                    <option value="PER_VISIT">PER_VISIT</option>
                    <option value="PER_SESSION">PER_SESSION</option>
                    <option value="PER_DAY">PER_DAY</option>
                    <option value="PER_WEEK">PER_WEEK</option>
                    <option value="PER_MONTH">PER_MONTH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Default (min)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={formData.default_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, default_duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9E8] text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Min (min)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={formData.min_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, min_duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9E8] text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Max (min)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={formData.max_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, max_duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9E8] text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="p-4 bg-[#F8FAFA] rounded-2xl border border-[#E6E9E8] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-[#151A19]">Requires Professional License</span>
                    <p className="text-[11px] text-[#5A6360]">Requires certified medical practitioner</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.requires_licence}
                    onChange={(e) => setFormData({ ...formData, requires_licence: e.target.checked })}
                    className="w-5 h-5 rounded text-[#0F6B5C] focus:ring-[#0F6B5C]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#151A19] uppercase tracking-wider mb-1">
                    Required Qualification Description
                  </label>
                  <input
                    type="text"
                    value={formData.required_qualification}
                    onChange={(e) => setFormData({ ...formData, required_qualification: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E9E8] text-xs bg-white"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E6E9E8]">
                  <div>
                    <span className="font-bold text-xs text-[#151A19]">Requires Clinical Review</span>
                    <p className="text-[11px] text-[#5A6360]">Must be reviewed by supervisor before confirming</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.requires_review}
                    onChange={(e) => setFormData({ ...formData, requires_review: e.target.checked })}
                    className="w-5 h-5 rounded text-[#0F6B5C] focus:ring-[#0F6B5C]"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E6E9E8]">
                  <div>
                    <span className="font-bold text-xs text-[#151A19]">Catalog Status (Active in Mobile App)</span>
                    <p className="text-[11px] text-[#5A6360]">Customers can see and book this service if active</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded text-[#0F6B5C] focus:ring-[#0F6B5C]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E6E9E8]">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#E6E9E8] text-sm font-semibold text-[#5A6360] hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0F6B5C] text-white text-sm font-semibold hover:bg-[#0B5246] transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving Changes...' : 'Save & Update Price'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
