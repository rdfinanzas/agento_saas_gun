/**
 * Tenant Middleware - Extrae tenantId de los parámetros de la URL
 *
 * Para rutas como /api/v1/:tenant/accomplish/*
 */

import type { Context, Next } from "hono"
import { db } from "../../../db"
import { tenants } from "../../../db/schema"

export async function tenantFromParamsMiddleware(c: Context, next: Next) {
  const tenantSlug = c.req.param("tenant")

  if (!tenantSlug) {
    return c.json({ error: "Tenant parameter is required" }, 400)
  }

  // Buscar tenant por slug
  const tenant = await db.query.tenants.findFirst({
    where: (tenants, { eq }) => eq(tenants.slug, tenantSlug),
  })

  if (!tenant) {
    return c.json({ error: "Tenant not found" }, 404)
  }

  // Establecer tenantId en el contexto
  c.set("tenantId", tenant.id)
  c.set("tenantSlug", tenant.slug)

  await next()
}
