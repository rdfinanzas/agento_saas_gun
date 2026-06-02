export interface TenantContext {
  tenant: string | null;
  subdomain: string | null;
  isTenantRoute: boolean;
}

/**
 * Extract tenant information from the current hostname
 * Supports both subdomain-based and path-based multi-tenancy
 */
export function getTenantFromHostname(hostname: string): TenantContext {
  // Local development environments
  const localhostDomains = ['localhost', '127.0.0.1', 'lvh.me'];

  if (localhostDomains.some(domain => hostname === domain)) {
    return {
      tenant: null,
      subdomain: null,
      isTenantRoute: false
    };
  }

  // Extract subdomain from hostname
  // Format: tenant.example.com or tenant.localhost:3000
  const parts = hostname.split('.');

  // Check if we have a subdomain (at least 3 parts for domain.tld format)
  if (parts.length >= 3) {
    const subdomain = parts[0];

    // Skip common subdomains that aren't tenants
    const reservedSubdomains = ['www', 'app', 'api', 'admin', 'cdn', 'static', 'mail'];

    if (!reservedSubdomains.includes(subdomain.toLowerCase())) {
      return {
        tenant: subdomain,
        subdomain,
        isTenantRoute: true
      };
    }
  }

  return {
    tenant: null,
    subdomain: null,
    isTenantRoute: false
  };
}

/**
 * Get tenant from URL path (fallback for path-based routing)
 * Format: example.com/tenant/dashboard
 */
export function getTenantFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);

  // First segment could be a tenant if not a reserved route
  const reservedRoutes = ['login', 'register', 'api', '_next', 'static', 'auth'];

  if (segments.length > 0 && !reservedRoutes.includes(segments[0])) {
    return segments[0];
  }

  return null;
}

/**
 * Check if current path is a tenant route
 */
export function isTenantPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  const reservedRoutes = ['login', 'register', 'api', '_next', 'static', 'auth'];

  return segments.length > 0 && !reservedRoutes.includes(segments[0]);
}
