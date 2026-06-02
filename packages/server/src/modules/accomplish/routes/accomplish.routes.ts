/**
 * Accomplish Routes - Rutas del módulo Accomplish
 *
 * Gestión de tareas agenticas con streaming SSE
 */

import { Hono } from "hono"
import { authMiddleware } from "../../auth/middleware/auth.middleware"
import { accomplishTenantMiddleware } from "../middleware/accomplish-tenant.middleware"
import { accomplishController } from "../controllers/accomplish.controller"

const accomplishRoutes = new Hono()

// Todas las rutas requieren autenticación (PRIMERO - establece userId, tenantId, userRole)
accomplishRoutes.use("*", authMiddleware)

// Middleware para establecer el tenantId correcto (DESPUÉS - usa el tenantId del contexto)
accomplishRoutes.use("*", accomplishTenantMiddleware)

// Endpoint de prueba
accomplishRoutes.get("/test", (c) => c.json({ message: "Accomplish routes working!" }))

// Endpoint de prueba SSE
accomplishRoutes.post("/test-sse", (c) => accomplishController.testSSE(c))

// ============================================
// Task Endpoints
// ============================================

// Crear nueva tarea
accomplishRoutes.post("/tasks", (c) => accomplishController.createTask(c))

// Obtener tarea por ID
accomplishRoutes.get("/tasks/:id", (c) => accomplishController.getTask(c))

// Enviar follow-up a tarea
accomplishRoutes.post("/tasks/:id/followup", (c) => accomplishController.sendFollowUp(c))

// Re-ejecutar tarea
accomplishRoutes.post("/tasks/:id/reexecute", (c) => accomplishController.reExecuteTask(c))

// Eliminar tarea (completa)
accomplishRoutes.delete("/tasks/:id", (c) => accomplishController.deleteTask(c))

// Cancelar tarea
accomplishRoutes.delete("/tasks/:id/cancel", (c) => accomplishController.cancelTask(c))

// Obtener eventos SSE de tarea
accomplishRoutes.get("/tasks/:id/events", (c) => accomplishController.getTaskEvents(c))

// Obtener resultados de tarea
accomplishRoutes.get("/tasks/:id/results", (c) => accomplishController.getTaskResults(c))

// Exportar resultados de tarea
accomplishRoutes.get("/tasks/:id/export", (c) => accomplishController.exportTaskResults(c))

// ============================================
// History Endpoints
// ============================================

// Obtener historial de tareas
accomplishRoutes.get("/history", (c) => accomplishController.getHistory(c))

// Obtener detalle de tarea del historial
accomplishRoutes.get("/history/:id", (c) => accomplishController.getHistoryDetail(c))

// ============================================
// Permission Endpoints
// ============================================

// Obtener configuración de permisos
accomplishRoutes.get("/permissions/config", (c) => accomplishController.getPermissionsConfig(c))

// Actualizar configuración de permisos
accomplishRoutes.put("/permissions/config", (c) => accomplishController.updatePermissionsConfig(c))

// Responder a solicitud de permiso
accomplishRoutes.post("/permissions/:requestId/respond", (c) =>
  accomplishController.respondToPermission(c)
)

// ============================================
// Workspace Endpoints
// ============================================

// Obtener uso de workspace
accomplishRoutes.get("/workspace/usage", (c) => accomplishController.getWorkspaceUsage(c))

// Listar archivos de workspace
accomplishRoutes.get("/workspace/files", (c) => accomplishController.listWorkspaceFiles(c))

// Eliminar archivo de workspace
accomplishRoutes.delete("/workspace/files/:id", (c) => accomplishController.deleteWorkspaceFile(c))

// Forzar limpieza de workspace
accomplishRoutes.post("/workspace/cleanup", (c) => accomplishController.forceCleanup(c))

export { accomplishRoutes }
