/**
 * Accomplish Tenant Middleware - Establece el tenantId para accomplish
 *
 * Extrae el tenantId del JWT token (ya validado por authMiddleware)
 * El slug del tenant viene de la URL pero no se valida aquí por seguridad
 * - El tenantId del JWT es la fuente de verdad
 * - El slug en la URL es solo para routing del frontend
 */

import type { Context, Next } from "hono"

export async function accomplishTenantMiddleware(c: Context, next: Next) {
  // El tenantId ya está disponible en el contexto después de authMiddleware
  // El JWT contiene tenantId en el payload y es más seguro que el slug de la URL
  const tenantId = c.get("tenantId") as string | undefined

  if (!tenantId) {
    return c.json({ error: "Tenant ID not found in token" }, 401)
  }

  // Establecer tenantId en el contexto para los controladores
  c.set("tenantId", tenantId)

  await next()
}
