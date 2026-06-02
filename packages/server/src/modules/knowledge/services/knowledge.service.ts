/**
 * Knowledge Service - Gestión de base de conocimientos
 * Migrado de Prisma a Drizzle ORM para Bun
 */

import { eq, and, or, like, sql, desc, isNull, count } from "drizzle-orm"
import { db } from "../../../db"
import { knowledgeEntries, knowledgeEmbeddings, agents } from "../../../db/schema"
import { KnowledgeType } from "../../../db/schema/enums"

export interface CreateKnowledgeInput {
  tenantId: string
  agentId?: string
  type: KnowledgeType
  title: string
  content: string
  source?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface UpdateKnowledgeInput {
  title?: string
  content?: string
  source?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  status?: string
}

export interface KnowledgeFilterOptions {
  tenantId: string
  agentId?: string
  type?: KnowledgeType
  search?: string
  tags?: string[]
  status?: string
  page?: number
  limit?: number
}

export interface KnowledgeSearchResult {
  entry: typeof knowledgeEntries.$inferSelect
  score: number
}

class KnowledgeService {
  /**
   * Create knowledge entry
   */
  async create(data: CreateKnowledgeInput) {
    const [entry] = await db
      .insert(knowledgeEntries)
      .values({
        tenantId: data.tenantId,
        agentId: data.agentId,
        type: data.type,
        title: data.title,
        content: data.content,
        source: data.source,
        tags: data.tags || [],
        metadata: data.metadata,
        status: "ACTIVE",
      })
      .returning()

    return entry
  }

  /**
   * Get knowledge entry by ID
   */
  async getById(id: string, tenantId: string) {
    return db.query.knowledgeEntries.findFirst({
      where: and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.tenantId, tenantId)),
    })
  }

  /**
   * List knowledge entries
   */
  async list(options: KnowledgeFilterOptions) {
    const { tenantId, agentId, type, search, tags, status, page = 1, limit = 20 } = options
    const offset = (page - 1) * limit

    // Build conditions
    const conditions = [eq(knowledgeEntries.tenantId, tenantId)]

    if (agentId) {
      conditions.push(eq(knowledgeEntries.agentId, agentId))
    }
    if (type) {
      conditions.push(eq(knowledgeEntries.type, type))
    }
    if (status) {
      conditions.push(eq(knowledgeEntries.status, status))
    }

    const entries = await db.query.knowledgeEntries.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [desc(knowledgeEntries.createdAt)],
    })

    // Filter by tags if provided
    let filtered = entries
    if (tags && tags.length > 0) {
      filtered = entries.filter((entry) => tags.every((tag) => entry.tags.includes(tag)))
    }

    // Filter by search if provided
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (entry) =>
          entry.title.toLowerCase().includes(searchLower) ||
          entry.content.toLowerCase().includes(searchLower)
      )
    }

    return filtered
  }

  /**
   * Update knowledge entry
   */
  async update(id: string, tenantId: string, data: UpdateKnowledgeInput) {
    const existing = await this.getById(id, tenantId)
    if (!existing) {
      throw new Error("Knowledge entry not found")
    }

    const [updated] = await db
      .update(knowledgeEntries)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeEntries.id, id))
      .returning()

    return updated
  }

  /**
   * Delete knowledge entry (soft delete)
   */
  async delete(id: string, tenantId: string) {
    const existing = await this.getById(id, tenantId)
    if (!existing) {
      throw new Error("Knowledge entry not found")
    }

    const [deleted] = await db
      .update(knowledgeEntries)
      .set({ status: "DELETED", updatedAt: new Date() })
      .where(eq(knowledgeEntries.id, id))
      .returning()

    return deleted
  }

  /**
   * Search knowledge entries (basic text search)
   */
  async search(
    tenantId: string,
    query: string,
    options?: {
      agentId?: string
      type?: KnowledgeType
      limit?: number
    }
  ): Promise<KnowledgeSearchResult[]> {
    const limit = options?.limit || 10
    const queryLower = query.toLowerCase()

    const conditions = [eq(knowledgeEntries.tenantId, tenantId), eq(knowledgeEntries.status, "ACTIVE")]

    if (options?.agentId) {
      conditions.push(eq(knowledgeEntries.agentId, options.agentId))
    }
    if (options?.type) {
      conditions.push(eq(knowledgeEntries.type, options.type))
    }

    const entries = await db.query.knowledgeEntries.findMany({
      where: and(...conditions),
      limit: limit * 2, // Get more to filter by relevance
    })

    // Simple relevance scoring
    const results: KnowledgeSearchResult[] = []
    for (const entry of entries) {
      const titleLower = entry.title.toLowerCase()
      const contentLower = entry.content.toLowerCase()

      let score = 0

      // Title match (higher weight)
      if (titleLower.includes(queryLower)) {
        score += 10
      }

      // Content match
      if (contentLower.includes(queryLower)) {
        score += 5
      }

      // Tag match
      if (entry.tags.some((tag) => tag.toLowerCase().includes(queryLower))) {
        score += 3
      }

      if (score > 0) {
        results.push({ entry, score })
      }
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }

  /**
   * Get knowledge by agent
   */
  async getByAgent(agentId: string, tenantId: string) {
    // Get agent-specific and global (agentId = null) entries
    return db.query.knowledgeEntries.findMany({
      where: and(
        eq(knowledgeEntries.tenantId, tenantId),
        eq(knowledgeEntries.status, "ACTIVE"),
        or(eq(knowledgeEntries.agentId, agentId), isNull(knowledgeEntries.agentId))
      ),
      orderBy: [desc(knowledgeEntries.createdAt)],
    })
  }

  /**
   * Get knowledge statistics
   */
  async getStats(tenantId: string) {
    const entries = await db.query.knowledgeEntries.findMany({
      where: eq(knowledgeEntries.tenantId, tenantId),
    })

    const total = entries.length
    const active = entries.filter((e) => e.status === "ACTIVE").length

    const byType: Record<string, number> = {}
    const byAgent: Record<string, number> = {}

    for (const entry of entries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1
      if (entry.agentId) {
        byAgent[entry.agentId] = (byAgent[entry.agentId] || 0) + 1
      } else {
        byAgent["global"] = (byAgent["global"] || 0) + 1
      }
    }

    return { total, active, byType, byAgent }
  }

  /**
   * Bulk create knowledge entries
   */
  async bulkCreate(entries: CreateKnowledgeInput[]) {
    const created = await db.insert(knowledgeEntries).values(
      entries.map((e) => ({
        ...e,
        tags: e.tags || [],
        status: "ACTIVE",
      }))
    ).returning()

    return created
  }

  /**
   * Import knowledge from JSON
   */
  async importFromJson(tenantId: string, data: Array<{
    type: KnowledgeType
    title: string
    content: string
    source?: string
    tags?: string[]
    agentId?: string
  }>) {
    const entries = data.map((item) => ({
      tenantId,
      agentId: item.agentId,
      type: item.type,
      title: item.title,
      content: item.content,
      source: item.source,
      tags: item.tags || [],
      status: "ACTIVE" as const,
    }))

    return this.bulkCreate(entries)
  }
}

export const knowledgeService = new KnowledgeService()
