/**
 * Marketplace Routes
 * Rutas para el marketplace de skills
 * Usa Hono router con Bun
 */

import { Hono } from "hono"
import { marketplaceController } from "../controllers/marketplace.controller"
import { authMiddleware } from "../../auth/middleware/auth.middleware"

const marketplaceRoutes = new Hono()

// Todas las rutas requieren autenticacion
marketplaceRoutes.use("*", authMiddleware)

// ============================================
// Skills del Marketplace (Publicos dentro del tenant)
// ============================================

/**
 * @route GET /api/marketplace/skills/categories
 * @desc Obtener categorias disponibles
 * @access Private
 */
marketplaceRoutes.get("/skills/categories", (c) => marketplaceController.getCategories(c))

/**
 * @route GET /api/marketplace/skills/popular
 * @desc Obtener skills populares
 * @access Private
 */
marketplaceRoutes.get("/skills/popular", (c) => marketplaceController.getPopularSkills(c))

/**
 * @route GET /api/marketplace/skills/top-rated
 * @desc Obtener skills mejor valorados
 * @access Private
 */
marketplaceRoutes.get("/skills/top-rated", (c) => marketplaceController.getTopRatedSkills(c))

/**
 * @route GET /api/marketplace/skills/search-by-tags
 * @desc Buscar skills por tags
 * @access Private
 */
marketplaceRoutes.get("/skills/search-by-tags", (c) => marketplaceController.searchByTags(c))

/**
 * @route GET /api/marketplace/skills
 * @desc Listar skills disponibles
 * @access Private
 */
marketplaceRoutes.get("/skills", (c) => marketplaceController.listSkills(c))

/**
 * @route GET /api/marketplace/skills/:id
 * @desc Obtener skill por ID
 * @access Private
 */
marketplaceRoutes.get("/skills/:id", (c) => marketplaceController.getSkillById(c))

/**
 * @route GET /api/marketplace/skills/:id/reviews/stats
 * @desc Obtener estadisticas de reviews de un skill
 * @access Private
 */
marketplaceRoutes.get("/skills/:id/reviews/stats", (c) => marketplaceController.getSkillReviewStats(c))

/**
 * @route GET /api/marketplace/skills/:id/reviews
 * @desc Obtener reviews de un skill
 * @access Private
 */
marketplaceRoutes.get("/skills/:id/reviews", (c) => marketplaceController.getSkillReviews(c))

/**
 * @route POST /api/marketplace/skills/:id/reviews
 * @desc Crear review de un skill
 * @access Private
 */
marketplaceRoutes.post("/skills/:id/reviews", (c) => marketplaceController.createReview(c))

// ============================================
// Reviews
// ============================================

/**
 * @route DELETE /api/marketplace/reviews/:reviewId
 * @desc Eliminar review
 * @access Private
 */
marketplaceRoutes.delete("/reviews/:reviewId", (c) => marketplaceController.deleteReview(c))

// ============================================
// Skills Instalados
// ============================================

/**
 * @route GET /api/marketplace/installed
 * @desc Listar skills instalados del tenant
 * @access Private
 */
marketplaceRoutes.get("/installed", (c) => marketplaceController.listInstalledSkills(c))

/**
 * @route GET /api/marketplace/installed/:skillId/check
 * @desc Verificar si un skill esta instalado
 * @access Private
 */
marketplaceRoutes.get("/installed/:skillId/check", (c) => marketplaceController.checkSkillInstalled(c))

/**
 * @route POST /api/marketplace/installed
 * @desc Instalar skill en el tenant
 * @access Private
 */
marketplaceRoutes.post("/installed", (c) => marketplaceController.installSkill(c))

/**
 * @route DELETE /api/marketplace/installed/:skillId
 * @desc Desinstalar skill del tenant
 * @access Private
 */
marketplaceRoutes.delete("/installed/:skillId", (c) => marketplaceController.uninstallSkill(c))

export { marketplaceRoutes }
