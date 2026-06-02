/**
 * Agents Routes - Migrado a Hono
 */

import { Hono } from "hono"
import { authMiddleware } from "../../auth/middleware/auth.middleware"
import { agentsController } from "../controllers/agents.controller"

const agentsRoutes = new Hono()

// Todas las rutas requieren autenticación
agentsRoutes.use("*", authMiddleware)

// CRUD básico
agentsRoutes.post("/", (c) => agentsController.create(c))
agentsRoutes.get("/", (c) => agentsController.list(c))

// Templates (ANTES de /:id para evitar conflicto)
agentsRoutes.get("/templates", (c) => agentsController.listTemplates(c))
agentsRoutes.post("/templates/deploy", (c) => agentsController.deployTemplate(c))

agentsRoutes.get("/hierarchy", (c) => agentsController.getHierarchy(c))
agentsRoutes.get("/stats", (c) => agentsController.getStats(c))
agentsRoutes.get("/type/:type", (c) => agentsController.getByType(c))

// Rutas con :id (DESPUES de las rutas fijas)
agentsRoutes.get("/:id", (c) => agentsController.getById(c))
agentsRoutes.put("/:id", (c) => agentsController.update(c))
agentsRoutes.delete("/:id", (c) => agentsController.delete(c))

// Acciones especiales
agentsRoutes.patch("/:id/status", (c) => agentsController.setStatus(c))
agentsRoutes.post("/:id/duplicate", (c) => agentsController.duplicate(c))

export { agentsRoutes }
