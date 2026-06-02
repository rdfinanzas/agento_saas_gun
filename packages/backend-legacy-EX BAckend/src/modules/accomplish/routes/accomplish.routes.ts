/**
 * Accomplish Routes - Rutas del módulo Accomplish
 *
 * Define todos los endpoints para la gestión de tareas en modo FULL
 */

import { Router } from 'express';
import { accomplishController } from '../controllers/accomplish.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';
import { tenantFromParamsMiddleware } from '../middleware/tenant.middleware';

const router = Router();

// Aplicar middleware de autenticación y extracción de tenant
router.use(authMiddleware);
router.use(tenantFromParamsMiddleware);

// ============================================
// Task Endpoints
// ============================================

// Endpoint de prueba para SSE
router.post('/test-sse', (req, res) => accomplishController.testSSE(req, res));

// Crear nueva tarea
router.post('/tasks', (req, res) => accomplishController.createTask(req, res));

// Obtener tarea por ID
router.get('/tasks/:id', (req, res) => accomplishController.getTask(req, res));

// Enviar follow-up a tarea
router.post('/tasks/:id/followup', (req, res) => accomplishController.sendFollowUp(req, res));

// Re-ejecutar tarea
router.post('/tasks/:id/reexecute', (req, res) => accomplishController.reExecuteTask(req, res));

// Eliminar tarea
router.delete('/tasks/:id', (req, res) => accomplishController.deleteTask(req, res));

// Cancelar tarea
router.delete('/tasks/:id/cancel', (req, res) => accomplishController.cancelTask(req, res));

// Obtener eventos SSE de tarea
router.get('/tasks/:id/events', (req, res) => accomplishController.getTaskEvents(req, res));

// Obtener resultados de tarea
router.get('/tasks/:id/results', (req, res) => accomplishController.getTaskResults(req, res));

// Exportar resultados de tarea
router.get('/tasks/:id/export', (req, res) => accomplishController.exportTaskResults(req, res));

// ============================================
// History Endpoints
// ============================================

// Obtener historial de tareas
router.get('/history', (req, res) => accomplishController.getHistory(req, res));

// Obtener detalle de tarea del historial
router.get('/history/:id', (req, res) => accomplishController.getHistoryDetail(req, res));

// ============================================
// Permission Endpoints
// ============================================

// Responder a solicitud de permiso
router.post('/permissions/:requestId/respond', (req, res) =>
  accomplishController.respondToPermission(req, res)
);

// Obtener configuración de permisos
router.get('/permissions/config', (req, res) =>
  accomplishController.getPermissionsConfig(req, res)
);

// Actualizar configuración de permisos
router.put('/permissions/config', (req, res) =>
  accomplishController.updatePermissionsConfig(req, res)
);

// ============================================
// Workspace Endpoints
// ============================================

// Obtener uso de workspace
router.get('/workspace/usage', (req, res) => accomplishController.getWorkspaceUsage(req, res));

// Listar archivos de workspace
router.get('/workspace/files', (req, res) => accomplishController.listWorkspaceFiles(req, res));

// Eliminar archivo de workspace
router.delete('/workspace/files/:id', (req, res) =>
  accomplishController.deleteWorkspaceFile(req, res)
);

// Forzar limpieza de workspace
router.post('/workspace/cleanup', (req, res) => accomplishController.forceCleanup(req, res));

export { router as accomplishRoutes };
