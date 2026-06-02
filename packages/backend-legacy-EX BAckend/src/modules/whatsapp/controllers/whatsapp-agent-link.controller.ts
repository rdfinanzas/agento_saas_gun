/**
 * WhatsApp Agent Link Controller - Endpoints para vincular Agentes con WhatsApp
 */

import { Request, Response } from 'express';
import { whatsAppAgentServiceV2 } from '../services/agent-v2.service';
import { prisma } from '../../../config/database';

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

export class WhatsAppAgentLinkController {
  /**
   * POST /api/whatsapp/:configId/link-agent
   * Vincula un agente a una configuración de WhatsApp
   */
  async linkAgent(req: Request, res: Response): Promise<void> {
    try {
      const { configId } = req.params;
      const { agentId } = req.body;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!agentId) {
        res.status(400).json({ error: 'agentId is required' });
        return;
      }

      await whatsAppAgentServiceV2.linkAgent(configId, agentId, tenantId);

      res.json({ message: 'Agent linked successfully' });
    } catch (error: any) {
      console.error('[WhatsAppAgentLink] Error linking agent:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/whatsapp/:configId/unlink-agent
   * Desvincula un agente de una configuración de WhatsApp
   */
  async unlinkAgent(req: Request, res: Response): Promise<void> {
    try {
      const { configId } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await whatsAppAgentServiceV2.unlinkAgent(configId, tenantId);

      res.json({ message: 'Agent unlinked successfully' });
    } catch (error: any) {
      console.error('[WhatsAppAgentLink] Error unlinking agent:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/whatsapp/:configId/agent
   * Obtiene el agente vinculado a una configuración de WhatsApp
   */
  async getLinkedAgent(req: Request, res: Response): Promise<void> {
    try {
      const { configId } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const config = await prisma.whatsAppConfig.findFirst({
        where: { id: configId, tenantId },
        include: { agent: true },
      });

      if (!config) {
        res.status(404).json({ error: 'WhatsApp config not found' });
        return;
      }

      res.json({ agent: config.agent });
    } catch (error: any) {
      console.error('[WhatsAppAgentLink] Error getting linked agent:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/whatsapp/stats
   * Obtiene estadísticas de uso de WhatsApp
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const stats = await whatsAppAgentServiceV2.getStats(tenantId);
      res.json(stats);
    } catch (error: any) {
      console.error('[WhatsAppAgentLink] Error getting stats:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/whatsapp/configs
   * Lista todas las configuraciones de WhatsApp con sus agentes vinculados
   */
  async listConfigs(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const configs = await prisma.whatsAppConfig.findMany({
        where: { tenantId },
        include: { agent: true },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ configs });
    } catch (error: any) {
      console.error('[WhatsAppAgentLink] Error listing configs:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const whatsAppAgentLinkController = new WhatsAppAgentLinkController();
