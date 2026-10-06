export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000/api/v1';

export interface ApiError {
  code: string;
  message: string;
  message_am?: string;
  field_errors?: Record<string, string>;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('homecare_admin_token');
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('homecare_admin_token', token);
  } else {
    localStorage.removeItem('homecare_admin_token');
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: ApiError | null }> {
  const token = getStoredToken();
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401) {
        // Token invalid or expired
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          setStoredToken(null);
          window.location.href = '/login?expired=true';
        }
      }

      return {
        data: null,
        error: body?.error || {
          code: 'REQUEST_FAILED',
          message: body?.message || `Request failed with status ${res.status}`,
          message_am: body?.message_am,
        },
      };
    }

    return {
      data: body?.data !== undefined ? body.data : body,
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: err?.message || 'Unable to connect to Home Care API server',
        message_am: 'የኔትወርክ ወይም የሰርቨር ግንኙነት ችግር አጋጥሟል።',
      },
    };
  }
}
