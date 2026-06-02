// Middleware de cliente para manejar redirecciones basadas en autenticación
// Este archivo proporciona utilidades para manejar redirecciones en el cliente

export function getTenantFromPath(): string | null {
  if (typeof window === 'undefined') return null;

  const path = window.location.pathname;
  const match = path.match(/^\/([^\/]+)/);
  return match ? match[1] : null;
}

export function redirectToLogin(returnUrl?: string) {
  if (typeof window === 'undefined') return;

  const loginUrl = returnUrl
    ? `/login?returnUrl=${encodeURIComponent(returnUrl)}`
    : '/login';

  window.location.href = loginUrl;
}

export function redirectToDashboard(tenantSlug: string) {
  if (typeof window === 'undefined') return;

  window.location.href = `/${tenantSlug}/dashboard`;
}
