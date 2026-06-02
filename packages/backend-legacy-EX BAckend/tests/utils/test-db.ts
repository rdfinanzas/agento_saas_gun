/**
 * Test Database Helper
 * FASE 6: Tests de integración
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/agento_test',
    },
  },
});

export class TestDB {
  private static instance: TestDB;
  private cleanupQueue: (() => Promise<void>)[] = [];

  static getInstance(): TestDB {
    if (!TestDB.instance) {
      TestDB.instance = new TestDB();
    }
    return TestDB.instance;
  }

  getClient(): PrismaClient {
    return prisma;
  }

  /**
   * Create a test tenant
   */
  async createTenant(data?: Partial<any>) {
    const tenant = await prisma.tenant.create({
      data: {
        slug: data?.slug || `test-tenant-${Date.now()}`,
        name: data?.name || 'Test Tenant',
        email: data?.email || `test-${Date.now()}@test.com`,
        subscriptionTier: data?.subscriptionTier || 'FREE',
        quotaMaxRequests: data?.quotaMaxRequests || 1000,
        quotaMaxStorage: data?.quotaMaxStorage || BigInt(1073741824),
        ...data,
      },
    });

    this.cleanupQueue.push(async () => {
      await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
    });

    return tenant;
  }

  /**
   * Create a test user
   */
  async createUser(data?: Partial<any>) {
    const user = await prisma.user.create({
      data: {
        email: data?.email || `user-${Date.now()}@test.com`,
        password: data?.password || '$2b$10$test hashed password', // Pre-hashed
        name: data?.name || 'Test User',
        ...data,
      },
    });

    this.cleanupQueue.push(async () => {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    });

    return user;
  }

  /**
   * Create a test tenant-user relationship
   */
  async createTenantUser(tenantId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER') {
    const tenantUser = await prisma.tenantUser.create({
      data: {
        tenantId,
        userId,
        role,
      },
    });

    this.cleanupQueue.push(async () => {
      await prisma.tenantUser.delete({ where: { id: tenantUser.id } }).catch(() => {});
    });

    return tenantUser;
  }

  /**
   * Create a test WhatsApp config
   */
  async createWhatsAppConfig(tenantId: string, data?: Partial<any>) {
    const config = await prisma.whatsAppConfig.create({
      data: {
        tenantId,
        phoneNumberId: data?.phoneNumberId || 'test-phone-id',
        accessToken: data?.accessToken || 'test-access-token',
        webhookVerifyToken: data?.webhookVerifyToken || 'test-verify-token',
        isActive: data?.isActive ?? true,
        agentMode: data?.agentMode || 'LIMITED',
        isDraft: data?.isDraft ?? true,
        agentName: data?.agentName || 'Test Agent',
        agentRole: data?.agentRole || 'soporte',
        agentInstructions: data?.agentInstructions || 'Se amable y profesional',
        knowledgeBase: data?.knowledgeBase || {},
        ...data,
      },
    });

    this.cleanupQueue.push(async () => {
      await prisma.whatsAppConfig.delete({ where: { id: config.id } }).catch(() => {});
    });

    return config;
  }

  /**
   * Create a test conversation
   */
  async createConversation(tenantId: string, configId: string, data?: Partial<any>) {
    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        configId,
        phoneNumber: data?.phoneNumber || `+52${Date.now()}`,
        status: data?.status || 'ACTIVE',
        ...data,
      },
    });

    this.cleanupQueue.push(async () => {
      await prisma.conversation.delete({ where: { id: conversation.id } }).catch(() => {});
    });

    return conversation;
  }

  /**
   * Create a test message
   */
  async createMessage(tenantId: string, conversationId: string, data?: Partial<any>) {
    const message = await prisma.message.create({
      data: {
        tenantId,
        conversationId,
        fromPhone: data?.fromPhone || '+521234567890',
        toPhone: data?.toPhone || '+529876543210',
        direction: data?.direction || 'INCOMING',
        type: data?.type || 'text',
        content: data?.content || 'Test message',
        status: data?.status || 'RECEIVED',
        ...data,
      },
    });

    this.cleanupQueue.push(async () => {
      await prisma.message.delete({ where: { id: message.id } }).catch(() => {});
    });

    return message;
  }

  /**
   * Create a test subscription
   */
  async createSubscription(tenantId: string, data?: Partial<any>) {
    const subscription = await prisma.subscription.create({
      data: {
        tenantId,
        planId: data?.planId || 'pro-monthly',
        planName: data?.planName || 'Pro (Mensual)',
        status: data?.status || 'ACTIVE',
        tier: data?.tier || 'PRO',
        gateway: data?.gateway || 'MERCADOPAGO',
        currentPeriodStart: data?.currentPeriodStart || new Date(),
        currentPeriodEnd: data?.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ...data,
      },
    });

    this.cleanupQueue.push(async () => {
      await prisma.subscription.delete({ where: { id: subscription.id } }).catch(() => {});
    });

    return subscription;
  }

  /**
   * Create a test payment
   */
  async createPayment(tenantId: string, data?: Partial<any>) {
    const payment = await prisma.payment.create({
      data: {
        tenantId,
        gateway: data?.gateway || 'MERCADOPAGO',
        gatewayPaymentId: data?.gatewayPaymentId || `mp-${Date.now()}`,
        amount: data?.amount || 299,
        currency: data?.currency || 'MXN',
        status: data?.status || 'APPROVED',
        payerEmail: data?.payerEmail || 'test@test.com',
        ...data,
      },
    });

    this.cleanupQueue.push(async () => {
      await prisma.payment.delete({ where: { id: payment.id } }).catch(() => {});
    });

    return payment;
  }

  /**
   * Create a test knowledge embedding
   */
  async createEmbedding(tenantId: string, data?: Partial<any>) {
    const embedding = await prisma.knowledgeEmbedding.create({
      data: {
        tenantId,
        content: data?.content || 'Test content for embedding',
        embedding: data?.embedding || JSON.stringify(Array(1536).fill(0.1)),
        source: data?.source || 'test',
        metadata: data?.metadata || {},
        ...data,
      },
    });

    this.cleanupQueue.push(async () => {
      await prisma.knowledgeEmbedding.delete({ where: { id: embedding.id } }).catch(() => {});
    });

    return embedding;
  }

  /**
   * Clean up all test data
   */
  async cleanup() {
    // Execute cleanup in reverse order (LIFO)
    while (this.cleanupQueue.length > 0) {
      const cleanupFn = this.cleanupQueue.pop();
      if (cleanupFn) {
        try {
          await cleanupFn();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Clear all test data from database
   */
  async clearDatabase() {
    const tables = [
      'knowledge_embeddings',
      'payments',
      'invoices',
      'subscriptions',
      'messages',
      'conversations',
      'whatsapp_configs',
      'tenant_usages',
      'tenant_files',
      'tenant_users',
      'conversation_contexts',
      'users',
      'tenants',
    ];

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE 1=1`);
      } catch (error) {
        // Ignore if table doesn't exist
      }
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    await prisma.$disconnect();
  }
}

export const testDB = TestDB.getInstance();
