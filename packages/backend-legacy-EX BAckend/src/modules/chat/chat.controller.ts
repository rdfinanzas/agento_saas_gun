import { Request, Response } from 'express';
import { openCodeChatService } from './services/opencode-chat.service';

const chatService = openCodeChatService;

export class ChatController {
  async sendMessage(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId!;
      const { message, mode } = req.body;

      const result = await chatService.sendMessage(
        tenantId,
        message,
        mode || 'FULL'
      );

      res.json({
        response: result.response,
        mode: result.mode,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getContext(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId!;

      // TODO: Implement context retrieval
      res.json({
        tenantId,
        context: {},
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async clearContext(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId!;

      // TODO: Implement context clearing
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getHistory(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId!;

      const history = await chatService.getHistory(tenantId);

      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async clearHistory(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId!;
      const { sessionId } = req.body;

      await chatService.clearHistory(tenantId, sessionId || 'default');

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
