// Tipos compartidos para autenticación

export interface LoginCredentials {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  tenantSlug: string;
}

export interface AuthTokens {
  token: string;
  refreshToken?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

export interface AuthTenant {
  id: string;
  slug: string;
  name: string;
  email?: string;
}

export interface AuthState {
  user: AuthUser | null;
  tenant: AuthTenant | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
