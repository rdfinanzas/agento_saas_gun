/**
 * Marketplace Service - Gestion de skills del marketplace
 * Usa Drizzle ORM con Bun/Hono
 */

import { eq, and, desc, sql, avg, count } from "drizzle-orm"
import { db } from "../../../db"
import { marketplaceSkills, skillReviews, installedSkills } from "../../../db/schema/marketplace"

export interface ListSkillsOptions {
  category?: string
  search?: string
  status?: string
  isVerified?: boolean
  isOfficial?: boolean
  page?: number
  limit?: number
}

export interface CreateReviewInput {
  skillId: string
  userId: string
  userName: string
  rating: number
  comment?: string
}

export interface InstallSkillInput {
  tenantId: string
  marketplaceSkillId: string
  localSkillId: string
}

class MarketplaceService {
  /**
   * Listar skills disponibles en el marketplace
   */
  async listSkills(options: ListSkillsOptions = {}) {
    const { category, search, status = "PUBLISHED", isVerified, isOfficial, page = 1, limit = 20 } = options
    const offset = (page - 1) * limit

    // Construir condiciones
    const conditions = [eq(marketplaceSkills.status, status)]

    if (category) {
      conditions.push(eq(marketplaceSkills.category, category))
    }
    if (isVerified !== undefined) {
      conditions.push(eq(marketplaceSkills.isVerified, isVerified))
    }
    if (isOfficial !== undefined) {
      conditions.push(eq(marketplaceSkills.isOfficial, isOfficial))
    }

    let skills = await db.query.marketplaceSkills.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [desc(marketplaceSkills.downloads)],
    })

    // Filtrar por busqueda de texto si se proporciona
    if (search) {
      const searchLower = search.toLowerCase()
      skills = skills.filter(
        (skill) =>
          skill.name.toLowerCase().includes(searchLower) ||
          skill.description.toLowerCase().includes(searchLower) ||
          skill.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      )
    }

    return skills
  }

  /**
   * Obtener skill por ID
   */
  async getSkillById(id: string) {
    return db.query.marketplaceSkills.findFirst({
      where: eq(marketplaceSkills.id, id),
    })
  }

  /**
   * Obtener categorias disponibles
   */
  async getCategories() {
    const result = await db
      .selectDistinct({ category: marketplaceSkills.category })
      .from(marketplaceSkills)
      .where(eq(marketplaceSkills.status, "PUBLISHED"))

    return result.map((r) => r.category)
  }

  /**
   * Instalar skill en un tenant
   */
  async installSkill(data: InstallSkillInput) {
    // Verificar que el skill existe
    const skill = await this.getSkillById(data.marketplaceSkillId)
    if (!skill) {
      throw new Error("Skill not found in marketplace")
    }

    // Verificar si ya esta instalado
    const existing = await db.query.installedSkills.findFirst({
      where: and(
        eq(installedSkills.tenantId, data.tenantId),
        eq(installedSkills.marketplaceSkillId, data.marketplaceSkillId)
      ),
    })

    if (existing) {
      throw new Error("Skill already installed")
    }

    // Crear registro de instalacion
    const [installed] = await db
      .insert(installedSkills)
      .values({
        tenantId: data.tenantId,
        marketplaceSkillId: data.marketplaceSkillId,
        localSkillId: data.localSkillId,
        installedVersion: skill.version,
      })
      .returning()

    // Incrementar contador de descargas
    await db
      .update(marketplaceSkills)
      .set({
        downloads: sql`${marketplaceSkills.downloads} + 1`,
      })
      .where(eq(marketplaceSkills.id, data.marketplaceSkillId))

    return installed
  }

  /**
   * Desinstalar skill de un tenant
   */
  async uninstallSkill(tenantId: string, skillId: string) {
    const existing = await db.query.installedSkills.findFirst({
      where: and(
        eq(installedSkills.tenantId, tenantId),
        eq(installedSkills.marketplaceSkillId, skillId)
      ),
    })

    if (!existing) {
      throw new Error("Skill not installed")
    }

    const [deleted] = await db
      .delete(installedSkills)
      .where(eq(installedSkills.id, existing.id))
      .returning()

    return deleted
  }

  /**
   * Listar skills instalados en un tenant
   */
  async listInstalledSkills(tenantId: string) {
    const installed = await db.query.installedSkills.findMany({
      where: eq(installedSkills.tenantId, tenantId),
      orderBy: [desc(installedSkills.createdAt)],
    })

    // Obtener detalles de cada skill instalado
    const skillsWithDetails = await Promise.all(
      installed.map(async (item) => {
        const skill = await this.getSkillById(item.marketplaceSkillId)
        return {
          ...item,
          skill,
        }
      })
    )

    return skillsWithDetails
  }

  /**
   * Verificar si un skill esta instalado en un tenant
   */
  async isSkillInstalled(tenantId: string, skillId: string) {
    const existing = await db.query.installedSkills.findFirst({
      where: and(
        eq(installedSkills.tenantId, tenantId),
        eq(installedSkills.marketplaceSkillId, skillId)
      ),
    })

    return !!existing
  }

  /**
   * Crear review de un skill
   */
  async createReview(data: CreateReviewInput) {
    // Verificar que el skill existe
    const skill = await this.getSkillById(data.skillId)
    if (!skill) {
      throw new Error("Skill not found")
    }

    // Verificar que el rating esta entre 1 y 5
    if (data.rating < 1 || data.rating > 5) {
      throw new Error("Rating must be between 1 and 5")
    }

    // Verificar si el usuario ya hizo review
    const existingReview = await db.query.skillReviews.findFirst({
      where: and(
        eq(skillReviews.skillId, data.skillId),
        eq(skillReviews.userId, data.userId)
      ),
    })

    if (existingReview) {
      throw new Error("User already reviewed this skill")
    }

    // Crear review
    const [review] = await db
      .insert(skillReviews)
      .values({
        skillId: data.skillId,
        userId: data.userId,
        userName: data.userName,
        rating: data.rating,
        comment: data.comment,
      })
      .returning()

    // Actualizar rating promedio del skill
    await this.updateSkillRating(data.skillId)

    return review
  }

  /**
   * Obtener reviews de un skill
   */
  async getSkillReviews(skillId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit

    const reviews = await db.query.skillReviews.findMany({
      where: eq(skillReviews.skillId, skillId),
      limit,
      offset,
      orderBy: [desc(skillReviews.createdAt)],
    })

    return reviews
  }

  /**
   * Obtener estadisticas de reviews de un skill
   */
  async getSkillReviewStats(skillId: string) {
    const reviews = await db.query.skillReviews.findMany({
      where: eq(skillReviews.skillId, skillId),
    })

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      }
    }

    const totalReviews = reviews.length
    const sumRatings = reviews.reduce((sum, r) => sum + r.rating, 0)
    const averageRating = sumRatings / totalReviews

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const review of reviews) {
      ratingDistribution[review.rating]++
    }

    return {
      averageRating: Math.round(averageRating * 100) / 100,
      totalReviews,
      ratingDistribution,
    }
  }

  /**
   * Actualizar rating promedio de un skill (interno)
   */
  private async updateSkillRating(skillId: string) {
    const stats = await this.getSkillReviewStats(skillId)

    await db
      .update(marketplaceSkills)
      .set({
        rating: stats.averageRating.toString(),
        ratingsCount: stats.totalReviews,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceSkills.id, skillId))
  }

  /**
   * Eliminar review (solo el autor puede eliminarla)
   */
  async deleteReview(reviewId: string, userId: string) {
    const review = await db.query.skillReviews.findFirst({
      where: eq(skillReviews.id, reviewId),
    })

    if (!review) {
      throw new Error("Review not found")
    }

    if (review.userId !== userId) {
      throw new Error("Unauthorized to delete this review")
    }

    const [deleted] = await db
      .delete(skillReviews)
      .where(eq(skillReviews.id, reviewId))
      .returning()

    // Actualizar rating del skill
    await this.updateSkillRating(review.skillId)

    return deleted
  }

  /**
   * Obtener skills populares (mas descargados)
   */
  async getPopularSkills(limit: number = 10) {
    return db.query.marketplaceSkills.findMany({
      where: eq(marketplaceSkills.status, "PUBLISHED"),
      limit,
      orderBy: [desc(marketplaceSkills.downloads)],
    })
  }

  /**
   * Obtener skills mejor valorados
   */
  async getTopRatedSkills(limit: number = 10) {
    return db.query.marketplaceSkills.findMany({
      where: and(
        eq(marketplaceSkills.status, "PUBLISHED"),
        sql`${marketplaceSkills.ratingsCount} > 0`
      ),
      limit,
      orderBy: [desc(marketplaceSkills.rating)],
    })
  }

  /**
   * Buscar skills por tags
   */
  async searchByTags(tags: string[], limit: number = 20) {
    const skills = await db.query.marketplaceSkills.findMany({
      where: eq(marketplaceSkills.status, "PUBLISHED"),
      limit: limit * 2,
    })

    // Filtrar por tags
    const filtered = skills.filter((skill) =>
      tags.some((tag) => skill.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase()))
    )

    return filtered.slice(0, limit)
  }
}

export const marketplaceService = new MarketplaceService()
