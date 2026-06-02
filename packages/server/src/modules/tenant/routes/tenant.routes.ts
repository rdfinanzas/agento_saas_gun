/**
 * Tenant Routes - Migrado a Hono
 */

import { Hono } from "hono"
import { authMiddleware, adminMiddleware } from "../../auth/middleware/auth.middleware"
import { tenantController } from "../controllers/tenant.controller"

const tenantRoutes = new Hono()

// Todas las rutas requieren autenticación
tenantRoutes.use("*", authMiddleware)

// Rutas públicas (usuarios autenticados pueden ver su propio tenant)
tenantRoutes.get("/slug/:slug", (c) => tenantController.getBySlug(c))

// Rutas protegidas (solo admin)
const adminTenantRoutes = new Hono()
adminTenantRoutes.use("*", adminMiddleware)

adminTenantRoutes.post("/", (c) => tenantController.create(c))
adminTenantRoutes.get("/", (c) => tenantController.list(c))
adminTenantRoutes.get("/:id", (c) => tenantController.getById(c))
adminTenantRoutes.put("/:id", (c) => tenantController.update(c))
adminTenantRoutes.delete("/:id", (c) => tenantController.delete(c))
adminTenantRoutes.get("/:id/stats", (c) => tenantController.getStats(c))
adminTenantRoutes.put("/:id/plan", (c) => tenantController.changePlan(c))
adminTenantRoutes.post("/:id/activate", (c) => tenantController.activate(c))
adminTenantRoutes.post("/:id/suspend", (c) => tenantController.suspend(c))

// Montar rutas admin
tenantRoutes.route("/admin", adminTenantRoutes)

export { tenantRoutes }
