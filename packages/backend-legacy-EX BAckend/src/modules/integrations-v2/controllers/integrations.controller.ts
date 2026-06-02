/**
 * Integrations Controller - Endpoints para gestión de Integraciones
 */

import { Request, Response } from 'express';
import { integrationsService } from '../services/integrations.service';
import { IntegrationType } from '@prisma/client';

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

export class IntegrationsController {
  /**
   * POST /api/integrations
   * Crea una nueva integración
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || req.body.tenantId;
      if (!tenantId) {
        res.status(400).json({ error: 'tenantId is required' });
        return;
      }

      const integration = await integrationsService.create({
        ...req.body,
        tenantId,
      });

      res.status(201).json(integration);
    } catch (error: any) {
      console.error('[Integrations] Error creating:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/integrations
   * Obtiene todas las integraciones del tenant
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || req.query.tenantId as string;

      if (!tenantId) {
        res.status(400).json({ error: 'tenantId is required' });
        return;
      }

      const integrations = await integrationsService.getByTenant(tenantId);
      res.json({ integrations });
    } catch (error: any) {
      console.error('[Integrations] Error listing:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/integrations/:id
   * Obtiene una integración por ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const integration = await integrationsService.getById(id, tenantId);

      if (!integration) {
        res.status(404).json({ error: 'Integration not found' });
        return;
      }

      res.json(integration);
    } catch (error: any) {
      console.error('[Integrations] Error getting:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/integrations/:id
   * Actualiza una integración
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const integration = await integrationsService.update(id, tenantId, req.body);
      res.json(integration);
    } catch (error: any) {
      console.error('[Integrations] Error updating:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/integrations/:id
   * Elimina una integración
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await integrationsService.delete(id, tenantId);
      res.json({ message: 'Integration deleted' });
    } catch (error: any) {
      console.error('[Integrations] Error deleting:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/integrations/:id/link-agent
   * Vincula una integración a un agente
   */
  async linkToAgent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { agentId, config } = req.body;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!agentId) {
        res.status(400).json({ error: 'agentId is required' });
        return;
      }

      const agentIntegration = await integrationsService.linkToAgent(
        id,
        agentId,
        tenantId,
        config
      );

      res.status(201).json(agentIntegration);
    } catch (error: any) {
      console.error('[Integrations] Error linking agent:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/integrations/:id/unlink-agent/:agentId
   * Desvincula una integración de un agente
   */
  async unlinkFromAgent(req: Request, res: Response): Promise<void> {
    try {
      const { id, agentId } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await integrationsService.unlinkFromAgent(id, agentId, tenantId);
      res.json({ message: 'Integration unlinked from agent' });
    } catch (error: any) {
      console.error('[Integrations] Error unlinking agent:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/integrations/:id/test
   * Prueba la conexión de una integración
   */
  async testConnection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const success = await integrationsService.testConnection(id);

      res.json({ success, message: success ? 'Connection successful' : 'Connection failed' });
    } catch (error: any) {
      console.error('[Integrations] Error testing connection:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/integrations/types
   * Obtiene los tipos de integración disponibles
   */
  async getTypes(req: Request, res: Response): Promise<void> {
    const types = Object.values(IntegrationType).map(type => ({
      value: type,
      label: type.replace('_', ' '),
      description: this.getTypeDescription(type),
    }));

    res.json({ types });
  }

  /**
   * GET /api/agents/:agentId/tools
   * Obtiene las tools de un agente
   */
  async getAgentTools(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const tools = await integrationsService.getAgentTools(agentId, tenantId);
      res.json({ tools });
    } catch (error: any) {
      console.error('[Integrations] Error getting agent tools:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene la descripción de un tipo de integración
   */
  private getTypeDescription(type: IntegrationType): string {
    const descriptions: Record<IntegrationType, string> = {
      [IntegrationType.CRM]: 'CRM (Salesforce, HubSpot, etc.)',
      [IntegrationType.ERP]: 'ERP (SAP, Oracle, etc.)',
      [IntegrationType.ECOMMERCE]: 'E-commerce (Shopify, MercadoLibre, etc.)',
      [IntegrationType.ACCOUNTING]: 'Contabilidad (QuickBooks, ContaPlus, etc.)',
      [IntegrationType.BANK]: 'Bancos y pasarelas de pago',
      [IntegrationType.CUSTOM_API]: 'API REST personalizada',
      [IntegrationType.GOOGLE]: 'Google (Sheets, Docs, Drive)',
      [IntegrationType.MICROSOFT]: 'Microsoft (Excel, Teams)',
    };

    return descriptions[type] || type;
  }
}

export const integrationsController = new IntegrationsController();
