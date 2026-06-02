/**
 * Master Agent Controller - Endpoints para el Agente Maestro
 */

import { Request, Response } from 'express';
import { masterAgentService } from '../services/master-agent.service';

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

export class MasterAgentController {
  /**
   * POST /api/master/chat
   * Envía un mensaje al Agente Maestro
   */
  async chat(req: Request, res: Response): Promise<void> {
    try {
      const { message } = req.body;
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

      const response = await masterAgentService.processRequest(
        tenantId,
        userId,
        message
      );

      res.json(response);
    } catch (error: any) {
      console.error('[MasterAgent] Error processing request:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/master/suggestions
   * Obtiene sugerencias del Agente Maestro
   */
  async getSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId;
      const userId = req.userId;

      if (!tenantId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const suggestions = await masterAgentService.getSuggestions(tenantId, userId);
      res.json({ suggestions });
    } catch (error: any) {
      console.error('[MasterAgent] Error getting suggestions:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/master/analytics
   * Obtiene reporte de analíticas del Agente Maestro
   */
  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const report = await masterAgentService.generateAnalyticsReport(tenantId);
      res.json(report);
    } catch (error: any) {
      console.error('[MasterAgent] Error generating analytics:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/master/initialize
   * Inicializa el Agente Maestro para un tenant
   */
  async initialize(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const masterAgentId = await masterAgentService.initializeForTenant(tenantId);
      res.json({
        message: 'Master Agent initialized',
        agentId: masterAgentId,
      });
    } catch (error: any) {
      console.error('[MasterAgent] Error initializing:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/master/agent/create
   * Crea un agente usando el Agente Maestro
   */
  async createAgent(req: Request, res: Response): Promise<void> {
    try {
      const { instructions } = req.body;
      const tenantId = req.tenantId;
      const userId = req.userId;

      if (!tenantId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const response = await masterAgentService.processRequest(
        tenantId,
        userId,
        instructions || 'Ayúdame a crear un nuevo agente. Primero necesito saber: ¿qué tipo de agente necesitas? (INTERNO para empleados, EXTERNO para clientes)'
      );

      res.json(response);
    } catch (error: any) {
      console.error('[MasterAgent] Error creating agent:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /master/integration/create
   * Crea una integración usando el Agente Maestro
   */
  async createIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { instructions } = req.body;
      const tenantId = req.tenantId;
      const userId = req.userId;

      if (!tenantId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const response = await masterAgentService.processRequest(
        tenantId,
        userId,
        instructions || 'Ayúdame a configurar una integración con una API externa. Necesito: nombre de la integración, tipo de API (CRM, ERP, etc.), y credenciales.'
      );

      res.json(response);
    } catch (error: any) {
      console.error('[MasterAgent] Error creating integration:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const masterAgentController = new MasterAgentController();
