/**
 * Workspace Routes - Rutas para gestión de workspace
 *
 * Endpoints para gestionar archivos, cuotas y limpieza de workspace
 */

import { Router } from 'express';
import { workspaceController } from '../controllers/workspace.controller';
import { tenantFromParamsMiddleware } from '../middleware/tenant.middleware';

const router = Router();

// Todas las rutas requieren autenticación de tenant
router.use(tenantFromParamsMiddleware);

/**
 * @route   GET /api/v1/:tenant/workspace/usage
 * @desc    Obtiene el uso de espacio del tenant
 * @access  Private
 */
router.get('/usage', workspaceController.getUsage.bind(workspaceController));

/**
 * @route   GET /api/v1/:tenant/workspace/stats
 * @desc    Obtiene estadísticas del workspace
 * @access  Private
 */
router.get('/stats', workspaceController.getStats.bind(workspaceController));

/**
 * @route   GET /api/v1/:tenant/workspace/files
 * @desc    Lista archivos del workspace
 * @access  Private
 * @query   type - Filtrar por tipo (USER, TASK, TEMP)
 * @query   search - Buscar por nombre
 */
router.get('/files', workspaceController.listFiles.bind(workspaceController));

/**
 * @route   DELETE /api/v1/:tenant/workspace/files/:fileId
 * @desc    Elimina un archivo del workspace
 * @access  Private
 */
router.delete('/files/:fileId', workspaceController.deleteFile.bind(workspaceController));

/**
 * @route   POST /api/v1/:tenant/workspace/files/move
 * @desc    Mueve un archivo de tarea a archivos de usuario
 * @access  Private
 * @body    { taskId: string, filePath: string }
 */
router.post('/files/move', workspaceController.moveFile.bind(workspaceController));

/**
 * @route   POST /api/v1/:tenant/workspace/cleanup
 * @desc    Fuerza la limpieza del workspace
 * @access  Private
 */
router.post('/cleanup', workspaceController.forceCleanup.bind(workspaceController));

/**
 * @route   POST /api/v1/:tenant/workspace/tasks/:taskId/cleanup
 * @desc    Limpia una tarea específica
 * @access  Private
 */
router.post('/tasks/:taskId/cleanup', workspaceController.cleanupTask.bind(workspaceController));

export default router;
