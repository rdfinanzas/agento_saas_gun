/**
 * Agents Routes - Rutas para gestión de Agentes
 */

import { Router } from 'express';
import { agentsController } from '../controllers/agents.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';
import internalChatRoutes from './internal-chat.routes';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// ============================================
// CRUD de Agentes
// ============================================

/**
 * @route   POST /api/agents
 * @desc    Crea un nuevo agente
 * @access  Private
 */
router.post('/', agentsController.create.bind(agentsController));

/**
 * @route   GET /api/agents
 * @desc    Lista agentes con filtros y paginación
 * @query    type - Filtrar por tipo (MASTER, INTERNAL, EXTERNAL)
 * @query    status - Filtrar por estado (DRAFT, ACTIVE, PAUSED, ARCHIVED)
 * @query    accessType - Filtrar por tipo de acceso (PRIVATE, SHARED, PUBLIC)
 * @query    parentId - Filtrar por agente padre
 * @query    search - Buscar por nombre/descripción
 * @query    page - Página (default: 1)
 * @query    limit - Límite por página (default: 20)
 * @access  Private
 */
router.get('/', agentsController.list.bind(agentsController));

/**
 * @route   GET /api/agents/stats
 * @desc    Obtiene estadísticas de agentes del tenant
 * @access  Private
 */
router.get('/stats', agentsController.getStats.bind(agentsController));

/**
 * @route   GET /api/agents/hierarchy
 * @desc    Obtiene el árbol jerárquico de agentes
 * @access  Private
 */
router.get('/hierarchy', agentsController.getHierarchy.bind(agentsController));

/**
 * @route   GET /api/agents/type/:type
 * @desc    Obtiene agentes por tipo
 * @access  Private
 */
router.get('/type/:type', agentsController.getByType.bind(agentsController));

/**
 * @route   GET /api/agents/:id
 * @desc    Obtiene un agente por ID
 * @query    include - Incluir relaciones (true/false)
 * @access  Private
 */
router.get('/:id', agentsController.getById.bind(agentsController));

/**
 * @route   PUT /api/agents/:id
 * @desc    Actualiza un agente
 * @access  Private
 */
router.put('/:id', agentsController.update.bind(agentsController));

/**
 * @route   DELETE /api/agents/:id
 * @desc    Elimina un agente (soft delete: archiva)
 * @access  Private
 */
router.delete('/:id', agentsController.delete.bind(agentsController));

/**
 * @route   PATCH /api/agents/:id/status
 * @desc    Cambia el estado de un agente
 * @body     status - Nuevo estado (DRAFT, ACTIVE, PAUSED, ARCHIVED)
 * @access  Private
 */
router.patch('/:id/status', agentsController.setStatus.bind(agentsController));

/**
 * @route   POST /api/agents/:id/duplicate
 * @desc    Duplica un agente
 * @body     name - Nombre para el duplicado (opcional)
 * @access  Private
 */
router.post('/:id/duplicate', agentsController.duplicate.bind(agentsController));

// ============================================
// Chat Interno (para agentes INTERNAL)
// ============================================

// Las rutas de chat se montan directamente
// Ejemplo: POST /api/v1/agents/:agentId/chat
router.use('/:agentId/chat', internalChatRoutes);

export default router;
