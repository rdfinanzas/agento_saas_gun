/**
 * AI Config Routes - Rutas para configuración de AI del admin
 */

import { Hono } from "hono"
import { authMiddleware } from "@/modules/auth/middleware/auth.middleware"
import { aiConfigController } from "../controllers/ai-config.controller"

const aiConfigRoutes = new Hono()

// Todas las rutas requieren autenticación
aiConfigRoutes.use("*", authMiddleware)

// ============================================
// Global Config
// ============================================

// Obtener configuración global
aiConfigRoutes.get("/global", (c) => aiConfigController.getGlobalConfig(c))

// Actualizar configuración global
aiConfigRoutes.put("/global", (c) => aiConfigController.updateGlobalConfig(c))

// ============================================
// Tenant Permissions
// ============================================

// Listar todos los tenants con permisos
aiConfigRoutes.get("/tenants", (c) => aiConfigController.listTenantsPermissions(c))

// Obtener permisos de un tenant específico
aiConfigRoutes.get("/tenants/:tenantId", (c) => aiConfigController.getTenantPermissions(c))

// Actualizar permisos de un tenant (autorizar/desautorizar)
aiConfigRoutes.put("/tenants/:tenantId", (c) => aiConfigController.updateTenantPermissions(c))

// Verificar si un tenant puede usar su propio modelo (para el frontend)
aiConfigRoutes.get("/check/:tenantId", (c) => aiConfigController.checkTenantPermission(c))

// Obtener el modelo que debe usar un tenant
aiConfigRoutes.get("/model-for-tenant/:tenantId", (c) => aiConfigController.getModelForTenant(c))

export { aiConfigRoutes }
