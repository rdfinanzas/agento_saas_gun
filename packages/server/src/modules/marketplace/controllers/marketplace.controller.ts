/**
 * Marketplace Controller
 * Controlador para gestionar el marketplace de skills
 * Usa Hono con Bun
 */

import type { Context } from "hono"
import { marketplaceService } from "../services/marketplace.service"
import { HTTPException } from "hono/http-exception"

export class MarketplaceController {
  /**
   * GET /api/marketplace/skills
   * Listar skills disponibles en el marketplace
   */
  async listSkills(c: Context) {
    const options = {
      category: c.req.query("category"),
      search: c.req.query("search"),
      status: c.req.query("status"),
      isVerified: c.req.query("isVerified") === "true" ? true : c.req.query("isVerified") === "false" ? false : undefined,
      isOfficial: c.req.query("isOfficial") === "true" ? true : c.req.query("isOfficial") === "false" ? false : undefined,
      page: parseInt(c.req.query("page") || "1"),
      limit: parseInt(c.req.query("limit") || "20"),
    }

    const skills = await marketplaceService.listSkills(options)
    return c.json(skills)
  }

  /**
   * GET /api/marketplace/skills/categories
   * Obtener categorias disponibles
   */
  async getCategories(c: Context) {
    const categories = await marketplaceService.getCategories()
    return c.json({ categories })
  }

  /**
   * GET /api/marketplace/skills/popular
   * Obtener skills populares
   */
  async getPopularSkills(c: Context) {
    const limit = parseInt(c.req.query("limit") || "10")
    const skills = await marketplaceService.getPopularSkills(limit)
    return c.json(skills)
  }

  /**
   * GET /api/marketplace/skills/top-rated
   * Obtener skills mejor valorados
   */
  async getTopRatedSkills(c: Context) {
    const limit = parseInt(c.req.query("limit") || "10")
    const skills = await marketplaceService.getTopRatedSkills(limit)
    return c.json(skills)
  }

  /**
   * GET /api/marketplace/skills/search-by-tags
   * Buscar skills por tags
   */
  async searchByTags(c: Context) {
    const tagsParam = c.req.query("tags")
    if (!tagsParam) {
      throw new HTTPException(400, { message: "Tags parameter required" })
    }

    const tags = tagsParam.split(",").map((t) => t.trim())
    const limit = parseInt(c.req.query("limit") || "20")

    const skills = await marketplaceService.searchByTags(tags, limit)
    return c.json(skills)
  }

  /**
   * GET /api/marketplace/skills/:id
   * Obtener skill por ID
   */
  async getSkillById(c: Context) {
    const id = c.req.param("id")
    if (!id) {
      throw new HTTPException(400, { message: "Skill ID required" })
    }

    const skill = await marketplaceService.getSkillById(id)

    if (!skill) {
      throw new HTTPException(404, { message: "Skill not found" })
    }

    return c.json(skill)
  }

  /**
   * GET /api/marketplace/skills/:id/reviews
   * Obtener reviews de un skill
   */
  async getSkillReviews(c: Context) {
    const skillId = c.req.param("id")
    if (!skillId) {
      throw new HTTPException(400, { message: "Skill ID required" })
    }

    const page = parseInt(c.req.query("page") || "1")
    const limit = parseInt(c.req.query("limit") || "20")

    // Verificar que el skill existe
    const skill = await marketplaceService.getSkillById(skillId)
    if (!skill) {
      throw new HTTPException(404, { message: "Skill not found" })
    }

    const reviews = await marketplaceService.getSkillReviews(skillId, page, limit)
    return c.json(reviews)
  }

  /**
   * GET /api/marketplace/skills/:id/reviews/stats
   * Obtener estadisticas de reviews de un skill
   */
  async getSkillReviewStats(c: Context) {
    const skillId = c.req.param("id")
    if (!skillId) {
      throw new HTTPException(400, { message: "Skill ID required" })
    }

    // Verificar que el skill existe
    const skill = await marketplaceService.getSkillById(skillId)
    if (!skill) {
      throw new HTTPException(404, { message: "Skill not found" })
    }

    const stats = await marketplaceService.getSkillReviewStats(skillId)
    return c.json(stats)
  }

