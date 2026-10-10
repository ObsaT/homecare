'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Send,
  AlertTriangle,
  Megaphone,
  MessageSquare,
  Users,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  Phone,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useDashboardWebSocket } from '../../lib/websocket-context';

interface CommRecord {
  id: string;
  appointment_id?: string;
  request_id?: string;
  sender_user_id?: string;
  sender_name: string;
  sender_role: string;
  message_type: 'CHAT' | 'QUICK_UPDATE' | 'EMERGENCY_SOS' | 'BROADCAST_ANNOUNCEMENT' | 'ETA_UPDATE';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  request_reference?: string;
  service_name?: string;
  patient_name?: string;
}

interface ActiveRequest {
  id: string;
  reference: string;
  patient_name: string;
  service_name: string;
  caregiver_name?: string;
  status: string;
}

export default function CommsDispatchPage() {
  const { isConnected, playAlertSound } = useDashboardWebSocket();
  const [feed, setFeed] = useState<CommRecord[]>([]);
  const [activeRequests, setActiveRequests] = useState<ActiveRequest[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Direct Message Composer State
  const [msgContent, setMsgContent] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Broadcast Modal / Composer State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState<'ALL' | 'CAREGIVER' | 'CUSTOMER'>('ALL');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  const loadFeed = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await apiFetch<CommRecord[]>('/comms/admin/feed?limit=60');
      if (data) setFeed(data);

      // Also fetch active requests for the message dropdown
      const { data: reqData } = await apiFetch<ActiveRequest[]>('/admin/requests');
      if (reqData) {
        setActiveRequests(reqData.filter((r) => !['COMPLETED', 'CANCELLED'].includes(r.status)));
      }
    } catch (err) {
      console.warn('Failed to load comms feed:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();

    const handleUpdate = () => {
      loadFeed(true);
    };

    window.addEventListener('hc-realtime-update', handleUpdate);
    const interval = setInterval(() => loadFeed(true), 8000);
    return () => {
      window.removeEventListener('hc-realtime-update', handleUpdate);
      clearInterval(interval);
    };
  }, [loadFeed]);

  const handleSendDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgContent.trim()) return;

    setSendingMsg(true);
    try {
      await apiFetch('/comms/messages', {
        method: 'POST',
        body: JSON.stringify({
          appointment_id: selectedTarget || undefined,
          request_id: selectedTarget || undefined,
          content: msgContent.trim(),
          message_type: 'CHAT',
          metadata: { channel: 'DISPATCH_OVERRIDE' },
        }),
      });
      setMsgContent('');
      loadFeed(true);
    } catch (err) {
      alert('Failed to dispatch message: ' + (err as Error).message);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    setSendingBroadcast(true);
    try {
      await apiFetch('/comms/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          title: broadcastTitle.trim(),
          message: broadcastMessage.trim(),
          target_role: broadcastAudience,
        }),
      });
      setBroadcastTitle('');
      setBroadcastMessage('');
      setBroadcastSuccess(true);
      setTimeout(() => setBroadcastSuccess(false), 4000);
      loadFeed(true);
    } catch (err) {
      alert('Failed to broadcast: ' + (err as Error).message);
    } finally {
      setSendingBroadcast(false);
    }
  };

  const filteredFeed = feed.filter((item) => {
    if (filterType === 'EMERGENCY' && item.message_type !== 'EMERGENCY_SOS') return false;
    if (filterType === 'BROADCAST' && item.message_type !== 'BROADCAST_ANNOUNCEMENT') return false;
    if (filterType === 'CAREGIVER' && item.sender_role !== 'CAREGIVER') return false;
    if (filterType === 'CUSTOMER' && item.sender_role !== 'CUSTOMER') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = (item.content || '').toLowerCase();
      const matchSender = (item.sender_name || '').toLowerCase();
      const matchRef = (item.request_reference || '').toLowerCase();
      const matchPatient = (item.patient_name || '').toLowerCase();
      return matchText.includes(q) || matchSender.includes(q) || matchRef.includes(q) || matchPatient.includes(q);
    }
    return true;
  });

  const emergencyCount = feed.filter((f) => f.message_type === 'EMERGENCY_SOS').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E6E9E8] shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F6B5C]/10 flex items-center justify-center text-[#0F6B5C]">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Live Dispatch & Communications Center</h1>
              <p className="text-xs text-gray-500">Real-time bi-directional messaging, emergency SOS dispatch, and network advisories</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{isConnected ? 'Live WebSocket Connected' : 'Reconnecting...'}</span>
          </div>

          <button
            onClick={() => loadFeed(false)}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition"
            title="Refresh Feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0F6B5C]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Emergency Alert Banner if any SOS detected */}
      {emergencyCount > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-xl animate-bounce">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-rose-900 text-sm">ACTIVE EMERGENCY SOS DETECTED ({emergencyCount})</h3>
              <p className="text-xs text-rose-700">Immediate response protocol active. Caregiver/patient coordinates pinned below.</p>
            </div>
          </div>
          <button
            onClick={playAlertSound}
            className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition"
          >
            Replay Siren
          </button>
        </div>
      )}

      {/* Two Column Grid: Broadcast Tool + Comms Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Dispatch Intercom & Broadcast (1 col) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Direct Visit Intercom */}
          <div className="bg-white p-5 rounded-2xl border border-[#E6E9E8] shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <MessageSquare className="w-4 h-4 text-[#0F6B5C]" />
              <span>Direct Visit Intercom</span>
            </div>
            <p className="text-xs text-gray-500">Inject dispatch instructions directly into an active visit's timeline.</p>

            <form onSubmit={handleSendDirect} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Target Active Visit</label>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-1 focus:ring-[#0F6B5C] outline-hidden"
                >
                  <option value="">General Dispatch (All Active)</option>
                  {activeRequests.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.reference} • {req.patient_name} ({req.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Message to Participant</label>
                <textarea
                  rows={3}
                  value={msgContent}
                  onChange={(e) => setMsgContent(e.target.value)}
                  placeholder="Type dispatch update (e.g., 'Nurse Sister Almaz is arriving in 10 mins')..."
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-200 focus:ring-1 focus:ring-[#0F6B5C] outline-hidden"
                  required
                />
              </div>

              {/* Quick dispatch tags */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Traffic delay: ETA +15m',
                  'Please confirm gate access',
                  'Clinical vitals check required',
                  'Nurse en route to destination',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setMsgContent(chip)}
                    className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition"
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={sendingMsg}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0F6B5C] text-white rounded-lg text-xs font-bold hover:bg-[#0c574a] transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingMsg ? 'Dispatching...' : 'Send to Visit Timeline'}</span>
              </button>
            </form>
          </div>

          {/* Network-Wide Broadcast Tool */}
          <div className="bg-white p-5 rounded-2xl border border-[#E6E9E8] shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Megaphone className="w-4 h-4 text-amber-600" />
              <span>Broadcast Network Advisory</span>
            </div>
            <p className="text-xs text-gray-500">Send an urgent alert or operational bulletin to all mobile apps across Addis Ababa.</p>

            {broadcastSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Advisory successfully broadcasted to all active devices!</span>
              </div>
            )}

            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Target Audience</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {(['ALL', 'CAREGIVER', 'CUSTOMER'] as const).map((aud) => (
                    <button
                      key={aud}
                      type="button"
                      onClick={() => setBroadcastAudience(aud)}
                      className={`py-1.5 rounded-lg border font-semibold text-[11px] transition ${
                        broadcastAudience === aud
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {aud === 'ALL' ? 'Entire Network' : aud === 'CAREGIVER' ? 'Nurses / Aides' : 'Patients'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Advisory Title</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="e.g., Addis Rain Advisory / Traffic in Bole"
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-200 outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Announcement Body</label>
                <textarea
                  rows={3}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Provide operational guidance, weather delays, or clinical notices..."
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-200 outline-hidden"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={sendingBroadcast}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition disabled:opacity-50"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>{sendingBroadcast ? 'Broadcasting...' : 'Broadcast to Mobile Apps'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Real-Time Feed (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Feed Filter Chips & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#E6E9E8] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'ALL', label: 'All Feed', count: feed.length },
                { id: 'EMERGENCY', label: '🚨 SOS Emergencies', count: emergencyCount },
                { id: 'CAREGIVER', label: '👩‍⚕️ Caregiver Notes', count: feed.filter((f) => f.sender_role === 'CAREGIVER').length },
                { id: 'CUSTOMER', label: '👤 Patient Inquiries', count: feed.filter((f) => f.sender_role === 'CUSTOMER').length },
                { id: 'BROADCAST', label: '📢 Advisories', count: feed.filter((f) => f.message_type === 'BROADCAST_ANNOUNCEMENT').length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    filterType === tab.id
                      ? 'bg-[#0F6B5C] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterType === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages, patient, ref..."
                className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-gray-200 outline-hidden"
              />
            </div>
          </div>

          {/* Messages Feed Stream */}
          <div className="space-y-3">
            {loading && feed.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-xs bg-white rounded-2xl border border-[#E6E9E8]">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-[#0F6B5C]" />
                <p>Loading real-time communications stream...</p>
              </div>
            ) : filteredFeed.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-xs bg-white rounded-2xl border border-[#E6E9E8]">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="font-semibold text-gray-600">No communication records match this filter</p>
                <p className="text-[11px] mt-1">In-visit chats, location pings, and emergency alerts will appear here in real time.</p>
              </div>
            ) : (
              filteredFeed.map((item) => {
                const isEmergency = item.message_type === 'EMERGENCY_SOS';
                const isBroadcast = item.message_type === 'BROADCAST_ANNOUNCEMENT';
                const isCaregiver = item.sender_role === 'CAREGIVER';

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isEmergency
                        ? 'bg-rose-50/80 border-rose-300 shadow-md animate-pulse'
                        : isBroadcast
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-white border-[#E6E9E8] hover:border-[#0F6B5C]/30 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isEmergency
                              ? 'bg-rose-600 text-white'
                              : isBroadcast
                              ? 'bg-amber-500 text-white'
                              : isCaregiver
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {isEmergency ? '🚨' : isBroadcast ? '📢' : isCaregiver ? 'RN' : 'PT'}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900">{item.sender_name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                isEmergency
                                  ? 'bg-rose-200 text-rose-900'
                                  : isCaregiver
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {item.sender_role}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                            {item.request_reference && (
                              <span className="font-semibold text-gray-700">{item.request_reference}</span>
                            )}
                            {item.patient_name && <span>• Patient: {item.patient_name}</span>}
                            {item.service_name && <span>• {item.service_name}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="mt-3 pl-10.5">
                      <p
                        className={`text-xs ${
                          isEmergency
                            ? 'font-bold text-rose-900 bg-rose-100/70 p-2.5 rounded-lg border border-rose-300'
                            : 'text-gray-800 bg-gray-50/80 p-2.5 rounded-lg border border-gray-100'
                        }`}
                      >
                        {item.content}
                      </p>

                      {/* Metadata Chips (e.g. coordinates or quick status) */}
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Boolean(item.metadata.latitude && item.metadata.longitude) && (
                            <a
                              href={`https://www.google.com/maps?q=${String(item.metadata.latitude)},${String(item.metadata.longitude)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-semibold hover:underline"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>View GPS Location on Google Maps</span>
                            </a>
                          )}
                          {Boolean(item.metadata.channel) && (
                            <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-medium">
                              Channel: {String(item.metadata.channel)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
