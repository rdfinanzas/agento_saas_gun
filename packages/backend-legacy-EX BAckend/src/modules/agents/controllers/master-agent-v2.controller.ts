/**
 * Master Agent V2 Controller - Endpoints avanzados del Agente Maestro
 */

import { Request, Response } from 'express';
import { masterAgentV2Service } from '../services/master-agent-v2.service';

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

export class MasterAgentV2Controller {
  /**
   * POST /api/master/v2/chat
   * Chat mejorado con capacidades de análisis
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

      const response = await masterAgentV2Service.enhancedChat(
        tenantId,
        userId,
        message
      );

      res.json(response);
    } catch (error: any) {
      console.error('[MasterAgentV2] Error processing request:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/master/v2/analyze-api
   * Analiza una especificación OpenAPI/Swagger
   */
  async analyzeAPI(req: Request, res: Response): Promise<void> {
    try {
      const { specUrl, specContent } = req.body;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!specUrl && !specContent) {
        res.status(400).json({ error: 'specUrl or specContent is required' });
        return;
      }

      const analysis = await masterAgentV2Service.analyzeOpenAPISpec(
        specUrl || specContent,
        !!specUrl
      );

      res.json({ analysis });
    } catch (error: any) {
      console.error('[MasterAgentV2] Error analyzing API:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/master/v2/integration-from-spec
   * Crea una integración desde una especificación OpenAPI
   */
  async createIntegrationFromSpec(req: Request, res: Response): Promise<void> {
    try {
      const { specUrl, specContent, credentials } = req.body;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!specUrl && !specContent) {
        res.status(400).json({ error: 'specUrl or specContent is required' });
        return;
      }

      const result = await masterAgentV2Service.createIntegrationFromSpec(
        tenantId,
        specUrl || specContent,
        !!specUrl,
        credentials
      );

      res.json(result);
    } catch (error: any) {
      console.error('[MasterAgentV2] Error creating integration:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/master/v2/recommendations
   * Obtiene recomendaciones inteligentes
   */
  async getRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const recommendations = await masterAgentV2Service.generateSmartRecommendations(tenantId);

      res.json(recommendations);
    } catch (error: any) {
      console.error('[MasterAgentV2] Error getting recommendations:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/master/v2/health
   * Verifica el estado del servicio
   */
  async health(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'ok',
      service: 'master-agent-v2',
      version: '2.0',
      capabilities: [
        'openapi_analysis',
        'auto_integration',
        'smart_recommendations',
        'enhanced_chat',
      ],
    });
  }
}

export const masterAgentV2Controller = new MasterAgentV2Controller();
