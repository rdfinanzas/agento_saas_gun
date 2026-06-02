/**
 * DunningService - Gestión de reintentos de pago fallidos
 * FASE 1: Suscripciones Recurrentes
 */

import { PrismaClient, SubscriptionStatus } from '@prisma/client';

// ============================================
// Types & Interfaces
// ============================================

export interface DunningConfig {
  maxRetries: number;
  retryIntervals: number[]; // In hours
  escalateAfterRetries: number;
  notificationTypes: ('email' | 'whatsapp' | 'sms')[];
}

export interface DunningAttemptResult {
  success: boolean;
  attemptNumber: number;
  nextRetryAt?: Date;
  shouldCancel: boolean;
  error?: string;
}

export interface DunningSummary {
  subscriptionId: string;
  tenantId: string;
  totalAttempts: number;
  lastAttemptAt: Date | null;
  status: string;
  nextRetryAt: Date | null;
}

// ============================================
// Dunning Service
// ============================================

export class DunningService {
  private prisma: PrismaClient;
  private config: DunningConfig;

  constructor(config?: Partial<DunningConfig>) {
    this.prisma = new PrismaClient();
    this.config = {
      maxRetries: 5,
      retryIntervals: [24, 48, 72, 120, 168], // Hours: 1d, 2d, 3d, 5d, 7d
      escalateAfterRetries: 3,
      notificationTypes: ['email', 'whatsapp'],
      ...config,
    };
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Start dunning process for subscription
   */
  async startDunning(subscriptionId: string): Promise<DunningAttemptResult> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { tenant: true },
      });

      if (!subscription) {
        return { success: false, attemptNumber: 0, shouldCancel: true, error: 'Subscription not found' };
      }

      // Update subscription status
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: SubscriptionStatus.PAST_DUE },
      });

      // Create first dunning attempt
      const nextRetryAt = this.calculateNextRetryDate(0);
      const attempt = await this.prisma.dunningAttempt.create({
        data: {
          subscriptionId,
          attemptNumber: 1,
          status: 'pending',
          nextRetryAt,
        },
      });

      // Send notification
      await this.sendNotification(subscription.tenantId, attempt.attemptNumber, nextRetryAt);

      console.log(`[Dunning] Started dunning for subscription ${subscriptionId}`);

      return {
        success: true,
        attemptNumber: 1,
        nextRetryAt,
        shouldCancel: false,
      };
    } catch (error: any) {
      console.error('[Dunning] Error starting dunning:', error);
      return { success: false, attemptNumber: 0, shouldCancel: false, error: error.message };
    }
  }

  /**
   * Process dunning retry attempt
   */
  async processRetry(attemptId: string): Promise<DunningAttemptResult> {
    try {
      const attempt = await this.prisma.dunningAttempt.findUnique({
        where: { id: attemptId },
        include: { subscription: true },
      });

      if (!attempt) {
        return { success: false, attemptNumber: 0, shouldCancel: true, error: 'Attempt not found' };
      }

      // Update attempt status
      await this.prisma.dunningAttempt.update({
        where: { id: attemptId },
        data: { status: 'in_progress' },
      });

      // Try to process payment (would integrate with payment processor)
      const paymentResult = await this.retryPayment(attempt.subscriptionId);

      if (paymentResult.success) {
        // Payment successful - end dunning
        await this.prisma.dunningAttempt.update({
          where: { id: attemptId },
          data: { status: 'success' },
        });

        await this.prisma.subscription.update({
          where: { id: attempt.subscriptionId },
          data: { status: SubscriptionStatus.ACTIVE },
        });

        // Send success notification
        await this.sendSuccessNotification(attempt.subscription.tenantId);

        return {
          success: true,
          attemptNumber: attempt.attemptNumber,
          shouldCancel: false,
        };
      } else {
        // Payment failed
        const shouldContinue = attempt.attemptNumber < this.config.maxRetries;

        if (shouldContinue) {
          // Schedule next retry
          const nextRetryAt = this.calculateNextRetryDate(attempt.attemptNumber);
          const nextAttemptNumber = attempt.attemptNumber + 1;

          await this.prisma.dunningAttempt.update({
            where: { id: attemptId },
            data: {
              status: 'failed',
              error: paymentResult.error,
            },
          });

          // Create next attempt
          await this.prisma.dunningAttempt.create({
            data: {
              subscriptionId: attempt.subscriptionId,
              attemptNumber: nextAttemptNumber,
              status: 'pending',
              nextRetryAt,
            },
          });

          // Send notification
          await this.sendNotification(
            attempt.subscription.tenantId,
            nextAttemptNumber,
            nextRetryAt
          );

          // Check if should escalate
          if (nextAttemptNumber >= this.config.escalateAfterRetries) {
            await this.escalateDunning(attempt.subscriptionId, nextAttemptNumber);
          }

          return {
            success: false,
            attemptNumber: attempt.attemptNumber,
            nextRetryAt,
            shouldCancel: false,
            error: paymentResult.error,
          };
        } else {
          // Max retries reached - cancel subscription
          await this.prisma.dunningAttempt.update({
            where: { id: attemptId },
            data: {
              status: 'failed',
              error: 'Max retries reached',
            },
          });

          await this.cancelSubscriptionDueToDunning(attempt.subscriptionId);

          return {
            success: false,
            attemptNumber: attempt.attemptNumber,
            shouldCancel: true,
            error: 'Max retries reached, subscription cancelled',
          };
        }
      }
    } catch (error: any) {
      console.error('[Dunning] Error processing retry:', error);
      return { success: false, attemptNumber: 0, shouldCancel: false, error: error.message };
    }
  }

  /**
   * Get pending dunning attempts
   */
  async getPendingAttempts(): Promise<any[]> {
    const now = new Date();
    return this.prisma.dunningAttempt.findMany({
      where: {
        status: 'pending',
        nextRetryAt: { lte: now },
      },
      include: {
        subscription: {
          include: { tenant: true },
        },
      },
      orderBy: { nextRetryAt: 'asc' },
    });
  }

  /**
   * Get dunning summary for subscription
   */
  async getDunningSummary(subscriptionId: string): Promise<DunningSummary | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      return null;
    }

    const attempts = await this.prisma.dunningAttempt.findMany({
      where: { subscriptionId },
      orderBy: { attemptNumber: 'desc' },
    });

    const latestAttempt = attempts[0];

    return {
      subscriptionId,
      tenantId: subscription.tenantId,
      totalAttempts: attempts.length,
      lastAttemptAt: latestAttempt?.attemptedAt || null,
      status: latestAttempt?.status || 'none',
      nextRetryAt: latestAttempt?.nextRetryAt || null,
    };
  }

  /**
   * Cancel dunning process (payment received externally)
   */
  async cancelDunning(subscriptionId: string): Promise<void> {
    // Update all pending attempts to cancelled
    await this.prisma.dunningAttempt.updateMany({
      where: {
        subscriptionId,
        status: 'pending',
      },
      data: { status: 'cancelled' },
    });

    // Update subscription status
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.ACTIVE },
    });

    console.log(`[Dunning] Cancelled dunning for subscription ${subscriptionId}`);
  }

  /**
   * Get all subscriptions in dunning
   */
  async getSubscriptionsInDunning(): Promise<any[]> {
    return this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.PAST_DUE },
      include: {
        tenant: {
          select: { name: true, email: true },
        },
        dunningAttempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
      },
    });
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Calculate next retry date based on attempt number
   */
  private calculateNextRetryDate(attemptNumber: number): Date {
    const hours = this.config.retryIntervals[Math.min(attemptNumber, this.config.retryIntervals.length - 1)];
    const nextRetry = new Date();
    nextRetry.setHours(nextRetry.getHours() + hours);
    return nextRetry;
  }

  /**
   * Retry payment (placeholder - would integrate with payment processor)
   */
  private async retryPayment(subscriptionId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    // This would integrate with MercadoPago to retry the payment
    // For now, return failure
    return {
      success: false,
      error: 'Payment retry failed',
    };
  }

  /**
   * Send notification to tenant
   */
  private async sendNotification(
    tenantId: string,
    attemptNumber: number,
    nextRetryAt: Date
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) return;

    // Determine notification message based on attempt number
    let message: string;
    if (attemptNumber === 1) {
      message = 'Your payment failed. Please update your payment method.';
    } else if (attemptNumber === this.config.maxRetries) {
      message = 'Final payment attempt. Your subscription will be cancelled if payment fails.';
    } else {
      message = `Payment attempt ${attemptNumber} failed. Next retry scheduled for ${nextRetryAt.toLocaleDateString()}.`;
    }

    // Send notifications based on configured types
    for (const type of this.config.notificationTypes) {
      // Implement actual notification sending
      console.log(`[Dunning] Sending ${type} notification to tenant ${tenantId}: ${message}`);
    }
  }

  /**
   * Send success notification
   */
  private async sendSuccessNotification(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) return;

    const message = 'Your payment was successful. Your subscription has been reactivated.';

    for (const type of this.config.notificationTypes) {
      console.log(`[Dunning] Sending ${type} success notification to tenant ${tenantId}: ${message}`);
    }
  }

  /**
   * Escalate dunning process
   */
  private async escalateDunning(subscriptionId: string, attemptNumber: number): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { tenant: true },
    });

    if (!subscription) return;

    // Escalate to admin/support team
    console.log(`[Dunning] Escalating subscription ${subscriptionId} after ${attemptNumber} attempts`);

    // Send notification to support team
    // This would integrate with a notification system
  }

  /**
   * Cancel subscription due to dunning failure
   */
  private async cancelSubscriptionDueToDunning(subscriptionId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) return;

    // Cancel subscription
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        autoRenew: false,
      },
    });

    // Downgrade tenant to free
    await this.prisma.tenant.update({
      where: { id: subscription.tenantId },
      data: {
        subscriptionTier: 'FREE',
        quotaMaxRequests: 1000,
        quotaMaxStorage: BigInt(1073741824), // 1GB
      },
    });

    // Send final notification
    await this.sendFinalCancellationNotification(subscription.tenantId);

    console.log(`[Dunning] Cancelled subscription ${subscriptionId} due to payment failure`);
  }

  /**
   * Send final cancellation notification
   */
  private async sendFinalCancellationNotification(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) return;

    const message = 'Your subscription has been cancelled due to repeated payment failures.';

    for (const type of this.config.notificationTypes) {
      console.log(`[Dunning] Sending ${type} cancellation notification to tenant ${tenantId}: ${message}`);
    }
  }
}

// Export singleton instance
export const dunningService = new DunningService();
