/**
 * Tenant Controller - Migrado a Hono
 */

import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { tenantService } from "../services/tenant.service"

class TenantController {
  /**
   * POST /api/v1/tenants
   * Crea un nuevo tenant (solo admin)
   */
  async create(c: Context) {
    const body = await c.req.json()

    const tenant = await tenantService.create(body)

    return c.json({
      success: true,
      data: tenant,
    })
  }

  /**
   * GET /api/v1/tenants
   * Lista todos los tenants (solo admin)
   */
  async list(c: Context) {
    const page = parseInt(c.req.query("page") || "1")
    const limit = parseInt(c.req.query("limit") || "20")
    const search = c.req.query("search")
    const status = c.req.query("status")

    const result = await tenantService.list({
      page,
      limit,
      search: search || undefined,
      status: status || undefined,
    })

    return c.json({
      success: true,
      data: result.tenants,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    })
  }

  /**
   * GET /api/v1/tenants/:id
   * Obtiene un tenant por ID
   */
  async getById(c: Context) {
    const id = c.req.param("id")

    const tenant = await tenantService.getById(id)

    if (!tenant) {
      throw new HTTPException(404, { message: "Tenant not found" })
    }

    return c.json({
      success: true,
      data: tenant,
    })
  }

  /**
   * GET /api/v1/tenants/slug/:slug
   * Obtiene un tenant por slug
   */
  async getBySlug(c: Context) {
    const slug = c.req.param("slug")

    const tenant = await tenantService.getBySlug(slug)

    if (!tenant) {
      throw new HTTPException(404, { message: "Tenant not found" })
    }

    return c.json({
      success: true,
      data: tenant,
    })
  }

  /**
   * PUT /api/v1/tenants/:id
   * Actualiza un tenant
   */
  async update(c: Context) {
    const id = c.req.param("id")
    const body = await c.req.json()

    const tenant = await tenantService.update(id, body)

    return c.json({
      success: true,
      data: tenant,
    })
  }

  /**
   * DELETE /api/v1/tenants/:id
   * Elimina un tenant (soft delete)
   */
  async delete(c: Context) {
    const id = c.req.param("id")

    await tenantService.delete(id)

    return c.json({
      success: true,
      message: "Tenant deleted successfully",
    })
  }

  /**
   * GET /api/v1/tenants/:id/stats
   * Obtiene estadísticas del tenant
   */
  async getStats(c: Context) {
    const id = c.req.param("id")

    const stats = await tenantService.getStats(id)

    return c.json({
      success: true,
      data: stats,
    })
  }

  /**
   * PUT /api/v1/tenants/:id/plan
   * Cambia el plan de suscripción
   */
  async changePlan(c: Context) {
    const id = c.req.param("id")
    const body = await c.req.json()

    if (!body.tier) {
      throw new HTTPException(400, { message: "tier is required" })
    }

    const tenant = await tenantService.changePlan(id, body.tier)

    return c.json({
      success: true,
      data: tenant,
    })
  }

  /**
   * POST /api/v1/tenants/:id/activate
   * Activa un tenant
   */
  async activate(c: Context) {
    const id = c.req.param("id")

    const tenant = await tenantService.activate(id)

    return c.json({
      success: true,
      data: tenant,
    })
  }

  /**
   * POST /api/v1/tenants/:id/suspend
   * Suspende un tenant
   */
  async suspend(c: Context) {
    const id = c.req.param("id")

    const tenant = await tenantService.suspend(id)

    return c.json({
      success: true,
      data: tenant,
    })
  }
}

export const tenantController = new TenantController()
