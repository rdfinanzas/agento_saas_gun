/**
 * Master Agent V2 Routes - Rutas avanzadas del Agente Maestro
 */

import { Router } from 'express';
import { masterAgentV2Controller } from '../controllers/master-agent-v2.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * @route   GET /api/master/v2/health
 * @desc    Verifica el estado del servicio V2
 * @access  Private
 */
router.get('/health', masterAgentV2Controller.health.bind(masterAgentV2Controller));

/**
 * @route   POST /api/master/v2/chat
 * @desc    Chat mejorado con capacidades de análisis
 * @body    message - Mensaje del usuario
 * @access  Private
 */
router.post('/chat', masterAgentV2Controller.chat.bind(masterAgentV2Controller));

/**
 * @route   POST /api/master/v2/analyze-api
 * @desc    Analiza una especificación OpenAPI/Swagger
 * @body    specUrl - URL de la especificación (opcional)
 * @body    specContent - Contenido JSON de la especificación (opcional)
 * @access  Private
 */
router.post('/analyze-api', masterAgentV2Controller.analyzeAPI.bind(masterAgentV2Controller));

/**
 * @route   POST /api/master/v2/integration-from-spec
 * @desc    Crea una integración desde una especificación OpenAPI
 * @body    specUrl - URL de la especificación (opcional)
 * @body    specContent - Contenido JSON de la especificación (opcional)
 * @body    credentials - Credenciales para la API (opcional)
 * @access  Private
 */
router.post('/integration-from-spec', masterAgentV2Controller.createIntegrationFromSpec.bind(masterAgentV2Controller));

/**
 * @route   GET /api/master/v2/recommendations
 * @desc    Obtiene recomendaciones inteligentes
 * @access  Private
 */
router.get('/recommendations', masterAgentV2Controller.getRecommendations.bind(masterAgentV2Controller));

export default router;
