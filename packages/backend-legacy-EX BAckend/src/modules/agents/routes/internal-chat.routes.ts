/**
 * Internal Chat Routes - Rutas para chat con agentes internos
 */

import { Router } from 'express';
import { internalChatController } from '../controllers/internal-chat.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * @route   POST /api/agents/:agentId/chat
 * @desc    Envía un mensaje a un agente interno
 * @body     message - Mensaje a enviar
 * @body     conversationId - ID de conversación (opcional)
 * @access  Private
 */
router.post('/:agentId/chat', internalChatController.sendMessage.bind(internalChatController));

/**
 * @route   GET /api/agents/:agentId/chat/history
 * @desc    Obtiene el historial de chat con un agente
 * @access  Private
 */
router.get('/:agentId/chat/history', internalChatController.getHistory.bind(internalChatController));

/**
 * @route   GET /api/agents/:agentId/chat/session
 * @desc    Obtiene información de la sesión actual
 * @access  Private
 */
router.get('/:agentId/chat/session', internalChatController.getSessionInfo.bind(internalChatController));

/**
 * @route   GET /api/agents/:agentId/chat/active
 * @desc    Verifica si hay una sesión activa
 * @access  Private
 */
router.get('/:agentId/chat/active', internalChatController.hasActiveSession.bind(internalChatController));

/**
 * @route   DELETE /api/agents/:agentId/chat
 * @desc    Cierra la sesión de chat con un agente
 * @access  Private
 */
router.delete('/:agentId/chat', internalChatController.closeSession.bind(internalChatController));

export default router;
