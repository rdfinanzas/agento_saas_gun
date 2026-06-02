import { Request, Response } from 'express';
import { prisma } from '../../../config/database';
import { whatsappQueue, WhatsAppJobData } from '../../../config/queue';
import crypto from 'crypto';

export class WebhookController {
  /**
   * GET - Webhook verification (Meta requirement)
   */
  async verify(req: Request, res: Response): Promise<void> {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const tenantSlug = req.params.tenantSlug;

    try {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) {
        res.status(404).send('Tenant not found');
        return;
      }

      const config = await prisma.whatsAppConfig.findFirst({
        where: { tenantId: tenant.id }
      });

      if (mode === 'subscribe' && token === config?.webhookVerifyToken) {
        console.log(`Webhook verified for tenant: ${tenantSlug}`);
        res.status(200).send(challenge);
        return;
      }

      res.status(403).send('Verification failed');
    } catch (error) {
      console.error('Webhook verification error:', error);
      res.status(500).send('Error');
    }
  }

  /**
   * POST - Receive WhatsApp messages
   */
  async handleIncoming(req: Request, res: Response): Promise<void> {
    const tenantSlug = req.params.tenantSlug;

    try {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) {
        res.status(404).send('Tenant not found');
        return;
      }

      const body = req.body;

      // Validate webhook structure
      if (body.object !== 'whatsapp_business_account') {
        res.status(200).send('OK');
        return;
      }

      // Process each entry
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;

          // Process messages
          for (const message of value.messages || []) {
            await this.processMessage(tenant.id, message, value);
          }
        }
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).send('Error');
    }
  }

  private async processMessage(tenantId: string, message: any, value: any) {
    const from = message.from;
    const messageId = message.id;
    const type = message.type;
    const timestamp = new Date(parseInt(message.timestamp) * 1000);

    let content = '';
    if (type === 'text') {
      content = message.text?.body || '';
    } else if (type === 'interactive') {
      content = message.interactive?.button_reply?.title || 
                message.interactive?.list_reply?.title || '';
    }

    if (!content) return;

    // Get or create conversation
    let conversation = await prisma.conversation.findUnique({
      where: { tenantId_phoneNumber: { tenantId, phoneNumber: from } }
    });

    if (!conversation) {
      const config = await prisma.whatsAppConfig.findFirst({
        where: { tenantId, isActive: true }
      });

      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          configId: config!.id,
          phoneNumber: from,
          contactName: value.contacts?.[0]?.profile?.name || from,
          status: 'ACTIVE'
        }
      });
    }

    // Save incoming message
    await prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        messageId,
        fromPhone: from,
        toPhone: value.metadata?.phone_number_id || '',
        direction: 'INCOMING',
        type: 'TEXT',
        content,
        status: 'RECEIVED'
      }
    });

    // Add to processing queue
    const jobData: WhatsAppJobData = {
      messageId,
      conversationId: conversation.id,
      tenantId,
      phoneNumber: from,
      content,
      timestamp
    };

    await whatsappQueue.add('process', jobData);
    console.log(`Queued message ${messageId} from ${from}`);
  }

  /**
   * Health check endpoint
   */
  async health(req: Request, res: Response): Promise<void> {
    const tenantSlug = req.params.tenantSlug;

    try {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) {
        res.status(404).json({ status: 'error', message: 'Tenant not found' });
        return;
      }

      const config = await prisma.whatsAppConfig.findFirst({
        where: { tenantId: tenant.id, isActive: true }
      });

      res.json({
        status: 'ok',
        tenant: tenantSlug,
        hasConfig: !!config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ status: 'error' });
    }
  }
}

export const webhookController = new WebhookController();
