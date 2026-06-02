/**
 * Agents Controller - Endpoints para gestión de Agentes
 */

import { Request, Response } from 'express';
import { agentsService } from '../services/agents.service';
import { AgentType, AgentStatus, AgentAccessType } from '@prisma/client';

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

export class AgentsController {
  /**
   * POST /api/agents
   * Crea un nuevo agente
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || req.body.tenantId;
      if (!tenantId) {
        res.status(400).json({ error: 'tenantId is required' });
        return;
      }

      const agent = await agentsService.create({
        ...req.body,
        tenantId,
      });

      res.status(201).json(agent);
    } catch (error: any) {
      console.error('Error creating agent:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/agents/:id
   * Obtiene un agente por ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const includeRelations = req.query.include === 'true';
      const agent = await agentsService.getById(id, tenantId, includeRelations);

      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      res.json(agent);
    } catch (error: any) {
      console.error('Error getting agent:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/agents
   * Lista agentes con filtros y paginación
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || req.query.tenantId as string;

      if (!tenantId) {
        res.status(400).json({ error: 'tenantId is required' });
        return;
      }

      const options = {
        tenantId,
        type: req.query.type as AgentType | undefined,
        status: req.query.status as AgentStatus | undefined,
        accessType: req.query.accessType as AgentAccessType | undefined,
        parentId: req.query.parentId as string | undefined,
        search: req.query.search as string | undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };

      const result = await agentsService.list(options);
      res.json(result);
    } catch (error: any) {
      console.error('Error listing agents:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/agents/:id
   * Actualiza un agente
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const agent = await agentsService.update(id, tenantId, req.body);
      res.json(agent);
    } catch (error: any) {
      console.error('Error updating agent:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/agents/:id
   * Elimina un agente (soft delete)
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const agent = await agentsService.delete(id, tenantId);
      res.json({ message: 'Agent archived', agent });
    } catch (error: any) {
      console.error('Error deleting agent:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/agents/:id/status
   * Cambia el estado de un agente
   */
  async setStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!status || !Object.values(AgentStatus).includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }

      const agent = await agentsService.setStatus(id, tenantId, status);
      res.json(agent);
    } catch (error: any) {
      console.error('Error setting agent status:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/agents/:id/duplicate
   * Duplica un agente
   */
  async duplicate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const agent = await agentsService.duplicate(id, tenantId, name);
      res.status(201).json(agent);
    } catch (error: any) {
      console.error('Error duplicating agent:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/agents/type/:type
   * Obtiene agentes por tipo
   */
  async getByType(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.params;
      const tenantId = req.tenantId;
      const activeOnly = req.query.active !== 'false';

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!Object.values(AgentType).includes(type as AgentType)) {
        res.status(400).json({ error: 'Invalid agent type' });
        return;
      }

      const agents = await agentsService.getByType(
        tenantId,
        type as AgentType,
        activeOnly
      );

      res.json(agents);
    } catch (error: any) {
      console.error('Error getting agents by type:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/agents/hierarchy
   * Obtiene el árbol jerárquico de agentes
   */
  async getHierarchy(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || req.query.tenantId as string;

      if (!tenantId) {
        res.status(400).json({ error: 'tenantId is required' });
        return;
      }

      const agents = await agentsService.getHierarchy(tenantId);
      res.json(agents);
    } catch (error: any) {
      console.error('Error getting agent hierarchy:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/agents/stats
   * Obtiene estadísticas de agentes del tenant
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || req.query.tenantId as string;

      if (!tenantId) {
        res.status(400).json({ error: 'tenantId is required' });
        return;
      }

      const prisma = (await import('@prisma/client')).PrismaClient;
      const prismaClient = new prisma();

      const [
        total,
        byType,
        byStatus,
        activeCount,
      ] = await Promise.all([
        prismaClient.agent.count({
          where: {
            tenantId,
            status: { not: 'ARCHIVED' },
          },
        }),
        prismaClient.agent.groupBy({
          by: ['type'],
          where: { tenantId },
          _count: true,
        }),
        prismaClient.agent.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: true,
        }),
        prismaClient.agent.count({
          where: {
            tenantId,
            status: 'ACTIVE',
          },
        }),
      ]);

      res.json({
        total,
        active: activeCount,
        byType: byType.reduce((acc, item) => {
          acc[item.type] = item._count;
          return acc;
        }, {} as Record<string, number>),
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>),
      });
    } catch (error: any) {
      console.error('Error getting agent stats:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const agentsController = new AgentsController();
