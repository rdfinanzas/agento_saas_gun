/**
 * Admin Controller - Migrado a Hono
 */

import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { adminService } from "../services/admin.service"

class AdminController {
  async getStats(c: Context) {
    const stats = await adminService.getStats()
    return c.json({ success: true, data: stats })
  }

  async listTenants(c: Context) {
    const page = parseInt(c.req.query("page") || "1")
    const limit = parseInt(c.req.query("limit") || "20")
    const search = c.req.query("search")
    const result = await adminService.listTenants({ page, limit, search: search || undefined })
    return c.json({ success: true, ...result })
  }

  async getTenantById(c: Context) {
    const id = c.req.param("id")
    const tenant = await adminService.getTenantById(id)
    if (!tenant) throw new HTTPException(404, { message: "Tenant not found" })
    return c.json({ success: true, data: tenant })
  }

  async updateTenant(c: Context) {
    const id = c.req.param("id")
    const body = await c.req.json()
    const tenant = await adminService.updateTenant(id, body)
    return c.json({ success: true, data: tenant })
  }

  async listUsers(c: Context) {
    const page = parseInt(c.req.query("page") || "1")
    const limit = parseInt(c.req.query("limit") || "20")
    const search = c.req.query("search")
    const tenantId = c.req.query("tenantId")
    const result = await adminService.listUsers({
      page, limit,
      search: search || undefined,
      tenantId: tenantId || undefined,
    })
    return c.json({
      success: true,
      users: result.users,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit),
      },
    })
  }

  async listPlans(c: Context) {
    const plans = await adminService.listPlans()
    return c.json({
      success: true,
      plans: plans,
      pagination: { page: 1, limit: plans.length, total: plans.length, pages: 1 },
    })
  }

  async getPlanById(c: Context) {
    const id = c.req.param("id")
    const plan = await adminService.getPlanById(id)
    if (!plan) throw new HTTPException(404, { message: "Plan not found" })
    return c.json({ success: true, data: plan })
  }

  async createPlan(c: Context) {
    const body = await c.req.json()
    const plan = await adminService.upsertPlan(undefined, body)
    return c.json({ success: true, data: plan })
  }

  async updatePlan(c: Context) {
    const id = c.req.param("id")
    const body = await c.req.json()
    const plan = await adminService.upsertPlan(id, body)
    return c.json({ success: true, data: plan })
  }

  async deletePlan(c: Context) {
    const id = c.req.param("id")
    await adminService.deletePlan(id)
    return c.json({ success: true, message: "Plan deleted successfully" })
  }

  async getMetrics(c: Context) {
    const stats = await adminService.getStats()
    return c.json({
      success: true,
      data: {
        tenants: { total: stats.tenants, active: stats.tenants },
        users: { total: stats.users },
        conversations: { total: 0, active: 0 },
        messages: { total: 0, today: 0 },
        agents: { total: 0, active: 0 },
        revenue: { total: 0, monthly: 0 },
      },
    })
  }

  async listAIProviders(c: Context) {
    const tenantId = c.get("tenantId") as string | undefined
    const providers = await adminService.listAIProviders(tenantId)
    return c.json({ success: true, data: providers })
  }

  async listPublicAIProviders(c: Context) {
    const tenantId = c.get("tenantId") as string
    const providers = await adminService.listPublicAIProviders(tenantId)
    return c.json({ success: true, data: providers })
  }

  async getAIProviderById(c: Context) {
    const id = c.req.param("id")
    const provider = await adminService.getAIProviderById(id)
    if (!provider) throw new HTTPException(404, { message: "AI Provider not found" })
    return c.json({ success: true, data: provider })
  }

  async createAIProvider(c: Context) {
    const body = await c.req.json()
    const tenantId = c.get("tenantId") as string | undefined
    const provider = await adminService.upsertAIProvider(undefined, body, tenantId)
    return c.json({ success: true, data: provider })
  }

  async updateAIProvider(c: Context) {
    const id = c.req.param("id")
    const body = await c.req.json()
    const tenantId = c.get("tenantId") as string | undefined
    try {
      const provider = await adminService.upsertAIProvider(id, body, tenantId)
      return c.json({ success: true, data: provider })
    } catch (error) {
      if (error instanceof Error) throw new HTTPException(400, { message: error.message })
      throw error
    }
  }

  async listAIModels(c: Context) {
    const providerId = c.req.query("providerId")
    const models = await adminService.listAIModels(providerId || undefined)
    return c.json({ success: true, data: models })
  }

  async createAIModel(c: Context) {
    const body = await c.req.json()
    const model = await adminService.upsertAIModel(undefined, body)
    return c.json({ success: true, data: model })
  }

  async updateAIModel(c: Context) {
    const id = c.req.param("id")
    const body = await c.req.json()
    const model = await adminService.upsertAIModel(id, body)
    return c.json({ success: true, data: model })
  }

  async deleteAIModel(c: Context) {
    const id = c.req.param("id")
    await adminService.deleteAIModel(id)
    return c.json({ success: true, message: "AI Model deleted successfully" })
  }
}

export const adminController = new AdminController()
