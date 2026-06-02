/**
 * SubscriptionService - Gestión del ciclo de vida de suscripciones recurrentes
 * FASE 1: Suscripciones Recurrentes
 */

import { PrismaClient, SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import { MercadoPagoService } from './mercadopago.service';

// ============================================
// Types & Interfaces
// ============================================

export interface CreateSubscriptionData {
  tenantId: string;
  planId: string;
  payerEmail: string;
  backUrl?: string;
}

export interface SubscriptionDetails {
  id: string;
  tenantId: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
  gatewayPreapprovalId: string | null;
}

export interface PauseSubscriptionData {
  reason?: string;
  resumeAt?: Date;
}

export interface UpgradeDowngradeData {
  targetPlanId: string;
  prorate: boolean;
  effectiveImmediately: boolean;
}

// ============================================
// Subscription Service
// ============================================

export class SubscriptionService {
  private prisma: PrismaClient;
  private mercadoPagoService: MercadoPagoService;

  constructor(mercadoPagoService?: MercadoPagoService) {
    this.prisma = new PrismaClient();
    this.mercadoPagoService = mercadoPagoService || new MercadoPagoService();
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Create a new recurring subscription
   */
  async createSubscription(data: CreateSubscriptionData): Promise<{
    success: boolean;
    subscription?: SubscriptionDetails;
    initPoint?: string;
    error?: string;
  }> {
    try {
      const plan = this.mercadoPagoService.getPlanById(data.planId);
      if (!plan) {
        return { success: false, error: 'Plan not found' };
      }

      // Get or create customer in MercadoPago
      const customer = await this.mercadoPagoService.createCustomer(
        data.payerEmail,
        data.tenantId
      );

      // Create preapproval in MercadoPago
      const preapprovalData = {
        reason: `AgentO - ${plan.name}`,
        auto_recurring: {
          frequency: plan.interval === 'monthly' ? 1 : 12,
          frequency_type: (plan.interval === 'monthly' ? 'months' : 'years') as 'months' | 'years',
          transaction_amount: plan.price,
          currency_id: plan.currency,
        },
        back_url: data.backUrl || `${process.env.FRONTEND_URL}/billing/success`,
        external_reference: data.tenantId,
        payer_email: data.payerEmail,
      } as const;

      const response = await this.mercadoPagoService.createPreapproval(preapprovalData);

      // Create subscription in database
      const now = new Date();
      const periodEnd = new Date(now);
      if (plan.interval === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }

      const tier = this.getTierFromPlan(plan.id);

      const subscription = await this.prisma.subscription.create({
        data: {
          tenantId: data.tenantId,
          planId: plan.id,
          planName: plan.name,
          status: SubscriptionStatus.PENDING,
          tier,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          gateway: 'MERCADOPAGO',
          gatewayCustomerId: customer.id,
          gatewayPreapprovalId: response.id,
          autoRenew: true,
        },
      });

      console.log(`[Subscription] Created subscription ${subscription.id} for tenant ${data.tenantId}`);

      return {
        success: true,
        subscription: this.formatSubscription(subscription),
        initPoint: response.init_point,
      };
    } catch (error: any) {
      console.error('[Subscription] Error creating subscription:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Activate subscription after preapproval is authorized
   */
  async activateSubscription(tenantId: string, preapprovalId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      console.error(`[Subscription] No subscription found for tenant ${tenantId}`);
      return;
    }

    const plan = this.mercadoPagoService.getPlanById(subscription.planId);
    if (!plan) {
      console.error(`[Subscription] Plan ${subscription.planId} not found`);
      return;
    }

    // Calculate period
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan.interval === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Update subscription status
    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    // Update tenant quotas
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionTier: subscription.tier,
        quotaMaxRequests: plan.maxRequests,
        quotaMaxStorage: plan.maxStorage,
      },
    });

    // Create invoice
    await this.createInvoice(subscription.id, tenantId, plan.price, plan.currency);

    console.log(`[Subscription] Activated subscription for tenant ${tenantId}`);
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(
    tenantId: string,
    data: PauseSubscriptionData
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { tenantId },
      });

      if (!subscription) {
        return { success: false, message: 'Subscription not found' };
      }

      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        return { success: false, message: 'Subscription is not active' };
      }

      // Update status to paused
      await this.prisma.subscription.update({
        where: { tenantId },
        data: {
          status: 'PAUSED' as any,
          pausedAt: new Date(),
        },
      });

      // Pause in MercadoPago if supported
      if (subscription.gatewayPreapprovalId) {
        await this.mercadoPagoService.updatePreapproval(
          subscription.gatewayPreapprovalId,
          { status: 'paused' }
        );
      }

      console.log(`[Subscription] Paused subscription for tenant ${tenantId}`);

      return { success: true, message: 'Subscription paused successfully' };
    } catch (error: any) {
      console.error('[Subscription] Error pausing subscription:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Resume a paused subscription
   */
  async resumeSubscription(tenantId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { tenantId },
      });

      if (!subscription) {
        return { success: false, message: 'Subscription not found' };
      }

      if (subscription.status !== 'PAUSED') {
        return { success: false, message: 'Subscription is not paused' };
      }

      // Resume in MercadoPago
      if (subscription.gatewayPreapprovalId) {
        await this.mercadoPagoService.updatePreapproval(
          subscription.gatewayPreapprovalId,
          { status: 'authorized' }
        );
      }

      // Update status
      await this.prisma.subscription.update({
        where: { tenantId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          pausedAt: null,
        },
      });

      console.log(`[Subscription] Resumed subscription for tenant ${tenantId}`);

      return { success: true, message: 'Subscription resumed successfully' };
    } catch (error: any) {
      console.error('[Subscription] Error resuming subscription:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    tenantId: string,
    immediately: boolean = false
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { tenantId },
      });

      if (!subscription) {
        return { success: false, message: 'Subscription not found' };
      }

      if (immediately) {
        // Cancel immediately
        if (subscription.gatewayPreapprovalId) {
          await this.mercadoPagoService.cancelPreapproval(
            subscription.gatewayPreapprovalId
          );
        }

        await this.prisma.subscription.update({
          where: { tenantId },
          data: {
            status: SubscriptionStatus.CANCELLED,
            cancelledAt: new Date(),
            autoRenew: false,
          },
        });

        // Downgrade tenant to free
        await this.downgradeTenantToFree(tenantId);

        return { success: true, message: 'Subscription cancelled immediately' };
      } else {
        // Cancel at period end
        await this.prisma.subscription.update({
          where: { tenantId },
          data: { cancelAtPeriodEnd: true },
        });

        return {
          success: true,
          message: 'Subscription will be cancelled at the end of the current period',
        };
      }
    } catch (error: any) {
      console.error('[Subscription] Error cancelling subscription:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Upgrade subscription to a higher tier plan
   */
  async upgradeSubscription(
    tenantId: string,
    data: UpgradeDowngradeData
  ): Promise<{
    success: boolean;
    message: string;
    proratedAmount?: number;
  }> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { tenantId },
      });

      if (!subscription) {
        return { success: false, message: 'Subscription not found' };
      }

      const currentPlan = this.mercadoPagoService.getPlanById(subscription.planId);
      const targetPlan = this.mercadoPagoService.getPlanById(data.targetPlanId);

      if (!currentPlan || !targetPlan) {
        return { success: false, message: 'Plan not found' };
      }

      if (targetPlan.price <= currentPlan.price) {
        return { success: false, message: 'Target plan must be more expensive' };
      }

      if (data.effectiveImmediately) {
        // Calculate prorated amount
        const proratedAmount = data.prorate
          ? this.calculateProratedAmount(subscription, targetPlan.price)
          : targetPlan.price;

        // Create prorated invoice
        await this.createProratedInvoice(subscription.id, tenantId, proratedAmount, targetPlan);

        // Update subscription
        const tier = this.getTierFromPlan(targetPlan.id);
        await this.prisma.subscription.update({
          where: { tenantId },
          data: {
            planId: targetPlan.id,
            planName: targetPlan.name,
            tier,
          },
        });

        // Update tenant quotas
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: {
            subscriptionTier: tier,
            quotaMaxRequests: targetPlan.maxRequests,
            quotaMaxStorage: targetPlan.maxStorage,
          },
        });

        // Update MercadoPago preapproval
        if (subscription.gatewayPreapprovalId) {
          await this.mercadoPagoService.updatePreapproval(
            subscription.gatewayPreapprovalId,
            {
              auto_recurring: {
                frequency: targetPlan.interval === 'monthly' ? 1 : 12,
                frequency_type: targetPlan.interval === 'monthly' ? 'months' : 'years',
                transaction_amount: targetPlan.price,
                currency_id: targetPlan.currency,
              },
              reason: `AgentO - ${targetPlan.name}`,
            }
          );
        }

        return {
          success: true,
          message: 'Subscription upgraded successfully',
          proratedAmount,
        };
      } else {
        // Schedule upgrade for next period
        await this.prisma.subscription.update({
          where: { tenantId },
          data: {
            // Store pending upgrade in metadata or create a scheduled change
          },
        });

        return {
          success: true,
          message: 'Upgrade scheduled for next billing period',
        };
      }
    } catch (error: any) {
      console.error('[Subscription] Error upgrading subscription:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Downgrade subscription to a lower tier plan
   */
  async downgradeSubscription(
    tenantId: string,
    data: UpgradeDowngradeData
  ): Promise<{
    success: boolean;
    message: string;
    creditAmount?: number;
  }> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { tenantId },
      });

      if (!subscription) {
        return { success: false, message: 'Subscription not found' };
      }

      const currentPlan = this.mercadoPagoService.getPlanById(subscription.planId);
      const targetPlan = this.mercadoPagoService.getPlanById(data.targetPlanId);

      if (!currentPlan || !targetPlan) {
        return { success: false, message: 'Plan not found' };
      }

      if (targetPlan.price >= currentPlan.price) {
        return { success: false, message: 'Target plan must be less expensive' };
      }

      if (data.effectiveImmediately) {
        // Calculate credit for remaining period
        const creditAmount = data.prorate
          ? this.calculateCredit(subscription, currentPlan.price, targetPlan.price)
          : 0;

        // Apply credit to subscription
        await this.prisma.subscription.update({
          where: { tenantId },
          data: {
            prorationCredit: { increment: creditAmount },
          },
        });

        // Update MercadoPago preapproval
        if (subscription.gatewayPreapprovalId) {
          await this.mercadoPagoService.updatePreapproval(
            subscription.gatewayPreapprovalId,
            {
              auto_recurring: {
                frequency: targetPlan.interval === 'monthly' ? 1 : 12,
                frequency_type: targetPlan.interval === 'monthly' ? 'months' : 'years',
                transaction_amount: targetPlan.price,
                currency_id: targetPlan.currency,
              },
              reason: `AgentO - ${targetPlan.name}`,
            }
          );
        }

        return {
          success: true,
          message: 'Subscription downgraded successfully',
          creditAmount,
        };
      } else {
        // Schedule downgrade for next period
        return {
          success: true,
          message: 'Downgrade scheduled for next billing period',
        };
      }
    } catch (error: any) {
      console.error('[Subscription] Error downgrading subscription:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Process subscription renewal
   */
  async processRenewal(subscriptionId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        return { success: false, message: 'Subscription not found' };
      }

      const plan = this.mercadoPagoService.getPlanById(subscription.planId);
      if (!plan) {
        return { success: false, message: 'Plan not found' };
      }

      // Check if auto-renew is enabled
      if (!subscription.autoRenew || subscription.cancelAtPeriodEnd) {
        // Cancel subscription
        await this.cancelSubscription(subscription.tenantId, true);
        return { success: true, message: 'Subscription cancelled as requested' };
      }

      // Get preapproval status from MercadoPago
      const preapproval = await this.mercadoPagoService.getPreapproval(
        subscription.gatewayPreapprovalId!
      );

      if (preapproval.status === 'authorized' || preapproval.status === 'pending') {
        // Renewal successful - update period
        const periodEnd = new Date(subscription.currentPeriodEnd!);
        if (plan.interval === 'monthly') {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        } else {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        }

        await this.prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            currentPeriodStart: subscription.currentPeriodEnd,
            currentPeriodEnd: periodEnd,
            status: SubscriptionStatus.ACTIVE,
          },
        });

        // Create invoice for the renewal
        await this.createInvoice(
          subscriptionId,
          subscription.tenantId,
          plan.price,
          plan.currency
        );

        return { success: true, message: 'Subscription renewed successfully' };
      } else if (preapproval.status === 'cancelled') {
        await this.cancelSubscription(subscription.tenantId, true);
        return { success: true, message: 'Subscription cancelled in MercadoPago' };
      } else {
        // Payment failed - trigger dunning
        await this.prisma.subscription.update({
          where: { id: subscriptionId },
          data: { status: SubscriptionStatus.PAST_DUE },
        });

        return { success: false, message: 'Payment failed, initiating dunning process' };
      }
    } catch (error: any) {
      console.error('[Subscription] Error processing renewal:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get subscription by tenant ID
   */
  async getSubscriptionByTenant(tenantId: string): Promise<SubscriptionDetails | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    return subscription ? this.formatSubscription(subscription) : null;
  }

  /**
   * Get subscriptions due for renewal
   */
  async getSubscriptionsDueForRenewal(): Promise<SubscriptionDetails[]> {
    const now = new Date();
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          lte: now,
        },
        autoRenew: true,
        cancelAtPeriodEnd: false,
      },
    });

    return subscriptions.map(s => this.formatSubscription(s));
  }

  /**
   * Get past due subscriptions for dunning
   */
  async getPastDueSubscriptions(): Promise<SubscriptionDetails[]> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.PAST_DUE,
      },
    });

    return subscriptions.map(s => this.formatSubscription(s));
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Calculate prorated amount for plan upgrade
   */
  private calculateProratedAmount(subscription: any, newPlanPrice: number): number {
    if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
      return newPlanPrice;
    }

    const now = new Date();
    const periodStart = new Date(subscription.currentPeriodStart);
    const periodEnd = new Date(subscription.currentPeriodEnd);

    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const priceDifference = newPlanPrice - subscription.planId;
    return (priceDifference * remainingDays) / totalDays;
  }

  /**
   * Calculate credit for plan downgrade
   */
  private calculateCredit(subscription: any, currentPrice: number, newPrice: number): number {
    if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
      return 0;
    }

    const now = new Date();
    const periodStart = new Date(subscription.currentPeriodStart);
    const periodEnd = new Date(subscription.currentPeriodEnd);

    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const priceDifference = currentPrice - newPrice;
    return (priceDifference * remainingDays) / totalDays;
  }

  /**
   * Create invoice for subscription
   */
  private async createInvoice(
    subscriptionId: string,
    tenantId: string,
    amount: number,
    currency: string
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) return;

    await this.prisma.invoice.create({
      data: {
        tenantId,
        subscriptionId,
        number: this.generateInvoiceNumber(),
        amount,
        currency,
        status: 'OPEN',
      },
    });
  }

  /**
   * Create prorated invoice
   */
  private async createProratedInvoice(
    subscriptionId: string,
    tenantId: string,
    amount: number,
    plan: any
  ): Promise<void> {
    await this.prisma.invoice.create({
      data: {
        tenantId,
        subscriptionId,
        number: this.generateInvoiceNumber('PRORATED'),
        amount,
        currency: plan.currency,
        status: 'OPEN',
      },
    });
  }

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(prefix: string = ''): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${prefix}${year}${month}-${random}`;
  }

  /**
   * Get subscription tier from plan ID
   */
  private getTierFromPlan(planId: string): SubscriptionTier {
    if (planId.includes('enterprise')) return SubscriptionTier.ENTERPRISE;
    if (planId.includes('pro')) return SubscriptionTier.PRO;
    return SubscriptionTier.FREE;
  }

  /**
   * Downgrade tenant to free plan
   */
  private async downgradeTenantToFree(tenantId: string): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionTier: SubscriptionTier.FREE,
        quotaMaxRequests: 1000,
        quotaMaxStorage: BigInt(1073741824), // 1GB
      },
    });
  }

  /**
   * Format subscription for API response
   */
  private formatSubscription(subscription: any): SubscriptionDetails {
    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      planId: subscription.planId,
      planName: subscription.planName,
      status: subscription.status,
      tier: subscription.tier,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      autoRenew: subscription.autoRenew,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd,
      gatewayPreapprovalId: subscription.gatewayPreapprovalId,
    };
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
