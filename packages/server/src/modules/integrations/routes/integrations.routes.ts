/**
 * Integrations Routes - Migrado a Hono
 */

import { Hono } from "hono"
import { authMiddleware } from "../../auth/middleware/auth.middleware"
import { integrationsController } from "../controllers/integrations.controller"

const integrationsRoutes = new Hono()

// Todas las rutas requieren autenticacion
integrationsRoutes.use("*", authMiddleware)

// CRUD basico
integrationsRoutes.post("/", (c) => integrationsController.create(c))
integrationsRoutes.get("/", (c) => integrationsController.list(c))
integrationsRoutes.get("/stats", (c) => integrationsController.getStats(c))
integrationsRoutes.get("/active", (c) => integrationsController.getActive(c))
integrationsRoutes.get("/type/:type", (c) => integrationsController.getByType(c))
integrationsRoutes.get("/:id", (c) => integrationsController.getById(c))
integrationsRoutes.put("/:id", (c) => integrationsController.update(c))
integrationsRoutes.delete("/:id", (c) => integrationsController.delete(c))

// Acciones especiales
integrationsRoutes.patch("/:id/activate", (c) => integrationsController.activate(c))
integrationsRoutes.patch("/:id/deactivate", (c) => integrationsController.deactivate(c))
integrationsRoutes.post("/:id/test", (c) => integrationsController.testConnection(c))

// Asociacion con agentes
integrationsRoutes.post("/:id/agents/:agentId", (c) => integrationsController.assignToAgent(c))
integrationsRoutes.delete("/:id/agents/:agentId", (c) => integrationsController.unassignFromAgent(c))

export { integrationsRoutes }
