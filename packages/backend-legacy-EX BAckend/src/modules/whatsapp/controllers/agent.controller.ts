import { Request, Response } from 'express';
import { agentConfigService } from '../services/agent-config.service';
import { WhatsAppAgentService } from '../services/agent.service';
import { WhatsAppCloudApiService } from '../services/whatsapp-cloud-api.service';
import { prisma } from '../../../config/database';

export class AgentController {
  private agentService: WhatsAppAgentService;

  constructor() {
    const whatsappApi = new WhatsAppCloudApiService();
    this.agentService = new WhatsAppAgentService(whatsappApi);
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const agent = await agentConfigService.create(tenantId, req.body);
      res.status(201).json(agent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const agents = await agentConfigService.findByTenant(tenantId);
      res.json(agents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async findOne(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const agent = await agentConfigService.findById(id, tenantId);

      if (!agent) {
        res.status(404).json({ error: 'Agente no encontrado' });
        return;
      }
      res.json(agent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const agent = await agentConfigService.update(id, tenantId, req.body);
      res.json(agent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateKnowledge(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const { knowledgeBase } = req.body;
      const agent = await agentConfigService.updateKnowledgeBase(id, tenantId, knowledgeBase);
      res.json(agent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async toggleActive(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const agent = await agentConfigService.toggleActive(id, tenantId);
      res.json(agent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const stats = await agentConfigService.getStats(id, tenantId);

      if (!stats) {
        res.status(404).json({ error: 'Agente no encontrado' });
        return;
      }
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      await agentConfigService.delete(id, tenantId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Conversations endpoints
  async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      const conversations = await prisma.conversation.findMany({
        where: {
          tenantId,
          configId: id,
        },
        include: {
          _count: {
            select: { messages: true },
          },
        },
        orderBy: {
          lastMessageAt: 'desc',
        },
      });

      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getConversationMessages(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const tenantId = req.tenantId!;

      const messages = await prisma.message.findMany({
        where: {
          tenantId,
          conversationId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async takeOverConversation(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const tenantId = req.tenantId!;

      const conversation = await prisma.conversation.updateMany({
        where: {
          id: conversationId,
          tenantId,
        },
        data: {
          status: 'HUMAN_TAKEOVER',
        },
      });

      if (conversation.count === 0) {
        res.status(404).json({ error: 'Conversación no encontrada' });
        return;
      }

      res.json({ success: true, status: 'HUMAN_TAKEOVER' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async releaseConversation(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const tenantId = req.tenantId!;

      const conversation = await prisma.conversation.updateMany({
        where: {
          id: conversationId,
          tenantId,
        },
        data: {
          status: 'ACTIVE',
        },
      });

      if (conversation.count === 0) {
        res.status(404).json({ error: 'Conversación no encontrada' });
        return;
      }

      res.json({ success: true, status: 'ACTIVE' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // Test Endpoints - Probar agente sin WhatsApp
  // ============================================

  /**
   * Probar respuesta del agente (sin enviar por WhatsApp)
   */
  async testAgent(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { message, phoneNumber } = req.body;

      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      // Usar número de prueba si no se proporciona
      const testPhone = phoneNumber || 'test_user_' + Date.now();

      const response = await this.agentService.processIncomingMessage({
        tenantId,
        phoneNumber: testPhone,
        message,
        messageId: `test_${Date.now()}`
      });

      res.json({
        success: true,
        response: response.response,
        confidence: response.confidence,
        sources: response.sources,
        tokensUsed: response.tokensUsed,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Verificar disponibilidad del LLM/OpenCode
   */
  async checkLLMStatus(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const status = await this.agentService.checkOpenCodeAvailability();

      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtener estado del agente
   */
  async getAgentStatus(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const status = await this.agentService.getAgentStatus(tenantId);

      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Activar/desactivar modo draft (sandbox)
   */
  async setDraftMode(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { isDraft } = req.body;

      await this.agentService.setDraftMode(tenantId, isDraft);

      res.json({ success: true, isDraft });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Ejecuta un skill instalado
   */
  async executeSkill(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { toolName, input } = req.body;

      if (!toolName) {
        res.status(400).json({ error: 'toolName es requerido' });
        return;
      }

      const { skillLoaderService } = await import('../services/skill-loader.service');
      const result = await skillLoaderService.executeSkill(tenantId, toolName, input || {});

      res.json(result);
    } catch (error: any) {
      console.error('[AgentController] Error executing skill:', error);
      res.status(500).json({ error: error.message || 'Error ejecutando skill' });
    }
  }
}

export const agentController = new AgentController();
