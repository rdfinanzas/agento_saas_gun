/**
 * Admin Routes - Migrado a Hono
 */

import { Hono } from "hono"
import { authMiddleware, adminMiddleware } from "../../auth/middleware/auth.middleware"
import { adminController } from "../controllers/admin.controller"
import { apiKeysController } from "../controllers/api-keys.controller"

// Router principal
const adminRoutes = new Hono()

// ============================================
// RUTAS PÚBLICAS (Solo requieren autenticación)
// Montamos PRIMERO para que tengan prioridad
// ============================================
const publicRouter = new Hono()
publicRouter.use("*", authMiddleware)

// AI Providers - rutas específicas ANTES de las que usan :id
publicRouter.get("/ai-providers", (c) => adminController.listAIProviders(c))
publicRouter.get("/ai-providers/public", (c) => adminController.listPublicAIProviders(c))

// Otras rutas públicas
publicRouter.get("/stats", (c) => adminController.getStats(c))
publicRouter.get("/plans", (c) => adminController.listPlans(c))
publicRouter.get("/metrics", (c) => adminController.getMetrics(c))
publicRouter.get("/ai-models", (c) => adminController.listAIModels(c))

// ============================================
// RUTAS DE ADMIN (Requieren auth + rol admin)
// Montamos DESPUÉS
// ============================================
const adminRouter = new Hono()
adminRouter.use("*", authMiddleware, adminMiddleware)

adminRouter.get("/tenants", (c) => adminController.listTenants(c))
adminRouter.get("/tenants/:id", (c) => adminController.getTenantById(c))
adminRouter.put("/tenants/:id", (c) => adminController.updateTenant(c))
adminRouter.get("/users", (c) => adminController.listUsers(c))
adminRouter.get("/plans/:id", (c) => adminController.getPlanById(c))
adminRouter.post("/plans", (c) => adminController.createPlan(c))
adminRouter.put("/plans/:id", (c) => adminController.updatePlan(c))
adminRouter.delete("/plans/:id", (c) => adminController.deletePlan(c))
adminRouter.get("/ai-providers/:id", (c) => adminController.getAIProviderById(c))
adminRouter.post("/ai-providers", (c) => adminController.createAIProvider(c))
adminRouter.put("/ai-providers/:id", (c) => adminController.updateAIProvider(c))
adminRouter.post("/ai-models", (c) => adminController.createAIModel(c))
adminRouter.put("/ai-models/:id", (c) => adminController.updateAIModel(c))
adminRouter.delete("/ai-models/:id", (c) => adminController.deleteAIModel(c))
adminRouter.post("/api-keys", (c) => apiKeysController.storeApiKey(c))
adminRouter.get("/api-keys/:provider", (c) => apiKeysController.hasApiKey(c))
adminRouter.delete("/api-keys/:provider", (c) => apiKeysController.deleteApiKey(c))
adminRouter.get("/api-keys", (c) => apiKeysController.listApiKeys(c))

// Montar ambos routers en el principal - el orden importa
// El primero en montar tiene prioridad en el matching
adminRoutes.route("/", publicRouter)
adminRoutes.route("/", adminRouter)

export { adminRoutes }
