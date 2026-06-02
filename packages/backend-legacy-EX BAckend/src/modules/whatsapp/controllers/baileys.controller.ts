import { Request, Response } from 'express';
import { whatsAppBaileysService } from '../services/whatsapp-baileys.service';

export class BaileysController {
  async startSession(req: Request, res: Response) {
    try {
      const { configId } = req.params;

      const result = await whatsAppBaileysService.startSession(configId);

      res.json({
        success: true,
        status: result.status,
        qr: result.qr,
      });
    } catch (error: any) {
      console.error('[BaileysController] Error starting session:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async closeSession(req: Request, res: Response) {
    try {
      const { configId } = req.params;

      await whatsAppBaileysService.closeSession(configId);

      res.json({
        success: true,
        message: 'Session closed',
      });
    } catch (error: any) {
      console.error('[BaileysController] Error closing session:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getStatus(req: Request, res: Response) {
    try {
      const { configId } = req.params;

      const status = whatsAppBaileysService.getStatus(configId);
      const qrCode = whatsAppBaileysService.getQRCode(configId);

      res.json({
        success: true,
        status,
        qrCode: qrCode ? `data:image/png;base64,${qrCode}` : null,
      });
    } catch (error: any) {
      console.error('[BaileysController] Error getting status:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async sendMessage(req: Request, res: Response) {
    try {
      const { configId } = req.params;
      const { to, message } = req.body;

      if (!to || !message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to, message',
        });
      }

      const success = await whatsAppBaileysService.sendMessage(configId, to, message);

      res.json({
        success,
      });
    } catch (error: any) {
      console.error('[BaileysController] Error sending message:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const baileysController = new BaileysController();
