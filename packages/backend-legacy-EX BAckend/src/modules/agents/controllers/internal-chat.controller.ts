/**
 * Internal Chat Controller - Endpoints para chat con agentes internos
 */

import { Request, Response } from 'express';
import { internalChatService } from '../services/internal-chat.service';

// Extender Request con propiedades de autenticación
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      tenantId?: string;
      userRole?: string;
    }
  }
}

export class InternalChatController {
  /**
   * POST /api/agents/:agentId/chat
   * Envía un mensaje a un agente interno
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const { message, conversationId } = req.body;
      const tenantId = req.tenantId;
      const userId = req.userId;

      if (!tenantId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const response = await internalChatService.sendMessage({
        tenantId,
        agentId,
        userId,
        message,
        conversationId,
      });

      res.json(response);
    } catch (error: any) {
      console.error('[InternalChat] Error sending message:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/agents/:agentId/chat/history
   * Obtiene el historial de chat con un agente
   */
  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const tenantId = req.tenantId;
      const userId = req.userId;

      if (!tenantId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const history = await internalChatService.getChatHistory(
        tenantId,
        agentId,
        userId
      );

      res.json({ history });
    } catch (error: any) {
      console.error('[InternalChat] Error getting history:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/agents/:agentId/chat
   * Cierra la sesión de chat con un agente
   */
  async closeSession(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const tenantId = req.tenantId;
      const userId = req.userId;

      if (!tenantId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await internalChatService.closeSession(tenantId, agentId, userId);

      res.json({ message: 'Session closed' });
    } catch (error: any) {
      console.error('[InternalChat] Error closing session:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/agents/:agentId/chat/session
   * Obtiene información de la sesión actual
   */
  async getSessionInfo(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const tenantId = req.tenantId;
      const userId = req.userId;

      if (!tenantId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const sessionInfo = await internalChatService.getSessionInfo(
        tenantId,
        agentId,
        userId
      );

      if (!sessionInfo) {
        res.status(404).json({ error: 'No active session' });
        return;
      }

      res.json(sessionInfo);
    } catch (error: any) {
      console.error('[InternalChat] Error getting session info:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/agents/:agentId/chat/active
   * Verifica si hay una sesión activa
   */
  async hasActiveSession(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const tenantId = req.tenantId;
      const userId = req.userId;

      if (!tenantId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const hasSession = await internalChatService.hasActiveSession(
        tenantId,
        agentId,
        userId
      );

      res.json({ hasSession });
    } catch (error: any) {
      console.error('[InternalChat] Error checking session:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const internalChatController = new InternalChatController();
