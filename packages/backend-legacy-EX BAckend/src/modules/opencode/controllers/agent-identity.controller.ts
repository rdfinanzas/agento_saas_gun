/**
 * Controller para gestión de identidad del agente
 * Refactorizado para usar AgentIdentityService
 *
 * PLAN #5: Migrado a @agento/agent-core
 */

import { Request, Response } from 'express';
import { agentIdentityService } from '../services/agent-identity.service';
import { WhatsAppAdapter } from '@agento/agent-core';
import { prisma } from '../../../config/database';

export class AgentIdentityController {
  // PLAN #5: Usar @agento/agent-core - WhatsAppAdapter maneja internamente la ejecución
  private adapter = new WhatsAppAdapter();

  /**
   * Obtiene la configuración de identidad del agente
   */
  async getIdentity(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const config = await agentIdentityService.getIdentity(tenantId);

      if (!config) {
        res.status(404).json({ error: 'No hay configuración de agente' });
        return;
      }

      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Actualiza la identidad del agente
   */
  async updateIdentity(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const config = await agentIdentityService.configureIdentity(tenantId, req.body);
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Valida si el agente está listo para producción
   */
  async validate(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const validation = await agentIdentityService.validateForProduction(tenantId);
      res.json(validation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Activa el agente (sale de sandbox)
   */
  async activate(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const result = await agentIdentityService.activateAgent(tenantId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Desactiva el agente (entra en sandbox)
   */
  async deactivate(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const result = await agentIdentityService.deactivateAgent(tenantId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Actualiza solo las FAQs
   */
  async updateFaq(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { faq } = req.body;

      const config = await agentIdentityService.configureIdentity(tenantId, { faq });
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Actualiza las políticas del negocio
   */
  async updatePolicies(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { businessPolicies } = req.body;

      const config = await agentIdentityService.configureIdentity(tenantId, { businessPolicies });
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Actualiza horarios de atención
   */
  async updateBusinessHours(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { businessHours } = req.body;

      const config = await agentIdentityService.configureIdentity(tenantId, { businessHours });
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Activa/desactiva modo sandbox
   */
  async toggleDraftMode(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { isDraft } = req.body;

      const config = await agentIdentityService.configureIdentity(tenantId, { isDraft });

      res.json({
        success: true,
        isDraft: config.isDraft,
        message: config.isDraft
          ? 'Modo sandbox activado - las respuestas no se enviarán a clientes'
          : 'Modo producción activado - las respuestas se enviarán a clientes',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Test de agente en modo sandbox
   */
  async testAgent(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { message, phoneNumber } = req.body;

      if (!message) {
        res.status(400).json({ error: 'Mensaje es requerido' });
        return;
      }

      const config = await agentIdentityService.getIdentity(tenantId);

      if (!config) {
        res.status(404).json({ error: 'No hay configuración de WhatsApp' });
        return;
      }

      const startTime = Date.now();

      // PLAN #5: Usar execute() de @agento/agent-core
      const response = await this.adapter.execute(
        tenantId,
        message,
        {
          phoneNumber: phoneNumber || 'test-phone',
          metadata: { fromPhone: 'test-from-phone' }
        }
      );

      const executionTime = Date.now() - startTime;

      // Obtener historial de conversación
      const context = await prisma.conversationContext.findFirst({
        where: { tenantId, type: 'WHATSAPP_AGENT' },
      });

      res.json({
        response: response.content,
        conversationHistory: (context?.messages as any[]) || [],
        executionTime,
        isDraft: config.isDraft,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Limpia el historial de conversación
   * PLAN #5: Implementado localmente (antes en adapter)
   */
  async clearHistory(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const context = await prisma.conversationContext.findFirst({
        where: {
          tenantId,
          type: 'WHATSAPP_AGENT'
        }
      });

      if (context) {
        await prisma.conversationContext.update({
          where: { id: context.id },
          data: {
            messages: [],
            memory: {}
          }
        });
      }

      res.json({ success: true, message: 'Historial de conversación limpiado' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene estadísticas del agente
   * PLAN #5: Implementado localmente (antes en adapter)
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const context = await prisma.conversationContext.findFirst({
        where: {
          tenantId,
          type: 'WHATSAPP_AGENT'
        }
      });

      const messages = context?.messages as any[] || [];
      const conversationsCount = await prisma.conversation.count({
        where: { tenantId }
      });

      const stats = {
        totalMessages: messages.length,
        conversationsCount,
        lastMessageAt: messages.length > 0 ? messages[messages.length - 1].timestamp : null,
      };

      const config = await agentIdentityService.getIdentity(tenantId);

      res.json({
        ...stats,
        config: config ? {
          agentName: config.agentName,
          agentRole: config.agentRole,
          isDraft: config.isDraft,
          isActive: config.isActive,
        } : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Genera system prompt basado en la identidad configurada
   */
  async getSystemPrompt(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const config = await agentIdentityService.getIdentity(tenantId);

      if (!config) {
        res.status(404).json({ error: 'No hay configuración de agente' });
        return;
      }

      const systemPrompt = agentIdentityService.generateSystemPrompt(config);

      res.json({ systemPrompt });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene templates de identidad predefinidos
   */
  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = agentIdentityService.getIdentityTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Aplica un template de identidad
   */
  async applyTemplate(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { templateId } = req.params;

      const templates = agentIdentityService.getIdentityTemplates();
      const template = templates[templateId];

      if (!template) {
        res.status(404).json({ error: 'Template no encontrado' });
        return;
      }

      const config = await agentIdentityService.configureIdentity(tenantId, template);
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const agentIdentityController = new AgentIdentityController();
