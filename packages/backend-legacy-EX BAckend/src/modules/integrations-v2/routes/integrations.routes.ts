/**
 * Integrations Routes - Rutas para gestión de Integraciones
 */

import { Router } from 'express';
import { integrationsController } from '../controllers/integrations.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// ============================================
// CRUD de Integraciones
// ============================================

/**
 * @route   GET /api/integrations/types
 * @desc    Obtiene los tipos de integración disponibles
 * @access  Private
 */
router.get('/types', integrationsController.getTypes.bind(integrationsController));

/**
 * @route   POST /api/integrations
 * @desc    Crea una nueva integración
 * @body     name - Nombre de la integración
 * @body     type - Tipo de integración (CRM, ERP, etc.)
 * @body     credentials - Credenciales (JSON)
 * @body     baseUrl - URL base de la API
 * @access  Private
 */
router.post('/', integrationsController.create.bind(integrationsController));

/**
 * @route   GET /api/integrations
 * @desc    Obtiene todas las integraciones del tenant
 * @access  Private
 */
router.get('/', integrationsController.list.bind(integrationsController));

/**
 * @route   GET /api/integrations/:id
 * @desc    Obtiene una integración por ID
 * @access  Private
 */
router.get('/:id', integrationsController.getById.bind(integrationsController));

/**
 * @route   PUT /api/integrations/:id
 * @desc    Actualiza una integración
 * @access  Private
 */
router.put('/:id', integrationsController.update.bind(integrationsController));

/**
 * @route   DELETE /api/integrations/:id
 * @desc    Elimina una integración
 * @access  Private
 */
router.delete('/:id', integrationsController.delete.bind(integrationsController));

/**
 * @route   POST /api/integrations/:id/test
 * @desc    Prueba la conexión de una integración
 * @access  Private
 */
router.post('/:id/test', integrationsController.testConnection.bind(integrationsController));

// ============================================
// Vinculación con Agentes
// ============================================

/**
 * @route   POST /api/integrations/:id/link-agent
 * @desc    Vincula una integración a un agente
 * @body     agentId - ID del agente
 * @body     config - Configuración específica (opcional)
 * @access  Private
 */
router.post('/:id/link-agent', integrationsController.linkToAgent.bind(integrationsController));

/**
 * @route   DELETE /api/integrations/:id/unlink-agent/:agentId
 * @desc    Desvincula una integración de un agente
 * @access  Private
 */
router.delete('/:id/unlink-agent/:agentId', integrationsController.unlinkFromAgent.bind(integrationsController));

// ============================================
// Tools de Agentes
// ============================================

/**
 * @route   GET /api/agents/:agentId/tools
 * @desc    Obtiene las tools de un agente (desde integraciones)
 * @access  Private
 */
router.get('/agents/:agentId/tools', integrationsController.getAgentTools.bind(integrationsController));

export default router;
