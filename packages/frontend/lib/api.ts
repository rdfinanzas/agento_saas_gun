const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
interface ApiOptions extends RequestInit {
  token?: string;
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Automatically add tenant slug from localStorage if available
  // NOTE: This only works on client-side (browser), not during SSR
  if (typeof window !== 'undefined') {
    try {
      const tenantItem = localStorage.getItem('tenant');
      if (tenantItem) {
        const tenant = JSON.parse(tenantItem);
        if (tenant?.slug) {
          headers['x-tenant-slug'] = tenant.slug;
        }
      }
    } catch (error) {
      console.error('Error reading tenant from localStorage:', error);
    }
  }

  const response = await fetch(`${API_URL}/api/v1${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Métodos de conveniencia
export const api = {
  get: <T = any>(endpoint: string, token?: string) =>
    fetchApi<T>(endpoint, { method: 'GET', token }),

  post: <T = any>(endpoint: string, body: any, token?: string) =>
    fetchApi<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      token
    }),

  put: <T = any>(endpoint: string, body: any, token?: string) =>
    fetchApi<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      token
    }),

  patch: <T = any>(endpoint: string, body?: any, token?: string) =>
    fetchApi<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      token
    }),

  delete: <T = any>(endpoint: string, token?: string) =>
    fetchApi<T>(endpoint, { method: 'DELETE', token }),
};

// Interfaces de respuesta del API
export interface AuthResponse {
  token: string;
  user: User;
  tenant?: Tenant;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  email?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  tenantSlug: string;
}
