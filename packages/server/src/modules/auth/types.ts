import type { Context, Next } from "hono"
import { jwtService } from "../services/jwt.service"
import { db } from "../../db"
import { tenants } from "../../db/schema"
import { eq } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"

// User variables type for Hono context
export type UserVariables = {
  userId: string
  tenantId: string
  userRole: string
  userEmail?: string
}

/**
 * Authentication middleware
 * Verifies JWT token and adds user info to context
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, {
      message: "Token de autenticación requerido",
    })
  }

  const token = authHeader.split(" ")[1]

  try {
    const decoded = jwtService.verifyToken(token)

    // Set user info in context
    c.set("userId", decoded.userId)
    c.set("tenantId", decoded.tenantId)
    c.set("userRole", decoded.role)

    await next()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token inválido"
    throw new HTTPException(401, { message })
  }
}

/**
 * Optional authentication middleware
 * Doesn't fail if no token, but adds info if exists
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return next()
  }

  const token = authHeader.split(" ")[1]

  try {
    const decoded = jwtService.verifyToken(token)
    c.set("userId", decoded.userId)
    c.set("tenantId", decoded.tenantId)
    c.set("userRole", decoded.role)
  } catch {
    // Ignore errors in optional auth
  }

  await next()
}

/**
 * Admin middleware
 * Only allows ADMIN or OWNER roles
 */
export async function adminMiddleware(c: Context, next: Next) {
  const userRole = c.get("userRole")
  const userId = c.get("userId")

  if (!userId) {
    throw new HTTPException(401, {
      message: "Autenticación requerida",
    })
  }

  if (userRole !== "ADMIN" && userRole !== "OWNER") {
    throw new HTTPException(403, {
      message: "Se requiere rol de administrador",
    })
  }

  await next()
}

/**
 * Owner middleware
 * Only allows OWNER role
 */
export async function ownerMiddleware(c: Context, next: Next) {
  const userRole = c.get("userRole")
  const userId = c.get("userId")

  if (!userId) {
    throw new HTTPException(401, {
      message: "Autenticación requerida",
    })
  }

  if (userRole !== "OWNER") {
    throw new HTTPException(403, {
      message: "Se requiere rol de propietario",
    })
  }

  await next()
}

/**
 * Tenant middleware
 * Verifies tenant exists and adds to context
 */
export async function tenantMiddleware(c: Context, next: Next) {
  const tenantSlug = c.req.param("tenantSlug") || c.req.header("x-tenant-slug")

  if (!tenantSlug) {
    throw new HTTPException(400, {
      message: "Tenant requerido",
    })
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, tenantSlug),
    })

    if (!tenant) {
      throw new HTTPException(404, {
        message: "Tenant no encontrado",
      })
    }

    c.set("tenantId", tenant.id)
    await next()
  } catch (error) {
    if (error instanceof HTTPException) throw error
    throw new HTTPException(500, {
      message: "Error al verificar tenant",
    })
  }
}

/**
 * Combined auth + tenant middleware
 */
export async function authAndTenantMiddleware(c: Context, next: Next) {
  await authMiddleware(c, async () => {
    await tenantMiddleware(c, next)
  })
}

/**
 * Role-based middleware factory
 */
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const userRole = c.get("userRole")

    if (!userRole || !roles.includes(userRole)) {
      throw new HTTPException(403, {
        message: `Se requiere uno de los siguientes roles: ${roles.join(", ")}`,
      })
    }

    await next()
  }
}
