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
