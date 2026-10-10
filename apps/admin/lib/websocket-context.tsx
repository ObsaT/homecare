'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './auth-context';

export interface DashboardNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: Record<string, unknown>;
}

interface WebSocketContextType {
  isConnected: boolean;
  notifications: DashboardNotification[];
  unreadCount: number;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  playAlertSound: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// Web Audio API Sound Synthesizer for Admin Portal
function playDashboardChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    const playNote = (freq: number, start: number, duration: number, gainVal: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(gainVal, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    // Ascending dual alert chime (E5 659Hz -> B5 987Hz)
    playNote(659.25, now, 0.25, 0.35);
    playNote(987.77, now + 0.15, 0.40, 0.45);
  } catch (e) {
    console.warn('Dashboard audio chime failed:', e);
  }
}

function playEmergencySiren() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.linearRampToValueAtTime(587, now + 0.2);
    osc.frequency.linearRampToValueAtTime(880, now + 0.4);
    osc.frequency.linearRampToValueAtTime(587, now + 0.6);
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.85);
  } catch (e) {
    console.warn('Emergency audio failed:', e);
  }
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addNotification = useCallback((type: string, title: string, message: string, data?: Record<string, unknown>) => {
    const newNotif: DashboardNotification = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      data,
    };

    setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]); // Keep last 50
    playDashboardChime();

    // Notify any listening pages to refresh their data tables
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hc-realtime-update', { detail: { type, data } }));
    }
  }, []);

  const connectWs = useCallback(() => {
    if (!token || !isAuthenticated) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const wsUrl = `ws://${host}:3000/ws?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const type = payload.type;
          const data = payload.data || {};

          // Immediately notify all active pages to refresh their UI
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hc-realtime-update', { detail: { type, data } }));
          }

          switch (type) {
            case 'NEW_REQUEST':
              addNotification(
                type,
                '🚨 New Care Request Submitted',
                `Request ${data.reference || ''} for ${data.patient_name || 'Patient'}`,
                data,
              );
              break;
            case 'NEW_OFFER':
              addNotification(
                type,
                '📍 Assignment Dispatched',
                `Care visit offered to nurse in ${data.sub_city || 'Addis Ababa'}`,
                data,
              );
              break;
            case 'OFFER_ACCEPTED':
              addNotification(
                type,
                '✅ Assignment Accepted',
                `${data.caregiver_name ? data.caregiver_name + ' accepted' : 'Caregiver accepted'} request ${data.reference || data.appointment_id || ''}`,
                data,
              );
              break;
            case 'OFFER_DECLINED':
              addNotification(
                type,
                '⚠️ Offer Declined',
                `${data.caregiver_name ? data.caregiver_name + ' declined' : 'Caregiver declined'} request ${data.reference || data.appointment_id || ''}. Reassignment required.`,
                data,
              );
              break;
            case 'VISIT_STATUS_CHANGED':
              addNotification(
                type,
                '🚗 Visit Status Updated',
                data.message || `Visit ${data.reference || ''} status changed to ${data.status || 'NEW_STATUS'}`,
                data,
              );
              break;
            case 'VISIT_COMPLETED':
              addNotification(
                type,
                '🎉 Visit Completed & Vitals Recorded',
                `Appointment ${data.reference || data.appointment_id || ''} completed successfully`,
                data,
              );
              break;
            case 'REQUEST_CANCELLED':
              addNotification(
                type,
                '❌ Request Cancelled by Patient',
                `Request ${data.reference || data.request_id || ''}: ${data.reason || 'Cancelled by customer'}`,
                data,
              );
              break;
            case 'PAYMENT_CLAIM_SUBMITTED':
              addNotification(
                type,
                '💳 Payment Claim Submitted',
                `${data.customer_name || 'Customer'} submitted ${data.amount_etb || 0} ETB via ${data.method || 'Telebirr'} (Ref: ${data.customer_reference || data.invoice_number || ''})`,
                data,
              );
              break;
            case 'PAYMENT_CONFIRMED':
              addNotification(
                type,
                '💰 Payment Verified & Reconciled',
                `Payment verified. Invoice marked as PAID.`,
                data,
              );
              break;
            case 'CAREGIVER_AVAILABILITY_CHANGED':
              addNotification(
                type,
                data.is_available ? '🩺 Caregiver On-Duty' : '💤 Caregiver Off-Duty',
                `${data.caregiver_name || 'Caregiver'} is now ${data.is_available ? 'AVAILABLE for dispatches' : 'OFFLINE'}`,
                data,
              );
              break;
            case 'CAREGIVER_REGISTERED':
              addNotification(
                type,
                '👩‍⚕️ New Caregiver Registered',
                `${data.full_name || 'Caregiver'} (${data.professional_title || 'Clinical'}) registered in ${data.sub_city || 'Addis Ababa'}. Onboarding fee: ${data.amount_etb || 500} ETB verified.`,
                data,
              );
              break;
            case 'CUSTOMER_REGISTERED':
              addNotification(
                type,
                '👤 New Customer Registered',
                `${data.full_name || 'Customer'} created an account (${data.phone_e164 || ''}).`,
                data,
              );
              break;
            case 'REVIEW_SUBMITTED':
              addNotification(
                type,
                '⭐ New Patient Review & Rating',
                `${data.customer_name || 'Patient'} gave ${data.caregiver_name || 'Caregiver'} ${data.rating_overall || 5}/5 stars: "${data.comment || 'Service completed'}"`,
                data,
              );
              break;
            case 'QUOTE_UPDATED':
              addNotification(
                type,
                '📝 Service Quote Updated',
                `Request ${data.reference || ''} updated to ${(Number(data.price_santim || 0) / 100).toFixed(0)} ETB`,
                data,
              );
              break;
            case 'EMERGENCY_SOS':
              playEmergencySiren();
              addNotification(
                type,
                '🚨 EMERGENCY SOS ALARM',
                `CRITICAL: ${data.sender_name || 'Caregiver'} reported emergency for ${data.patient_name || 'Patient'} (${data.reference || ''}): "${data.content || 'Medical emergency'}"`,
                data,
              );
              break;
            case 'CHAT_MESSAGE':
              addNotification(
                type,
                `💬 In-Visit Message (${data.sender_role || 'Chat'})`,
                `${data.sender_name || 'User'} on ${data.reference || 'Visit'}: "${data.content}"`,
                data,
              );
              break;
            case 'BROADCAST_ANNOUNCEMENT':
              addNotification(
                type,
                '📢 Network Announcement Broadcasted',
                `${data.content}`,
                data,
              );
              break;
            case 'ETA_UPDATE':
              addNotification(
                type,
                '⏱️ Live ETA Updated',
                `${data.sender_name || 'Caregiver'} updated arrival ETA: ${data.content}`,
                data,
              );
              break;
            default:
              break;
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        // Auto-reconnect after 4 seconds
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connectWs, 4000);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch (e) {
      console.warn('Failed to establish WebSocket connection:', e);
    }
  }, [token, isAuthenticated, addNotification]);

  useEffect(() => {
    if (isAuthenticated && token) {
      connectWs();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    }

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, token, connectWs]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        notifications,
        unreadCount,
        markAllAsRead,
        clearNotifications,
        playAlertSound: playDashboardChime,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useDashboardWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useDashboardWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
