'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User, Tenant, LoginRequest, RegisterRequest } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  register: (email: string, password: string, name: string, tenantName: string, tenantSlug: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }
    
    // Cargar token y datos del localStorage usando utilidades
    const storedToken = storage.getItem<string>('token');
    const storedUser = storage.getItem<User>('user');
    const storedTenant = storage.getItem<Tenant>('tenant');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
      if (storedTenant) setTenant(storedTenant);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, tenantSlug?: string) => {
    const response = await api.post<{ token: string; refreshToken: string; user: User & { tenant?: Tenant } }>(
      '/auth/login',
      { email, password, tenantSlug }
    );

    storage.setItem('token', response.token);
    storage.setItem('refreshToken', response.refreshToken);
    storage.setItem('user', response.user);

    // El tenant viene dentro de user.tenant
    const tenant = response.user.tenant;
    if (tenant) {
      storage.setItem('tenant', tenant);
      setTenant(tenant);
    }

    setToken(response.token);
    setUser(response.user);

    // Solo redirigir al admin panel si es super admin (tenant agento-superadmin)
    const isSuperAdmin = tenant?.slug === 'agento-superadmin';
    if (isSuperAdmin && (response.user.role === 'OWNER' || response.user.role === 'ADMIN')) {
      router.push('/admin');
      return;
    }

    // Redirigir al dashboard del tenant
    const targetTenant = tenant?.slug || tenantSlug || 'default';
    router.push(`/${targetTenant}/dashboard`);
  };

  const register = async (email: string, password: string, name: string, tenantName: string, tenantSlug: string) => {
    const response = await api.post<{ token: string; refreshToken: string; user: User & { tenant?: Tenant } }>(
      '/auth/register',
      { email, password, name, tenantName, tenantSlug }
    );

    storage.setItem('token', response.token);
    storage.setItem('refreshToken', response.refreshToken);
    storage.setItem('user', response.user);

    // El tenant viene dentro de user.tenant
    const tenant = response.user.tenant;
    if (tenant) {
      storage.setItem('tenant', tenant);
      setTenant(tenant);
    }

    setToken(response.token);
    setUser(response.user);

    // Los nuevos usuarios van al dashboard de su tenant
    router.push(`/${tenantSlug}/dashboard`);
  };

  const logout = () => {
    storage.removeItem('token');
    storage.removeItem('user');
    storage.removeItem('tenant');
    setToken(null);
    setUser(null);
    setTenant(null);
    router.push('/login');
  };

  const value: AuthContextType = {
    user,
    tenant,
    token,
    login,
    register,
    logout,
    isLoading,
    isAuthenticated: !!token && !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
