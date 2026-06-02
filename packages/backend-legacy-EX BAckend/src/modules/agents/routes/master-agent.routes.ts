/**
 * Master Agent Routes - Rutas para el Agente Maestro
 */

import { Router } from 'express';
import { masterAgentController } from '../controllers/master-agent.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// ============================================
// Chat con el Agente Maestro
// ============================================

/**
 * @route   POST /api/master/chat
 * @desc    Envía un mensaje al Agente Maestro
 * @body    message - Mensaje del usuario
 * @access  Private
 */
router.post('/chat', masterAgentController.chat.bind(masterAgentController));

/**
 * @route   GET /api/master/suggestions
 * @desc    Obtiene sugerencias del Agente Maestro
 * @access  Private
 */
router.get('/suggestions', masterAgentController.getSuggestions.bind(masterAgentController));

/**
 * @route   GET /api/master/analytics
 * @desc    Obtiene reporte de analíticas del Agente Maestro
 * @access  Private
 */
router.get('/analytics', masterAgentController.getAnalytics.bind(masterAgentController));

// ============================================
// Gestión del Agente Maestro
// ============================================

/**
 * @route   POST /api/master/initialize
 * @desc    Inicializa el Agente Maestro para un tenant
 * @access  Private
 */
router.post('/initialize', masterAgentController.initialize.bind(masterAgentController));

// ============================================
// Creación asistida por el Agente Maestro
// ============================================

/**
 * @route   POST /api/master/agent/create
 * @desc    Crea un agente usando el Agente Maestro
 * @body    instructions - Instrucciones para crear el agente
 * @access  Private
 */
router.post('/agent/create', masterAgentController.createAgent.bind(masterAgentController));

/**
 * @route   POST /api/master/integration/create
 * @desc    Crea una integración usando el Agente Maestro
 * @body    instructions - Instrucciones para crear la integración
 * @access  Private
 */
router.post('/integration/create', masterAgentController.createIntegration.bind(masterAgentController));

export default router;
