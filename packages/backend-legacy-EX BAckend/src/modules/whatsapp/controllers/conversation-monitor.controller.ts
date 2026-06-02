import { Request, Response } from 'express';
import { conversationMonitorService } from '../services/conversation-monitor.service';

// Helper para extender Request con propiedades custom
interface CustomRequest extends Request {
  tenantId?: string;
  user?: {
    userId: string;
    id?: string;
    tenantId: string;
    role: string;
    name?: string;
    email?: string;
  };
}

export class ConversationMonitorController {
  async getActiveConversations(req: CustomRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      const conversations = await conversationMonitorService.getActiveConversations(tenantId);
      res.json(conversations);
    } catch (error) {
      console.error('Error getting active conversations:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getHumanTakeoverConversations(req: CustomRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      const conversations = await conversationMonitorService.getHumanTakeoverConversations(tenantId);
      res.json(conversations);
    } catch (error) {
      console.error('Error getting human takeover conversations:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getConversation(req: CustomRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { conversationId } = req.params;

      if (!tenantId || !conversationId) {
        return res.status(400).json({ error: 'Tenant ID and conversation ID are required' });
      }

      const conversation = await conversationMonitorService.getConversation(tenantId, conversationId);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.json(conversation);
    } catch (error) {
      console.error('Error getting conversation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async takeOver(req: CustomRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { conversationId } = req.params;
      const userId = req.user?.userId;

      if (!tenantId || !conversationId || !userId) {
        return res.status(400).json({ error: 'Tenant ID, conversation ID, and user ID are required' });
      }

      const conversation = await conversationMonitorService.takeOver(tenantId, conversationId, userId);
      res.json(conversation);
    } catch (error) {
      console.error('Error taking over conversation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async releaseControl(req: CustomRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { conversationId } = req.params;

      if (!tenantId || !conversationId) {
        return res.status(400).json({ error: 'Tenant ID and conversation ID are required' });
      }

      const conversation = await conversationMonitorService.releaseControl(tenantId, conversationId);
      res.json(conversation);
    } catch (error) {
      console.error('Error releasing control:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async sendManualMessage(req: CustomRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { conversationId } = req.params;
      const { content } = req.body;
      const userId = req.user?.userId;

      if (!tenantId || !conversationId || !content || !userId) {
        return res.status(400).json({ error: 'Tenant ID, conversation ID, content, and user ID are required' });
      }

      const message = await conversationMonitorService.sendManualMessage(
        tenantId,
        conversationId,
        content,
        userId
      );
      res.json(message);
    } catch (error) {
      console.error('Error sending manual message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async closeConversation(req: CustomRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { conversationId } = req.params;

      if (!tenantId || !conversationId) {
        return res.status(400).json({ error: 'Tenant ID and conversation ID are required' });
      }

      await conversationMonitorService.closeConversation(tenantId, conversationId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error closing conversation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
