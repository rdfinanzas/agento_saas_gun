/**
 * BillingWorker - Worker para procesamiento asíncrono de facturación
 * FASE 1: Suscripciones Recurrentes
 */

import { Job, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { subscriptionService } from '../services/subscription.service';
import { dunningService } from '../services/dunning.service';
import { MercadoPagoService } from '../services/mercadopago.service';

// ============================================
// Types & Interfaces
// ============================================

export interface BillingJobData {
  type: 'renewal' | 'dunning' | 'invoice' | 'proration' | 'webhook';
  subscriptionId?: string;
  tenantId?: string;
  attemptId?: string;
  webhookPayload?: any;
  [key: string]: any;
}

export interface BillingWorkerConfig {
  connection: {
    host: string;
    port: number;
    password?: string;
  };
  concurrency?: number;
}

// ============================================
// Billing Worker
// ============================================

export class BillingWorker {
  private worker: Worker;
  private prisma: PrismaClient;
  private mercadoPagoService: MercadoPagoService;
  private processedWebhooks: Set<string> = new Set();

  constructor(config: BillingWorkerConfig) {
    this.prisma = new PrismaClient();
    this.mercadoPagoService = new MercadoPagoService();

    this.worker = new Worker(
      'billing',
      async (job: Job<BillingJobData>) => this.processJob(job),
      {
        connection: config.connection,
        concurrency: config.concurrency || 5,
      }
    );

    this.setupEventHandlers();
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Process a billing job
   */
  private async processJob(job: Job<BillingJobData>): Promise<any> {
    const { data } = job;
    const { type } = data;

    console.log(`[BillingWorker] Processing job ${job.id} of type ${type}`);

    try {
      switch (type) {
        case 'renewal':
          return await this.handleRenewal(data);
        case 'dunning':
          return await this.handleDunning(data);
        case 'invoice':
          return await this.handleInvoice(data);
        case 'proration':
          return await this.handleProration(data);
        case 'webhook':
          return await this.handleWebhook(data);
        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error: any) {
      console.error(`[BillingWorker] Error processing job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Handle subscription renewal job
   */
  private async handleRenewal(data: BillingJobData): Promise<any> {
    if (!data.subscriptionId) {
      throw new Error('Subscription ID is required for renewal');
    }

    const result = await subscriptionService.processRenewal(data.subscriptionId);

    // Log result
    await this.logBillingEvent({
      type: 'renewal',
      subscriptionId: data.subscriptionId,
      status: result.success ? 'success' : 'failed',
      message: result.message,
    });

    return result;
  }

  /**
   * Handle dunning retry job
   */
  private async handleDunning(data: BillingJobData): Promise<any> {
    if (!data.attemptId) {
      throw new Error('Attempt ID is required for dunning');
    }

    const result = await dunningService.processRetry(data.attemptId);

    // Log result
    await this.logBillingEvent({
      type: 'dunning',
      attemptId: data.attemptId,
      status: result.success ? 'success' : 'failed',
      message: result.error || 'Retry completed',
    });

    return result;
  }

  /**
   * Handle invoice generation job
   */
  private async handleInvoice(data: BillingJobData): Promise<any> {
    if (!data.subscriptionId || !data.tenantId) {
      throw new Error('Subscription ID and Tenant ID are required for invoice');
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { id: data.subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId: data.tenantId,
        subscriptionId: data.subscriptionId,
        number: this.generateInvoiceNumber(),
        amount: data.amount || subscription.planId,
        currency: data.currency || 'MXN',
        status: 'OPEN',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });

    // Log result
    await this.logBillingEvent({
      type: 'invoice',
      invoiceId: invoice.id,
      status: 'created',
      message: `Invoice ${invoice.number} created`,
    });

    return { success: true, invoiceId: invoice.id };
  }

  /**
   * Handle proration calculation job
   */
  private async handleProration(data: BillingJobData): Promise<any> {
    if (!data.tenantId || !data.targetPlanId) {
      throw new Error('Tenant ID and Target Plan ID are required for proration');
    }

    const { prorationService } = await import('../services/proration.service');

    const isUpgrade = data.isUpgrade || false;
    const result = isUpgrade
      ? await prorationService.calculateUpgradeProration(data.tenantId, data.targetPlanId)
      : await prorationService.calculateDowngradeProration(data.tenantId, data.targetPlanId);

    // Log result
    await this.logBillingEvent({
      type: 'proration',
      tenantId: data.tenantId,
      status: 'calculated',
      message: `Proration calculated: ${result.netAmount}`,
    });

    return result;
  }

  /**
   * Handle webhook processing job
   */
  private async handleWebhook(data: BillingJobData): Promise<any> {
    if (!data.webhookPayload) {
      throw new Error('Webhook payload is required');
    }

    const payload = data.webhookPayload;
    const webhookId = payload.data?.id || payload.id;

    // Check for replay attacks
    const isReplay = await dunningService.checkReplay(webhookId, this.processedWebhooks);
    if (isReplay) {
      return { success: false, error: 'Duplicate webhook' };
    }

    // Process webhook
    const result = await this.mercadoPagoService.processWebhook(payload);

    // Log result
    await this.logBillingEvent({
      type: 'webhook',
      webhookId,
      status: result.success ? 'processed' : 'failed',
      message: result.action,
    });

    return result;
  }

  // ============================================
  // Job Scheduling Methods
  // ============================================

  /**
   * Schedule renewal job for subscription
   */
  async scheduleRenewal(
    subscriptionId: string,
    delay: number
  ): Promise<void> {
    const { Queue } = await import('bullmq');
    const billingQueue = new Queue('billing', {
      connection: this.worker.opts.connection,
    });

    await billingQueue.add(
      'renewal',
      { type: 'renewal', subscriptionId },
      { delay }
    );

    console.log(`[BillingWorker] Scheduled renewal for subscription ${subscriptionId}`);
  }

  /**
   * Schedule dunning retry job
   */
  async scheduleDunningRetry(
    attemptId: string,
    delay: number
  ): Promise<void> {
    const { Queue } = await import('bullmq');
    const billingQueue = new Queue('billing', {
      connection: this.worker.opts.connection,
    });

    await billingQueue.add(
      'dunning',
      { type: 'dunning', attemptId },
      { delay }
    );

    console.log(`[BillingWorker] Scheduled dunning retry ${attemptId}`);
  }

  /**
   * Schedule invoice generation job
   */
  async scheduleInvoice(
    subscriptionId: string,
    tenantId: string,
    amount: number,
    delay?: number
  ): Promise<void> {
    const { Queue } = await import('bullmq');
    const billingQueue = new Queue('billing', {
      connection: this.worker.opts.connection,
    });

    await billingQueue.add(
      'invoice',
      { type: 'invoice', subscriptionId, tenantId, amount },
      { delay: delay || 0 }
    );

    console.log(`[BillingWorker] Scheduled invoice for subscription ${subscriptionId}`);
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Setup worker event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job: Job, result: any) => {
      console.log(`[BillingWorker] Job ${job.id} completed:`, result);
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      console.error(`[BillingWorker] Job ${job?.id} failed:`, error);
    });

    this.worker.on('error', (error: Error) => {
      console.error('[BillingWorker] Worker error:', error);
    });
  }

  /**
   * Log billing event for audit
   */
  private async logBillingEvent(event: {
    type: string;
    subscriptionId?: string;
    attemptId?: string;
    invoiceId?: string;
    webhookId?: string;
    tenantId?: string;
    status: string;
    message: string;
  }): Promise<void> {
    // In production, this would write to a dedicated audit log table
    console.log(`[BillingWorker] Event logged:`, event);
  }

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}${month}-${random}`;
  }

  /**
   * Gracefully shutdown the worker
   */
  async close(): Promise<void> {
    await this.worker.close();
    console.log('[BillingWorker] Worker closed');
  }
}

// ============================================
// Worker Factory
// ============================================

export function createBillingWorker(config: BillingWorkerConfig): BillingWorker {
  return new BillingWorker(config);
}

// If running directly, start the worker
if (require.main === module) {
  const workerConfig: BillingWorkerConfig = {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    },
    concurrency: parseInt(process.env.BILLING_WORKER_CONCURRENCY || '5'),
  };

  const worker = createBillingWorker(workerConfig);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[BillingWorker] SIGTERM received, shutting down...');
    await worker.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[BillingWorker] SIGINT received, shutting down...');
    await worker.close();
    process.exit(0);
  });

  console.log('[BillingWorker] Worker started');
}