  /**
   * POST /api/marketplace/skills/:id/reviews
   * Crear review de un skill
   */
  async createReview(c: Context) {
    const tenantId = c.get("tenantId") as string | undefined
    const userId = c.get("userId") as string | undefined
    const userName = c.get("userName") as string | undefined
    const skillId = c.req.param("id")

    if (!tenantId || !userId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    if (!skillId) {
      throw new HTTPException(400, { message: "Skill ID required" })
    }

    const body = await c.req.json()

    try {
      const review = await marketplaceService.createReview({
        skillId,
        userId,
        userName: userName || body.userName || "Anonymous",
        rating: body.rating,
        comment: body.comment,
      })

      return c.json(review, 201)
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Skill not found") {
          throw new HTTPException(404, { message: error.message })
        }
        if (error.message === "User already reviewed this skill") {
          throw new HTTPException(409, { message: error.message })
        }
        throw new HTTPException(400, { message: error.message })
      }
      throw error
    }
  }

  /**
   * DELETE /api/marketplace/reviews/:reviewId
   * Eliminar review
   */
  async deleteReview(c: Context) {
    const userId = c.get("userId") as string | undefined
    const reviewId = c.req.param("reviewId")

    if (!userId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    if (!reviewId) {
      throw new HTTPException(400, { message: "Review ID required" })
    }

    try {
      const deleted = await marketplaceService.deleteReview(reviewId, userId)
      return c.json({ message: "Review deleted", review: deleted })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Review not found") {
          throw new HTTPException(404, { message: error.message })
        }
        if (error.message === "Unauthorized to delete this review") {
          throw new HTTPException(403, { message: error.message })
        }
        throw new HTTPException(400, { message: error.message })
      }
      throw error
    }
  }

  /**
   * GET /api/marketplace/installed
   * Listar skills instalados del tenant
   */
  async listInstalledSkills(c: Context) {
    const tenantId = c.get("tenantId") as string | undefined

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const installed = await marketplaceService.listInstalledSkills(tenantId)
    return c.json(installed)
  }

  /**
   * GET /api/marketplace/installed/:skillId/check
   * Verificar si un skill esta instalado
   */
  async checkSkillInstalled(c: Context) {
    const tenantId = c.get("tenantId") as string | undefined
    const skillId = c.req.param("skillId")

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    if (!skillId) {
      throw new HTTPException(400, { message: "Skill ID required" })
    }

    const isInstalled = await marketplaceService.isSkillInstalled(tenantId, skillId)
    return c.json({ skillId, isInstalled })
  }

  /**
   * POST /api/marketplace/installed
   * Instalar skill en el tenant
   */
  async installSkill(c: Context) {
    const tenantId = c.get("tenantId") as string | undefined

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const body = await c.req.json()

    if (!body.marketplaceSkillId) {
      throw new HTTPException(400, { message: "marketplaceSkillId is required" })
    }

    if (!body.localSkillId) {
      throw new HTTPException(400, { message: "localSkillId is required" })
    }

    try {
      const installed = await marketplaceService.installSkill({
        tenantId,
        marketplaceSkillId: body.marketplaceSkillId,
        localSkillId: body.localSkillId,
      })

      return c.json(installed, 201)
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Skill not found in marketplace") {
          throw new HTTPException(404, { message: error.message })
        }
        if (error.message === "Skill already installed") {
          throw new HTTPException(409, { message: error.message })
        }
        throw new HTTPException(400, { message: error.message })
      }
      throw error
    }
  }

  /**
   * DELETE /api/marketplace/installed/:skillId
   * Desinstalar skill del tenant
   */
  async uninstallSkill(c: Context) {
    const tenantId = c.get("tenantId") as string | undefined
    const skillId = c.req.param("skillId")

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    if (!skillId) {
      throw new HTTPException(400, { message: "Skill ID required" })
    }

    try {
      const deleted = await marketplaceService.uninstallSkill(tenantId, skillId)
      return c.json({ message: "Skill uninstalled", installed: deleted })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Skill not installed") {
          throw new HTTPException(404, { message: error.message })
        }
        throw new HTTPException(400, { message: error.message })
      }
      throw error
    }
  }
}

export const marketplaceController = new MarketplaceController()
