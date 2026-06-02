import { PrismaClient } from '@prisma/client';
import { Queue, Job } from 'bullmq';
import { Redis } from 'ioredis';

export interface WebhookPayload {
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  field: string;
  value?: {
    metadata?: {
      phone_number_id: string;
      display_phone_number: string;
    };
    messages?: WebhookMessage[];
    contacts?: WebhookContact[];
  };
}

export interface WebhookMessage {
  id: string;
  from: string;
  to: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  interactive?: any;
  audio?: any;
  document?: any;
  image?: any;
  video?: any;
  location?: any;
}

export interface WebhookContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface ProcessWebhookResult {
  messageCount: number;
  tenantId: string;
  errors: string[];
}

export class WebhookService {
  private prisma: PrismaClient;
  private whatsappQueue: Queue;
  private redis: Redis;

  constructor() {
    this.prisma = new PrismaClient();

    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    };

    this.redis = new Redis(redisConfig);
    this.whatsappQueue = new Queue('whatsapp-incoming', {
      connection: redisConfig
    });
  }

  /**
   * Process incoming webhook from Meta WhatsApp
   */
  async processWebhook(tenantSlug: string, payload: WebhookPayload): Promise<ProcessWebhookResult> {
    const result: ProcessWebhookResult = {
      messageCount: 0,
      tenantId: '',
      errors: []
    };

    try {
      // 1. Find tenant by slug
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        include: { whatsappConfigs: true }
      });

      if (!tenant) {
        throw new Error(`Tenant not found: ${tenantSlug}`);
      }

      result.tenantId = tenant.id;

      const config = tenant.whatsappConfigs[0];
      if (!config || !config.isActive) {
        throw new Error('WhatsApp not configured or inactive for tenant');
      }

      // 2. Process webhook entries
      for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;

          const value = change.value;

          // Verify phone number ID matches tenant's config
          if (!value || value?.metadata?.phone_number_id !== config.phoneNumberId) {
            result.errors.push(`Phone number ID mismatch for tenant ${tenantSlug}`);
            continue;
          }

          // 3. Process each message
          const messages = value.messages || [];
          const contacts = value.contacts || [];
          for (const message of messages) {
            try {
              await this.processMessage(tenant.id, config.id, message, contacts);
              result.messageCount++;
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              result.errors.push(`Failed to process message ${message.id}: ${errorMsg}`);
            }
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Webhook processing error:', error);
      throw error;
    }
  }

  /**
   * Process individual message
   */
  private async processMessage(
    tenantId: string,
    configId: string,
    message: WebhookMessage,
    contacts?: WebhookContact[]
  ): Promise<void> {
    // Extract contact name if available
    const contact = contacts?.find(c => c.wa_id === message.from);
    const contactName = contact?.profile?.name;

    // Get or create conversation
    const conversationId = await this.getOrCreateConversation(
      tenantId,
      configId,
      message.from,
      contactName
    );

    // Save message to database
    await this.prisma.message.create({
      data: {
        tenantId,
        conversationId,
        messageId: message.id,
        fromPhone: message.from,
        toPhone: message.to,
        direction: 'INCOMING',
        type: message.type,
        content: this.extractMessageContent(message),
        status: 'RECEIVED',
        metadata: {
          timestamp: message.timestamp,
          contactName
        } as any
      }
    });

    // Add to queue for async processing
    await this.whatsappQueue.add(
      'process-message',
      {
        tenantId,
        phoneNumber: message.from,
        message: this.extractMessageContent(message),
        messageId: message.id,
        messageType: message.type,
        timestamp: new Date(parseInt(message.timestamp) * 1000)
      },
      {
        jobId: `${tenantId}-${message.id}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    );
  }

  /**
   * Extract message content based on type
   */
  private extractMessageContent(message: WebhookMessage): string {
    switch (message.type) {
      case 'text':
        return message.text?.body || '';

      case 'interactive':
        return JSON.stringify(message.interactive);

      case 'audio':
        return '[Audio]';

      case 'document':
        return `[Document: ${message.document?.filename || 'unknown'}]`;

      case 'image':
        return '[Image]';

      case 'video':
        return '[Video]';

      case 'location':
        return JSON.stringify(message.location);

      default:
        return `[Unsupported message type: ${message.type}]`;
    }
  }

  /**
   * Get or create conversation for phone number
   */
  private async getOrCreateConversation(
    tenantId: string,
    configId: string,
    phoneNumber: string,
    contactName?: string
  ): Promise<string> {
    let conversation = await this.prisma.conversation.findUnique({
      where: {
        tenantId_phoneNumber: { tenantId, phoneNumber }
      }
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId,
          configId,
          phoneNumber,
          contactName: contactName || phoneNumber,
          status: 'ACTIVE',
          lastMessageAt: new Date()
        }
      });
    } else {
      // Update last message time and contact name if needed
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          ...(contactName && { contactName })
        }
      });
    }

    return conversation.id;
  }

  /**
   * Verify webhook token
   */
  verifyToken(mode: string, token: string, verifyToken: string): boolean {
    return mode === 'subscribe' && token === verifyToken;
  }

  /**
   * Get queue stats
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.whatsappQueue.getWaitingCount(),
      this.whatsappQueue.getActiveCount(),
      this.whatsappQueue.getCompletedCount(),
      this.whatsappQueue.getFailedCount()
    ]);

    return { waiting, active, completed, failed };
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    await this.whatsappQueue.close();
    await this.redis.quit();
  }
}
