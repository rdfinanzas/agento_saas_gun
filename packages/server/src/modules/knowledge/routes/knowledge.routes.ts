/**
 * Knowledge Routes
 * Migrado de Express a Hono
 */

import { Hono } from "hono"
import { knowledgeController } from "../controllers/knowledge.controller"
import { authMiddleware } from "../../auth/middleware/auth.middleware"

const knowledgeRoutes = new Hono()

// All routes require authentication
knowledgeRoutes.use("*", authMiddleware)

// ============================================
// CRUD de Knowledge
// ============================================

/**
 * @route POST /api/knowledge
 * @desc Create knowledge entry
 * @access Private
 */
knowledgeRoutes.post("/", (c) => knowledgeController.create(c))

/**
 * @route GET /api/knowledge
 * @desc List knowledge entries
 * @access Private
 */
knowledgeRoutes.get("/", (c) => knowledgeController.list(c))

/**
 * @route GET /api/knowledge/search
 * @desc Search knowledge entries
 * @access Private
 */
knowledgeRoutes.get("/search", (c) => knowledgeController.search(c))

/**
 * @route GET /api/knowledge/stats
 * @desc Get knowledge statistics
 * @access Private
 */
knowledgeRoutes.get("/stats", (c) => knowledgeController.getStats(c))

/**
 * @route GET /api/knowledge/agent/:agentId
 * @desc Get knowledge by agent
 * @access Private
 */
knowledgeRoutes.get("/agent/:agentId", (c) => knowledgeController.getByAgent(c))

/**
 * @route POST /api/knowledge/import
 * @desc Import knowledge from JSON
 * @access Private
 */
knowledgeRoutes.post("/import", (c) => knowledgeController.import(c))

/**
 * @route POST /api/knowledge/bulk
 * @desc Bulk create knowledge entries
 * @access Private
 */
knowledgeRoutes.post("/bulk", (c) => knowledgeController.bulkCreate(c))

/**
 * @route GET /api/knowledge/:id
 * @desc Get knowledge entry by ID
 * @access Private
 */
knowledgeRoutes.get("/:id", (c) => knowledgeController.getById(c))

/**
 * @route PUT /api/knowledge/:id
 * @desc Update knowledge entry
 * @access Private
 */
knowledgeRoutes.put("/:id", (c) => knowledgeController.update(c))

/**
 * @route DELETE /api/knowledge/:id
 * @desc Delete knowledge entry
 * @access Private
 */
knowledgeRoutes.delete("/:id", (c) => knowledgeController.delete(c))

export { knowledgeRoutes }
