/**
 * ProrationService - Cálculo de prorrateo para cambios de plan
 * FASE 1: Suscripciones Recurrentes
 */

import { PrismaClient } from '@prisma/client';
import { MercadoPagoService } from './mercadopago.service';

// ============================================
// Types & Interfaces
// ============================================

export interface ProrationCalculation {
  originalAmount: number;
  newAmount: number;
  proratedCredit: number;
  proratedCharge: number;
  netAmount: number;
  remainingDays: number;
  totalDays: number;
  currency: string;
}

export interface BillingCycleAdjustment {
  currentPeriodEnd: Date;
  newPeriodStart: Date;
  newPeriodEnd: Date;
  daysInCurrentCycle: number;
  daysRemaining: number;
  totalDays: number;
}

export interface ProratedInvoiceData {
  tenantId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  description: string;
  applyCredit: number;
}

// ============================================
// Proration Service
// ============================================

export class ProrationService {
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
   * Calculate prorated amount for plan upgrade
   */
  async calculateUpgradeProration(
    tenantId: string,
    targetPlanId: string
  ): Promise<ProrationCalculation> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const currentPlan = this.mercadoPagoService.getPlanById(subscription.planId);
    const targetPlan = this.mercadoPagoService.getPlanById(targetPlanId);

    if (!currentPlan || !targetPlan) {
      throw new Error('Plan not found');
    }

    const cycleInfo = this.getBillingCycleInfo(subscription);
    const priceDifference = targetPlan.price - currentPlan.price;

    // Calculate prorated charge
    const proratedCharge = (priceDifference * cycleInfo.daysRemaining) / cycleInfo.totalDays;

    return {
      originalAmount: currentPlan.price,
      newAmount: targetPlan.price,
      proratedCredit: 0,
      proratedCharge,
      netAmount: proratedCharge,
      remainingDays: cycleInfo.daysRemaining,
      totalDays: cycleInfo.totalDays,
      currency: currentPlan.currency,
    };
  }

  /**
   * Calculate prorated credit for plan downgrade
   */
  async calculateDowngradeProration(
    tenantId: string,
    targetPlanId: string
  ): Promise<ProrationCalculation> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const currentPlan = this.mercadoPagoService.getPlanById(subscription.planId);
    const targetPlan = this.mercadoPagoService.getPlanById(targetPlanId);

    if (!currentPlan || !targetPlan) {
      throw new Error('Plan not found');
    }

    const cycleInfo = this.getBillingCycleInfo(subscription);
    const priceDifference = currentPlan.price - targetPlan.price;

    // Calculate prorated credit
    const proratedCredit = (priceDifference * cycleInfo.daysRemaining) / cycleInfo.totalDays;

    return {
      originalAmount: currentPlan.price,
      newAmount: targetPlan.price,
      proratedCredit,
      proratedCharge: 0,
      netAmount: -proratedCredit,
      remainingDays: cycleInfo.daysRemaining,
      totalDays: cycleInfo.totalDays,
      currency: currentPlan.currency,
    };
  }

  /**
   * Calculate billing cycle adjustment
   */
  calculateBillingCycleAdjustment(
    currentPeriodEnd: Date,
    newPlanInterval: 'monthly' | 'yearly'
  ): BillingCycleAdjustment {
    const now = new Date();
    const periodEnd = new Date(currentPeriodEnd);
    const daysInCurrentCycle = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let newPeriodEnd = new Date(periodEnd);
    if (newPlanInterval === 'monthly') {
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    } else {
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
    }

    return {
      currentPeriodEnd: periodEnd,
      newPeriodStart: periodEnd,
      newPeriodEnd,
      daysInCurrentCycle,
      daysRemaining: Math.max(0, daysInCurrentCycle),
      totalDays: newPlanInterval === 'monthly' ? 30 : 365,
    };
  }

  /**
   * Apply proration credit to subscription
   */
  async applyProrationCredit(
    tenantId: string,
    creditAmount: number
  ): Promise<void> {
    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        prorationCredit: { increment: creditAmount },
      },
    });

    console.log(`[Proration] Applied credit of ${creditAmount} to tenant ${tenantId}`);
  }

  /**
   * Create prorated invoice
   */
  async createProratedInvoice(data: ProratedInvoiceData): Promise<string> {
    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId: data.tenantId,
        subscriptionId: data.subscriptionId,
        number: this.generateInvoiceNumber('PRORATED'),
        amount: data.amount,
        currency: data.currency,
        discount: data.applyCredit > 0 ? data.applyCredit : null,
        status: 'OPEN',
      },
    });

    console.log(`[Proration] Created prorated invoice ${invoice.number} for tenant ${data.tenantId}`);
    return invoice.id;
  }

  /**
   * Get billing cycle info for subscription
   */
  getBillingCycleInfo(subscription: any): {
    totalDays: number;
    daysRemaining: number;
    daysUsed: number;
  } {
    const now = new Date();
    const periodStart = subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart) : now;
    const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : now;

    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const daysUsed = totalDays - daysRemaining;

    return { totalDays, daysRemaining, daysUsed };
  }

  /**
   * Calculate prorated amount for partial month
   */
  calculateProratedAmount(
    fullAmount: number,
    daysInPeriod: number,
    daysRemaining: number
  ): number {
    return (fullAmount * daysRemaining) / daysInPeriod;
  }

  /**
   * Validate if proration should be applied
   */
  shouldApplyProration(subscription: any): boolean {
    // Don't prorate if no period info
    if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
      return false;
    }

    // Don't prorate if already near end of period (less than 3 days)
    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return daysRemaining >= 3;
  }

  /**
   * Get existing proration credit for subscription
   */
  async getProrationCredit(tenantId: string): Promise<number> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      select: { prorationCredit: true },
    });

    return subscription?.prorationCredit || 0;
  }

  /**
   * Use proration credit for invoice
   */
  async useProrationCredit(
    tenantId: string,
    invoiceAmount: number
  ): Promise<{
    remainingCredit: number;
    finalAmount: number;
  }> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription || !subscription.prorationCredit) {
      return { remainingCredit: 0, finalAmount: invoiceAmount };
    }

    const credit = Math.min(subscription.prorationCredit, invoiceAmount);
    const finalAmount = invoiceAmount - credit;
    const remainingCredit = subscription.prorationCredit - credit;

    // Update credit
    await this.prisma.subscription.update({
      where: { tenantId },
      data: { prorationCredit: remainingCredit },
    });

    return { remainingCredit, finalAmount };
  }

  // ============================================
  // Helper Methods
  // ============================================

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
}

// Export singleton instance
export const prorationService = new ProrationService();
