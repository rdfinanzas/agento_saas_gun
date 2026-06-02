/**
 * Knowledge Controller
 * Migrado de Express a Hono
 */

import type { Context } from "hono"
import { knowledgeService } from "../services/knowledge.service"
import { HTTPException } from "hono/http-exception"
import { KnowledgeType } from "../../../db/schema/enums"

export class KnowledgeController {
  /**
   * POST /api/knowledge
   * Create knowledge entry
   */
  async create(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const body = await c.req.json()
    const entry = await knowledgeService.create({
      ...body,
      tenantId,
    })

    return c.json(entry, 201)
  }

  /**
   * GET /api/knowledge
   * List knowledge entries
   */
  async list(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const options = {
      tenantId,
      agentId: c.req.query("agentId"),
      type: c.req.query("type") as KnowledgeType | undefined,
      search: c.req.query("search"),
      tags: c.req.query("tags")?.split(","),
      status: c.req.query("status"),
      page: parseInt(c.req.query("page") || "1"),
      limit: parseInt(c.req.query("limit") || "20"),
    }

    const entries = await knowledgeService.list(options)
    return c.json(entries)
  }

  /**
   * GET /api/knowledge/search
   * Search knowledge entries
   */
  async search(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const query = c.req.query("q")
    if (!query) {
      throw new HTTPException(400, { message: "Search query required" })
    }

    const results = await knowledgeService.search(tenantId, query, {
      agentId: c.req.query("agentId"),
      type: c.req.query("type") as KnowledgeType | undefined,
      limit: parseInt(c.req.query("limit") || "10"),
    })

    return c.json(results)
  }

  /**
   * GET /api/knowledge/stats
   * Get knowledge statistics
   */
  async getStats(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const stats = await knowledgeService.getStats(tenantId)
    return c.json(stats)
  }

  /**
   * GET /api/knowledge/agent/:agentId
   * Get knowledge by agent
   */
  async getByAgent(c: Context) {
    const tenantId = c.get("tenantId") as string
    const agentId = c.req.param("agentId")

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const entries = await knowledgeService.getByAgent(agentId, tenantId)
    return c.json(entries)
  }

  /**
   * GET /api/knowledge/:id
   * Get knowledge entry by ID
   */
  async getById(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const entry = await knowledgeService.getById(id, tenantId)
    if (!entry) {
      throw new HTTPException(404, { message: "Knowledge entry not found" })
    }

    return c.json(entry)
  }

  /**
   * PUT /api/knowledge/:id
   * Update knowledge entry
   */
  async update(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const body = await c.req.json()
    const entry = await knowledgeService.update(id, tenantId, body)
    return c.json(entry)
  }

  /**
   * DELETE /api/knowledge/:id
   * Delete knowledge entry
   */
  async delete(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const entry = await knowledgeService.delete(id, tenantId)
    return c.json({ message: "Knowledge entry deleted", entry })
  }

  /**
   * POST /api/knowledge/import
   * Import knowledge from JSON
   */
  async import(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const body = await c.req.json()
    if (!Array.isArray(body)) {
      throw new HTTPException(400, { message: "Expected array of knowledge entries" })
    }

    const entries = await knowledgeService.importFromJson(tenantId, body)
    return c.json({ message: `Imported ${entries.length} entries`, entries }, 201)
  }

  /**
   * POST /api/knowledge/bulk
   * Bulk create knowledge entries
   */
  async bulkCreate(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const body = await c.req.json()
    if (!Array.isArray(body)) {
      throw new HTTPException(400, { message: "Expected array of knowledge entries" })
    }

    const entries = body.map((item: any) => ({ ...item, tenantId }))
    const created = await knowledgeService.bulkCreate(entries)

    return c.json({ message: `Created ${created.length} entries`, entries: created }, 201)
  }
}

export const knowledgeController = new KnowledgeController()
