/**
 * WhatsApp Agent Link Routes - Rutas para vincular Agentes con WhatsApp
 */

import { Router } from 'express';
import { whatsAppAgentLinkController } from '../controllers/whatsapp-agent-link.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * @route   GET /api/whatsapp/configs
 * @desc    Lista todas las configuraciones de WhatsApp con sus agentes
 * @access  Private
 */
router.get('/configs', whatsAppAgentLinkController.listConfigs.bind(whatsAppAgentLinkController));

/**
 * @route   GET /api/whatsapp/stats
 * @desc    Obtiene estadísticas de uso de WhatsApp
 * @access  Private
 */
router.get('/stats', whatsAppAgentLinkController.getStats.bind(whatsAppAgentLinkController));

/**
 * @route   GET /api/whatsapp/:configId/agent
 * @desc    Obtiene el agente vinculado a una configuración de WhatsApp
 * @access  Private
 */
router.get('/:configId/agent', whatsAppAgentLinkController.getLinkedAgent.bind(whatsAppAgentLinkController));

/**
 * @route   POST /api/whatsapp/:configId/link-agent
 * @desc    Vincula un agente a una configuración de WhatsApp
 * @body     agentId - ID del agente a vincular
 * @access  Private
 */
router.post('/:configId/link-agent', whatsAppAgentLinkController.linkAgent.bind(whatsAppAgentLinkController));

/**
 * @route   DELETE /api/whatsapp/:configId/unlink-agent
 * @desc    Desvincula un agente de una configuración de WhatsApp
 * @access  Private
 */
router.delete('/:configId/unlink-agent', whatsAppAgentLinkController.unlinkAgent.bind(whatsAppAgentLinkController));

export default router;
